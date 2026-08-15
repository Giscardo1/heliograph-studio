"""Generazione della geometria stampabile (coordinate locali dispositivo, mm).

Ogni specchio -> un pilastro con faccia superiore inclinata secondo la normale
locale, piu': allineatori (due sponde su lati adiacenti per posizionare lo
specchio durante l'incollaggio) e uno zoccolo di base che unisce i pilastri
adiacenti in un corpo unico.
"""
import numpy as np


def polygon(shape, width_mm, n_rot_deg=0.0):
    """Sezione 2D centrata: hex (width = distanza tra lati piatti) o square
    (width = lato). Ritorna array (N,2)."""
    if shape == "hex":
        R = width_mm / np.sqrt(3.0)
        ang = np.radians(np.arange(6) * 60.0 + 30.0 + n_rot_deg)
    elif shape == "square":
        R = width_mm / np.sqrt(2.0)
        ang = np.radians(np.arange(4) * 90.0 + 45.0 + n_rot_deg)
    else:
        raise ValueError(f"Unknown mirror shape: {shape}")
    return np.stack([R * np.cos(ang), R * np.sin(ang)], axis=1)


def required_top_height(normals_local, shape, width_mm, min_base_mm=3.0):
    """Altezza minima del centro-faccia perche' nessun angolo scenda sotto
    `min_base_mm`, dato l'insieme delle normali locali."""
    poly = polygon(shape, width_mm)
    worst = 0.0
    for n in normals_local:
        n = np.asarray(n, float)
        for (px, py) in poly:
            worst = max(worst, (n[0] * px + n[1] * py) / n[2])
    return worst + min_base_mm


def _tri(a, b, c):
    return np.array([a, b, c], dtype=float)


def _prism_between(bottom_pts, top_pts):
    """Triangoli di un prisma generico dato l'anello inferiore e superiore
    (stesso numero di vertici, ordinati coerentemente)."""
    n = len(bottom_pts)
    tris = []
    cb = np.mean(bottom_pts, axis=0)
    ct = np.mean(top_pts, axis=0)
    for i in range(n):
        j = (i + 1) % n
        tris.append(_tri(bottom_pts[j], bottom_pts[i], cb))          # fondo
        tris.append(_tri(top_pts[i], top_pts[j], ct))                # cima
        tris.append(_tri(bottom_pts[i], bottom_pts[j], top_pts[j]))  # lato
        tris.append(_tri(bottom_pts[i], top_pts[j], top_pts[i]))
    return tris


def top_ring(poly2d, center, top_h, normal_local):
    """Solleva ogni angolo della sezione fino al piano con normale data,
    passante per (center, top_h)."""
    n = np.asarray(normal_local, float)
    if n[2] <= 0.05:
        raise ValueError("Local normal is nearly horizontal: pillar is not printable.")
    pts = []
    for (px, py) in poly2d:
        z = top_h - (n[0] * px + n[1] * py) / n[2]
        pts.append([center[0] + px, center[1] + py, z])
    return np.array(pts)


def pillar(center_ab, normal_local, shape, mirror_width_mm, margin_mm,
           top_h_mm, aligner=True, aligner_h_mm=1.8):
    """Triangoli di un pilastro. center_ab = (a,b) locali in mm."""
    cx, cy = float(center_ab[0]), float(center_ab[1])
    outer2d = polygon(shape, mirror_width_mm + 2 * margin_mm)
    inner2d = polygon(shape, mirror_width_mm)
    bottom = np.array([[cx + p[0], cy + p[1], 0.0] for p in outer2d])
    top = top_ring(outer2d, (cx, cy), top_h_mm, normal_local)
    if top[:, 2].min() < 2.0:
        raise ValueError("Pillar too short for the required tilt: "
                         "increase the pillar height.")
    tris = _prism_between(bottom, top)

    if aligner:
        n = np.asarray(normal_local, float)
        n = n / np.linalg.norm(n)
        top_in = top_ring(inner2d, (cx, cy), top_h_mm, normal_local)
        for edge in (0, 1):  # due sponde su lati adiacenti
            i, j = edge, (edge + 1) % len(outer2d)
            base_quad = [top_in[i], top_in[j], top[j], top[i]]
            lift = [p + aligner_h_mm * n for p in base_quad]
            tris += _prism_between(np.array(base_quad), np.array(lift))
    return tris


def base_pad(center_ab, shape, footprint_mm, pad_h_mm=3.0):
    """Zoccolo che unisce i pilastri: prisma dritto leggermente piu' largo."""
    cx, cy = float(center_ab[0]), float(center_ab[1])
    p2d = polygon(shape, footprint_mm)
    bottom = np.array([[cx + p[0], cy + p[1], 0.0] for p in p2d])
    top = bottom + np.array([0.0, 0.0, pad_h_mm])
    return _prism_between(bottom, top)


def write_stl(triangles, path):
    """Scrive un STL binario. Usa numpy-stl se presente, altrimenti un writer
    interno: il generatore non deve fallire per una dipendenza opzionale."""
    tris = [np.asarray(t, dtype=float) for t in triangles]
    if not tris:
        raise ValueError("No faces to write to the STL")
    for t in tris:
        if t.shape != (3, 3) or not np.isfinite(t).all():
            raise ValueError("Invalid STL triangle (bad shape or NaN/Inf)")
    try:
        from stl import mesh as stlmesh
    except ModuleNotFoundError:
        import struct
        with open(path, "wb") as f:
            f.write(b"Heliograph Studio - binary STL".ljust(80, b" "))
            f.write(struct.pack("<I", len(tris)))
            for t in tris:
                c = np.cross(t[1] - t[0], t[2] - t[0])
                nrm = np.linalg.norm(c)
                n = c / nrm if nrm > 1e-15 else np.zeros(3)
                f.write(struct.pack("<3f", *n))
                f.write(struct.pack("<9f", *t.astype(np.float32).ravel()))
                f.write(struct.pack("<H", 0))
        return len(tris)
    data = np.zeros(len(tris), dtype=stlmesh.Mesh.dtype)
    for k, t in enumerate(tris):
        data["vectors"][k] = t.astype(np.float32)
    m = stlmesh.Mesh(data)
    m.update_normals()
    m.save(path)
    return len(tris)
