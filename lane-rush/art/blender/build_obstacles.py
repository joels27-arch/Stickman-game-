"""Lane Rush obstacles, modelled in Blender: hurdle, slide-under gate, crate stack, rolling barrel.

python3 build_obstacles.py <outdir>  → bl_hurdle.glb, bl_gate.glb, bl_crates.glb, bl_barrel.glb + preview.jpg
Sizes match what the game fits them to (fitProp): the hurdle is cleared above 0.62 m, the gate's beam
leaves a slide gap of ~1 m, the crates block a lane, the barrel rolls along the lane.
"""
import math
import os
import sys

import bpy  # noqa: I001  (bpy first: it provides bmesh)
import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def hurdle(x0=0.0):
    white = mat("hurdle_white", "#f4f6fb", rough=0.35)
    red = mat("hurdle_red", "#e8313a", rough=0.35)
    rubber = mat("rubber", "#2a2d34", rough=0.7)
    steel = mat("steel", "#c9d1dc", rough=0.25, metal=0.85)
    parts = []
    for sx in (-0.8, 0.8):
        x = x0 + sx
        parts.append(cyl(0.045, 0.56, (x, 0.0, 0.05), white, rot=(math.radians(90), 0, 0), name="foot"))
        for sy in (-0.28, 0.28):
            parts.append(sphere(0.055, (x, sy, 0.05), rubber, scale=(1, 1, 0.8), name="cap"))
        parts.append(cyl(0.035, 0.6, (x, 0.12, 0.36), steel, name="upright"))
        parts.append(cyl(0.05, 0.05, (x, 0.12, 0.08), steel, name="collar"))
    # the striped top board: alternating red / white panels
    n = 7
    w = 1.68 / n
    for i in range(n):
        x = x0 - 0.84 + w * (i + 0.5)
        parts.append(box((w - 0.004, 0.05, 0.17), (x, 0.12, 0.6), red if i % 2 == 0 else white, bevel=0.012, segs=2, name="board"))
    return join(parts, "hurdle")


def gate(x0=0.0):
    yellow = mat("haz_yellow", "#ffcc1f", rough=0.4)
    black = mat("haz_black", "#24262c", rough=0.5)
    concrete = mat("concrete", "#a9adb5", rough=0.85)
    cushion = mat("cushion", "#ef3b46", rough=0.55)
    white = mat("cushion_white", "#fbfbfd", rough=0.5)
    panel = mat("panel", "#1d3f8f", rough=0.45)
    lamp = mat("lamp", "#ffd54a", rough=0.2, emit="#ffc42e", emit_strength=4.0)
    parts = []
    for sx in (-0.86, 0.86):
        x = x0 + sx
        parts.append(box((0.42, 0.5, 0.2), (x, 0, 0.1), concrete, bevel=0.04, name="base"))
        seg = 0.25
        for i in range(8):
            parts.append(box((0.15, 0.15, seg - 0.004), (x, 0, 0.2 + seg * (i + 0.5)), yellow if i % 2 == 0 else black, bevel=0.02, segs=2, name="post"))
    # the padded beam you slide under (bottom ~1.03 m)
    parts.append(box((1.6, 0.24, 0.3), (x0, 0, 1.18), cushion, bevel=0.1, segs=4, name="beam"))
    for sx in (-0.45, 0.0, 0.45):
        parts.append(box((0.14, 0.245, 0.305), (x0 + sx, 0, 1.18), white, bevel=0.025, segs=2, name="band"))
    # warning sign on top with lamps
    parts.append(box((1.95, 0.12, 0.28), (x0, 0, 2.08), panel, bevel=0.04, name="sign"))
    for i in range(5):
        parts.append(sphere(0.065, (x0 - 0.7 + i * 0.35, -0.07, 2.08), lamp, scale=(1, 0.6, 1), name="lamp"))
    return join(parts, "gate")


def crate(cx, cy, cz, s, light, dark, iron, rot=0.0):
    parts = []
    t = 0.075 * s
    h = s / 2
    parts.append(box((s - 2 * t * 0.6, s - 2 * t * 0.6, s - 2 * t * 0.6), (cx, cy, cz), dark, bevel=0.01, name="core"))
    # frame bars along the 12 edges
    for ax in range(3):
        for a in (-1, 1):
            for b in (-1, 1):
                size = [t, t, t]
                size[ax] = s
                loc = [cx, cy, cz]
                o1, o2 = [i for i in range(3) if i != ax]
                loc[o1] += a * (h - t / 2)
                loc[o2] += b * (h - t / 2)
                parts.append(box(tuple(size), tuple(loc), light, bevel=0.012, segs=1, name="bar"))
    # diagonal braces on the front and back
    for fy in (-1, 1):
        parts.append(box((s * 1.25, t * 0.8, t), (cx, cy + fy * (h - t * 0.3), cz), light, bevel=0.01, segs=2, rot=(0, math.radians(45), 0), name="brace"))
    # iron corner caps
    for a in (-1, 1):
        for b in (-1, 1):
            for c in (-1, 1):
                parts.append(box((t * 1.2, t * 1.2, t * 1.2), (cx + a * (h - t * 0.5), cy + b * (h - t * 0.5), cz + c * (h - t * 0.5)), iron, bevel=0.012, segs=1, name="corner"))
    o = join(parts, "crate")
    if rot:
        o.rotation_euler = (0, 0, rot)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def crates(x0=0.0):
    light = mat("wood_light", "#d89a52", rough=0.7)
    dark = mat("wood_dark", "#9c6331", rough=0.8)
    iron = mat("iron", "#4a4f58", rough=0.4, metal=0.7)
    s = 0.72
    parts = [
        crate(x0 - 0.37, 0, s / 2, s, light, dark, iron),
        crate(x0 + 0.37, 0, s / 2, s, light, dark, iron, rot=math.radians(4)),
        crate(x0 - 0.33, 0.02, s * 1.5 + 0.005, s, light, dark, iron, rot=math.radians(-6)),
        crate(x0 + 0.36, -0.02, s * 1.5 + 0.005, s, light, dark, iron, rot=math.radians(3)),
        crate(x0 + 0.0, 0, s * 2.5 + 0.01, s, light, dark, iron, rot=math.radians(8)),
    ]
    return join(parts, "crates")


def barrel(x0=0.0):
    wood = mat("barrel_wood", "#b5713a", rough=0.65)
    iron = mat("barrel_iron", "#3d424b", rough=0.35, metal=0.8)
    L, R = 1.4, 0.44
    # lathe the bulged body along X
    bm = bmesh.new()
    rings, seg = 14, 28
    rows = []
    for i in range(rings + 1):
        u = i / rings
        x = -L / 2 + L * u
        r = R * (0.84 + 0.16 * math.sin(math.pi * u))
        row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            # shallow grooves between the staves
            rr = r * (1 - 0.012 * (1 if j % 2 else 0))
            row.append(bm.verts.new((x + x0, rr * math.cos(a), rr * math.sin(a) + R)))
        rows.append(row)
    for i in range(rings):
        for j in range(seg):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % seg], rows[i + 1][(j + 1) % seg], rows[i + 1][j]))
    # ends: a slightly recessed lid, fanned from a centre vertex (the rim stays proud)
    for row, sx in ((rows[0], -1), (rows[-1], 1)):
        c = bm.verts.new((x0 + sx * (L / 2 - 0.035), 0, R))
        for j in range(seg):
            a, b = row[j], row[(j + 1) % seg]
            bm.faces.new((a, b, c) if sx > 0 else (b, a, c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("barrel")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("barrel", me)
    bpy.context.collection.objects.link(body)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    body.data.materials.append(wood)
    parts = [body]
    for u in (0.12, 0.34, 0.66, 0.88):
        x = -L / 2 + L * u
        r = R * (0.84 + 0.16 * math.sin(math.pi * u))
        parts.append(torus(r + 0.004, 0.022, (x + x0, 0, R), iron, rot=(0, math.radians(90), 0), major=36, minor=8, name="hoop"))
    return join(parts, "barrel")


if __name__ == "__main__":
    reset()
    objs = {"hurdle": hurdle(-3.3), "gate": gate(-1.1), "crates": crates(1.15), "barrel": barrel(3.2)}
    for o in objs.values():
        bake_ao(o)
    preview(list(objs.values()), os.path.abspath(os.path.join(OUT, "preview.jpg")), size=(1100, 460), cam_loc=(0, -8.6, 2.6), look=(0, 0, 1.0), lens=32)
    for k, o in objs.items():
        export(o, os.path.abspath(os.path.join(OUT, f"bl_{k}.glb")))
