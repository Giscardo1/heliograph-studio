"""Griglie di specchi e matching specchio-bersaglio ad anelli concentrici.

Il matching generalizza l'algoritmo di Bartlett: gli specchi vengono raggruppati
in "anelli" per distanza dal centro dell'array; i bersagli, ordinati per
distanza dal loro baricentro, riempiono gli anelli dal centro verso l'esterno;
dentro ogni anello specchi e bersagli sono accoppiati per angolo. Il risultato:
raggi quasi paralleli e minima distorsione fuori fuoco.
"""
import numpy as np


def hex_grid(radius, spacing_mm):
    """Coordinate (a,b) in mm dei centri, griglia esagonale pointy-side,
    anelli 0..radius. spacing = distanza tra centri adiacenti."""
    pts = []
    for q in range(-radius, radius + 1):
        r1 = max(-radius, -q - radius)
        r2 = min(radius, -q + radius)
        for r in range(r1, r2 + 1):
            x = spacing_mm * (q + r / 2.0)
            y = spacing_mm * (np.sqrt(3) / 2.0) * r
            pts.append((x, y))
    return np.array(pts, dtype=float)


def square_grid(cols, rows, spacing_mm):
    xs = (np.arange(cols) - (cols - 1) / 2.0) * spacing_mm
    ys = (np.arange(rows) - (rows - 1) / 2.0) * spacing_mm
    return np.array([(x, y) for y in ys for x in xs], dtype=float)


def _rings(points):
    """Indici raggruppati per distanza (quantizzata) dal baricentro."""
    c = points.mean(axis=0)
    d = np.linalg.norm(points - c, axis=1)
    order = np.argsort(d, kind="stable")
    rings, cur, last = [], [order[0]], d[order[0]]
    for i in order[1:]:
        if d[i] - last > 1e-6 * (1 + d[i]):
            rings.append(cur)
            cur = [i]
        else:
            cur.append(i)
        last = d[i]
    rings.append(cur)
    return rings, c


def match(mirrors_2d, targets_2d):
    """Ritorna assign[i] = indice del bersaglio per lo specchio i.

    Se i bersagli sono meno degli specchi, vengono duplicati ciclicamente
    (piu' specchi per pixel = testo piu' luminoso). Se sono di piu', errore.
    """
    n_m, n_t = len(mirrors_2d), len(targets_2d)
    if n_t == 0:
        raise ValueError("Nessun punto bersaglio: testo vuoto o caratteri ignoti.")
    if n_t > n_m:
        raise ValueError(f"Need {n_t} mirrors but the grid has {n_m}: "
                         "enlarge the grid or shorten the text.")
    reps = int(np.ceil(n_m / n_t))
    t_ext = np.tile(targets_2d, (reps, 1))[:n_m]
    t_idx = np.tile(np.arange(n_t), reps)[:n_m]

    m_rings, m_c = _rings(mirrors_2d)
    tc = t_ext.mean(axis=0)
    t_order = np.argsort(np.linalg.norm(t_ext - tc, axis=1), kind="stable")

    assign = np.empty(n_m, dtype=int)
    cursor = 0
    for ring in m_rings:
        chunk = t_order[cursor:cursor + len(ring)]
        cursor += len(ring)
        # ordina per angolo (partendo dal basso, orario) sia specchi che bersagli
        ma = np.arctan2(mirrors_2d[ring][:, 0] - m_c[0], -(mirrors_2d[ring][:, 1] - m_c[1]))
        ta = np.arctan2(t_ext[chunk][:, 0] - tc[0], -(t_ext[chunk][:, 1] - tc[1]))
        ring_sorted = np.asarray(ring)[np.argsort(ma, kind="stable")]
        chunk_sorted = chunk[np.argsort(ta, kind="stable")]
        assign[ring_sorted] = t_idx[chunk_sorted]
    return assign
