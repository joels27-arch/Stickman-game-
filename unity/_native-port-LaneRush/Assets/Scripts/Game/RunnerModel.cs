// The runner you see: one of the game's rigged 3D runners (the same .glb files as the web game,
// loaded at runtime with glTFast), playing run / jump / slide / fall clips. A runner comes from
// StreamingAssets/Runners if it's there, else from the download cache, else it's downloaded from
// the live game once and cached. Until it has loaded (or offline) a simple stand-in figure runs.
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
#if LANERUSH_GLTFAST
using GLTFast;
#endif

namespace LaneRush
{
    public sealed class RunnerModel : MonoBehaviour
    {
        public const float CharH = 1.4f; // the runners are rigged at 1.4 m

        Transform standIn, legL, legR, armL, armR;
        Animation anim;
        string current = "";
        float phase;
        string oneShot; // jump / slide / fall play once, then back to running
        float oneShotT;

        public static readonly string[] Names = { "Rex", "Bolt", "Ivy", "Gizmo", "Pip", "Kiko", "Dino", "Nova", "Gloop", "Sharky", "Captain Brainstorm", "Pandu", "Siete", "Prof. Brainz", "Big Dunk", "Webster", "MC Gold", "Momo", "Glorb" };
        // runner index -> .glb file, as in the web game's RUNNERS list
        public static readonly string[] Files = { "c0", "c1b", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c19", "c14", "c15", "c16", "c17", "c18" };
        public static readonly Color[] Colors =
        {
            Hex("#ef4a3c"), Hex("#2f7df6"), Hex("#2fbf55"), Hex("#f5b921"), Hex("#e0703a"), Hex("#7c4dff"), Hex("#14b8a6"), Hex("#8fa3bf"),
            Hex("#5b2a8a"), Hex("#3f8fe0"), Hex("#7c3aed"), Hex("#d23a2a"), Hex("#e02424"), Hex("#ff7ab8"), Hex("#14b8b0"), Hex("#1a6a78"), Hex("#f0b400"), Hex("#e9ecef"), Hex("#8a4fd8"),
        };
        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        const string Site = "https://lane-rush-party.higgsfield.app/assets/";
        int loadId; // a newer Setup() wins over a load still in flight

        public void Setup(int runner)
        {
            loadId++;
            foreach (Transform ch in transform) Destroy(ch.gameObject);
            anim = null;
            BuildStandIn(Colors[Mathf.Clamp(runner, 0, Colors.Length - 1)]);
#if LANERUSH_GLTFAST
            Load(runner);
#endif
        }

        void BuildStandIn(Color c)
        {
            standIn = new GameObject("Stand-in runner").transform;
            standIn.SetParent(transform, false);
            var body = Mats.Lit(c, 0.4f);
            var skin = Mats.Lit(new Color(1f, 0.82f, 0.68f), 0.3f);
            Mats.Prim(PrimitiveType.Capsule, body, standIn, new Vector3(0, 0.85f, 0), new Vector3(0.45f, 0.32f, 0.3f));
            Mats.Prim(PrimitiveType.Sphere, skin, standIn, new Vector3(0, 1.28f, 0), Vector3.one * 0.32f);
            legL = Limb(body, new Vector3(-0.11f, 0.55f, 0), 0.5f);
            legR = Limb(body, new Vector3(0.11f, 0.55f, 0), 0.5f);
            armL = Limb(skin, new Vector3(-0.28f, 1.05f, 0), 0.42f);
            armR = Limb(skin, new Vector3(0.28f, 1.05f, 0), 0.42f);
        }

        Transform Limb(Material m, Vector3 hip, float len)
        {
            var pivot = new GameObject("limb").transform;
            pivot.SetParent(standIn, false);
            pivot.localPosition = hip;
            Mats.Prim(PrimitiveType.Capsule, m, pivot, new Vector3(0, -len / 2, 0), new Vector3(0.13f, len / 2, 0.13f));
            return pivot;
        }

#if LANERUSH_GLTFAST
        /// <summary>The runner's .glb bytes: bundled, cached, or downloaded once (null if offline).</summary>
        static async Task<byte[]> Bytes(string name)
        {
            string bundled = Path.Combine(Application.streamingAssetsPath, "Runners", name + ".glb");
            if (!bundled.Contains("://") && File.Exists(bundled)) return File.ReadAllBytes(bundled);
            string cached = Path.Combine(Application.persistentDataPath, "Runners", name + ".glb");
            if (File.Exists(cached)) return File.ReadAllBytes(cached);
            using (var req = UnityWebRequest.Get(Site + name + ".glb"))
            {
                var op = req.SendWebRequest();
                while (!op.isDone) await Task.Yield();
                if (req.result != UnityWebRequest.Result.Success) { Debug.LogWarning("Lane Rush: couldn't download runner " + name + ": " + req.error); return null; }
                var data = req.downloadHandler.data;
                Directory.CreateDirectory(Path.GetDirectoryName(cached));
                File.WriteAllBytes(cached, data);
                return data;
            }
        }

        async void Load(int runner)
        {
            int id = loadId;
            var data = await Bytes(Files[Mathf.Clamp(runner, 0, Files.Length - 1)]);
            if (data == null || this == null || id != loadId) return;
            var gltf = new GltfImport();
            var ok = await gltf.Load(data, null, new ImportSettings { AnimationMethod = AnimationMethod.Legacy });
            if (!ok || this == null || id != loadId) return;
            var holder = new GameObject("Model").transform;
            holder.SetParent(transform, false);
            ok = await gltf.InstantiateMainSceneAsync(holder);
            if (!ok || this == null || id != loadId) { if (holder != null) Destroy(holder.gameObject); return; }
            // fit: CharH tall, feet on the ground
            var rends = holder.GetComponentsInChildren<Renderer>();
            if (rends.Length > 0)
            {
                var b = rends[0].bounds;
                foreach (var r in rends) b.Encapsulate(r.bounds);
                float k = CharH / Mathf.Max(0.01f, b.size.y);
                holder.localScale = Vector3.one * k;
                holder.localPosition = new Vector3(0, -(b.min.y - transform.position.y) * k, 0);
                foreach (var r in rends) r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            }
            anim = holder.GetComponentInChildren<Animation>();
            var clips = gltf.GetAnimationClips();
            if (anim == null && clips != null && clips.Length > 0)
            {
                anim = holder.GetChild(0).gameObject.AddComponent<Animation>();
                foreach (var c in clips) { c.legacy = true; anim.AddClip(c, c.name); }
            }
            if (standIn != null) standIn.gameObject.SetActive(false);
            current = "";
            Play("run");
        }
#endif

        /// <summary>The clip whose name contains `key` (the .glb clips are named like "Run", "Jump"…).</summary>
        string ClipFor(string key)
        {
            if (anim == null) return null;
            foreach (AnimationState s in anim)
            {
                string n = s.name.ToLowerInvariant();
                if (key == "run" && n.Contains("run")) return s.name;
                if (key == "jump" && n.Contains("jump") && !n.Contains("happy")) return s.name;
                if (key == "slide" && n.Contains("slide")) return s.name;
                if (key == "fall" && n.Contains("fall")) return s.name;
                if (key == "idle" && n.Contains("idle")) return s.name;
                if (key == "cheer" && (n.Contains("cheer") || n.Contains("happy"))) return s.name;
            }
            return null;
        }

        public void Play(string key)
        {
            if (key != "run" && key != "idle") { oneShot = key; oneShotT = key == "fall" ? 1.2f : 0.7f; }
            if (anim == null || key == current) return;
            var name = ClipFor(key);
            if (name == null) return;
            var st = anim[name];
            st.wrapMode = key == "run" || key == "idle" ? WrapMode.Loop : WrapMode.ClampForever;
            anim.CrossFade(name, 0.12f);
            current = key;
        }

        public void Tick(float dt, bool running, bool air = false, bool slide = false, bool rocket = false, float speed = 12f)
        {
            if (oneShotT > 0) { oneShotT -= dt; if (oneShotT <= 0 && running) { oneShot = null; Play("run"); } }
            if (anim != null)
            {
                if (!running && current != "fall") Play("idle");
                var name = ClipFor("run");
                if (current == "run" && name != null) anim[name].speed = speed / 12f;
                return;
            }
            // the stand-in: swing arms and legs, crouch when sliding, tuck in the air
            if (standIn == null) return;
            phase += dt * (running ? speed * 0.9f : 2f);
            float swing = running && !air ? Mathf.Sin(phase) * 45f : air ? 25f : 0f;
            legL.localRotation = Quaternion.Euler(swing, 0, 0);
            legR.localRotation = Quaternion.Euler(-swing, 0, 0);
            armL.localRotation = Quaternion.Euler(-swing, 0, 0);
            armR.localRotation = Quaternion.Euler(swing, 0, 0);
            standIn.localScale = slide && !air ? new Vector3(1, 0.55f, 1) : Vector3.one;
            standIn.localRotation = rocket ? Quaternion.Euler(20, 0, 0) : !running && oneShot == "fall" ? Quaternion.Euler(80, 0, 0) : Quaternion.identity;
        }
    }
}
