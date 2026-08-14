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
                    help="dimensioni piatto di stampa in mm, es. 220x220")
    ap.add_argument("-o", "--out", default="output", help="cartella di output")
    args = ap.parse_args()

    with open(args.config) as f:
        cfg = json.load(f)
    if cfg.get("schema_version") != 1:
        sys.exit("Config non riconosciuto: atteso schema_version = 1.")
    bw, bh = (float(x) for x in args.bed.lower().split("x"))

    print(f"Testo: {cfg['text']['string']!r}  |  sorgente: {cfg['light']['mode']}")
    rows, files, report = generate(cfg, args.out, (bw, bh))
    print(f"Specchi: {len(rows)}  |  inclinazione max: "
          f"{max(r['tilt_deg'] for r in rows):.1f} deg")
    for path, npil, ntri in files:
        print(f"  {path}  ({npil} pilastri, {ntri} triangoli)")
    print(f"  {report}")
    print("Fatto. Stampa gli STL con layer fini negli ultimi mm superiori "
          "(le facce inclinate determinano gli angoli degli specchi).")


if __name__ == "__main__":
    main()
