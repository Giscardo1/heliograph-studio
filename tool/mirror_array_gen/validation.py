"""Validazione del config schema v1 prima dei calcoli geometrici."""


def _num(v, name, *, min_value=None, max_value=None):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ValueError(f"{name} must be a number")
    v = float(v)
    if min_value is not None and v < min_value:
        raise ValueError(f"{name} must be >= {min_value}")
    if max_value is not None and v > max_value:
        raise ValueError(f"{name} must be <= {max_value}")
    return v


def validate_config(cfg):
    if not isinstance(cfg, dict):
        raise ValueError("Config must be a JSON object")
    if cfg.get("schema_version") != 1:
        raise ValueError("schema_version must be 1")
    for section in ("light", "plane", "device", "text"):
        if not isinstance(cfg.get(section), dict):
            raise ValueError(f"Missing required section: {section}")

    light = cfg["light"]
    if light.get("mode") not in ("sun", "lamp"):
        raise ValueError("light.mode must be 'sun' or 'lamp'")
    if light["mode"] == "sun":
        sun = light.get("sun")
        if not isinstance(sun, dict):
            raise ValueError("light.sun is missing")
        if sun.get("auto"):
            for k in ("datetime_utc", "lat", "lon"):
                if k not in sun:
                    raise ValueError(f"light.sun.{k} is required in auto mode")
            _num(sun["lat"], "light.sun.lat", min_value=-90, max_value=90)
            _num(sun["lon"], "light.sun.lon", min_value=-180, max_value=180)
        else:
            _num(sun.get("elevation_deg"), "light.sun.elevation_deg", min_value=-90, max_value=90)
            _num(sun.get("azimuth_rel_deg", 0), "light.sun.azimuth_rel_deg", min_value=-180, max_value=180)
    else:
        lamp = light.get("lamp")
        if not isinstance(lamp, dict) or len(lamp.get("position_m", [])) != 3:
            raise ValueError("light.lamp.position_m must have 3 coordinates")
        for i, v in enumerate(lamp["position_m"]):
            _num(v, f"light.lamp.position_m[{i}]")
        _num(lamp.get("diameter_m", 0.05), "light.lamp.diameter_m", min_value=0)

    plane = cfg["plane"]
    _num(plane.get("distance_m"), "plane.distance_m", min_value=1e-6)
    _num(plane.get("tilt_deg"), "plane.tilt_deg", min_value=0, max_value=180)
    if plane.get("tilt_deg", 0) > 90:
        _num(plane.get("ceiling_height_m", 2.7), "plane.ceiling_height_m", min_value=0.5, max_value=20)

    dev = cfg["device"]
    if len(dev.get("center_m", [])) != 3:
        raise ValueError("device.center_m must have 3 coordinates")
    if dev.get("tilt_deg") != "auto":
        _num(dev.get("tilt_deg"), "device.tilt_deg", min_value=-89.9, max_value=90.0)
    if dev.get("mirror_shape") not in ("hex", "square"):
        raise ValueError("device.mirror_shape must be 'hex' or 'square'")
    _num(dev.get("mirror_width_mm"), "device.mirror_width_mm", min_value=0.1)
    _num(dev.get("gap_mm", 0), "device.gap_mm", min_value=0)
    grid = dev.get("grid")
    if not isinstance(grid, dict) or grid.get("type") not in ("hex", "square"):
        raise ValueError("device.grid.type must be 'hex' or 'square'")
    if grid["type"] == "hex":
        radius = grid.get("radius")
        if not isinstance(radius, int) or radius < 0:
            raise ValueError("device.grid.radius must be an integer >= 0")
    else:
        for k in ("cols", "rows"):
            if not isinstance(grid.get(k), int) or grid[k] < 1:
                raise ValueError(f"device.grid.{k} must be an integer >= 1")

    text = cfg["text"]
    if not isinstance(text.get("string"), str) or not text["string"].strip():
        raise ValueError("text.string cannot be empty")
    _num(text.get("pitch_cm"), "text.pitch_cm", min_value=0.01)

    return True
