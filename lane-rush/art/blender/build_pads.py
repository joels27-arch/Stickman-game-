"""Track pads, modelled in Blender: a green boost pad whose chevrons point down the track (away from the runner)
and a red slow pad whose chevrons point back at the runner (you're being pushed back).

The game turns a pad with PAD_TURN (-90°), which takes Blender -X to "down the track".
python3 build_pads.py <outdir>  → bl_pad_go.glb, bl_pad_slow.glb + preview_pads.jpg
"""
import math
import os
import sys

import bpy  # noqa: F401

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import box, export, join, mat, preview, reset  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def pad(x0, name, base_c, glow_c, emit_c, tip):
    """tip = -1: chevrons point -X (down the track in game); +1: they point +X (back at the runner)."""
    base = mat(f"{name}_base", base_c, rough=0.35, metal=0.3)
    rim = mat("pad_rim2", "#eef2f6", rough=0.3, metal=0.6)
    glow = mat(f"{name}_glow", glow_c, rough=0.2, emit=emit_c, emit_strength=3.0)
    p = [
        box((2.4, 1.4, 0.06), (x0, 0, 0.03), rim, bevel=0.03, segs=1, name="rim"),
        box((2.25, 1.25, 0.07), (x0, 0, 0.04), base, bevel=0.025, segs=1, name="base"),
    ]
    for i in range(3):
        cx = x0 + (i - 1) * 0.65
        for s in (-1, 1):
            # each arm runs from the outer back corner in to the tip on the centre line
            p.append(box((0.52, 0.15, 0.04), (cx, s * 0.19, 0.085), glow, bevel=0.015, segs=1, rot=(0, 0, -s * tip * math.radians(40)), name="chev"))
    return join(p, name)


if __name__ == "__main__":
    reset()
    objs = {
        "bl_pad_go": pad(-1.6, "pad_go", "#0f3b1e", "#5dff7a", "#2bff5a", -1),
        "bl_pad_slow": pad(1.6, "pad_slow", "#3d0f12", "#ff5148", "#ff2a22", 1),
    }
    preview(list(objs.values()), os.path.abspath(os.path.join(OUT, "preview_pads.jpg")), size=(900, 500), cam_loc=(0, -0.01, 7), look=(0, 0, 0), lens=40)
    for n, o in objs.items():
        export(o, os.path.abspath(os.path.join(OUT, f"{n}.glb")))
