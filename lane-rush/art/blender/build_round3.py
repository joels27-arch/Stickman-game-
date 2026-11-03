"""Lane Rush map sets, modelled in Blender (round 3): farm, beach, city, stadium and space props and running tiles.

python3 build_round3.py <outdir> [farm beach city stadium space]  → <name>.glb (+ <name>_lod.glb) + preview_<set>.jpg
Same file names as the old Higgsfield models, so the game's loaders and fitting stay as they are.
Tiles are 9.6 m square (the track width) and repeat seamlessly along the lane.
"""
import math
import os
import random
import sys

import bpy  # bpy first: it provides bmesh and mathutils
import bmesh
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_round1 import prism, text  # noqa: E402
from build_scenery import blob, lod_copy, trunk  # noqa: E402
from common import _finish, bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.endswith(".py")]
OUT = ARGS[0] if ARGS else "out"
SETS = ARGS[1:] or ["farm", "beach", "city", "stadium", "space"]
TW = 9.6  # track width: tiles are TW × TW


def flat_ao(o):
    me = o.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = me.color_attributes["AO"]
    for d in me.color_attributes["AO"].data:
        d.color = (1, 1, 1, 1)


def rot_apply(o, rx=0.0, ry=0.0, rz=0.0):
    o.rotation_euler = (rx, ry, rz)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(rotation=True)
    return o


def beam(a, b, r, material, verts=8):
    """A round bar from point a to point b."""
    return trunk(a, b, r, r, material, verts=verts)


# ════════════════════════ FARM ════════════════════════


def barn(x0):
    red = mat("barn_red", "#c8352b", rough=0.7)
    trim = mat("barn_trim", "#f5f1e8", rough=0.6)
    roof = mat("barn_roof", "#4a4f5a", rough=0.6)
    dark = mat("barn_dark", "#3b2416", rough=0.8)
    W, D, H = 6.0, 7.0, 3.6
    gambrel = [(-D / 2, 0), (D / 2, 0), (D / 2, H), (D / 2 - 1.0, H + 1.7), (0, H + 2.6), (-D / 2 + 1.0, H + 1.7), (-D / 2, H)]
    body = prism([(y, z) for y, z in gambrel], x0 - W / 2, x0 + W / 2, red, name="barn", bevel=0.04)
    rot_apply(body, rz=math.radians(90))  # gable faces the camera (-y)
    p = [body]
    # roof planes (slightly proud of the walls)
    for side in (-1, 1):
        for (y0, z0, y1, z1) in ((D / 2 + 0.15, H - 0.05, D / 2 - 1.0, H + 1.75), (D / 2 - 1.0, H + 1.7, 0, H + 2.65)):
            ya, yb = side * y0, side * y1
            mid = Vector((0, (ya + yb) / 2, (z0 + z1) / 2))
            ln = math.hypot(yb - ya, z1 - z0)
            r = box((ln + 0.15, W + 0.5, 0.14), (x0 + mid.y, 0, mid.z), roof, bevel=0.03, name="roof")
            rot_apply(r, ry=-math.atan2(z1 - z0, yb - ya))
            p.append(r)
    # front: big X doors + hayloft
    fy = -W / 2 - 0.02
    p.append(box((2.4, 0.08, 2.6), (x0, fy, 1.3), red, bevel=0.03, name="door"))
    for dx in (-0.6, 0.6):
        p.append(box((1.2, 0.1, 0.14), (x0 + dx, fy - 0.02, 2.55), trim, bevel=0.02, name="t"))
        p.append(box((1.2, 0.1, 0.14), (x0 + dx, fy - 0.02, 0.07), trim, bevel=0.02, name="t"))
        for s in (-1, 1):
            d = box((1.6, 0.1, 0.12), (x0 + dx, fy - 0.03, 1.3), trim, bevel=0.02, name="x")
            rot_apply(d, ry=s * math.radians(58))
            p.append(d)
    for dx in (-1.25, 0, 1.25):
        p.append(box((0.14, 0.1, 2.6), (x0 + dx, fy - 0.02, 1.3), trim, bevel=0.02, name="t"))
    p.append(box((1.3, 0.1, 1.1), (x0, fy, H + 1.1), dark, bevel=0.03, name="loft"))
    p.append(box((1.5, 0.12, 0.12), (x0, fy - 0.02, H + 1.7), trim, bevel=0.02, name="loft_t"))
    p.append(box((1.5, 0.12, 0.12), (x0, fy - 0.02, H + 0.5), trim, bevel=0.02, name="loft_b"))
    # corner trims
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(box((0.16, 0.16, H), (x0 + sx * W / 2, sy * D / 2, H / 2), trim, bevel=0.03, name="corner"))
    return join(p, "barn")


def windmill(x0):
    wall = mat("mill_wall", "#f2ede2", rough=0.7)
    wood = mat("mill_wood", "#8b5a33", rough=0.8)
    cap = mat("mill_cap", "#3f6fb5", rough=0.5)
    sail = mat("mill_sail", "#fbf7ee", rough=0.6)
    p = [cyl(1.9, 7.5, (x0, 0, 3.75), wall, r2=1.25, verts=8, bevel=0.06, name="tower")]
    p.append(cyl(2.1, 0.4, (x0, 0, 0.2), wood, verts=8, bevel=0.05, name="base"))
    p.append(cyl(1.6, 0.25, (x0, 0, 4.2), wood, verts=8, bevel=0.04, name="gallery"))
    p.append(sphere(1.45, (x0, 0, 7.6), cap, scale=(1, 1.15, 0.85), segs=16, rings=8, name="cap"))
    p.append(box((0.9, 0.1, 1.5), (x0, -1.93, 1.0), wood, bevel=0.04, name="door"))
    for z in (3.2, 5.6):
        p.append(box((0.6, 0.1, 0.7), (x0, -1.72 + (z - 3.2) * 0.2, z), wood, bevel=0.03, name="win"))
    hub = (x0, -1.7, 7.6)
    p.append(cyl(0.3, 0.6, hub, wood, rot=(math.radians(90), 0, 0), verts=12, bevel=0.04, name="hub"))
    for k in range(4):
        a = k * math.pi / 2 + math.radians(20)
        d = Vector((math.cos(a), 0, math.sin(a)))
        c = Vector(hub) + d * 2.9 + Vector((0, -0.15, 0))
        arm = box((5.4, 0.14, 0.18), tuple(c), wood, bevel=0.03, name="arm")
        rot_apply(arm, ry=-a)
        p.append(arm)
        frame = box((4.0, 0.06, 1.1), tuple(Vector(hub) + d * 3.4 + Vector((0, -0.12, 0)) + Vector((-math.sin(a), 0, math.cos(a))) * 0.62), sail, bevel=0.03, name="sail")
        rot_apply(frame, ry=-a)
        p.append(frame)
    return join(p, "windmill")


def wheat(x0):
    gold = mat("wheat_gold", "#e9c35a", rough=0.75)
    gold2 = mat("wheat_gold2", "#d7a93f", rough=0.75)
    soil = mat("wheat_soil", "#8a6238", rough=0.95)
    rnd = random.Random(11)
    p = [box((6.8, 3.0, 0.12), (x0, 0, 0.06), soil, bevel=0.05, name="soil")]
    for i in range(120):
        x = x0 + rnd.uniform(-3.2, 3.2)
        y = rnd.uniform(-1.3, 1.3)
        h = rnd.uniform(1.1, 1.6)
        m = gold if i % 3 else gold2
        st = cyl(0.045, h, (x, y, h / 2), m, verts=4, bevel=0, name="stalk")
        rot_apply(st, rx=rnd.uniform(-0.15, 0.15), ry=rnd.uniform(-0.15, 0.15))
        p.append(st)
        p.append(sphere(0.09, (x, y, h + 0.08), m, scale=(1, 1, 2.6), segs=5, rings=4, name="ear"))
    return join(p, "wheat")


def tractor(x0):
    green = mat("tractor_green", "#2fa043", rough=0.4)
    yellow = mat("tractor_yellow", "#ffc61a", rough=0.4)
    black = mat("tractor_black", "#25272c", rough=0.6)
    glass = mat("tractor_glass", "#9fd3ff", rough=0.08)
    chrome = mat("chrome", "#d9dee6", rough=0.18, metal=0.9)
    p = [
        box((2.0, 1.0, 0.9), (x0 + 0.4, 0, 1.1), green, bevel=0.12, name="hood"),
        box((1.3, 1.2, 0.5), (x0 - 0.8, 0, 1.05), green, bevel=0.08, name="seatbase"),
        box((0.08, 1.15, 1.2), (x0 - 0.4, 0, 1.9), black, bevel=0.03, name="cabpost"),
        box((1.4, 1.35, 0.1), (x0 - 0.8, 0, 2.55), green, bevel=0.04, name="roof"),
        box((0.06, 1.0, 0.8), (x0 - 0.15, 0, 1.95), glass, bevel=0.02, name="windscreen"),
        box((0.3, 0.8, 0.5), (x0 + 1.45, 0, 1.0), chrome, bevel=0.06, name="grille"),
    ]
    for sx in (-0.15, -1.45):
        for sy in (-1, 1):
            p.append(cyl(0.04, 1.3, (x0 + sx, sy * 0.62, 1.9), black, verts=8, bevel=0, name="post"))
    p.append(cyl(0.07, 0.9, (x0 + 1.0, 0.3, 1.9), black, verts=10, bevel=0.01, name="exhaust"))
    for sy in (-1, 1):
        p.append(cyl(0.78, 0.5, (x0 - 0.8, sy * 0.8, 0.78), black, rot=(math.radians(90), 0, 0), verts=24, bevel=0.08, name="rear"))
        p.append(cyl(0.45, 0.52, (x0 - 0.8, sy * 0.82, 0.78), yellow, rot=(math.radians(90), 0, 0), verts=20, bevel=0.04, name="rim"))
        p.append(cyl(0.45, 0.32, (x0 + 1.0, sy * 0.65, 0.45), black, rot=(math.radians(90), 0, 0), verts=20, bevel=0.06, name="front"))
        p.append(cyl(0.25, 0.34, (x0 + 1.0, sy * 0.67, 0.45), yellow, rot=(math.radians(90), 0, 0), verts=16, bevel=0.03, name="frim"))
    return join(p, "tractor")


def sunflowers(x0):
    stem = mat("sf_stem", "#3f9a3a", rough=0.7)
    petal = mat("sf_petal", "#ffcf1f", rough=0.5)
    seed = mat("sf_seed", "#5a3a1a", rough=0.9)
    rnd = random.Random(4)
    p = []
    for i, (dx, dy, h) in enumerate(((0, 0, 2.3), (-0.5, 0.25, 1.8), (0.45, 0.3, 2.0), (-0.2, -0.35, 1.5), (0.3, -0.3, 1.6))):
        x, y = x0 + dx, dy
        p.append(cyl(0.045, h, (x, y, h / 2), stem, verts=8, bevel=0, name="stem"))
        for s in (-1, 1):
            leaf = sphere(0.22, (x + s * 0.18, y, h * 0.5 + i * 0.05), stem, scale=(1, 0.4, 0.12), segs=10, rings=6, name="leaf")
            rot_apply(leaf, ry=s * math.radians(-25))
            p.append(leaf)
        hz = h + 0.05
        head = Vector((x, y - 0.05, hz))
        for k in range(12):
            a = k * math.tau / 12
            pc = head + Vector((math.cos(a) * 0.27, 0, math.sin(a) * 0.27))
            pt = sphere(0.13, tuple(pc), petal, scale=(1, 0.25, 0.45), segs=8, rings=6, name="petal")
            rot_apply(pt, ry=-a + math.pi / 2)
            p.append(pt)
        p.append(cyl(0.2, 0.08, tuple(head + Vector((0, -0.03, 0))), seed, rot=(math.radians(90), 0, 0), verts=16, bevel=0.03, name="disc"))
    return join(p, "sunflowers")


def farm_tile(x0):
    dirt = mat("farm_dirt", "#b88a55", rough=0.95)
    rut = mat("farm_rut", "#9c7243", rough=0.95)
    grass = mat("farm_grass", "#6cbf45", rough=0.9)
    p = [box((TW, TW, 0.3), (x0, 0, -0.15), dirt, bevel=0.0, segs=1, name="base")]
    for sx in (-3.0, -1.0, 1.0, 3.0):
        for dx in (-0.45, 0.45):
            p.append(box((0.32, TW, 0.02), (x0 + sx + dx, 0, 0.005), rut, bevel=0.0, segs=1, name="rut"))
    for sx in (-1, 1):
        p.append(box((0.5, TW, 0.06), (x0 + sx * (TW / 2 - 0.25), 0, 0.02), grass, bevel=0.0, segs=1, name="verge"))
    return join(p, "farm_tile")


# ════════════════════════ BEACH ════════════════════════


def palm(x0):
    bark = mat("palm_bark", "#a0703f", rough=0.85)
    ring = mat("palm_ring", "#7d5530", rough=0.85)
    frond = mat("palm_frond", "#3fb04a", rough=0.6)
    frond2 = mat("palm_frond2", "#5fcb52", rough=0.6)
    nut = mat("coconut", "#6b4523", rough=0.7)
    p = []
    pts = [Vector((x0 + 0.9 * (t**2), 0, 6.2 * t)) for t in [i / 8 for i in range(9)]]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        r = 0.32 - 0.02 * i
        p.append(trunk(tuple(a), tuple(b + Vector((0, 0, 0.05))), r, r * 0.88, bark if i % 2 else ring, verts=10))
    top = pts[-1] + Vector((0, 0, 0.2))
    for k in range(8):
        a = k * math.tau / 8
        d = Vector((math.cos(a), math.sin(a), 0))
        for j in range(4):  # each frond: a chain of flattened, drooping leaflets
            c = top + d * (0.8 + j * 0.95) + Vector((0, 0, 0.4 - 0.22 * j * j))
            leaf = sphere(0.7 - 0.08 * j, tuple(c), frond if k % 2 else frond2, scale=(1.5, 0.55, 0.08), segs=12, rings=6, name="frond")
            rot_apply(leaf, ry=math.radians(8 + 14 * j), rz=a)
            p.append(leaf)
    for k in range(3):
        a = k * math.tau / 3 + 0.5
        p.append(sphere(0.2, tuple(top + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, -0.25))), nut, segs=12, rings=8, name="nut"))
    return join(p, "palm")


def hut(x0):
    bamboo = mat("bamboo", "#d8b36a", rough=0.7)
    bamboo2 = mat("bamboo2", "#b98d48", rough=0.7)
    thatch = mat("thatch", "#c99a4a", rough=0.9)
    thatch2 = mat("thatch2", "#a97a35", rough=0.9)
    dark = mat("hut_dark", "#3a2616", rough=0.9)
    p = [box((3.2, 3.0, 0.3), (x0, 0, 0.15), bamboo2, bevel=0.05, name="deck")]
    n = 11
    for i in range(n):
        x = x0 - 1.4 + 2.8 * i / (n - 1)
        for sy in (-1.3, 1.3):
            if sy < 0 and abs(x - x0) < 0.45:
                continue  # the door
            p.append(cyl(0.12, 2.2, (x, sy, 1.4), bamboo if i % 2 else bamboo2, verts=6, bevel=0, name="pole"))
    for i in range(n):
        y = -1.3 + 2.6 * i / (n - 1)
        for sx in (-1.4, 1.4):
            p.append(cyl(0.12, 2.2, (x0 + sx, y, 1.4), bamboo if i % 2 else bamboo2, verts=6, bevel=0, name="pole"))
    p.append(box((0.9, 0.06, 1.8), (x0, -1.31, 1.2), dark, bevel=0.02, name="door"))
    roof = cyl(3.0, 2.2, (x0, 0, 3.55), thatch, r2=0.1, verts=4, bevel=0.06, name="roof")
    rot_apply(roof, rz=math.radians(45))
    p.append(roof)
    p.append(cyl(3.05, 0.3, (x0, 0, 2.55), thatch2, r2=2.9, verts=4, bevel=0.04, name="fringe"))
    p[-1] = rot_apply(p[-1], rz=math.radians(45))
    return join(p, "hut")


def lighthouse(x0):
    red = mat("lh_red", "#e3352d", rough=0.5)
    white = mat("lh_white", "#f6f6f4", rough=0.5)
    dark = mat("lh_dark", "#2c3038", rough=0.5)
    lamp = mat("lh_lamp", "#fff2a8", rough=0.1, emit="#ffe066", emit_strength=4.0)
    rock = mat("lh_rock", "#8b939e", rough=0.9)
    p = [blob(2.6, (x0, 0, 0.5), rock, squash=(1.2, 1.1, 0.4), sub=2, amp=0.15, seed=2)]
    n = 6
    for i in range(n):
        z0, z1 = 1.0 + i * 2.4, 1.0 + (i + 1) * 2.4
        r0, r1 = 1.7 - 0.12 * i, 1.7 - 0.12 * (i + 1)
        p.append(cyl(r0, z1 - z0, (x0, 0, (z0 + z1) / 2), red if i % 2 == 0 else white, r2=r1, verts=24, bevel=0.0, name="band"))
    top = 1.0 + n * 2.4
    p.append(cyl(1.35, 0.25, (x0, 0, top + 0.12), dark, verts=24, bevel=0.04, name="gallery"))
    for k in range(16):
        a = k * math.tau / 16
        p.append(cyl(0.03, 0.6, (x0 + 1.3 * math.cos(a), 1.3 * math.sin(a), top + 0.55), dark, verts=6, bevel=0, name="rail"))
    p.append(torus(1.3, 0.04, (x0, 0, top + 0.85), dark, major=24, minor=6, name="railtop"))
    p.append(cyl(0.75, 1.2, (x0, 0, top + 0.85), lamp, verts=16, bevel=0.02, name="lamp"))
    p.append(cyl(0.9, 0.9, (x0, 0, top + 1.9), red, r2=0.1, verts=16, bevel=0.03, name="dome"))
    p.append(box((0.8, 0.1, 1.6), (x0, -1.66, 1.8), dark, bevel=0.03, name="door"))
    return join(p, "lighthouse")


def umbrella(x0):
    pole = mat("umb_pole", "#f2f2f2", rough=0.4)
    a_m = mat("umb_red", "#ff5a5f", rough=0.5)
    b_m = mat("umb_white", "#fdfcf8", rough=0.5)
    towel = mat("towel", "#3fa9f5", rough=0.7)
    p = [cyl(0.05, 2.4, (x0, 0, 1.2), pole, verts=8, bevel=0, name="pole")]
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=1.6, radius2=0.06, depth=0.6, location=(x0, 0, 2.35))
    c = bpy.context.active_object
    c.data.materials.append(a_m)
    c.data.materials.append(b_m)
    for poly in c.data.polygons:
        ang = math.atan2(poly.center.y, poly.center.x - x0)
        poly.material_index = int((ang + math.pi) / (math.tau / 8)) % 2
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    p.append(c)
    p.append(sphere(0.08, (x0, 0, 2.68), pole, segs=8, rings=6, name="finial"))
    p.append(box((1.0, 2.0, 0.03), (x0 + 0.9, 0.2, 0.02), towel, bevel=0.01, segs=1, name="towel"))
    return join(p, "umbrella")


def board_tile(x0):
    w1 = mat("board_w1", "#c99a63", rough=0.8)
    w2 = mat("board_w2", "#b4844f", rough=0.8)
    gap = mat("board_gap", "#5a3d22", rough=0.9)
    p = [box((TW, TW, 0.2), (x0, 0, -0.12), gap, bevel=0.0, segs=1, name="under")]
    n = 24
    pitch = TW / n
    for i in range(n):
        y = -TW / 2 + pitch * (i + 0.5)
        p.append(box((TW - 0.1, pitch - 0.05, 0.1), (x0, y, -0.03), w1 if i % 3 else w2, bevel=0.015, segs=1, name="plank"))
    for sx in (-1, 1):
        p.append(box((0.25, TW, 0.12), (x0 + sx * (TW / 2 - 0.12), 0, 0.0), w2, bevel=0.02, segs=1, name="edge"))
    return join(p, "board_tile")


# ════════════════════════ CITY ════════════════════════


def ct_tower(x0):
    glass = mat("tower_glass", "#5f9fd6", rough=0.08, metal=0.3)
    frame = mat("tower_frame", "#dfe3ea", rough=0.5)
    roofm = mat("tower_roof", "#3a3f48", rough=0.6)
    red = mat("beacon", "#ff3b30", rough=0.2, emit="#ff2a1f", emit_strength=3.0)
    p = []
    tiers = [(0, 16, 8.0), (16, 8, 6.4), (24, 4, 4.6)]
    for z0, h, w in tiers:
        p.append(box((w, w, h), (x0, 0, z0 + h / 2), glass, bevel=0.06, name="glass"))
        floors = int(h / 1.6)
        for f in range(floors + 1):
            p.append(box((w + 0.08, w + 0.08, 0.18), (x0, 0, z0 + f * h / floors), frame, bevel=0.03, segs=1, name="slab"))
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(box((0.3, 0.3, h), (x0 + sx * w / 2, sy * w / 2, z0 + h / 2), frame, bevel=0.04, segs=1, name="col"))
        p.append(box((w + 0.2, w + 0.2, 0.3), (x0, 0, z0 + h + 0.15), roofm, bevel=0.05, name="cap"))
    p.append(cyl(0.08, 3.5, (x0, 0, 30.0), frame, verts=8, bevel=0, name="antenna"))
    p.append(sphere(0.18, (x0, 0, 31.8), red, segs=8, rings=6, name="beacon"))
    return join(p, "ct_tower")


def ct_shop(x0):
    brick = mat("shop_brick", "#d0704b", rough=0.85)
    trim = mat("shop_trim", "#f4efe6", rough=0.6)
    glass = mat("shop_glass", "#7fc0ef", rough=0.08)
    aw1 = mat("awn_a", "#2f9e5b", rough=0.6)
    aw2 = mat("awn_b", "#ffffff", rough=0.6)
    sign = mat("shop_sign", "#ffcf3a", rough=0.4, emit="#ffbf1a", emit_strength=0.8)
    W, D, H = 8.0, 6.0, 12.0
    p = [box((W, D, H), (x0, 0, H / 2), brick, bevel=0.08, name="block")]
    p.append(box((W + 0.3, D + 0.3, 0.4), (x0, 0, H + 0.2), trim, bevel=0.06, name="cornice"))
    p.append(box((W - 1.0, 0.1, 2.6), (x0, -D / 2 - 0.03, 1.5), glass, bevel=0.03, name="front"))
    for i in range(8):
        a = box((W / 8 - 0.02, 1.4, 0.08), (x0 - W / 2 + W / 8 * (i + 0.5), -D / 2 - 0.7, 3.2), aw1 if i % 2 else aw2, bevel=0.0, segs=1, name="awn")
        rot_apply(a, rx=math.radians(-18))
        p.append(a)
    p.append(box((4.0, 0.15, 0.9), (x0, -D / 2 - 0.08, 4.1), sign, bevel=0.04, name="sign"))
    for f in range(2):
        for k in range(4):
            z = 6.3 + f * 3.0
            x = x0 - W / 2 + 1.2 + k * 1.85
            p.append(box((1.1, 0.1, 1.6), (x, -D / 2 - 0.03, z), glass, bevel=0.03, name="win"))
            p.append(box((1.35, 0.14, 0.14), (x, -D / 2 - 0.06, z - 0.9), trim, bevel=0.02, segs=1, name="sill"))
    return join(p, "ct_shop")


def ct_lamp(x0):
    metal = mat("lamp_metal", "#2f3540", rough=0.4, metal=0.6)
    glow = mat("lamp_glow", "#fff4c4", rough=0.1, emit="#ffe9a0", emit_strength=3.0)
    p = [cyl(0.22, 0.4, (x0, 0, 0.2), metal, verts=12, bevel=0.04, name="base"), cyl(0.08, 5.0, (x0, 0, 2.6), metal, r2=0.06, verts=10, bevel=0, name="pole")]
    for i in range(6):
        a0, a1 = i / 6 * math.pi / 2, (i + 1) / 6 * math.pi / 2
        pa = Vector((x0 + 0.6 * (1 - math.cos(a0)), 0, 5.0 + 0.6 * math.sin(a0)))
        pb = Vector((x0 + 0.6 * (1 - math.cos(a1)), 0, 5.0 + 0.6 * math.sin(a1)))
        p.append(beam(tuple(pa), tuple(pb), 0.05, metal))
    p.append(cyl(0.3, 0.25, (x0 + 1.0, 0, 5.45), metal, r2=0.12, verts=12, bevel=0.02, name="head"))
    p.append(sphere(0.2, (x0 + 1.0, 0, 5.28), glow, scale=(1, 1, 0.5), segs=12, rings=6, name="bulb"))
    return join(p, "ct_lamp")


def ct_taxi(x0):
    yel = mat("taxi_yellow", "#ffcc1a", rough=0.3)
    glass = mat("taxi_glass", "#2f4f78", rough=0.08)
    black = mat("taxi_black", "#22242a", rough=0.6)
    chrome = mat("chrome", "#d9dee6", rough=0.18, metal=0.9)
    sign = mat("taxi_sign", "#ffffff", rough=0.3, emit="#fff5d0", emit_strength=0.8)
    lamp = mat("headlamp", "#fff6d0", rough=0.1, emit="#fff1b8", emit_strength=3.0)
    L = 4.2
    p = [box((L, 1.8, 0.7), (x0, 0, 0.75), yel, bevel=0.14, segs=3, name="body"), box((2.2, 1.6, 0.6), (x0 - 0.2, 0, 1.35), yel, bevel=0.16, segs=3, name="cabin")]
    p.append(box((2.1, 1.62, 0.42), (x0 - 0.2, 0, 1.38), glass, bevel=0.1, name="glass"))
    p.append(box((L - 0.4, 1.84, 0.12), (x0, 0, 0.92), black, bevel=0.03, segs=1, name="checker"))
    p.append(box((0.6, 0.25, 0.22), (x0 - 0.2, 0, 1.78), sign, bevel=0.05, name="sign"))
    for sx in (-1, 1):
        p.append(box((0.08, 1.7, 0.18), (x0 + sx * L / 2, 0, 0.5), chrome, bevel=0.04, name="bumper"))
        for sy in (-1, 1):
            p.append(cyl(0.36, 0.26, (x0 + sx * 1.3, sy * 0.86, 0.36), black, rot=(math.radians(90), 0, 0), verts=20, bevel=0.06, name="tyre"))
    for sy in (-0.6, 0.6):
        p.append(sphere(0.12, (x0 + L / 2, sy, 0.8), lamp, scale=(0.5, 1, 1), segs=10, rings=6, name="lamp"))
    return join(p, "ct_taxi")


def ct_pigeon(x0):
    grey = mat("pigeon_grey", "#8e96a4", rough=0.6)
    dark = mat("pigeon_dark", "#5d6573", rough=0.6)
    neck = mat("pigeon_neck", "#4fb39a", rough=0.4, metal=0.3)
    orange = mat("pigeon_orange", "#ff8a3a", rough=0.5)
    black = mat("eye_black", "#121316", rough=0.3)
    p = [
        sphere(0.3, (x0, 0, 0.35), grey, scale=(1.4, 0.95, 0.95), segs=20, rings=12, name="body"),
        sphere(0.2, (x0 + 0.38, 0, 0.62), neck, segs=16, rings=10, name="neck"),
        sphere(0.17, (x0 + 0.45, 0, 0.78), grey, segs=16, rings=10, name="head"),
        cyl(0.05, 0.14, (x0 + 0.65, 0, 0.76), orange, r2=0.005, rot=(0, math.radians(90), 0), verts=8, bevel=0, name="beak"),
        sphere(0.3, (x0 - 0.45, 0, 0.42), dark, scale=(0.9, 0.5, 0.15), segs=12, rings=6, name="tail"),
    ]
    for s in (-1, 1):
        p.append(sphere(0.035, (x0 + 0.55, s * 0.12, 0.83), black, segs=8, rings=6, name="eye"))
        w = sphere(0.28, (x0 - 0.05, s * 0.27, 0.42), dark, scale=(1.3, 0.25, 0.6), segs=12, rings=8, name="wing")
        p.append(w)
        p.append(cyl(0.025, 0.14, (x0 + 0.05, s * 0.1, 0.07), orange, verts=6, bevel=0, name="leg"))
    return join(p, "ct_pigeon")


def ct_road(x0):
    asphalt = mat("asphalt", "#4a4f58", rough=0.9)
    paint = mat("road_paint", "#f7f4ea", rough=0.6)
    yellow = mat("road_yellow", "#ffcc33", rough=0.6)
    curb = mat("curb", "#c9ccd2", rough=0.8)
    p = [box((TW, TW, 0.3), (x0, 0, -0.15), asphalt, bevel=0.0, segs=1, name="base")]
    for lx in (-2.0, 2.0):
        for k in range(4):  # dashes repeat every 2.4 m: seamless across tiles
            p.append(box((0.14, 1.2, 0.02), (x0 + lx, -TW / 2 + 0.6 + k * 2.4 + 0.6, 0.005), paint, bevel=0.0, segs=1, name="dash"))
    for dx in (-0.12, 0.12):
        p.append(box((0.1, TW, 0.02), (x0 + dx, 0, 0.005), yellow, bevel=0.0, segs=1, name="centre"))
    for sx in (-1, 1):
        p.append(box((0.14, TW, 0.02), (x0 + sx * 4.2, 0, 0.005), paint, bevel=0.0, segs=1, name="edge"))
        p.append(box((0.4, TW, 0.18), (x0 + sx * (TW / 2 - 0.2), 0, 0.06), curb, bevel=0.03, segs=1, name="curb"))
    return join(p, "ct_road")


# ════════════════════════ STADIUM ════════════════════════


def st_light(x0):
    steel = mat("mast_steel", "#cfd5de", rough=0.35, metal=0.7)
    panel = mat("mast_panel", "#2f3540", rough=0.5)
    glow = mat("mast_glow", "#ffffff", rough=0.1, emit="#f4f8ff", emit_strength=4.0)
    p = []
    H = 26
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(beam((x0 + sx * 0.9, sy * 0.9, 0), (x0 + sx * 0.35, sy * 0.35, H), 0.08, steel))
    for k in range(9):
        z = k * H / 9
        w = 0.9 - 0.55 * (k / 9)
        for (a, b) in (((-w, -w), (w, -w)), ((w, -w), (w, w)), ((w, w), (-w, w)), ((-w, w), (-w, -w))):
            p.append(beam((x0 + a[0], a[1], z), (x0 + b[0], b[1], z), 0.04, steel, verts=6))
    p.append(box((4.0, 0.5, 2.6), (x0, -0.3, H + 1.3), panel, bevel=0.08, name="panel"))
    for i in range(4):
        for j in range(3):
            p.append(cyl(0.3, 0.1, (x0 - 1.4 + i * 0.93, -0.57, H + 0.55 + j * 0.75), glow, rot=(math.radians(90), 0, 0), verts=12, bevel=0.02, name="bulb"))
    return join(p, "st_light")


def st_ball(x0):
    white = mat("ball_white", "#f8f8f6", rough=0.35)
    black = mat("ball_black", "#1f2127", rough=0.35)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.5, location=(x0, 0, 0.5))
    o = bpy.context.active_object
    o.data.materials.append(white)
    o.data.materials.append(black)
    phi = (1 + 5**0.5) / 2
    ico = [Vector(v).normalized() for v in [(-1, phi, 0), (1, phi, 0), (-1, -phi, 0), (1, -phi, 0), (0, -1, phi), (0, 1, phi), (0, -1, -phi), (0, 1, -phi), (phi, 0, -1), (phi, 0, 1), (-phi, 0, -1), (-phi, 0, 1)]]
    for poly in o.data.polygons:
        n = poly.center.normalized()
        if max(n.dot(v) for v in ico) > 0.94:
            poly.material_index = 1
    bpy.ops.object.shade_smooth()
    return o


def st_cam(x0):
    body = mat("cam_body", "#2a2d34", rough=0.4)
    accent = mat("cam_accent", "#e5332a", rough=0.4)
    lens = mat("cam_lens", "#5fa8ff", rough=0.05, metal=0.3)
    steel = mat("mast_steel", "#cfd5de", rough=0.35, metal=0.7)
    p = [box((0.8, 1.0, 0.5), (x0, 0, 0.5), body, bevel=0.08, name="body"), cyl(0.2, 0.4, (x0, -0.65, 0.5), body, rot=(math.radians(90), 0, 0), verts=16, bevel=0.03, name="barrel")]
    p.append(cyl(0.16, 0.04, (x0, -0.86, 0.5), lens, rot=(math.radians(90), 0, 0), verts=16, bevel=0.01, name="lens"))
    p.append(box((0.82, 0.3, 0.1), (x0, 0.1, 0.78), accent, bevel=0.03, name="stripe"))
    p.append(torus(0.45, 0.04, (x0, 0, 0.95), steel, major=24, minor=6, name="ring"))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        p.append(beam((x0 + 0.32 * math.cos(a), 0.32 * math.sin(a), 0.95), (x0 + 0.7 * math.cos(a), 0.7 * math.sin(a), 1.6), 0.015, steel, verts=6))
    return join(p, "st_cam")


def st_pitch(x0):
    g1 = mat("turf1", "#3fae4a", rough=0.9)
    g2 = mat("turf2", "#4fc25a", rough=0.9)
    line = mat("pitch_line", "#f7f7f2", rough=0.6)
    p = []
    n = 4  # mowing bands across the lane, 2.4 m each: seamless
    for i in range(n):
        p.append(box((TW, TW / n, 0.3), (x0, -TW / 2 + TW / n * (i + 0.5), -0.15), g1 if i % 2 else g2, bevel=0.0, segs=1, name="band"))
    for sx in (-1, 1):
        p.append(box((0.12, TW, 0.02), (x0 + sx * 4.3, 0, 0.005), line, bevel=0.0, segs=1, name="touch"))
    return join(p, "st_pitch")


# ════════════════════════ SPACE ════════════════════════


def sp_dome(x0):
    glass = mat("dome_glass", "#9fd8ff", rough=0.05, metal=0.2)
    frame = mat("dome_frame", "#e6ebf2", rough=0.3, metal=0.6)
    base = mat("dome_base", "#5b6270", rough=0.5)
    glow = mat("dome_glow", "#59f0ff", rough=0.1, emit="#3fe6ff", emit_strength=3.0)
    p = [cyl(4.6, 1.2, (x0, 0, 0.6), base, verts=32, bevel=0.08, name="base")]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=4.2, location=(x0, 0, 1.2))
    d = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(d.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context="VERTS")
    bm.to_mesh(d.data)
    bm.free()
    p.append(_finish(d, glass, 0, 0))
    for k in range(8):
        a = k * math.pi / 8
        t = torus(4.25, 0.07, (x0, 0, 1.2), frame, rot=(math.radians(90), 0, a), major=48, minor=6, name="rib")
        bm = bmesh.new()
        bm.from_mesh(t.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if (t.matrix_world @ v.co).z < 1.15], context="VERTS")
        bm.to_mesh(t.data)
        bm.free()
        p.append(t)
    p.append(torus(4.62, 0.1, (x0, 0, 1.2), glow, major=48, minor=6, name="glowring"))
    p.append(box((1.6, 0.6, 2.2), (x0, -4.3, 1.5), frame, bevel=0.15, name="airlock"))
    return join(p, "sp_dome")


def sp_rocket(x0):
    white = mat("rk_white", "#f4f6fa", rough=0.35)
    red = mat("rk_red", "#e5332a", rough=0.35)
    glass = mat("rk_glass", "#5fb6ff", rough=0.05)
    steel = mat("rk_steel", "#9aa3b0", rough=0.3, metal=0.8)
    pad = mat("rk_pad", "#4a515d", rough=0.7)
    p = [cyl(3.2, 0.5, (x0, 0, 0.25), pad, verts=24, bevel=0.06, name="pad")]
    p.append(cyl(1.1, 7.5, (x0, 0, 4.75), white, verts=28, bevel=0.04, name="body"))
    p.append(sphere(1.1, (x0, 0, 8.5), red, scale=(1, 1, 2.6), segs=28, rings=14, name="nose"))
    p.append(cyl(1.13, 0.5, (x0, 0, 7.6), red, verts=28, bevel=0.03, name="band"))
    p.append(cyl(0.45, 0.12, (x0, -1.08, 6.2), glass, rot=(math.radians(90), 0, 0), verts=20, bevel=0.03, name="window"))
    p.append(torus(0.47, 0.06, (x0, -1.1, 6.2), steel, rot=(math.radians(90), 0, 0), major=20, minor=6, name="rim"))
    p.append(cyl(0.8, 0.8, (x0, 0, 0.9), steel, r2=1.0, verts=20, bevel=0.04, name="nozzle"))
    for k in range(3):
        a = k * math.tau / 3 + math.pi / 2
        fin = prism([(0.9, 0), (2.3, 0), (1.1, 2.6), (0.9, 2.6)], -0.08, 0.08, red, name="fin", bevel=0.03)
        fin.location = (x0, 0, 1.0)
        rot_apply(fin, rz=a)
        bpy.ops.object.transform_apply(location=True)
        p.append(fin)
    return join(p, "sp_rocket")


def sp_dish(x0):
    white = mat("dish_white", "#f2f4f8", rough=0.35)
    steel = mat("dish_steel", "#9aa3b0", rough=0.3, metal=0.8)
    base = mat("dish_base", "#5b6270", rough=0.6)
    tip = mat("dish_tip", "#ff3b30", rough=0.2, emit="#ff2a1f", emit_strength=2.0)
    p = [box((1.6, 1.6, 0.8), (x0, 0, 0.4), base, bevel=0.1, name="base"), cyl(0.25, 2.0, (x0, 0, 1.8), steel, verts=12, bevel=0.03, name="mast")]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=2.0, location=(0, 0, 0))
    d = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(d.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -1.2], context="VERTS")
    bm.to_mesh(d.data)
    bm.free()
    d.data.materials.append(white)
    d.location = (x0, 0, 4.6)
    rot_apply(d, rx=math.radians(-125))
    bpy.ops.object.transform_apply(location=True)
    bpy.ops.object.shade_smooth()
    sol = d.modifiers.new("s", "SOLIDIFY")
    sol.thickness = 0.06
    bpy.ops.object.modifier_apply(modifier="s")
    p.append(d)
    feed = Vector((x0, -1.5, 4.2))
    for k in range(3):
        a = k * math.tau / 3
        p.append(beam((x0 + 0.9 * math.cos(a), -0.6 + 0.9 * math.sin(a) * 0.5, 3.4 + 0.9 * math.sin(a) * 0.6), tuple(feed), 0.03, steel, verts=6))
    p.append(sphere(0.15, tuple(feed), tip, segs=10, rings=6, name="feed"))
    return join(p, "sp_dish")


def sp_asteroid(x0):
    rock = mat("ast_rock", "#8a7f74", rough=0.9)
    o = blob(0.5, (x0, 0, 0.5), rock, squash=(1.1, 0.95, 0.85), sub=3, amp=0.22, freq=1.1, seed=8)
    # craters: push in the vertices around a few points
    rnd = random.Random(2)
    for _ in range(5):
        c = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        for v in o.data.vertices:
            p = v.co - Vector((x0, 0, 0.5))
            if p.normalized().dot(c) > 0.93:
                v.co -= p.normalized() * 0.06
    return o


def sp_ufo(x0):
    hull = mat("ufo_hull", "#c9d2de", rough=0.25, metal=0.8)
    glass = mat("ufo_glass", "#7fffd4", rough=0.05)
    glow = mat("ufo_glow", "#7cff6b", rough=0.1, emit="#5cff4a", emit_strength=3.5)
    p = [sphere(1.2, (x0, 0, 0.5), hull, scale=(1, 1, 0.28), segs=32, rings=12, name="hull"), sphere(0.55, (x0, 0, 0.75), glass, scale=(1, 1, 0.8), segs=24, rings=12, name="dome")]
    p.append(torus(1.08, 0.06, (x0, 0, 0.5), hull, major=40, minor=6, name="rim"))
    for k in range(10):
        a = k * math.tau / 10
        p.append(sphere(0.09, (x0 + 1.0 * math.cos(a), 1.0 * math.sin(a), 0.42), glow, segs=8, rings=6, name="light"))
    p.append(cyl(0.35, 0.12, (x0, 0, 0.2), glow, verts=20, bevel=0.03, name="beam"))
    return join(p, "sp_ufo")


def sp_walk(x0):
    plate = mat("walk_plate", "#6b7382", rough=0.4, metal=0.6)
    plate2 = mat("walk_plate2", "#7d8595", rough=0.4, metal=0.6)
    seam = mat("walk_seam", "#2b2f37", rough=0.6)
    glow = mat("walk_glow", "#3fe6ff", rough=0.1, emit="#2ee0ff", emit_strength=3.0)
    p = [box((TW, TW, 0.3), (x0, 0, -0.16), seam, bevel=0.0, segs=1, name="base")]
    n = 4
    for i in range(4):
        for j in range(n):
            x = x0 - TW / 2 + 1.2 + i * 2.4
            y = -TW / 2 + TW / n * (j + 0.5)
            p.append(box((2.3, TW / n - 0.1, 0.06), (x, y, -0.02), plate if (i + j) % 2 else plate2, bevel=0.02, segs=1, name="plate"))
    for sx in (-1, 1):
        p.append(box((0.12, TW, 0.04), (x0 + sx * (TW / 2 - 0.1), 0, 0.0), glow, bevel=0.0, segs=1, name="edge"))
    return join(p, "sp_walk")


def ground(x0):
    """The meadow track: blue athletics rubber, white lane lines, a grass verge each side."""
    rubber = mat("track_blue", "#2f74d8", rough=0.85)
    rubber2 = mat("track_blue2", "#3a80e2", rough=0.85)
    line = mat("track_line", "#f7f8fa", rough=0.6)
    grass = mat("verge_grass", "#6cbf45", rough=0.9)
    p = []
    for i in range(4):  # one slightly different blue per lane
        p.append(box((2.0, TW, 0.3), (x0 - 3.0 + i * 2.0, 0, -0.15), rubber if i % 2 else rubber2, bevel=0.0, segs=1, name="lane"))
    for lx in (-4.0, -2.0, 0.0, 2.0, 4.0):
        p.append(box((0.1, TW, 0.02), (x0 + lx, 0, 0.006), line, bevel=0.0, segs=1, name="line"))
    for sx in (-1, 1):
        p.append(box((0.8, TW, 0.3), (x0 + sx * 4.4, 0, -0.16), grass, bevel=0.0, segs=1, name="verge"))
    return join(p, "ground")


SET_BUILDERS = {
    "meadow": [("ground", ground, 0.6)],
    "farm": [("barn", barn, 0.25), ("windmill", windmill, 0.3), ("wheat", wheat, 0.3), ("tractor", tractor, None), ("sunflowers", sunflowers, 0.3), ("farm_tile", farm_tile, 0.6)],
    "beach": [("palm", palm, 0.3), ("hut", hut, 0.3), ("lighthouse", lighthouse, 0.3), ("umbrella", umbrella, 0.35), ("board_tile", board_tile, 0.6)],
    "city": [("ct_tower", ct_tower, 0.35), ("ct_shop", ct_shop, 0.35), ("ct_lamp", ct_lamp, None), ("ct_taxi", ct_taxi, None), ("ct_pigeon", ct_pigeon, None), ("ct_road", ct_road, 0.6)],
    "stadium": [("st_light", st_light, 0.35), ("st_ball", st_ball, None), ("st_cam", st_cam, None), ("st_pitch", st_pitch, 0.6)],
    "space": [("sp_dome", sp_dome, 0.3), ("sp_rocket", sp_rocket, 0.3), ("sp_dish", sp_dish, None), ("sp_asteroid", sp_asteroid, None), ("sp_ufo", sp_ufo, None), ("sp_walk", sp_walk, 0.6)],
}

if __name__ == "__main__":
    for set_name in SETS:
        reset()
        built = []
        x = 0.0
        for name, fn, lod in SET_BUILDERS[set_name]:
            o = fn(x)
            dims = o.dimensions
            built.append((name, o, lod))
            x += max(dims.x, 4) + 3
        for name, o, _ in built:
            if name.endswith(("_tile", "_road", "_pitch", "_walk")) or name == "ground":
                flat_ao(o)  # running surfaces: no baked shadow (box corners would read as dark patches)
            else:
                bake_ao(o, distance=1.5)
        lo = min(o.location.x + min(c[0] for c in o.bound_box) for _, o, _ in built)
        hi = max(o.location.x + max(c[0] for c in o.bound_box) for _, o, _ in built)
        mid, span = (lo + hi) / 2, hi - lo
        dist = max(12, span * 0.85)
        preview([o for _, o, _ in built], os.path.abspath(os.path.join(OUT, f"preview_{set_name}.jpg")), size=(1200, 460), cam_loc=(mid, -dist, dist * 0.3), look=(mid, 0, 3), lens=32)
        for name, o, lod in built:
            if lod:
                l = lod_copy(o, lod)
                export(l, os.path.abspath(os.path.join(OUT, f"{name}_lod.glb")))
            export(o, os.path.abspath(os.path.join(OUT, f"{name}.glb")))
