"""Lane Rush gadgets, modelled in Blender (round 2): banana peel, bowling ball, rocket pack, storm cloud,
glue puddle, boxing glove, bomb, and the big brain from Brain Chase.

python3 build_round2.py <outdir>  → bl_<name>.glb + preview_round2.jpg
The glove's fist points -Y in Blender (glTF +Z), which is the way three.js lookAt() aims it.
"""
import math
import os
import random
import sys

import bpy  # bpy first: it provides bmesh and mathutils
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_scenery import blob  # noqa: E402
from common import _finish, bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def banana(x0=0.0):
    peel = mat("peel", "#ffd93b", rough=0.4)
    inner = mat("peel_in", "#fff3b8", rough=0.5)
    tip = mat("peel_tip", "#6b4a22", rough=0.6)
    p = [sphere(0.13, (x0, 0, 0.12), peel, scale=(1, 1, 0.9), segs=16, rings=10, name="core")]
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        d = Vector((math.cos(a), math.sin(a), 0))
        c = Vector((x0, 0, 0.1)) + d * 0.24
        flap = sphere(0.27, tuple(c), peel, scale=(1, 0.45, 0.16), segs=18, rings=10, name="flap")
        flap.rotation_euler = (0, math.radians(28), a)
        bpy.ops.object.transform_apply(rotation=True)
        p.append(flap)
    p.append(cyl(0.035, 0.14, (x0, 0, 0.27), tip, verts=8, bevel=0.01, name="stem"))
    return join(p, "banana")


def bowling_ball(x0=0.0):
    shell = mat("bowl_shell", "#5b2bd6", rough=0.12, metal=0.1)
    swirl = mat("bowl_swirl", "#ff4fa3", rough=0.12)
    hole = mat("bowl_hole", "#111216", rough=0.6)
    b = sphere(0.5, (x0, 0, 0.5), shell, segs=32, rings=18, name="ball")
    # a pink marbled band: faces near a wavy great circle take the second colour
    b.data.materials.append(swirl)
    for poly in b.data.polygons:
        c = poly.center - Vector((x0, 0, 0.5))
        if abs(c.z + 0.12 * math.sin(4 * math.atan2(c.y, c.x))) < 0.07:
            poly.material_index = 1
    p = [b]
    for (dx, dz) in ((-0.1, 0.12), (0.1, 0.12), (0.0, -0.06)):
        v = Vector((dx, -0.5, dz)).normalized() * 0.49
        p.append(sphere(0.055, (x0 + v.x, v.y, 0.5 + v.z), hole, scale=(1, 0.4, 1), segs=12, rings=8, name="hole"))
    return join(p, "bowling_ball")


def rocket_pack(x0=0.0):
    body = mat("pack_body", "#e5332a", rough=0.3)
    metal = mat("pack_metal", "#d6dce5", rough=0.2, metal=0.9)
    dark = mat("pack_dark", "#2a2d34", rough=0.5)
    glow = mat("pack_glow", "#ffb347", rough=0.2, emit="#ff8a1f", emit_strength=3.0)
    p = [box((0.5, 0.18, 0.5), (x0, 0.05, 0.55), dark, bevel=0.05, name="frame")]
    for sx in (-0.17, 0.17):
        p.append(cyl(0.13, 0.62, (x0 + sx, 0.2, 0.55), body, verts=20, bevel=0.04, name="tank"))
        p.append(sphere(0.13, (x0 + sx, 0.2, 0.86), body, scale=(1, 1, 1.25), segs=20, rings=10, name="nose"))
        p.append(cyl(0.135, 0.06, (x0 + sx, 0.2, 0.42), metal, verts=20, bevel=0.01, name="band"))
        p.append(cyl(0.09, 0.14, (x0 + sx, 0.2, 0.18), metal, r2=0.12, verts=16, bevel=0.01, name="nozzle"))
        p.append(cyl(0.07, 0.02, (x0 + sx, 0.2, 0.105), glow, verts=16, bevel=0, name="glow"))
    for sx in (-0.2, 0.2):
        p.append(box((0.07, 0.03, 0.55), (x0 + sx, -0.06, 0.6), dark, bevel=0.01, name="strap"))
    return join(p, "rocket_pack")


def storm_cloud(x0=0.0):
    grey = mat("storm_grey", "#7f8794", rough=0.8)
    grey2 = mat("storm_grey2", "#9aa2ae", rough=0.8)
    bolt = mat("bolt", "#ffe14a", rough=0.3, emit="#ffd21a", emit_strength=3.0)
    p = []
    for i, (dx, dz, r) in enumerate(((-0.55, 0.0, 0.45), (0.0, 0.18, 0.6), (0.55, 0.02, 0.45), (-0.25, -0.12, 0.4), (0.3, -0.12, 0.4))):
        p.append(blob(r, (x0 + dx, 0, 0.9 + dz), grey if i % 2 else grey2, squash=(1, 0.8, 0.85), sub=2, seed=i))
    # a zig-zag lightning bolt hanging under it
    pts = [(0.05, 0.5), (-0.12, 0.25), (0.06, 0.24), (-0.1, -0.05)]
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        a, b = Vector((x0 + ax, 0, az)), Vector((x0 + bx, 0, bz))
        d = b - a
        seg = box((0.07, 0.05, d.length + 0.03), tuple((a + b) / 2), bolt, bevel=0.01, segs=1, name="bolt")
        seg.rotation_euler = (0, math.atan2(d.x, d.z), 0)
        bpy.ops.object.transform_apply(rotation=True)
        p.append(seg)
    return join(p, "storm_cloud")


def glue(x0=0.0):
    goo = mat("goo", "#9cff4a", rough=0.08)
    goo2 = mat("goo2", "#c8ff8a", rough=0.08)
    p = [blob(0.5, (x0, 0, 0.0), goo, squash=(1.0, 0.85, 0.14), sub=3, amp=0.18, freq=1.0, seed=3)]
    rnd = random.Random(5)
    for i in range(6):
        a = rnd.uniform(0, 6.28)
        r = rnd.uniform(0.35, 0.55)
        p.append(sphere(rnd.uniform(0.05, 0.09), (x0 + r * math.cos(a), 0.85 * r * math.sin(a), 0.03), goo2, scale=(1, 1, 0.5), segs=10, rings=6, name="drop"))
    p.append(sphere(0.07, (x0 + 0.1, -0.05, 0.08), goo2, scale=(1, 1, 0.6), segs=10, rings=6, name="bubble"))
    return join(p, "glue")


def glove(x0=0.0):
    red = mat("glove_red", "#e52b2b", rough=0.25)
    cuff = mat("glove_cuff", "#f7f7f9", rough=0.4)
    lace = mat("glove_lace", "#2a2d34", rough=0.5)
    p = [
        sphere(0.3, (x0, -0.12, 0.45), red, scale=(1.0, 1.2, 0.95), segs=24, rings=14, name="fist"),
        sphere(0.12, (x0 + 0.26, -0.08, 0.38), red, scale=(0.8, 1.4, 0.8), segs=14, rings=8, name="thumb"),
        cyl(0.22, 0.3, (x0, 0.28, 0.45), cuff, rot=(math.radians(90), 0, 0), verts=20, bevel=0.04, name="cuff"),
        box((0.06, 0.2, 0.03), (x0, 0.28, 0.67), lace, bevel=0.01, segs=1, name="lace"),
    ]
    return join(p, "glove")


def bomb(x0=0.0):
    shell = mat("bomb_shell", "#26282f", rough=0.25, metal=0.4)
    cap = mat("bomb_cap", "#8c929c", rough=0.3, metal=0.8)
    fuse = mat("bomb_fuse", "#c79a5b", rough=0.8)
    spark = mat("spark", "#ffd34a", rough=0.2, emit="#ffb21a", emit_strength=5.0)
    shine = mat("bomb_shine", "#ffffff", rough=0.1)
    p = [
        sphere(0.45, (x0, 0, 0.45), shell, segs=28, rings=16, name="ball"),
        cyl(0.13, 0.12, (x0, 0, 0.92), cap, verts=16, bevel=0.02, name="cap"),
        cyl(0.025, 0.25, (x0 + 0.05, 0, 1.08), fuse, verts=8, bevel=0, rot=(0, math.radians(20), 0), name="fuse"),
        sphere(0.08, (x0 + 0.1, 0, 1.22), spark, segs=10, rings=6, name="spark"),
        sphere(0.09, (x0 - 0.18, -0.36, 0.66), shine, scale=(1, 0.3, 0.6), segs=10, rings=6, name="shine"),
    ]
    return join(p, "bomb")


def brain(x0=0.0):
    pink = mat("brain_pink", "#ff8fb3", rough=0.35)
    pink2 = mat("brain_pink2", "#f2759f", rough=0.35)
    p = []
    for side, m in ((-1, pink), (1, pink2)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0, location=(x0 + side * 0.52, 0, 1.1))
        o = bpy.context.active_object
        for v in o.data.vertices:
            q = v.co.copy()
            # folds: ridged noise pushes grooves into the surface
            # folds: the zero-crossings of 3D noise make meandering grooves (gyri and sulci)
            n = noise.noise(q * 3.2 + Vector((side * 3.1, 0, 0)))
            fold = 1 - 2 * min(1.0, abs(n) * 2.2)
            v.co = Vector((q.x * 0.92, q.y * 1.25, q.z * 0.95)) * (1 - 0.055 * fold)
        p.append(_finish(o, m, 0, 0))
    p.append(cyl(0.28, 0.6, (x0, 0.45, 0.25), pink2, verts=16, bevel=0.05, rot=(math.radians(20), 0, 0), name="stem"))
    return join(p, "brain")


if __name__ == "__main__":
    reset()
    objs = {
        "banana": banana(-5.0),
        "bowling_ball": bowling_ball(-3.6),
        "rocket": rocket_pack(-2.3),
        "cloud": storm_cloud(-0.6),
        "glue": glue(1.1),
        "glove": glove(2.5),
        "bomb": bomb(3.7),
    }
    big = brain(7.5)
    for o in [*objs.values(), big]:
        bake_ao(o, distance=0.5)
    preview([*objs.values(), big], os.path.abspath(os.path.join(OUT, "preview_round2.jpg")), size=(1100, 460), cam_loc=(1.2, -11, 2.6), look=(1.2, 0, 0.7), lens=32)
    names = {"banana": "bl_banana", "bowling_ball": "bl_bowling_ball", "rocket": "bl_rocket", "cloud": "bl_cloud", "glue": "bl_glue", "glove": "bl_glove", "bomb": "bl_bomb"}
    for k, o in objs.items():
        export(o, os.path.abspath(os.path.join(OUT, f"{names[k]}.glb")))
    export(big, os.path.abspath(os.path.join(OUT, "bl_brain.glb")))
