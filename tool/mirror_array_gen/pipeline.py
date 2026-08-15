"""Pipeline completa: config JSON -> assegnazioni -> STL partizionati + report."""
import json
import math
import os
import numpy as np

from . import optics, matching, geometry
from .textraster import rasterize
from .solar import solar_position
from .validation import validate_config

MAX_TILT_DEG = 32.0


def resolve_light(cfg):
    light = dict(cfg["light"])
    if light["mode"] == "sun" and light["sun"].get("auto"):
        from datetime import datetime, timezone
        s = light["sun"]
        raw = str(s["datetime_utc"]).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        light["day_of_year"] = dt.timetuple().tm_yday
        elev, az_north = solar_position(dt, s["lat"], s["lon"])
        if elev <= 0:
            raise ValueError(f"The sun is below the horizon ({elev:.1f} deg) "
                             "a quella data/ora: scegli un altro momento.")
        # azimut relativo = azimut sole - azimut della direzione di proiezione
        light["sun"]["elevation_deg"] = elev
        # rel = 0 quando il sole e' esattamente alle spalle dell'osservatore
        rel = (az_north - s.get("projection_azimuth_deg", 180.0)) % 360.0 - 180.0
        light["sun"]["azimuth_rel_deg"] = rel
    return light


def compute_assignments(cfg):
    """Ritorna (rows, ctx). Se device.tilt_deg == "auto", l'inclinazione del
    dispositivo viene scelta come rotazione (attorno a x) della normale media:
    e' la posa naturale in cui terrai in mano l'array, e minimizza le
    inclinazioni locali dei pilastri (miglioria rispetto all'originale)."""
    validate_config(cfg)
    if cfg["device"].get("tilt_deg") == "auto":
        probe = json.loads(json.dumps(cfg))
        probe["device"]["tilt_deg"] = 0.0
        rows0, _ = _compute(probe)
        mean_n = np.mean([r["normal_world"] for r in rows0], axis=0)
        tilt = math.degrees(math.atan2(mean_n[1], mean_n[2]))
        cfg = json.loads(json.dumps(cfg))
        cfg["device"]["tilt_deg"] = tilt
        print(f"  [info] auto array tilt: {tilt:.1f} deg "
              "(0 = horizontal, 90 = vertical facing forward)")
    rows, ctx = _compute(cfg)
    # vincolo fisico: la luce deve colpire il FRONTE dell'array (mai il retro)
    if any(r["v_dot_z"] <= 0.05 for r in rows):
        raise ValueError("Light comes from behind the array: a mirror is not a "
                         "window. Use device.tilt_deg = \"auto\" or rotate the array.")
    exp = math.degrees(math.acos(max(-1.0, min(1.0, min(r["v_dot_z"] for r in rows)))))
    if exp > 60.0:
        print(f"  [warning] luce a {exp:.0f} gradi dal fronte dell'array: esposizione "
              "debole, riduci l'angolo.")
    return rows, ctx


def _compute(cfg):
    dev = cfg["device"]
    grid = dev["grid"]
    spacing = dev["mirror_width_mm"] + dev["gap_mm"]
    if grid["type"] == "hex":
        offsets = matching.hex_grid(grid["radius"], spacing)
    else:
        offsets = matching.square_grid(grid["cols"], grid["rows"], spacing)

    targets2d, unknown = rasterize(cfg["text"]["string"], cfg["text"]["pitch_cm"] / 100.0)
    if unknown:
        print(f"  [warning] caratteri ignorati dal font: {unknown}")

    light = resolve_light(cfg)
    center = np.asarray(dev["center_m"], float)
    P0, n_v, r, s = optics.focal_plane_frame(cfg["plane"]["distance_m"],
                                             cfg["plane"]["tilt_deg"], center,
                                             cfg["plane"].get("center_height_m"),
                                             cfg["plane"].get("ceiling_height_m"))
    fh = cfg["text"].get("flip_h", False)
    fv = cfg["text"].get("flip_v", False)
    t3d = np.array([P0 + (-a if fh else a) * r + (-b if fv else b) * s
                    for a, b in targets2d])

    assign = matching.match(offsets, targets2d)
    X, Y, Z = optics.device_frame(dev["tilt_deg"])
    rows = []
    for i, (a, b) in enumerate(offsets):
        mp = center + (a / 1000.0) * X + (b / 1000.0) * Y
        tp = t3d[assign[i]]
        v = optics.to_light_vector(mp, light)
        n_w = optics.mirror_normal(mp, tp, v)
        n_l = np.array([np.dot(n_w, X), np.dot(n_w, Y), np.dot(n_w, Z)])
        tilt = math.degrees(math.acos(min(1.0, abs(n_l[2]))))
        # verifica: il raggio riflesso colpisce il bersaglio
        hit, path = optics.intersect_plane(mp, optics.reflect(-v, n_w), P0, n_v)
        err = np.linalg.norm(hit - tp)
        inc = math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(v, n_w))))))
        v_dot_z = float(np.dot(v, Z))
        t_dot_z = float(np.dot(optics.normalize(tp - mp), Z))
        rows.append(dict(i=i, inc_deg=inc, v_dot_z=v_dot_z, t_dot_z=t_dot_z,
                         offset_mm=[a, b], mirror_world_m=mp.tolist(),
                         target_world_m=tp.tolist(), normal_world=n_w.tolist(),
                         normal_local=n_l.tolist(), tilt_deg=tilt,
                         path_m=path, hit_err_m=err,
                         spot_r_m=optics.spot_radius_m(light, mp,
                                                       dev["mirror_width_mm"] / 1000.0, path, slope_mrad=cfg.get("photometry", {}).get("slope_error_mrad", 0.0))))
    return rows, dict(light=light, P0=P0, n_v=n_v, r=r, s=s, offsets=offsets,
                      targets2d=targets2d, assign=assign, tilt_deg=dev["tilt_deg"])


def occlusion_fraction(cfg, rows, ctx):
    """Frazione dei bersagli nascosti all'osservatore dal pannello dell'array
    (che ha una superficie reale, non e' un punto). Richiede cfg["observer"]."""
    obs = cfg.get("observer")
    if not obs:
        return None
    dev = cfg["device"]
    _, _, Z = optics.device_frame(ctx["tilt_deg"])
    center = np.asarray(dev["center_m"], float)
    a_r = (np.max(np.linalg.norm(ctx["offsets"], axis=1)) + dev["mirror_width_mm"] / 2) / 1000.0 + 0.02
    eye = np.array([center[0], center[1] - float(obs["behind_m"]), float(obs["eye_height_m"])])
    occ = 0
    for row in rows:
        tp = np.asarray(row["target_world_m"], float)
        d = tp - eye
        den = float(np.dot(d, Z))
        if abs(den) < 1e-9:
            continue
        tt = float(np.dot(center - eye, Z)) / den
        if 1e-4 < tt < 1 - 1e-4 and np.linalg.norm(eye + tt * d - center) <= a_r:
            occ += 1
    return occ / max(1, len(rows))


def footprint_xy(footprint_mm, shape):
    """Ingombro del pilastro lungo x e y. L'esagono (piatto-su-piatto lungo x)
    e' piu' largo sulle punte: 2/sqrt(3) volte l'apotema doppia."""
    fp = float(footprint_mm)
    return (fp, fp * 2.0 / math.sqrt(3.0)) if shape == "hex" else (fp, fp)


def partition(offsets, footprint_mm, bed_wh_mm, shape="hex"):
    """Assegna ogni pilastro a una piastrella del piatto di stampa.

    I pilastri sono assegnati per centro, ma ciascuno sporge footprint/2 oltre
    il proprio centro: la cella utile per i CENTRI deve quindi essere
    (piatto - footprint), altrimenti la tessera stampata eccede il piano.
    """
    offsets = np.asarray(offsets, dtype=float)
    if offsets.ndim != 2 or offsets.shape[1] != 2 or len(offsets) == 0:
        raise ValueError("invalid offsets")
    bw, bh = float(bed_wh_mm[0]), float(bed_wh_mm[1])
    fpx, fpy = footprint_xy(footprint_mm, shape)
    if bw <= fpx or bh <= fpy:
        raise ValueError(
            f"Print bed {bw:.0f}x{bh:.0f} mm is too small: a single pillar "
            f"takes {fpx:.1f}x{fpy:.1f} mm")
    ux, uy = bw - fpx, bh - fpy        # larghezza utile per i centri
    cx0 = float(offsets[:, 0].min())
    cy0 = float(offsets[:, 1].min())
    nx = max(1, int(math.ceil((float(offsets[:, 0].max()) - cx0) / ux)))
    ny = max(1, int(math.ceil((float(offsets[:, 1].max()) - cy0) / uy)))
    tiles = {}
    for idx, (a, b) in enumerate(offsets):
        tx = min(nx - 1, max(0, int(math.floor((a - cx0) / ux))))
        ty = min(ny - 1, max(0, int(math.floor((b - cy0) / uy))))
        tiles.setdefault((tx, ty), []).append(idx)
    return tiles, (nx, ny)


def generate(cfg, out_dir, bed_wh_mm=(220.0, 220.0)):
    os.makedirs(out_dir, exist_ok=True)
    rows, ctx = compute_assignments(cfg)
    dev, pil = cfg["device"], cfg.get("pillar", {})
    margin = pil.get("margin_mm", 1.0)
    needed = geometry.required_top_height([r["normal_local"] for r in rows],
                                          dev["mirror_shape"],
                                          dev["mirror_width_mm"] + 2 * margin)
    top_h = max(pil.get("base_height_mm", 12.0), needed)
    if top_h > pil.get("base_height_mm", 12.0):
        print(f"  [info] pillar height raised to {top_h:.1f} mm to "
              "accommodate the required tilts.")
    aligner = pil.get("aligner", True)
    footprint = dev["mirror_width_mm"] + 2 * margin + dev["gap_mm"]

    max_err = max(r["hit_err_m"] for r in rows)
    if max_err > 1e-6:
        raise AssertionError(f"Optical self-check failed: error {max_err:.2e} m")
    occ = occlusion_fraction(cfg, rows, ctx)
    if occ:
        print(f"  [warning] the array panel blocks the viewer's line of sight: "
              f"{occ*100:.0f}% of the dots are hidden. Change the array/text height or position.")
    worst_inc = max(r["inc_deg"] for r in rows)
    if worst_inc > 60.0:
        print(f"  [warning] incidenza radente ({worst_inc:.0f} deg dalla normale): "
              "the mirrors will catch very little light. With a low sun, "
              "aim the projection TOWARD the sun (projection azimuth ~ sun azimuth).")
    steep = [r for r in rows if r["tilt_deg"] > MAX_TILT_DEG]
    if steep:
        print(f"  [warning] {len(steep)} pillars tilted more than {MAX_TILT_DEG} deg "
              f"(max {max(r['tilt_deg'] for r in steep):.1f} deg): "
              "consider tilting the array or moving the target closer.")

    if cfg.get("assignments"):
        provided = np.array([a["normal_local"] for a in cfg["assignments"]])
        ours = np.array([r["normal_local"] for r in rows])
        if provided.shape == ours.shape:
            dev_max = float(np.abs(provided - ours).max())
            status = "OK" if dev_max < 1e-4 else "DIVERGENZA! Controlla i parametri."
            print(f"  Cross-check against the web app: max deviation {dev_max:.2e} ({status})")

    tiles, (nx, ny) = partition(ctx["offsets"], footprint, bed_wh_mm, dev["mirror_shape"])
    files = []
    for (tx, ty), idxs in sorted(tiles.items()):
        tris = []
        for i in idxs:
            tris += geometry.pillar(rows[i]["offset_mm"], rows[i]["normal_local"],
                                    dev["mirror_shape"], dev["mirror_width_mm"],
                                    margin, top_h, aligner)
            tris += geometry.base_pad(rows[i]["offset_mm"], dev["mirror_shape"], footprint)
        name = f"array_tile_{tx}_{ty}.stl" if len(tiles) > 1 else "array.stl"
        path = os.path.join(out_dir, name)
        ntri = geometry.write_stl(tris, path)
        files.append((path, len(idxs), ntri))

    from .report import save_report
    report_path = os.path.join(out_dir, "report.png")
    save_report(rows, ctx, cfg, report_path)

    with open(os.path.join(out_dir, "assignments.json"), "w") as f:
        json.dump(rows, f, indent=1)
    return rows, files, report_path
