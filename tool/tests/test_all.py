import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mirror_array_gen import optics, matching
from mirror_array_gen.textraster import rasterize
from mirror_array_gen.solar import solar_position
from mirror_array_gen.pipeline import generate, compute_assignments


def test_reflection_hits_target_sun():
    light = {"mode": "sun", "sun": {"elevation_deg": 35, "azimuth_rel_deg": 20}}
    mp = np.array([0.1, 0.0, 1.2])
    tp = np.array([-0.4, 3.0, 0.0])
    v = optics.to_light_vector(mp, light)
    n = optics.mirror_normal(mp, tp, v)
    P0, n_v, r, s = optics.focal_plane_frame(3.0, 0.0, mp)
    hit, _ = optics.intersect_plane(mp, optics.reflect(-v, n), P0, n_v)
    assert np.linalg.norm(hit - tp) < 1e-9


def test_reflection_hits_target_lamp_wall():
    light = {"mode": "lamp", "lamp": {"position_m": [0.5, -2.0, 2.0], "diameter_m": 0.05}}
    mp = np.array([-0.05, 0.0, 1.0])
    P0, n_v, r, s = optics.focal_plane_frame(4.0, 90.0, mp)
    tp = P0 + 0.3 * r + 0.5 * s
    v = optics.to_light_vector(mp, light)
    n = optics.mirror_normal(mp, tp, v)
    hit, _ = optics.intersect_plane(mp, optics.reflect(-v, n), P0, n_v)
    assert np.linalg.norm(hit - tp) < 1e-9


def test_solar_rome_summer_noon():
    # Roma 21/6, mezzogiorno solare (~11:07 UTC): elevazione ~71.5, azimut ~sud
    elev, az = solar_position(datetime(2026, 6, 21, 11, 7, tzinfo=timezone.utc), 41.9, 12.5)
    assert 70.5 < elev < 72.5
    assert 170 < az < 190


def test_solar_morning_east():
    elev, az = solar_position(datetime(2026, 6, 21, 6, 0, tzinfo=timezone.utc), 41.9, 12.5)
    assert elev > 0 and 60 < az < 120  # mattina: sole a est


def test_raster_counts():
    pts, unknown = rasterize("CIAO", 0.05)
    assert len(pts) > 20 and not unknown
    pts2, unknown2 = rasterize("A~", 0.05)
    assert unknown2 == ["~"]


def test_matching_bijective_when_equal():
    m = matching.hex_grid(2, 30.0)  # 19 specchi
    t = np.random.RandomState(0).uniform(-1, 1, size=(19, 2))
    a = matching.match(m, t)
    assert sorted(a.tolist()) == list(range(19))


def test_matching_duplicates_when_fewer_targets():
    m = matching.hex_grid(2, 30.0)
    t = np.random.RandomState(1).uniform(-1, 1, size=(7, 2))
    a = matching.match(m, t)
    assert set(a.tolist()) == set(range(7))


def test_matching_too_many_targets():
    m = matching.hex_grid(1, 30.0)  # 7 specchi
    with pytest.raises(ValueError):
        matching.match(m, np.zeros((50, 2)))


def _base_cfg():
    return {
        "schema_version": 1,
        "light": {"mode": "sun", "sun": {"elevation_deg": 40, "azimuth_rel_deg": 10}},
        "plane": {"distance_m": 4.0, "tilt_deg": 0.0},
        "device": {"center_m": [0, 0, 1.2], "tilt_deg": 0.0,
                   "mirror_shape": "hex", "mirror_width_mm": 25.4, "gap_mm": 2.0,
                   "grid": {"type": "hex", "radius": 4}},
        "text": {"string": "HI", "pitch_cm": 6.0},
        "pillar": {"base_height_mm": 12.0, "margin_mm": 1.0, "aligner": True},
    }


def test_pipeline_end_to_end(tmp_path):
    cfg = _base_cfg()
    rows, files, report = generate(cfg, str(tmp_path), (220.0, 220.0))
    assert len(rows) == 61
    assert all(os.path.getsize(p) > 1000 for p, _, _ in files)
    assert os.path.exists(report)
    assert max(r["hit_err_m"] for r in rows) < 1e-9


def test_pipeline_square_lamp_tilted_plane(tmp_path):
    cfg = _base_cfg()
    cfg["light"] = {"mode": "lamp", "lamp": {"position_m": [0, -3, 2.5], "diameter_m": 0.08}}
    cfg["device"]["mirror_shape"] = "square"
    cfg["device"]["grid"] = {"type": "square", "cols": 8, "rows": 8}
    cfg["device"]["tilt_deg"] = "auto"
    cfg["plane"] = {"distance_m": 5.0, "tilt_deg": 60.0}
    rows, files, report = generate(cfg, str(tmp_path))
    assert len(rows) == 64
    assert max(r["hit_err_m"] for r in rows) < 1e-9


def test_sun_below_horizon_error():
    cfg = _base_cfg()
    cfg["light"]["sun"] = {"auto": True, "datetime_utc": "2026-06-21T23:30:00",
                           "lat": 43.9, "lon": 10.9, "projection_azimuth_deg": 0}
    with pytest.raises(ValueError):
        compute_assignments(cfg)


def test_backlit_rejected():
    # sole alle spalle ma dispositivo girato dall'altra parte: luce sul retro -> errore
    cfg = _base_cfg()
    cfg["light"]["sun"] = {"elevation_deg": 30, "azimuth_rel_deg": 0}
    cfg["device"]["tilt_deg"] = 60.0
    with pytest.raises(ValueError, match="dietro l'array"):
        compute_assignments(cfg)


def test_occlusion_detected():
    from mirror_array_gen.pipeline import occlusion_fraction
    cfg = _base_cfg()
    cfg["observer"] = {"behind_m": 3.0, "eye_height_m": 1.65}
    cfg["plane"] = {"distance_m": 4.0, "tilt_deg": 90.0, "center_height_m": 1.65}
    cfg["device"]["center_m"] = [0, 0, 1.65]  # pannello proprio davanti agli occhi
    cfg["device"]["tilt_deg"] = 90.0
    cfg["light"] = {"mode": "lamp", "lamp": {"position_m": [0, 1.5, 3.0], "diameter_m": 0.05}}
    rows, ctx = compute_assignments(cfg)
    occ = occlusion_fraction(cfg, rows, ctx)
    assert occ is not None and occ > 0.3   # buona parte della scritta e' coperta
    cfg2 = _base_cfg()                      # config pulita: nessuna occlusione
    cfg2["observer"] = {"behind_m": 0.4, "eye_height_m": 1.65}
    rows2, ctx2 = compute_assignments(cfg2)
    assert occlusion_fraction(cfg2, rows2, ctx2) == 0.0
