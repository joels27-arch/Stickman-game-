mkdir -p /home/user/m3d
cd /home/user/m3d && cat > merge_clips.py <<'PYEOF'
import json
import struct
import sys

COMP = {5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20 : 20 + jlen])
    off = 20 + jlen
    blen = struct.unpack_from("<I", data, off)[0]
    return j, bytearray(data[off + 8 : off + 8 + blen])


def accessor_values(j, b, idx):
    a = j["accessors"][idx]
    fmt, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    bv = j["bufferViews"][a["bufferView"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", n * size)
    return [list(struct.unpack_from("<" + fmt * n, b, start + i * stride)) for i in range(a["count"])], a["type"]


def add_accessor(j, b, values, typ, with_minmax):
    while len(b) % 4:
        b.append(0)
    offset = len(b)
    for v in values:
        b.extend(struct.pack("<" + "f" * len(v), *v))
    j["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(b) - offset})
    acc = {"bufferView": len(j["bufferViews"]) - 1, "componentType": 5126, "count": len(values), "type": typ}
    if with_minmax:
        n = len(values[0])
        acc["min"] = [min(v[k] for v in values) for k in range(n)]
        acc["max"] = [max(v[k] for v in values) for k in range(n)]
    j["accessors"].append(acc)
    return len(j["accessors"]) - 1


def hips_rest(j):
    for n in j["nodes"]:
        if n.get("name") == "Hips":
            return n.get("translation", [0, 0, 0])
    return [0, 0, 0]


def pin_hips(values, delta):
    first = values[0]
    return [[first[0] + delta[0], v[1] + delta[1], first[2] + delta[2]] for v in values]


def main():
    base_path, out_path, *donors = sys.argv[1:]
    j, b = read_glb(base_path)
    names = {n.get("name"): i for i, n in enumerate(j["nodes"])}
    base_rest = hips_rest(j)
    for anim in j["animations"]:
        anim["name"] = "Run"
        for ch in anim["channels"]:
            node = j["nodes"][ch["target"]["node"]]
            if node.get("name") == "Hips" and ch["target"]["path"] == "translation":
                s = anim["samplers"][ch["sampler"]]
                vals, typ = accessor_values(j, b, s["output"])
                s["output"] = add_accessor(j, b, pin_hips(vals, [0, 0, 0]), typ, True)
    for spec in donors:
        name, path = spec.split("=", 1)
        dj, db = read_glb(path)
        rest = hips_rest(dj)
        delta = [base_rest[k] - rest[k] for k in range(3)]
        src = dj["animations"][0]
        anim = {"name": name, "channels": [], "samplers": []}
        for ch in src["channels"]:
            node_name = dj["nodes"][ch["target"]["node"]].get("name")
            if node_name not in names:
                continue
            s = src["samplers"][ch["sampler"]]
            t_vals, t_typ = accessor_values(dj, db, s["input"])
            o_vals, o_typ = accessor_values(dj, db, s["output"])
            if node_name == "Hips" and ch["target"]["path"] == "translation":
                o_vals = pin_hips(o_vals, delta)
            anim["samplers"].append({
                "input": add_accessor(j, b, t_vals, t_typ, True),
                "output": add_accessor(j, b, o_vals, o_typ, False),
                "interpolation": s.get("interpolation", "LINEAR"),
            })
            anim["channels"].append({"sampler": len(anim["samplers"]) - 1, "target": {"node": names[node_name], "path": ch["target"]["path"]}})
        j["animations"].append(anim)
        print(f"{name}: {len(anim['channels'])} channels, hips shift {[round(d, 2) for d in delta]}")
    while len(b) % 4:
        b.append(0)
    j["buffers"][0]["byteLength"] = len(b)
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(b)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(b), 0x004E4942) + bytes(b))
    print("wrote", out_path, total, "bytes,", len(j["animations"]), "clips")


if __name__ == "__main__":
    main()
PYEOF
cat > build.sh <<'EOF'
# usage: build.sh name idx jumpURL slideURL idleURL cheerURL fallURL getupURL
set -e
cd /home/user/m3d
n=$1; i=$2; shift 2
k=0; for clip in Jump Slide Idle Cheer Fall GetUp; do k=$((k+1)); u=${!k}; [ -s ${n}_$clip.glb ] || curl -fsSL -o ${n}_$clip.glb "$u"; done
python3 merge_clips.py ${n}_run.glb ${n}_merged.glb Jump=${n}_Jump.glb Slide=${n}_Slide.glb Idle=${n}_Idle.glb Cheer=${n}_Cheer.glb Fall=${n}_Fall.glb GetUp=${n}_GetUp.glb
cd /home/user/gt && npx gltf-transform resize /home/user/m3d/${n}_merged.glb /tmp/${n}_r.glb --width 1024 --height 1024 >/dev/null && npx gltf-transform webp /tmp/${n}_r.glb /home/user/m3d/c$i.glb >/dev/null
ls -la /home/user/m3d/c$i.glb
EOF
