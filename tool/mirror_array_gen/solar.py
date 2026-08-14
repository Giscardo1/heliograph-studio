"""Posizione solare (algoritmo NOAA General Solar Position Calculations).
Precisione ~0.01 gradi: ampiamente sufficiente (tolleranza specchi ~0.2 gradi).
"""
import math
from datetime import datetime, timezone


def solar_position(dt_utc: datetime, lat_deg: float, lon_deg: float):
    """Ritorna (elevazione, azimut) in gradi. Azimut da nord, orario.
    dt_utc deve essere timezone-aware in UTC (o naive assunto UTC)."""
    if dt_utc.tzinfo is not None:
        dt_utc = dt_utc.astimezone(timezone.utc)
    doy = dt_utc.timetuple().tm_yday
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    g = 2 * math.pi / 365 * (doy - 1 + (hour - 12) / 24)  # anno frazionario
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                       - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g)
            - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g)
            - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    time_offset = eqtime + 4 * lon_deg           # minuti (tempo su UTC)
    tst = hour * 60 + time_offset                # true solar time, minuti
    ha = math.radians(tst / 4 - 180)             # angolo orario
    lat = math.radians(lat_deg)
    cos_zen = (math.sin(lat) * math.sin(decl)
               + math.cos(lat) * math.cos(decl) * math.cos(ha))
    cos_zen = max(-1.0, min(1.0, cos_zen))
    zen = math.acos(cos_zen)
    elevation = 90.0 - math.degrees(zen)
    if math.sin(zen) < 1e-9:
        return elevation, 180.0
    cos_az = (math.sin(lat) * math.cos(zen) - math.sin(decl)) / (math.cos(lat) * math.sin(zen))
    cos_az = max(-1.0, min(1.0, cos_az))
    theta = math.degrees(math.acos(cos_az))      # angolo dal sud
    # Convenzione finale: 0=N, 90=E, 180=S, 270=O (orario da nord).
    azimuth = (180.0 - theta) if math.sin(ha) <= 0 else (180.0 + theta)
    return elevation, azimuth % 360.0
