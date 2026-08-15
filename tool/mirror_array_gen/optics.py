"""Ottica geometrica dell'array di specchi.

Convenzioni (coordinate mondo, unita' in metri):
  +x = destra dell'osservatore, +y = direzione di proiezione (avanti), +z = su.
Il dispositivo e' centrato in `device.center`; il piano focale e' davanti (+y).
"""
import numpy as np


def normalize(v):
    v = np.asarray(v, dtype=float)
    n = np.linalg.norm(v)
    if n < 1e-12:
        raise ValueError("Vettore nullo: impossibile normalizzare.")
    return v / n


def sun_direction(elevation_deg, azimuth_rel_deg):
    """Versore che punta DAL mirror VERSO il sole.

    elevation: altezza sull'orizzonte. azimuth_rel: angolo orario rispetto
    all'asse di proiezione +y (0 = sole alle spalle dell'osservatore che
    guarda il piano focale, positivo verso destra).
    Il sole deve stare dietro/sopra l'array perche' la luce vada in avanti,
    quindi la componente y del versore e' -cos(e)cos(a) (sole lato -y).
    """
    e = np.radians(elevation_deg)
    a = np.radians(azimuth_rel_deg)
    return np.array([np.cos(e) * np.sin(a), -np.cos(e) * np.cos(a), np.sin(e)])


def to_light_vector(mirror_pos, light):
    """Versore dal centro dello specchio verso la sorgente."""
    if light["mode"] == "sun":
        return sun_direction(light["sun"]["elevation_deg"],
                             light["sun"].get("azimuth_rel_deg", 0.0))
    lamp = np.asarray(light["lamp"]["position_m"], dtype=float)
    return normalize(lamp - np.asarray(mirror_pos, dtype=float))


def mirror_normal(mirror_pos, target_pos, to_light):
    """Normal = bisector between 'toward the source' and 'toward the target'."""
    to_target = normalize(np.asarray(target_pos, float) - np.asarray(mirror_pos, float))
    return normalize(normalize(to_light) + to_target)


def reflect(direction, normal):
    d = normalize(direction)
    n = normalize(normal)
    return d - 2.0 * np.dot(d, n) * n


def focal_plane_frame(distance_m, tilt_deg, device_center, center_height_m=None,
                      ceiling_height_m=None):
    """Ritorna (P0, n_v, r, s): ancora del piano, normale verso l'osservatore,
    base destra `r` e alto `s` nel piano, scelte perche' il testo risulti
    leggibile per chi sta dietro l'array e guarda verso +y.
    tilt 0 = pavimento, 90 = parete verticale, >90 superficie sopra la testa
    (180 = soffitto piano, quota = ceiling_height_m)."""
    t = np.radians(tilt_deg)
    n_v = np.array([0.0, -np.sin(t), np.cos(t)])       # verso l'osservatore
    # Ancora (centro del testo): `distance_m` avanti lungo +y; quota che
    # interpola tra 0 (pavimento) e l'altezza del dispositivo (parete).
    dc = np.asarray(device_center, dtype=float)
    ph = dc[2] if center_height_m is None else float(center_height_m)
    z0 = ph * np.sin(t) if tilt_deg <= 90 else float(
        2.7 if ceiling_height_m is None else ceiling_height_m)
    P0 = np.array([dc[0], dc[1] + distance_m, z0])
    world_up = np.array([0.0, 0.0, 1.0])
    s_raw = world_up - np.dot(world_up, n_v) * n_v
    s = normalize(s_raw) if np.linalg.norm(s_raw) > 1e-9 else np.array([0.0, 1.0, 0.0])
    r = normalize(np.cross(s, n_v))
    # guardando in SU la manualita' si inverte: sul soffitto il testo va
    # specchiato perche' resti leggibile a chi sta sotto
    if tilt_deg > 90:
        r = -r
    return P0, n_v, r, s


def intersect_plane(origin, direction, P0, n_plane):
    d = normalize(direction)
    denom = np.dot(d, n_plane)
    if abs(denom) < 1e-9:
        raise ValueError("Ray is parallel to the focal plane: no intersection.")
    t = np.dot(P0 - np.asarray(origin, float), n_plane) / denom
    if t <= 0:
        raise ValueError("The focal plane is behind the mirror: invalid geometry.")
    return np.asarray(origin, float) + t * d, t


def device_frame(tilt_deg):
    """Assi locali del dispositivo (X destra, Y avanti-su, Z asse pilastri).
    tilt 0 = base orizzontale; crescendo, la base si inclina verso +y."""
    g = np.radians(tilt_deg)
    X = np.array([1.0, 0.0, 0.0])
    Z = np.array([0.0, np.sin(g), np.cos(g)])
    Y = np.cross(Z, X)
    return X, Y, Z


def solar_divergence_rad(day_of_year=None):
    """Diametro angolare apparente del disco solare (rad, angolo pieno).
    R(AU) = 1.00014 - 0.01671 cos g - 0.00014 cos 2g, g = anomalia media (perielio ~3 gen).
    Varia 0.5246° (afelio) ... 0.5425° (perielio); 0.0093 rad se il giorno e' ignoto."""
    if day_of_year is None:
        return 0.0093
    import math
    g = 2.0 * math.pi * (day_of_year - 3) / 365.25
    R = 1.00014 - 0.01671 * math.cos(g) - 0.00014 * math.cos(2.0 * g)
    return 0.009310 / R


def air_mass(elev_deg):
    """Kasten & Young (1989): optical air mass from apparent solar elevation."""
    import math
    g = max(0.5, float(elev_deg))
    return 1.0 / (math.sin(math.radians(g)) + 0.50572 * (g + 6.07995) ** -1.6364)


def sun_direct_lux(elev_deg):
    """Illuminanza diretta normale in cielo sereno, attenuata con l'air mass."""
    if elev_deg <= 0:
        return 0.0
    return 133000.0 * 0.7 ** (air_mass(elev_deg) ** 0.678)


def slope_blur_rad(slope_mrad):
    """Errore di pendenza sigma dello specchio: il riflesso devia di 2*sigma;
    angolo pieno equivalente (1-sigma di direzione) = 4*sigma."""
    return 4.0 * float(slope_mrad or 0.0) / 1000.0


def spot_radius_m(light, mirror_pos, mirror_width_m, path_len_m, slope_mrad=0.0):
    """Semilarghezza dello spot sul piano (senza allungamento obliquo).
    Sole: specchio + divergenza del giorno (+) slope error in quadratura.
    Lampada: ingrandimento geometrico + penombra (+) slope error."""
    blur = slope_blur_rad(slope_mrad) * path_len_m
    if light["mode"] == "sun":
        sdiv = solar_divergence_rad(light.get("day_of_year"))
        w = mirror_width_m + sdiv * path_len_m
        return 0.5 * (w * w + blur * blur) ** 0.5
    lamp = np.asarray(light["lamp"]["position_m"], float)
    L = np.linalg.norm(lamp - np.asarray(mirror_pos, float))
    D = float(light["lamp"].get("diameter_m", 0.05))
    w = mirror_width_m * (L + path_len_m) / L + D * path_len_m / L
    w = (w * w + blur * blur) ** 0.5
    return 0.5 * w
