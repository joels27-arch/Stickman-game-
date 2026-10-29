// The world around the track for one map: light, fog, sky colour, the running track (a strip that
// follows the runner, its stripes scrolling), kerbs, lane lines, ground, hills, roadside props and
// a themed wall behind the start. Everything is built from primitives: nothing to download.
using System.Collections.Generic;
using UnityEngine;

namespace LaneRush
{
    public sealed class World : MonoBehaviour
    {
        public const float LaneW = (float)Rules.LaneW;
        public static readonly float TrackW = Rules.Lanes * LaneW + 1.6f;
        const float StripLen = 420f; // the moving strips' length (well past the fog)

        public MapTheme Theme { get; private set; }
        Transform strips;
        Material trackMat, groundMat;
        readonly List<Transform> props = new List<Transform>();
        Light sun;
        Transform root;

        public static float LaneX(float lane) => (lane - (Rules.Lanes - 1) / 2f) * LaneW;

        public void Build(MapTheme theme, Camera cam)
        {
            Theme = theme;
            if (root != null) Destroy(root.gameObject);
            props.Clear();
            root = new GameObject("World · " + theme.Label).transform;
            root.SetParent(transform, false);

            // light, ambient, fog, sky
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = theme.HemiSky * theme.HemiIntensity * 0.75f;
            RenderSettings.ambientEquatorColor = Color.Lerp(theme.HemiSky, theme.HemiGround, 0.5f) * theme.HemiIntensity * 0.6f;
            RenderSettings.ambientGroundColor = theme.HemiGround * theme.HemiIntensity * 0.5f;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = theme.Fog;
            RenderSettings.fogStartDistance = theme.FogNear;
            RenderSettings.fogEndDistance = theme.FogFar;
            RenderSettings.skybox = null;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = theme.Fog;
            cam.farClipPlane = theme.FogFar + 40;

            sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(root, false);
            sun.type = LightType.Directional;
            sun.color = theme.Sun;
            sun.intensity = theme.SunIntensity * 0.75f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.55f;
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // the sky: the fog colour fills the background, so the horizon melts into it
            // the strips that move with the runner: ground, track, kerbs, lane lines
            strips = new GameObject("Strips").transform;
            strips.SetParent(root, false);
            groundMat = Mats.Textured(Mats.Speckle(theme.Ground, theme.Ground2, theme.Id.GetHashCode()), new Vector2(40, 40));
            var ground = Mats.Prim(PrimitiveType.Quad, groundMat, strips, new Vector3(0, -0.02f, StripLen / 2 - 60), new Vector3(StripLen * 1.6f, StripLen, 1), "Ground");
            ground.transform.localRotation = Quaternion.Euler(90, 0, 0);
            trackMat = Mats.Textured(Mats.Stripes(theme.Track, theme.Track2, 2), new Vector2(1, StripLen / 4f));
            var track = Mats.Prim(PrimitiveType.Cube, trackMat, strips, new Vector3(0, -0.1f, StripLen / 2 - 60), new Vector3(TrackW, 0.2f, StripLen), "Track");
            track.GetComponent<MeshRenderer>().receiveShadows = true;
            foreach (int s in new[] { -1, 1 })
                Mats.Prim(PrimitiveType.Cube, Mats.Lit(theme.Kerb, 0.4f), strips, new Vector3(s * (TrackW / 2 + 0.22f), 0.06f, StripLen / 2 - 60), new Vector3(0.45f, 0.32f, StripLen), "Kerb");
            for (int i = 1; i < Rules.Lanes; i++)
                Mats.Prim(PrimitiveType.Cube, Mats.Glow(theme.Lines, 0.35f), strips, new Vector3(LaneX(i - 0.5f), 0.005f, StripLen / 2 - 60), new Vector3(0.08f, 0.01f, StripLen), "Lane line");

            // hills: a ring of big flattened domes far out on both sides
            var rnd = new System.Random(theme.Id.Length * 7919);
            for (int i = 0; i < 18; i++)
            {
                float side = i % 2 == 0 ? -1 : 1;
                float r = 40 + (float)rnd.NextDouble() * 60;
                var hill = Mats.Prim(PrimitiveType.Sphere, Mats.Lit(i % 3 == 0 ? theme.Far : theme.Near, 0.05f), strips,
                    new Vector3(side * (60 + (float)rnd.NextDouble() * 80), -r * 0.7f, i * 24f), new Vector3(r * 2.2f, r * 1.2f, r * 1.6f), "Hill");
                hill.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }

            // roadside props (recycled as the runner moves on): cones, crystals, drops… in the map's colours
            for (int i = 0; i < 40; i++)
            {
                float side = i % 2 == 0 ? -1 : 1;
                var shape = theme.Backdrop == "crystal" || theme.Backdrop == "ice" ? PrimitiveType.Capsule : theme.Backdrop == "pyramid" ? PrimitiveType.Cube : PrimitiveType.Sphere;
                float h = 1.5f + (float)rnd.NextDouble() * 4f;
                var p = Mats.Prim(shape, Mats.Lit(Color.Lerp(theme.Prop, theme.Near, (float)rnd.NextDouble() * 0.4f), 0.3f), root,
                    new Vector3(side * (TrackW / 2 + 3 + (float)rnd.NextDouble() * 18), h * 0.4f, i * 9f), new Vector3(h * 0.7f, h, h * 0.7f), "Prop");
                if (shape == PrimitiveType.Cube) p.transform.localRotation = Quaternion.Euler(0, 45, 0);
                props.Add(p.transform);
            }

            BuildBackdrop(theme);
        }

        /// <summary>A wall of shapes behind the start that fits the map (icebergs, candy, scoops, pyramids, rocks).</summary>
        void BuildBackdrop(MapTheme theme)
        {
            var g = new GameObject("Backdrop").transform;
            g.SetParent(root, false);
            var rnd = new System.Random(99 + theme.Id.Length * 31);
            for (int i = 0; i < 44; i++)
            {
                bool back = i >= 22;
                float x = -150 + ((i % 22) + (float)rnd.NextDouble() * 0.6f) * (300f / 22f);
                float h = (back ? 40 : 20) + (float)rnd.NextDouble() * (back ? 34 : 18);
                float w = 13 + (float)rnd.NextDouble() * 12;
                float z = -(back ? 92 : 74) - (float)rnd.NextDouble() * 8;
                var shape = theme.Backdrop == "pyramid" ? PrimitiveType.Cube : theme.Backdrop == "drop" || theme.Backdrop == "scoop" ? PrimitiveType.Sphere : theme.Backdrop == "ice" || theme.Backdrop == "crystal" ? PrimitiveType.Capsule : PrimitiveType.Sphere;
                var col = Color.Lerp(theme.Far, theme.Prop, (float)rnd.NextDouble());
                if (theme.Backdrop == "drop" || theme.Backdrop == "scoop") col = Color.HSVToRGB((float)rnd.NextDouble(), 0.45f, 1f);
                var o = Mats.Prim(shape, Mats.Lit(col, 0.2f), g, new Vector3(x, h * 0.25f, z), new Vector3(w, h * 0.6f, w * 0.8f), "Backdrop");
                if (shape == PrimitiveType.Cube) { o.transform.localRotation = Quaternion.Euler(45, 45, 0); o.transform.localScale = Vector3.one * h * 0.75f; o.transform.localPosition = new Vector3(x, 0, z); }
                else o.transform.localRotation = Quaternion.Euler(0, (float)rnd.NextDouble() * 360, 0);
            }
            Mats.Prim(PrimitiveType.Quad, Mats.Lit(theme.Fog, 0f), g, new Vector3(0, 30, -112), new Vector3(460, 76, 1), "Backdrop wall").transform.localRotation = Quaternion.Euler(0, 180, 0);
        }

        /// <summary>Keep the strips under the runner (their pattern scrolls so the track looks endless) and recycle props.</summary>
        public void Follow(float d)
        {
            if (strips == null) return;
            float snap = Mathf.Max(0, d - 30f);
            strips.localPosition = new Vector3(0, 0, snap);
            trackMat.mainTextureOffset = new Vector2(0, snap / 4f);
            groundMat.mainTextureOffset = new Vector2(0, snap / (StripLen / 40f));
            foreach (var p in props)
                if (p.localPosition.z < d - 20) p.localPosition += new Vector3(0, 0, 360);
        }
    }
}
