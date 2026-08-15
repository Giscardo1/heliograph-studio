#!/usr/bin/env python3
"""Genera gli STL stampabili dell'array di specchi da un file di configurazione.

Uso:
    python generate.py config.json [--bed 220x220] [-o output/]

Il config puo' essere quello esportato dall'app web ("Esporta config.json")
oppure scritto a mano (vedi example_config.json).
"""
import argparse
import json
import sys

from mirror_array_gen.pipeline import generate


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("config", help="file config.json")
    ap.add_argument("--bed", default="220x220",
                    help="print bed size in mm, e.g. 220x220")
    ap.add_argument("-o", "--out", default="output", help="output folder")
    args = ap.parse_args()

    with open(args.config) as f:
        cfg = json.load(f)
    if cfg.get("schema_version") != 1:
        sys.exit("Unrecognised config: expected schema_version = 1.")
    bw, bh = (float(x) for x in args.bed.lower().split("x"))

    print(f"Text: {cfg['text']['string']!r}  |  light: {cfg['light']['mode']}")
    rows, files, report = generate(cfg, args.out, (bw, bh))
    print(f"Mirrors: {len(rows)}  |  max tilt: "
          f"{max(r['tilt_deg'] for r in rows):.1f} deg")
    for path, npil, ntri in files:
        print(f"  {path}  ({npil} pillars, {ntri} triangles)")
    print(f"  {report}")
    print("Done. Print the STL tiles with fine layers over the top few mm "
          "(the slanted faces set the mirror angles).")


if __name__ == "__main__":
    main()
