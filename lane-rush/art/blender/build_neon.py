"""Lane Rush obstacles, second pass: a neon-arena kit that sits with the Neon Rush worlds.

Glossy dark metal, rounded edges, bright padded parts and thin emissive strips (they bloom on the
Neon Rush maps and still read as bright paint on the others). Same file names and proportions as
build_obstacles.py / build_round1.py, so the game fits them exactly as before:

  bl_hurdle  jump over (bar top ~0.68 m)          bl_hay   the second hurdle look: a laser fence
  bl_gate    slide under (beam bottom ~1.03 m)    bl_arch  the second gate look: a neon arch
  bl_crates  a lane-blocking stack                bl_barrel  the rolling drum (along X)
  bl_ramp    the bus ramp (6 m long, 2.3 m high, foot at y=0, rising toward -y)

python3 build_neon.py <outdir>  → the GLBs + preview_neon.jpg
"""
import math
import os
import sys

import bpy  # noqa: F401  (bpy first: it provides bmesh)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_round1 import prism, text  # noqa: E402
from common import bake_ao, box, cyl, export, join, mat, preview, reset, sphere, torus  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else "out"
GLOW = 1.6  # emission strength of the light strips: bright enough to read, soft enough not to blow out under bloom


def upper_half(o, zc):
    """Drop everything below z = zc (keeps the top of a ring)."""
    import bmesh

    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # world coordinates in the mesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < zc - 1e-4], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    return o


def kit():
    """The shared palette: dark lacquered metal, chrome, and neon."""
    return {
        "dark": mat("nx_dark", "#1a2033", rough=0.28, metal=0.55),
        "dark2": mat("nx_dark2", "#262e48", rough=0.32, metal=0.5),
        "chrome": mat("nx_chrome", "#d9e0ea", rough=0.16, metal=0.95),
        "pink": mat("nx_pink", "#ff2e7e", rough=0.3),
        "white": mat("nx_white", "#f6f7fb", rough=0.32),
        "orange": mat("nx_orange", "#ff7a1a", rough=0.32),
        "teal": mat("nx_teal", "#15b9ad", rough=0.32),
        "yellow": mat("nx_yellow", "#ffc61f", rough=0.35),
        "rubber": mat("nx_rubber", "#14161d", rough=0.75),
        "cyan_glow": mat("nx_cyan", "#7ff6ff", rough=0.2, emit="#2ee9ff", emit_strength=GLOW),
        "pink_glow": mat("nx_pinkg", "#ff8ac4", rough=0.2, emit="#ff2e8a", emit_strength=GLOW),
        "yellow_glow": mat("nx_yellowg", "#fff1a0", rough=0.2, emit="#ffc21a", emit_strength=GLOW),
        "red_glow": mat("nx_redg", "#ff8a8a", rough=0.2, emit="#ff2a2a", emit_strength=GLOW),
    }


def hurdle(x0=0.0):
    k = kit()
    p = []
    for sx in (-0.8, 0.8):
        x = x0 + sx
        # a sled foot with glowing toes, a rounded post with a light strip up its front
        p.append(box((0.2, 0.62, 0.08), (x, 0.06, 0.04), k["dark2"], bevel=0.035, segs=3, name="foot"))
        for sy in (-0.24, 0.36):
            p.append(box((0.21, 0.05, 0.05), (x, sy, 0.06), k["yellow_glow"], bevel=0.015, segs=2, name="toe"))
        p.append(box((0.13, 0.13, 0.6), (x, 0.12, 0.38), k["dark"], bevel=0.045, segs=3, name="post"))
        p.append(box((0.03, 0.02, 0.48), (x, 0.05, 0.38), k["cyan_glow"], bevel=0.008, segs=1, name="strip"))
        p.append(cyl(0.085, 0.05, (x, 0.12, 0.69), k["chrome"], verts=20, bevel=0.015, name="cap"))
    # the padded bar: pink and white blocks, a chrome rail behind, a light line under it
    n = 7
    w = 1.56 / n
    for i in range(n):
        p.append(box((w - 0.006, 0.12, 0.17), (x0 - 0.78 + w * (i + 0.5), 0.12, 0.58), k["pink"] if i % 2 == 0 else k["white"], bevel=0.04, segs=3, name="pad"))
    p.append(cyl(0.025, 1.6, (x0, 0.2, 0.58), k["chrome"], verts=12, bevel=0, rot=(0, math.radians(90), 0), name="rail"))
    p.append(box((1.56, 0.03, 0.025), (x0, 0.05, 0.49), k["cyan_glow"], bevel=0.008, segs=1, name="underglow"))
    return join(p, "hurdle")


def laser_fence(x0=0.0):
    """The second hurdle look: two pylons with glowing laser beams between them (still jumped over)."""
    k = kit()
    p = []
    for sx in (-0.8, 0.8):
        x = x0 + sx
        p.append(box((0.26, 0.4, 0.1), (x, 0, 0.05), k["dark2"], bevel=0.04, segs=3, name="base"))
        p.append(box((0.16, 0.2, 0.62), (x, 0, 0.4), k["dark"], bevel=0.05, segs=3, name="pylon"))
        p.append(box((0.17, 0.205, 0.06), (x, 0, 0.66), k["yellow"], bevel=0.02, segs=2, name="band"))
        for z in (0.28, 0.5):
            p.append(sphere(0.055, (x - math.copysign(0.07, sx), 0, z), k["red_glow"], segs=14, rings=8, name="emitter"))
    for z in (0.28, 0.5):
        p.append(cyl(0.022, 1.46, (x0, 0, z), k["red_glow"], verts=10, bevel=0, rot=(0, math.radians(90), 0), name="beam"))
    return join(p, "laser_fence")


def gate(x0=0.0):
    k = kit()
    p = []
    for sx in (-0.86, 0.86):
        x = x0 + sx
        p.append(box((0.42, 0.5, 0.16), (x, 0, 0.08), k["dark2"], bevel=0.05, segs=3, name="foot"))
        p.append(box((0.2, 0.26, 1.98), (x, 0, 1.1), k["dark"], bevel=0.06, segs=3, name="pillar"))
        # hazard bands up the pillar, with a light strip on the inside face
        for i in range(4):
            p.append(box((0.21, 0.27, 0.1), (x, 0, 0.42 + i * 0.4), k["yellow"], bevel=0.02, segs=2, name="band"))
        p.append(box((0.025, 0.04, 1.7), (x - math.copysign(0.105, sx), -0.06, 1.1), k["cyan_glow"], bevel=0.008, segs=1, name="strip"))
    # the padded beam you slide under (bottom ~1.03 m), a red warning light along its underside
    p.append(box((1.56, 0.26, 0.3), (x0, 0, 1.18), k["orange"], bevel=0.1, segs=4, name="beam"))
    for sx in (-0.42, 0.0, 0.42):
        p.append(box((0.12, 0.265, 0.305), (x0 + sx, 0, 1.18), k["white"], bevel=0.03, segs=2, name="stripe"))
    p.append(box((1.4, 0.04, 0.025), (x0, -0.1, 1.035), k["red_glow"], bevel=0.008, segs=1, name="warn"))
    # the sign on top: three glowing chevrons pointing down (slide!)
    p.append(box((1.95, 0.14, 0.36), (x0, 0, 2.08), k["dark"], bevel=0.05, segs=3, name="sign"))
    for i, sx in enumerate((-0.55, 0.0, 0.55)):
        for s in (-1, 1):
            p.append(box((0.2, 0.03, 0.05), (x0 + sx + s * 0.07, -0.08, 2.08), k["yellow_glow"], bevel=0.01, segs=1, rot=(0, math.radians(-s * 35), 0), name="chev"))
    return join(p, "gate")


def neon_arch(x0=0.0):
    """The second gate look: a glowing arch over the lane with a padded bar to slide under."""
    k = kit()
    p = [
        upper_half(torus(0.88, 0.1, (x0, 0, 1.12), k["dark"], rot=(math.radians(90), 0, 0), major=40, minor=12, name="arch"), 1.12),
        upper_half(torus(0.88, 0.035, (x0, -0.1, 1.12), k["pink_glow"], rot=(math.radians(90), 0, 0), major=40, minor=8, name="glow"), 1.12),
    ]
    # only the top of the ring: solid legs carry it down to the ground
    for sx in (-0.88, 0.88):
        p.append(box((0.24, 0.3, 1.12), (x0 + sx, 0, 0.56), k["dark"], bevel=0.06, segs=3, name="leg"))
        p.append(box((0.03, 0.04, 0.95), (x0 + sx - math.copysign(0.12, sx), -0.1, 0.56), k["pink_glow"], bevel=0.008, segs=1, name="legglow"))
        p.append(box((0.4, 0.46, 0.14), (x0 + sx, 0, 0.07), k["dark2"], bevel=0.04, segs=3, name="foot"))
    p.append(box((1.52, 0.24, 0.28), (x0, 0, 1.18), k["teal"], bevel=0.1, segs=4, name="bar"))
    for sx in (-0.4, 0.4):
        p.append(box((0.12, 0.245, 0.285), (x0 + sx, 0, 1.18), k["white"], bevel=0.03, segs=2, name="stripe"))
    return join(p, "neon_arch")


def cargo(cx, cy, cz, s, body, k, rot=0.0):
    """One cargo crate: a coloured rounded box, dark inset panels, glowing seams on the upright edges."""
    p = [box((s, s, s), (cx, cy, cz), body, bevel=0.06 * s, segs=3, name="crate")]
    inset = s * 0.7
    for fy in (-1, 1):
        p.append(box((inset, 0.02, inset), (cx, cy + fy * s / 2, cz), k["dark"], bevel=0.02, segs=2, name="panel"))
        p.append(cyl(0.06 * s, 0.03, (cx, cy + fy * (s / 2 + 0.012), cz), k["yellow_glow"], verts=16, bevel=0, rot=(math.radians(90), 0, 0), name="dot"))
    for fx in (-1, 1):
        p.append(box((0.02, inset, inset), (cx + fx * s / 2, cy, cz), k["dark"], bevel=0.02, segs=2, name="panel"))
    for a in (-1, 1):
        for b in (-1, 1):
            p.append(box((0.03, 0.03, s * 0.86), (cx + a * (s / 2 - 0.01), cy + b * (s / 2 - 0.01), cz), k["cyan_glow"], bevel=0.008, segs=1, name="seam"))
    o = join(p, "cargo")
    if rot:
        o.rotation_euler = (0, 0, rot)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def crates(x0=0.0):
    k = kit()
    s = 0.72
    return join(
        [
            cargo(x0 - 0.37, 0, s / 2, s, k["orange"], k),
            cargo(x0 + 0.37, 0, s / 2, s, k["teal"], k, rot=math.radians(4)),
            cargo(x0 - 0.33, 0.02, s * 1.5 + 0.005, s, k["teal"], k, rot=math.radians(-6)),
            cargo(x0 + 0.36, -0.02, s * 1.5 + 0.005, s, k["orange"], k, rot=math.radians(3)),
            cargo(x0, 0, s * 2.5 + 0.01, s, k["pink"], k, rot=math.radians(8)),
        ],
        "crates",
    )


def barrel(x0=0.0):
    """The rolling drum, along X: red lacquer, chrome hoops, two glowing hazard bands, dark lids."""
    k = kit()
    red = mat("nx_red", "#e0283c", rough=0.25, metal=0.25)
    L, R = 1.4, 0.44
    rot = (0, math.radians(90), 0)
    p = [cyl(R, L, (x0, 0, R), red, verts=32, bevel=0.06, segs=3, rot=rot, name="drum")]
    for dx in (-0.62, 0.62):
        p.append(cyl(R * 0.82, 0.02, (x0 + dx * 1.115, 0, R), k["dark"], verts=32, bevel=0.01, rot=rot, name="lid"))
    for dx in (-0.5, 0.0, 0.5):
        p.append(torus(R + 0.005, 0.03, (x0 + dx, 0, R), k["chrome"], rot=rot, major=40, minor=8, name="hoop"))
    for dx in (-0.25, 0.25):
        p.append(cyl(R + 0.008, 0.06, (x0 + dx, 0, R), k["yellow_glow"], verts=32, bevel=0, rot=rot, name="band"))
    return join(p, "barrel")


def ramp(x0=0.0):
    k = kit()
    L, H, W = 6.0, 2.3, 1.8
    p = [prism([(0, 0), (-L, 0), (-L, H - 0.12), (0, 0.02)], x0 - W / 2 + 0.06, x0 + W / 2 - 0.06, k["dark"], name="wedge", bevel=0.03)]
    a = math.atan2(H, L)
    dl = math.hypot(L, H)
    p.append(box((W, dl, 0.12), (x0, -L / 2, H / 2 - 0.02), k["dark2"], bevel=0.04, rot=(-a, 0, 0), name="deck"))
    # glowing chevrons up the deck (toward -y), glowing edge lines
    n = 5
    for i in range(n):
        u = (i + 0.7) / (n + 0.4)
        y, z = -L * u, H * u + 0.07
        for s in (-1, 1):
            p.append(box((0.5, 0.1, 0.03), (x0 + s * 0.2, y, z), k["cyan_glow"], bevel=0.01, segs=1, rot=(-a, 0, s * math.radians(35)), name="chev"))
    for sx in (-1, 1):
        p.append(box((0.05, dl, 0.03), (x0 + sx * (W / 2 - 0.1), -L / 2, H / 2 + 0.05), k["yellow_glow"], bevel=0.01, segs=1, rot=(-a, 0, 0), name="edge"))
        p.append(box((0.09, dl, 0.09), (x0 + sx * (W / 2 - 0.04), -L / 2, H / 2 + 0.44), k["pink_glow"], bevel=0.035, rot=(-a, 0, 0), name="rail"))
        for j in range(4):
            u = (j + 0.5) / 4
            p.append(cyl(0.035, 0.42, (x0 + sx * (W / 2 - 0.04), -L * u, H * u + 0.2), k["chrome"], verts=10, bevel=0, name="post"))
    p.append(box((W + 0.1, 0.4, 0.05), (x0, 0.12, 0.025), k["yellow"], bevel=0.02, name="lip"))
    return join(p, "ramp")


def item_box(x0=0.0):
    """The mystery box: a purple rounded cube in a dark metal frame, a glowing "?" on each side, gems at the corners."""
    k = kit()
    purple = mat("nx_purple", "#8b3dff", rough=0.22, metal=0.15)
    q = mat("nx_q", "#fff3b0", rough=0.2, emit="#ffd23a", emit_strength=GLOW * 1.4)
    p = [box((0.86, 0.86, 0.86), (x0, 0, 0.5), purple, bevel=0.14, segs=4, name="cube")]
    for ax in range(3):
        for a in (-1, 1):
            for b in (-1, 1):
                size = [0.09, 0.09, 0.09]
                size[ax] = 0.8
                loc = [x0, 0, 0.5]
                o1, o2 = [i for i in range(3) if i != ax]
                loc[o1] += a * 0.43
                loc[o2] += b * 0.43
                p.append(box(tuple(size), tuple(loc), k["dark"], bevel=0.04, segs=2, name="frame"))
    for a in (-1, 1):
        for b in (-1, 1):
            for c in (-1, 1):
                p.append(sphere(0.06, (x0 + a * 0.43, b * 0.43, 0.5 + c * 0.43), k["cyan_glow"], segs=12, rings=8, name="gem"))
    p.append(text("?", 0.6, (x0, -0.44, 0.48), q, rot=(math.radians(90), 0, 0), extrude=0.035))
    p.append(text("?", 0.6, (x0, 0.44, 0.48), q, rot=(math.radians(90), 0, math.radians(180)), extrude=0.035))
    p.append(text("?", 0.6, (x0 + 0.44, 0, 0.48), q, rot=(math.radians(90), 0, math.radians(90)), extrude=0.035))
    p.append(text("?", 0.6, (x0 - 0.44, 0, 0.48), q, rot=(math.radians(90), 0, math.radians(-90)), extrude=0.035))
    p.append(text("?", 0.6, (x0, 0, 0.94), q, rot=(0, 0, 0), extrude=0.035))
    return join(p, "item_box")


if __name__ == "__main__":
    reset()
    objs = {
        "hurdle": hurdle(-4.6),
        "hay": laser_fence(-2.6),
        "gate": gate(-0.4),
        "arch": neon_arch(1.9),
        "crates": crates(3.9),
        "barrel": barrel(5.8),
        "box": item_box(7.2),
    }
    rmp = ramp(9.6)
    for o in [*objs.values(), rmp]:
        bake_ao(o)
    preview([*objs.values(), rmp], os.path.abspath(os.path.join(OUT, "preview_neon.jpg")), size=(1500, 560), cam_loc=(2.6, -14.5, 4.2), look=(2.6, -1.5, 1.0), lens=28)
    for name, o in objs.items():
        export(o, os.path.abspath(os.path.join(OUT, f"bl_{name}.glb")))
    export(rmp, os.path.abspath(os.path.join(OUT, "bl_ramp.glb")))
