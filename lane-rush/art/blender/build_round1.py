"""Lane Rush race props, modelled in Blender (round 1): bus, ramp, boost pad, item box, start and finish
gates, and the themed obstacle variants (hay bales, flower arch, tyre stack, cow).

python3 build_round1.py <outdir>  → one GLB per prop + preview_round1*.jpg
Blender axes: X across the lane, -Y toward the runners (glTF +Z), Z up. Sizes follow the game's fitting.
"""
import math
import os
import sys

import bpy  # bpy first: it provides bmesh and mathutils
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _finish, bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"


def text(body, size, loc, material, rot=(math.radians(90), 0, 0), extrude=0.04, align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.active_object
    t.data.body = body
    t.data.size = size
    t.data.extrude = extrude
    t.data.bevel_depth = extrude * 0.25
    t.data.bevel_resolution = 1
    t.data.align_x = align
    t.data.align_y = "CENTER"
    t.data.resolution_u = 4
    bpy.ops.object.convert(target="MESH")
    return _finish(t, material, 0, 0, smooth=30)


def prism(profile, x0, x1, material, name="prism", bevel=0.0):
    """Extrude a (y, z) polygon across X from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
    n = len(profile)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    return _finish(o, material, bevel, 2)


# ── bus: 1.8 m wide, 2.3 m roof, 11 m long, front toward the runners ──


def bus(x0=0.0):
    yellow = mat("bus_yellow", "#ffc21a", rough=0.35)
    red = mat("bus_red", "#e5332a", rough=0.4)
    white = mat("bus_white", "#f5f6f8", rough=0.4)
    glass = mat("bus_glass", "#2f4f78", rough=0.08, metal=0.2)
    black = mat("bus_black", "#23252b", rough=0.6)
    chrome = mat("chrome", "#d9dee6", rough=0.18, metal=0.9)
    lamp = mat("headlamp", "#fff6d0", rough=0.1, emit="#fff1b8", emit_strength=3.0)
    tail = mat("taillamp", "#ff3b30", rough=0.2, emit="#ff2a1f", emit_strength=2.0)
    sign = mat("bus_sign", "#ff9f1c", rough=0.3, emit="#ff8a00", emit_strength=1.6)
    L, W = 11.0, 1.8
    p = [
        box((W, L, 0.5), (x0, 0, 0.55), red, bevel=0.08, name="skirt"),
        box((W - 0.02, L - 0.05, 1.45), (x0, 0, 1.52), yellow, bevel=0.16, segs=4, name="body"),
        box((W - 0.18, L - 0.4, 0.14), (x0, 0, 2.24), white, bevel=0.06, name="roof"),
        box((0.9, 1.6, 0.16), (x0, 1.6, 2.36), white, bevel=0.05, name="ac"),
        box((W + 0.02, L - 0.3, 0.06), (x0, 0, 1.15), white, bevel=0.02, name="stripe"),
    ]
    # side windows
    for i in range(8):
        y = -3.9 + i * 1.12
        for sx in (-1, 1):
            p.append(box((0.04, 0.92, 0.62), (x0 + sx * (W / 2), y, 1.78), glass, bevel=0.03, name="win"))
    # windshield + destination sign, rear window
    p.append(box((W - 0.25, 0.06, 0.78), (x0, -L / 2, 1.72), glass, bevel=0.04, name="windshield"))
    p.append(box((1.1, 0.07, 0.2), (x0, -L / 2 - 0.01, 2.17), sign, bevel=0.02, name="sign"))
    p.append(box((W - 0.4, 0.06, 0.6), (x0, L / 2, 1.78), glass, bevel=0.04, name="rear"))
    # bumpers, lamps, grille
    for sy in (-1, 1):
        p.append(box((W + 0.06, 0.18, 0.24), (x0, sy * (L / 2 + 0.02), 0.42), black, bevel=0.05, name="bumper"))
    for sx in (-0.62, 0.62):
        p.append(sphere(0.13, (x0 + sx, -L / 2 - 0.02, 0.95), lamp, scale=(1, 0.5, 1), segs=16, rings=8, name="lamp"))
        p.append(box((0.22, 0.05, 0.16), (x0 + sx, L / 2 + 0.01, 0.95), tail, bevel=0.02, name="tail"))
    p.append(box((0.8, 0.05, 0.3), (x0, -L / 2 - 0.01, 0.95), chrome, bevel=0.03, name="grille"))
    # mirrors
    for sx in (-1, 1):
        p.append(cyl(0.02, 0.35, (x0 + sx * 1.05, -L / 2 + 0.25, 1.7), black, rot=(0, math.radians(90), 0), verts=8, bevel=0, name="arm"))
        p.append(box((0.08, 0.06, 0.24), (x0 + sx * 1.2, -L / 2 + 0.25, 1.7), black, bevel=0.02, name="mirror"))
    # wheels
    for sy in (-3.6, 3.4):
        for sx in (-1, 1):
            p.append(cyl(0.44, 0.3, (x0 + sx * 0.82, sy, 0.44), black, rot=(0, math.radians(90), 0), verts=24, bevel=0.06, name="tyre"))
            p.append(cyl(0.22, 0.32, (x0 + sx * 0.83, sy, 0.44), chrome, rot=(0, math.radians(90), 0), verts=16, bevel=0.03, name="hub"))
    return join(p, "bus")


# ── ramp: 6 m long up to the bus roof (2.3 m), one lane wide ──


def ramp(x0=0.0):
    steel = mat("ramp_steel", "#3a6fd8", rough=0.4, metal=0.3)
    deck = mat("ramp_deck", "#ffb81f", rough=0.45)
    chev = mat("ramp_chev", "#23252b", rough=0.5)
    rail = mat("ramp_rail", "#e5332a", rough=0.35)
    L, H, W = 6.0, 2.3, 1.8
    p = [prism([(0, 0), (-L, 0), (-L, H - 0.12), (0, 0.02)], x0 - W / 2 + 0.06, x0 + W / 2 - 0.06, steel, name="wedge", bevel=0.03)]
    a = math.atan2(H, L)
    dl = math.hypot(L, H)
    p.append(box((W, dl, 0.12), (x0, -L / 2, H / 2 - 0.02), deck, bevel=0.04, rot=(-a, 0, 0), name="deck"))
    # chevrons on the deck pointing up the ramp (toward -y)
    n = 5
    for i in range(n):
        u = (i + 0.7) / (n + 0.4)
        y, z = -L * u, H * u + 0.06
        for s in (-1, 1):
            arm = box((0.55, 0.14, 0.03), (x0 + s * 0.22, y, z), chev, bevel=0.01, segs=1, rot=(-a, 0, s * math.radians(35)), name="chev")
            p.append(arm)
    # side rails on posts
    for sx in (-1, 1):
        p.append(box((0.08, dl, 0.08), (x0 + sx * (W / 2 - 0.04), -L / 2, H / 2 + 0.42), rail, bevel=0.03, rot=(-a, 0, 0), name="rail"))
        for k in range(4):
            u = (k + 0.5) / 4
            p.append(cyl(0.035, 0.42, (x0 + sx * (W / 2 - 0.04), -L * u, H * u + 0.2), rail, verts=8, bevel=0, name="post"))
    # foot plate at the low end
    p.append(box((W + 0.1, 0.4, 0.05), (x0, 0.12, 0.025), chev, bevel=0.02, name="lip"))
    return join(p, "ramp")


# ── boost pad: 2.4 × 1.4 plate, chevrons pointing -x (the game turns it down the lane) ──


def boost_pad(x0=0.0):
    base = mat("pad_base", "#1b2a4a", rough=0.35, metal=0.4)
    rim = mat("pad_rim", "#e6ecf5", rough=0.3, metal=0.7)
    glow = mat("pad_glow", "#4ff3ff", rough=0.2, emit="#2ee9ff", emit_strength=4.0)
    p = [
        box((2.4, 1.4, 0.06), (x0, 0, 0.03), rim, bevel=0.03, name="rim"),
        box((2.25, 1.25, 0.07), (x0, 0, 0.04), base, bevel=0.025, name="base"),
    ]
    for i in range(3):
        cx = x0 + 0.7 - i * 0.65
        for s in (-1, 1):
            p.append(box((0.5, 0.14, 0.04), (cx - 0.18, s * 0.19, 0.08), glow, bevel=0.015, segs=1, rot=(0, 0, s * math.radians(-40)), name="chev"))
    return join(p, "boost_pad")


# ── item box ──


def item_box(x0=0.0):
    body = mat("ibox_body", "#ffb21f", rough=0.25)
    edge = mat("ibox_edge", "#fff4d6", rough=0.3)
    q = mat("ibox_q", "#ffffff", rough=0.25, emit="#fff3c4", emit_strength=0.6)
    p = [box((0.9, 0.9, 0.9), (x0, 0, 0.5), body, bevel=0.12, segs=4, name="cube")]
    for ax in range(3):
        for a in (-1, 1):
            for b in (-1, 1):
                size = [0.08, 0.08, 0.08]
                size[ax] = 0.92
                loc = [x0, 0, 0.5]
                o1, o2 = [i for i in range(3) if i != ax]
                loc[o1] += a * 0.43
                loc[o2] += b * 0.43
                p.append(box(tuple(size), tuple(loc), edge, bevel=0.035, segs=2, name="edge"))
    # a "?" on four sides and the top
    p.append(text("?", 0.62, (x0, -0.47, 0.48), q, rot=(math.radians(90), 0, 0), extrude=0.03))
    p.append(text("?", 0.62, (x0, 0.47, 0.48), q, rot=(math.radians(90), 0, math.radians(180)), extrude=0.03))
    p.append(text("?", 0.62, (x0 + 0.47, 0, 0.48), q, rot=(math.radians(90), 0, math.radians(90)), extrude=0.03))
    p.append(text("?", 0.62, (x0 - 0.47, 0, 0.48), q, rot=(math.radians(90), 0, math.radians(-90)), extrude=0.03))
    p.append(text("?", 0.62, (x0, 0, 0.97), q, rot=(0, 0, 0), extrude=0.03))
    return join(p, "item_box")


# ── start / finish gates: inflatable arches over the whole track (~16 m wide) ──


def arch_gate(x0, label, tube_hex, banner_hex, checker=False):
    tube = mat(f"{label}_tube", tube_hex, rough=0.5)
    tube2 = mat(f"{label}_tube2", "#ffffff", rough=0.5)
    banner = mat(f"{label}_banner", banner_hex, rough=0.45)
    letters = mat("gate_letters", "#ffffff", rough=0.35)
    blk = mat("check_black", "#1f2127", rough=0.5)
    wht = mat("check_white", "#f7f8fa", rough=0.5)
    weight = mat("gate_weight", "#3a3f48", rough=0.8)
    R, r = 7.3, 0.6
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=14, location=(x0, 0, 0), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object
    bpy.ops.object.transform_apply(rotation=True)
    bm = bmesh.new()
    bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context="VERTS")
    # stripe the tube: every other segment gets the second colour
    bm.to_mesh(t.data)
    bm.free()
    t.data.materials.append(tube)
    t.data.materials.append(tube2)
    for poly in t.data.polygons:
        ang = math.degrees(math.atan2(poly.center.z, poly.center.x - x0))
        poly.material_index = 1 if int(ang // 15) % 2 else 0
    bpy.context.view_layer.objects.active = t
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    # squash it a little so it reads as an inflatable, not a ring
    t.scale = (1.0, 1.0, 0.92)
    bpy.ops.object.transform_apply(scale=True)
    p = [t]
    # ground weights
    for sx in (-1, 1):
        p.append(box((1.6, 1.6, 0.4), (x0 + sx * R, 0, 0.2), weight, bevel=0.08, name="weight"))
    # banner across the top
    bw, bh = 8.0, 1.5
    p.append(box((bw, 0.3, bh), (x0, 0, R - 1.6), banner, bevel=0.1, name="banner"))
    if checker:
        n = 16
        for row, z in enumerate((R - 1.6 + bh / 2 - 0.12, R - 1.6 - bh / 2 + 0.12)):
            for i in range(n):
                c = blk if (i + row) % 2 else wht
                p.append(box((bw / n, 0.32, 0.24), (x0 - bw / 2 + bw / n * (i + 0.5), 0, z), c, bevel=0.0, segs=1, name="chk"))
    for sy, rz in ((-0.17, 0), (0.17, 180)):
        p.append(text(label, 0.85 if checker else 1.0, (x0, sy, R - 1.6 - 0.02), letters, rot=(math.radians(90), 0, math.radians(rz)), extrude=0.05))
    return join(p, f"gate_{label.lower()}")


# ── themed obstacle variants ──


def hay(x0=0.0):
    straw = mat("straw", "#e9c45a", rough=0.85)
    straw2 = mat("straw2", "#d4a93e", rough=0.85)
    twine = mat("twine", "#8a5a2b", rough=0.8)
    p = []
    for i, sx in enumerate((-0.43, 0.43)):
        p.append(box((0.84, 0.6, 0.58), (x0 + sx, 0, 0.29), straw if i == 0 else straw2, bevel=0.07, segs=3, name="bale"))
        for k in (-0.2, 0.2):
            p.append(box((0.06, 0.63, 0.61), (x0 + sx + k, 0, 0.29), twine, bevel=0.02, segs=1, name="twine"))
    import random

    rnd = random.Random(3)
    for _ in range(14):
        x = x0 + rnd.uniform(-0.8, 0.8)
        y = rnd.uniform(-0.28, 0.28)
        p.append(cyl(0.012, 0.18, (x, y, 0.62), straw, verts=4, bevel=0, rot=(rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), 0), name="tuft"))
    return join(p, "hay")


def flower_arch(x0=0.0):
    log = mat("log", "#8b5a33", rough=0.85)
    end = mat("log_end", "#d9a46b", rough=0.8)
    leaf = mat("vine", "#4caf3f", rough=0.8)
    pink = mat("petal_pink", "#ff7fb3", rough=0.5)
    yel = mat("petal_yellow", "#ffd84a", rough=0.5)
    p = []
    for sx in (-0.86, 0.86):
        p.append(cyl(0.12, 2.15, (x0 + sx, 0, 1.075), log, verts=12, bevel=0.03, name="post"))
    p.append(cyl(0.16, 2.0, (x0, 0, 1.2), log, verts=14, bevel=0.03, rot=(0, math.radians(90), 0), name="beam"))
    for sx in (-1, 1):
        p.append(cyl(0.15, 0.02, (x0 + sx * 1.0, 0, 1.2), end, verts=14, bevel=0, rot=(0, math.radians(90), 0), name="end"))
    p.append(cyl(0.1, 1.95, (x0, 0, 2.08), log, verts=10, bevel=0.02, rot=(0, math.radians(90), 0), name="top"))
    import random

    rnd = random.Random(7)
    for i in range(18):
        x = x0 + rnd.uniform(-0.9, 0.9)
        z = rnd.choice((1.2, 2.08)) + rnd.uniform(-0.05, 0.1)
        p.append(sphere(rnd.uniform(0.12, 0.18), (x, rnd.uniform(-0.12, 0.12), z + 0.12), leaf, segs=10, rings=6, name="leaf"))
        if i % 2 == 0:
            p.append(sphere(0.07, (x + 0.05, -0.17, z + 0.14), pink if i % 4 else yel, segs=10, rings=6, name="flower"))
    return join(p, "flower_arch")


def tyres(x0=0.0):
    rubber = mat("tyre_rubber", "#2a2c31", rough=0.75)
    paints = [mat("tyre_red", "#e8343b", rough=0.5), mat("tyre_white", "#f2f3f5", rough=0.5), mat("tyre_yellow", "#ffc61a", rough=0.5)]
    p = []
    for col, sx in enumerate((-0.44, 0.44)):
        for k in range(8):
            z = 0.15 + k * 0.29
            m = paints[(k + col) % 3] if (k + col) % 3 == 0 else rubber
            p.append(torus(0.3, 0.14, (x0 + sx + (0.02 if k % 2 else -0.02), 0, z), m, major=28, minor=10, name="tyre"))
    return join(p, "tyres")


def cow(x0=0.0):
    white = mat("cow_white", "#f7f5f0", rough=0.6)
    black = mat("cow_black", "#2b2a2e", rough=0.6)
    pinkm = mat("cow_pink", "#f4a7b5", rough=0.5)
    horn = mat("cow_horn", "#f1e2c2", rough=0.5)
    p = [
        sphere(0.75, (x0, 0.3, 1.45), white, scale=(1.0, 1.55, 0.85), segs=24, rings=14, name="body"),
        sphere(0.48, (x0, -0.95, 1.8), white, scale=(0.95, 1.0, 1.05), segs=20, rings=12, name="head"),
        sphere(0.3, (x0, -1.32, 1.62), pinkm, scale=(1.25, 0.8, 0.85), segs=16, rings=10, name="snout"),
    ]
    for sx in (-1, 1):
        p.append(sphere(0.06, (x0 + sx * 0.12, -1.55, 1.66), black, segs=8, rings=6, name="nostril"))
        p.append(sphere(0.085, (x0 + sx * 0.2, -1.33, 1.98), black, segs=10, rings=8, name="eye"))
        p.append(cyl(0.06, 0.28, (x0 + sx * 0.32, -0.95, 2.22), horn, r2=0.02, verts=8, bevel=0, rot=(0, sx * math.radians(-35), 0), name="horn"))
        p.append(sphere(0.14, (x0 + sx * 0.5, -0.95, 1.98), white, scale=(1.2, 0.5, 0.6), segs=12, rings=8, name="ear"))
        for sy in (-0.45, 0.95):
            p.append(cyl(0.13, 1.0, (x0 + sx * 0.38, sy, 0.55), white, verts=12, bevel=0.02, name="leg"))
            p.append(cyl(0.15, 0.16, (x0 + sx * 0.38, sy, 0.08), black, verts=12, bevel=0.03, name="hoof"))
    for (sx, sy, sz, r) in ((0.45, 0.1, 1.7, 0.32), (-0.55, 0.7, 1.5, 0.28), (0.2, 1.1, 1.85, 0.25), (-0.3, -0.2, 1.95, 0.22)):
        p.append(sphere(r, (x0 + sx, sy, sz), black, scale=(0.6, 1.0, 0.8), segs=14, rings=8, name="spot"))
    p.append(sphere(0.2, (x0, 0.55, 0.85), pinkm, scale=(1, 1, 0.7), segs=12, rings=8, name="udder"))
    p.append(cyl(0.04, 0.7, (x0, 1.55, 1.3), white, verts=6, bevel=0, rot=(math.radians(30), 0, 0), name="tail"))
    return join(p, "cow")


if __name__ == "__main__":
    reset()
    objs = {
        "bus": bus(0),
        "ramp": ramp(3.0),
        "boost_pad": boost_pad(6.0),
        "box": item_box(9.0),
    }
    gates = {"gate_start": arch_gate(0, "START", "#2f7df6", "#1f4fc9"), "gate_finish": arch_gate(20, "FINISH", "#e5332a", "#c41f2a", checker=True)}
    variants = {"hay": hay(-6), "arch": flower_arch(-3.2), "tires": tyres(-0.5), "cow": cow(2.6)}
    for o in [*objs.values(), *gates.values(), *variants.values()]:
        bake_ao(o, distance=1.0)
    # previews: race props / gates / variants (each render hides the other groups)
    groups = [("preview_round1a.jpg", objs, (4.5, -15, 5.5), (4.5, 0, 1.2)), ("preview_round1b.jpg", gates, (10, -34, 6), (10, 0, 4)), ("preview_round1c.jpg", variants, (-1.6, -9, 2.4), (-1.6, 0, 1.1))]
    everything = [*objs.values(), *gates.values(), *variants.values()]
    for name, g, cam, look in groups:
        for o in everything:
            o.hide_render = o not in g.values()
        preview(list(g.values()), os.path.abspath(os.path.join(OUT, name)), size=(1100, 460), cam_loc=cam, look=look, lens=32)
        for o in list(bpy.data.objects):
            if o.type in ("CAMERA", "LIGHT") or o.name.startswith("Plane"):
                bpy.data.objects.remove(o)
    for o in everything:
        o.hide_render = False
    files = {"bus": "bl_bus", "ramp": "bl_ramp", "boost_pad": "bl_boost_pad", "box": "bl_box", "gate_start": "bl_gate_start", "gate_finish": "bl_gate_finish", "hay": "bl_hay", "arch": "bl_arch", "tires": "bl_tires", "cow": "bl_cow"}
    for k, o in {**objs, **gates, **variants}.items():
        export(o, os.path.abspath(os.path.join(OUT, f"{files[k]}.glb")))
