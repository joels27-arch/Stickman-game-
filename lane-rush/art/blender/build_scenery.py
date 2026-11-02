"""Lane Rush roadside scenery, modelled in Blender: oak, pine, blossom tree, bush, rocks.

python3 build_scenery.py <outdir>  → md_oak.glb (+ md_oak_lod.glb) … md_rocks.glb, preview_scenery.jpg
Same file names as the old Higgsfield props, so the game picks them up as they are (fitted by height or width).
Soft, chunky cartoon shapes: noise-displaced blobs, tapered trunks, baked ambient occlusion in the vertex colours.
"""
import math
import os
import random
import sys

import bpy  # bpy first: it provides bmesh and mathutils
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _finish, bake_ao, cyl, export, join, mat, preview, reset  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def blob(r, loc, material, squash=(1, 1, 1), sub=3, amp=0.09, freq=0.8, seed=0, flat=False):
    """A lumpy foliage / rock blob: an icosphere pushed around by 3D noise."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    off = Vector((seed * 7.31, seed * 3.17, seed * 5.53))
    for v in o.data.vertices:
        p = v.co.copy()  # local: relative to the blob's centre
        n = noise.noise(p * freq / r + off)
        v.co = Vector((p.x * squash[0], p.y * squash[1], p.z * squash[2])) * (1 + amp * n)
    return _finish(o, material, 0, 0, smooth=22 if flat else True)


def trunk(base, top, r0, r1, material, verts=12):
    base, top = Vector(base), Vector(top)
    d = top - base
    mid = (base + top) / 2
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length, location=mid)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return _finish(o, material, 0, 0)


def oak(x0, seed=1, leaf="#4fae3c", leaf2="#6cc94a", name="oak"):
    rnd = random.Random(seed)
    bark = mat("bark", "#7a5032", rough=0.9)
    l1 = mat(name + "_leaf", leaf, rough=0.75)
    l2 = mat(name + "_leaf2", leaf2, rough=0.75)
    parts = [trunk((x0, 0, 0), (x0, 0, 3.2), 0.42, 0.24, bark)]
    # root flare
    for a in range(4):
        ang = a * math.pi / 2 + 0.4
        parts.append(trunk((x0 + 0.42 * math.cos(ang), 0.42 * math.sin(ang), 0), (x0, 0, 0.7), 0.16, 0.08, bark, verts=8))
    # branches
    tips = []
    for a in range(3):
        ang = a * 2.1 + rnd.uniform(-0.3, 0.3)
        tip = (x0 + 1.25 * math.cos(ang), 1.25 * math.sin(ang), 3.9 + rnd.uniform(-0.2, 0.3))
        parts.append(trunk((x0, 0, 2.6), tip, 0.17, 0.08, bark, verts=8))
        tips.append(tip)
    # canopy: one big crown and smaller clumps on the branch tips
    parts.append(blob(1.75, (x0, 0, 4.5), l1, squash=(1, 1, 0.85), seed=seed))
    for i, t in enumerate(tips):
        parts.append(blob(1.15, (t[0], t[1], t[2] + 0.3), l2 if i % 2 else l1, seed=seed + i + 1))
    parts.append(blob(1.1, (x0 + rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 5.6), l2, seed=seed + 9))
    return join(parts, name)


def pine(x0, seed=2):
    rnd = random.Random(seed)
    bark = mat("bark", "#7a5032", rough=0.9)
    n1 = mat("pine_needle", "#2f8a4a", rough=0.8)
    n2 = mat("pine_needle2", "#3fa457", rough=0.8)
    parts = [trunk((x0, 0, 0), (x0, 0, 2.0), 0.3, 0.2, bark)]
    tiers = [(0.9, 2.2, 1.9), (2.0, 1.85, 1.75), (3.0, 1.45, 1.6), (3.9, 1.05, 1.45), (4.7, 0.65, 1.3)]
    for i, (z, r, h) in enumerate(tiers):
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=0.05, depth=h, location=(x0, 0, z + h / 2))
        o = bpy.context.active_object
        o.rotation_euler = (0, 0, rnd.uniform(0, 1))
        bpy.ops.object.transform_apply(rotation=True)
        # scalloped skirt: pull every other rim vertex in and droop the rim a little
        for v in o.data.vertices:
            p = v.co - Vector((x0, 0, z + h / 2))
            if p.z < -h / 2 + 0.01:
                ang = math.atan2(p.y, p.x)
                k = 1 + 0.12 * math.cos(ang * 8)
                v.co.x = x0 + p.x * k
                v.co.y = p.y * k
                v.co.z -= 0.12 * (k - 0.88)
        sub = o.modifiers.new("s", "SUBSURF")
        sub.levels = 1
        parts.append(_finish(o, n1 if i % 2 == 0 else n2, 0, 0))
    return join(parts, "pine")


def bush(x0, seed=3):
    rnd = random.Random(seed)
    g1 = mat("bush_leaf", "#47a83a", rough=0.8)
    g2 = mat("bush_leaf2", "#5fc24a", rough=0.8)
    fl = mat("flower", "#ffe25a", rough=0.5)
    parts = []
    for i in range(5):
        a = i * 1.3
        r = rnd.uniform(0.55, 0.8)
        parts.append(blob(r, (x0 + 0.6 * math.cos(a), 0.45 * math.sin(a), r * 0.75), g1 if i % 2 else g2, squash=(1, 1, 0.85), sub=2, seed=seed + i))
    for i in range(7):
        a = rnd.uniform(0, 6.28)
        parts.append(blob(0.08, (x0 + 0.9 * math.cos(a), 0.7 * math.sin(a), rnd.uniform(0.7, 1.1)), fl, sub=1, amp=0.1, seed=i))
    return join(parts, "bush")


def rocks(x0, seed=4):
    rnd = random.Random(seed)
    s1 = mat("rock", "#8d96a3", rough=0.85)
    s2 = mat("rock2", "#a7afba", rough=0.85)
    moss = mat("moss", "#5aa646", rough=0.9)
    parts = [
        blob(0.75, (x0, 0, 0.42), s1, squash=(1.2, 1, 0.72), sub=2, amp=0.14, freq=0.9, seed=seed, flat=True),
        blob(0.45, (x0 + 0.85, 0.2, 0.24), s2, squash=(1, 1.1, 0.7), sub=2, amp=0.14, freq=0.9, seed=seed + 1, flat=True),
        blob(0.3, (x0 - 0.8, -0.25, 0.16), s2, squash=(1, 1, 0.7), sub=2, amp=0.14, freq=0.9, seed=seed + 2, flat=True),
        blob(0.55, (x0 - 0.05, 0.0, 0.78), moss, squash=(1.25, 1.05, 0.28), sub=2, amp=0.08, seed=seed + 3),
    ]
    return join(parts, "rocks")


def lod_copy(obj, ratio):
    """A far version: same look, a fraction of the triangles."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.duplicate()
    d = bpy.context.active_object
    m = d.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    bpy.ops.object.modifier_apply(modifier="dec")
    d.name = obj.name + "_lod"
    return d


if __name__ == "__main__":
    reset()
    objs = {
        "oak": oak(-6.0),
        "pine": pine(-1.8),
        "blossom": oak(2.4, seed=5, leaf="#f39ac0", leaf2="#ffc1da", name="blossom"),
        "bush": bush(5.6),
        "rocks": rocks(7.9),
    }
    for o in objs.values():
        bake_ao(o, distance=1.6, lift=0.38)
    preview(list(objs.values()), os.path.abspath(os.path.join(OUT, "preview_scenery.jpg")), size=(1100, 480), cam_loc=(0.8, -17, 4.2), look=(0.8, 0, 2.6), lens=34)
    for k, o in objs.items():
        lod = lod_copy(o, 0.18)
        export(o, os.path.abspath(os.path.join(OUT, f"md_{k}.glb")))
        export(lod, os.path.abspath(os.path.join(OUT, f"md_{k}_lod.glb")))
