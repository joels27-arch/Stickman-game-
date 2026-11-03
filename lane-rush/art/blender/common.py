"""Shared Blender helpers for Lane Rush props: clean scene, bevelled primitives, cartoon materials,
ambient-occlusion baked into vertex colours, phone-friendly GLB export and quick preview renders.

Run any build script with:  python3 build_obstacles.py <outdir>   (needs `pip install bpy`)
"""
import math
import os

import bpy  # bpy first: it provides bmesh
import bmesh
from mathutils import Vector

# ── scene ──


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()  # the factory reset removed them
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24
    sc.unit_settings.scale_length = 1.0
    return sc


_mats = {}


def mat(name, color, rough=0.45, metal=0.0, emit=None, emit_strength=1.0):
    """A Principled material. `color` is sRGB hex; vertex-colour AO multiplies it."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    r, g, b = srgb(color)
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "AO"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = (r, g, b, 1)
    nt.links.new(attr.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        er, eg, eb = srgb(emit)
        bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    m["base"] = (r, g, b)
    _mats[name] = m
    return m


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ── geometry ──


def _finish(obj, material, bevel=0.0, segs=3, smooth=True, subdiv=0):
    bpy.context.view_layer.objects.active = obj
    if bevel > 0:
        m = obj.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = segs
        m.limit_method = "ANGLE"
        m.harden_normals = False
    if subdiv:
        s = obj.modifiers.new("sub", "SUBSURF")
        s.levels = subdiv
        s.render_levels = subdiv
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth is True:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    elif smooth:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def box(size, loc, material, bevel=0.03, segs=3, rot=(0, 0, 0), name="box"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, material, bevel, segs)


def cyl(r, depth, loc, material, verts=24, bevel=0.02, segs=2, rot=(0, 0, 0), name="cyl", r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return _finish(o, material, bevel, segs)


def sphere(r, loc, material, scale=(1, 1, 1), segs=20, rings=12, name="sph", jitter=0.0, seed=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if jitter:
        import random

        rnd = random.Random(seed)
        for v in o.data.vertices:
            n = v.co - Vector(loc)
            v.co += n.normalized() * rnd.uniform(-jitter, jitter) * r
    return _finish(o, material, 0, 0)


def torus(R, r, loc, material, rot=(0, 0, 0), major=32, minor=10, name="tor"):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=major, minor_segments=minor, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return _finish(o, material, 0, 0)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# ── ambient occlusion baked into a vertex colour ──


def bake_ao(obj, samples=48, distance=0.6, lift=0.42):
    """Cycles AO bake into the `AO` colour attribute; `lift` keeps the darkest creases from going black."""
    sc = bpy.context.scene
    sc.cycles.samples = samples
    sc.render.bake.target = "VERTEX_COLORS"
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.light_settings.distance = distance
    me = obj.data
    if "AO" not in me.color_attributes:
        me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = me.color_attributes["AO"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO")
    ca = me.color_attributes["AO"]
    for d in ca.data:
        a = d.color[0]
        v = lift + (1 - lift) * a
        d.color = (v, v, v, 1)


# ── export & preview ──


def _flatten_materials(obj):
    """glTF: base colour as a plain factor; the AO colour attribute goes out as COLOR_0 and three.js multiplies it in."""
    for m in obj.data.materials:
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        for l in list(bsdf.inputs["Base Color"].links):
            nt.links.remove(l)
        r, g, b = m["base"]
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1)


def export(obj, path):
    _flatten_materials(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # ground the prop: feet on y=0, centred
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    lo = min((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)
    obj.location = (0, 0, obj.location.z - lo)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_apply=True,
        export_yup=True,
    )
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"exported {os.path.basename(path)}: {tris} tris, {os.path.getsize(path)//1024} KB")


def preview(objs, path, size=(900, 420), cam_loc=(0, -7.5, 2.4), look=(0, 0, 0.8), lens=38):
    sc = bpy.context.scene
    sc.cycles.samples = 32
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    w = sc.world or bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*srgb("#b9d9ff"), 1)
    bg.inputs["Strength"].default_value = 0.9
    bpy.ops.object.light_add(type="SUN", location=(4, -4, 8), rotation=(math.radians(50), math.radians(10), math.radians(35)))
    bpy.context.active_object.data.energy = 3.5
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
    ground = bpy.context.active_object
    g = bpy.data.materials.new("ground")
    g.use_nodes = True
    g.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*srgb("#6fbf4e"), 1)
    ground.data.materials.append(g)
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.active_object
    cam.data.lens = lens
    d = Vector(look) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = path
    sc.render.image_settings.file_format = "JPEG"
    bpy.ops.render.render(write_still=True)
