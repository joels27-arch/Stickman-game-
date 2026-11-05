"""Sunny Valley kit (the meadow map), modelled in Blender: soft round storybook trees, a wooden rail fence,
round hay bales, a hay-bale stack (the map's lane blocker) and flower clumps. Warm, saturated, rounded,
baked ambient occlusion in the vertex colours: the look of the countryside concept, cheap to draw.

python3 build_valley.py <outdir>  → vl_*.glb + preview_valley.jpg
"""
import math
import os
import random
import sys

import bpy  # noqa: F401  (bpy first: it provides bmesh and mathutils)
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_scenery import blob, lod_copy, trunk  # noqa: E402
from common import bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def round_tree(x0, seed, leaf, leaf2, tip, h=3.0, r=1.9, name="tree"):
    """A storybook tree: a slightly bent trunk with two branches, a big soft canopy of overlapping lumps, sunlit on top."""
    rnd = random.Random(seed)
    bark = mat("vl_bark", "#7b4f2e", rough=0.85)
    a, b, c = mat(f"vl_leaf_{leaf}", leaf, rough=0.75), mat(f"vl_leaf_{leaf2}", leaf2, rough=0.75), mat(f"vl_leaf_{tip}", tip, rough=0.7)
    p = [trunk((x0, 0, 0), (x0 + 0.12, 0.05, h * 0.62), 0.24, 0.15, bark, verts=14)]
    for s in (-1, 1):
        p.append(trunk((x0 + 0.06, 0, h * 0.42), (x0 + s * 0.7, s * 0.2, h * 0.78), 0.1, 0.06, bark, verts=10))
    cz = h * 0.62 + r * 0.55
    p.append(blob(r, (x0, 0, cz), a, squash=(1.1, 1.05, 0.88), sub=3, amp=0.12, seed=seed))
    for i in range(6):
        ang = i / 6 * math.tau + rnd.uniform(-0.3, 0.3)
        d = r * rnd.uniform(0.55, 0.8)
        p.append(blob(r * rnd.uniform(0.5, 0.65), (x0 + math.cos(ang) * d, math.sin(ang) * d, cz + rnd.uniform(-0.45, 0.25)), b if i % 2 else a, squash=(1, 1, 0.85), sub=3, amp=0.14, seed=seed * 10 + i))
    for i in range(3):
        ang = rnd.uniform(0, math.tau)
        p.append(blob(r * 0.45, (x0 + math.cos(ang) * r * 0.3, math.sin(ang) * r * 0.3, cz + r * 0.55), c, squash=(1, 1, 0.8), sub=3, amp=0.12, seed=seed * 20 + i))
    return join(p, name)


def poplar(x0, seed):
    """A tall slim tree (the line of poplars along a country road)."""
    rnd = random.Random(seed)
    bark = mat("vl_bark", "#7b4f2e", rough=0.85)
    a, b = mat("vl_pop", "#3f9a3a", rough=0.75), mat("vl_pop2", "#5cb84a", rough=0.75)
    p = [trunk((x0, 0, 0), (x0, 0, 1.4), 0.16, 0.12, bark, verts=12)]
    for i in range(5):
        z = 1.5 + i * 0.85
        p.append(blob(0.95 - i * 0.12, (x0 + rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), z), a if i % 2 else b, squash=(1, 1, 1.25), sub=3, amp=0.12, seed=seed + i))
    return join(p, "poplar")


def fence(x0=0.0):
    """One 2.9 m section of a wooden rail fence: two posts, two rails (laid along X like the picket fence)."""
    wood = mat("vl_wood", "#a8743f", rough=0.8)
    dark = mat("vl_wood_dark", "#7d5228", rough=0.85)
    p = []
    for sx in (-1.45, 1.45):
        p.append(box((0.13, 0.13, 1.05), (x0 + sx, 0, 0.52), dark, bevel=0.03, segs=2, name="post"))
        p.append(box((0.16, 0.16, 0.05), (x0 + sx, 0, 1.06), dark, bevel=0.02, segs=2, name="cap"))
    for z in (0.45, 0.85):
        p.append(box((3.0, 0.08, 0.14), (x0, 0.06, z), wood, bevel=0.03, segs=2, name="rail"))
    return join(p, "fence")


def round_bale(x0=0.0):
    """A round hay bale lying on its side, with the spiral showing on the ends."""
    hay = mat("vl_hay", "#e9b94e", rough=0.9)
    hay2 = mat("vl_hay2", "#cf9a35", rough=0.95)
    R, W = 0.62, 1.15
    rot = (0, math.radians(90), 0)
    p = [cyl(R, W, (x0, 0, R), hay, verts=28, bevel=0.12, segs=4, rot=rot, name="bale")]
    for k in range(3):
        for sx in (-1, 1):
            p.append(torus(R * (0.25 + k * 0.22), 0.025, (x0 + sx * (W / 2 + 0.005), 0, R), hay2, rot=rot, major=28, minor=6, name="spiral"))
    for dx in (-0.25, 0.25):
        p.append(torus(R + 0.004, 0.012, (x0 + dx, 0, R), mat("vl_twine", "#c94a3a", rough=0.6), rot=rot, major=32, minor=6, name="twine"))
    return join(p, "round_bale")


def hay_stack(x0=0.0):
    """The map's lane blocker: square hay bales stacked 2-2-2-1, red twine round each one."""
    hay = mat("vl_sq", "#efc25a", rough=0.9)
    twine = mat("vl_twine", "#c94a3a", rough=0.6)
    W, D, H = 0.72, 0.62, 0.5
    rnd = random.Random(7)
    p = []
    rows = [(-0.37, 0.0), (0.37, 0.0)], [(-0.37, 1.0), (0.37, 1.0)], [(-0.37, 2.0), (0.37, 2.0)], [(0.0, 3.0)]
    for row in rows:
        for dx, lvl in row:
            cx, cz = x0 + dx + rnd.uniform(-0.03, 0.03), H / 2 + lvl * (H + 0.01)
            p.append(box((W, D, H), (cx, rnd.uniform(-0.03, 0.03), cz), hay, bevel=0.07, segs=3, rot=(0, 0, math.radians(rnd.uniform(-4, 4))), name="bale"))
            for ox in (-0.18, 0.18):
                p.append(box((0.03, D + 0.012, H + 0.012), (cx + ox, 0, cz), twine, bevel=0.008, segs=1, name="twine"))
    return join(p, "hay_stack")


def flowers(x0=0.0, seed=5):
    """A clump of meadow flowers: a soft green tuft with white, yellow and violet heads."""
    rnd = random.Random(seed)
    green = mat("vl_tuft", "#5fb544", rough=0.8)
    heads = [mat("vl_fw", "#ffffff", rough=0.5), mat("vl_fy", "#ffd23a", rough=0.5), mat("vl_fv", "#a46cff", rough=0.5)]
    centre = mat("vl_fc", "#f2a51e", rough=0.5)
    p = [blob(0.45, (x0, 0, 0.12), green, squash=(1.3, 1.3, 0.45), sub=2, amp=0.2, seed=seed)]
    for i in range(9):
        a = rnd.uniform(0, math.tau)
        d = rnd.uniform(0.0, 0.5)
        x, y, z = x0 + math.cos(a) * d, math.sin(a) * d, 0.28 + rnd.uniform(0, 0.18)
        m = heads[i % 3]
        p.append(sphere(0.09, (x, y, z), m, scale=(1, 1, 0.45), segs=10, rings=6, name="head"))
        p.append(sphere(0.035, (x, y, z + 0.03), centre, segs=8, rings=5, name="eye"))
    return join(p, "flowers")


if __name__ == "__main__":
    reset()
    objs = {
        "vl_tree1": round_tree(-7.0, 3, "#4fae3c", "#63c247", "#9ad85a"),
        "vl_tree2": round_tree(-2.6, 8, "#3f9a3a", "#58b444", "#86cf55", h=3.6, r=1.6),
        "vl_tree3": round_tree(1.6, 13, "#6cbd3e", "#86cf4a", "#c3e467", h=2.6, r=1.5),
        "vl_poplar": poplar(5.0, 21),
        "vl_fence": fence(8.2),
        "vl_bale": round_bale(11.0),
        "vl_crate": hay_stack(13.2),
        "vl_flowers": flowers(15.0),
    }
    for o in objs.values():
        bake_ao(o, distance=0.8)
    preview(list(objs.values()), os.path.abspath(os.path.join(OUT, "preview_valley.jpg")), size=(1500, 560), cam_loc=(4.0, -17, 4.0), look=(4.0, 0, 2.2), lens=30)
    for name, o in objs.items():
        export(o, os.path.abspath(os.path.join(OUT, f"{name}.glb")))
        if name in ("vl_tree1", "vl_tree2", "vl_tree3", "vl_poplar", "vl_bale", "vl_flowers"):
            export(lod_copy(o, 0.2), os.path.abspath(os.path.join(OUT, f"{name}_lod.glb")))  # far version
