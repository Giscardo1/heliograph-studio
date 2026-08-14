"""Report visivo: layout dell'array e anteprima della proiezione."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def save_report(rows, ctx, cfg, path):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 6))
    offs = ctx["offsets"]
    tilts = [r["tilt_deg"] for r in rows]
    sc = ax1.scatter(offs[:, 0], offs[:, 1], c=tilts, cmap="viridis", s=60)
    plt.colorbar(sc, ax=ax1, label="inclinazione pilastro [deg]")
    ax1.set_title(f"Array {cfg['device']['mirror_shape']} - {len(rows)} specchi")
    ax1.set_xlabel("mm"); ax1.set_ylabel("mm"); ax1.set_aspect("equal")

    P0, r_b, s_b = ctx["P0"], ctx["r"], ctx["s"]
    for row in rows:
        t = np.asarray(row["target_world_m"]) - P0
        a, b = float(np.dot(t, r_b)), float(np.dot(t, s_b))
        rad = row["spot_r_m"]
        ax2.add_patch(plt.Circle((a, b), rad, color="#f0a020", alpha=0.55, lw=0))
    ts = ctx["targets2d"]
    pad = 0.05 + 3 * max(r["spot_r_m"] for r in rows)
    ax2.set_xlim(ts[:, 0].min() - pad, ts[:, 0].max() + pad)
    ax2.set_ylim(ts[:, 1].min() - pad, ts[:, 1].max() + pad)
    ax2.set_aspect("equal")
    ax2.set_facecolor("#101418")
    ax2.set_title(f"Proiezione a {cfg['plane']['distance_m']} m "
                  f"(tilt piano {cfg['plane']['tilt_deg']} deg)")
    ax2.set_xlabel("m (destra)"); ax2.set_ylabel("m (alto)")
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)
