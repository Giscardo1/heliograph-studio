"""Pipeline completa: config JSON -> assegnazioni -> STL partizionati + report."""
import json
import math
import os
import numpy as np

from . import optics, matching, geometry
from .textraster import rasterize
from .solar import solar_position

MAX_TILT_DEG = 32.0


def resolve_light(cfg):
    light = dict(cfg["light"])
    if light["mode"] == "sun" and light["sun"].get("auto"):
        from datetime import datetime, timezone
        s = light["sun"]
        dt = datetime.fromisoformat(s["datetime_utc"]).replace(tzinfo=timezone.utc)
        elev, az_north = solar_position(dt, s["lat"], s["lon"])
        if elev <= 0:
            raise ValueError(f"Il sole e' sotto l'orizzonte ({elev:.1f} deg) "
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
    if cfg["device"].get("tilt_deg") == "auto":
        probe = json.loads(json.dumps(cfg))
        probe["device"]["tilt_deg"] = 0.0
        rows0, _ = _compute(probe)
        mean_n = np.mean([r["normal_world"] for r in rows0], axis=0)
        tilt = math.degrees(math.atan2(mean_n[1], mean_n[2]))
        cfg = json.loads(json.dumps(cfg))
        cfg["device"]["tilt_deg"] = tilt
        print(f"  [info] inclinazione dispositivo auto: {tilt:.1f} deg "
              "(0 = orizzontale, 90 = verticale rivolto in avanti)")
    rows, ctx = _compute(cfg)
    # vincolo fisico: la luce deve colpire il FRONTE dell'array (mai il retro)
    if any(r["v_dot_z"] <= 0.05 for r in rows):
        raise ValueError("La luce arriva da dietro l'array: uno specchio non e' un "
                         "vetro. Usa device.tilt_deg = \"auto\" o ruota il dispositivo.")
    exp = math.degrees(math.acos(max(-1.0, min(1.0, min(r["v_dot_z"] for r in rows)))))
    if exp > 60.0:
        print(f"  [avviso] luce a {exp:.0f} gradi dal fronte dell'array: esposizione "
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
        print(f"  [avviso] caratteri ignorati dal font: {unknown}")

    light = resolve_light(cfg)
    center = np.asarray(dev["center_m"], float)
    P0, n_v, r, s = optics.focal_plane_frame(cfg["plane"]["distance_m"],
                                             cfg["plane"]["tilt_deg"], center,
                                             cfg["plane"].get("center_height_m"))
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
                                                       dev["mirror_width_mm"] / 1000.0, path)))
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


def partition(offsets, footprint_mm, bed_wh_mm):
    """Assegna ogni pilastro a una piastrella del piatto di stampa."""
    half = footprint_mm / 2.0
    xmin, ymin = offsets.min(axis=0) - half
    xmax, ymax = offsets.max(axis=0) + half
    bw, bh = bed_wh_mm
    nx = max(1, math.ceil((xmax - xmin) / bw))
    ny = max(1, math.ceil((ymax - ymin) / bh))
    tiles = {}
    for idx, (a, b) in enumerate(offsets):
        tx = min(nx - 1, int((a - xmin) / bw))
        ty = min(ny - 1, int((b - ymin) / bh))
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
        print(f"  [info] altezza pilastri portata a {top_h:.1f} mm per "
              "accomodare le inclinazioni richieste.")
    aligner = pil.get("aligner", True)
    footprint = dev["mirror_width_mm"] + 2 * margin + dev["gap_mm"]

    max_err = max(r["hit_err_m"] for r in rows)
    if max_err > 1e-6:
        raise AssertionError(f"Autoverifica ottica fallita: errore {max_err:.2e} m")
    occ = occlusion_fraction(cfg, rows, ctx)
    if occ:
        print(f"  [avviso] il pannello dell'array copre la vista all'osservatore: "
              f"{occ*100:.0f}% dei punti nascosti. Cambia altezza array/scritta o posizione.")
    worst_inc = max(r["inc_deg"] for r in rows)
    if worst_inc > 60.0:
        print(f"  [avviso] incidenza radente ({worst_inc:.0f} deg dalla normale): "
              "gli specchi cattureranno pochissima luce. Con sole basso, "
              "orienta la proiezione VERSO il sole (azimut proiezione ~ azimut sole).")
    steep = [r for r in rows if r["tilt_deg"] > MAX_TILT_DEG]
    if steep:
        print(f"  [avviso] {len(steep)} pilastri con inclinazione > {MAX_TILT_DEG} deg "
              f"(max {max(r['tilt_deg'] for r in steep):.1f} deg): "
              "valuta di inclinare il dispositivo o avvicinare il bersaglio.")

    if cfg.get("assignments"):
        provided = np.array([a["normal_local"] for a in cfg["assignments"]])
        ours = np.array([r["normal_local"] for r in rows])
        if provided.shape == ours.shape:
            dev_max = float(np.abs(provided - ours).max())
            status = "OK" if dev_max < 1e-4 else "DIVERGENZA! Controlla i parametri."
            print(f"  Verifica incrociata con l'app web: scarto max {dev_max:.2e} ({status})")

    tiles, (nx, ny) = partition(ctx["offsets"], footprint, bed_wh_mm)
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
