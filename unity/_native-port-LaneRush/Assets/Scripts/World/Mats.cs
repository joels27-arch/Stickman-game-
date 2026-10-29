// Materials made in code from one base material in Resources (so the Standard shader is
// always included in builds), cached per colour.
using System.Collections.Generic;
using UnityEngine;

namespace LaneRush
{
    public static class Mats
    {
        static Material baseMat;
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        static Material Base
        {
            get
            {
                if (baseMat == null)
                {
                    baseMat = Resources.Load<Material>("LaneRushLit");
                    if (baseMat == null) baseMat = new Material(Shader.Find("Standard"));
                }
                return baseMat;
            }
        }

        /// <summary>A lit material in this colour (shared: never change it afterwards).</summary>
        public static Material Lit(Color c, float smooth = 0.25f, float metal = 0f)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + smooth.ToString("0.00") + metal.ToString("0.00");
            if (cache.TryGetValue(key, out var m) && m != null) return m;
            m = new Material(Base) { color = c };
            m.SetFloat("_Glossiness", smooth);
            m.SetFloat("_Metallic", metal);
            cache[key] = m;
            return m;
        }

        /// <summary>A glowing material (lane lines, pads, rails).</summary>
        public static Material Glow(Color c, float strength = 0.8f)
        {
            string key = "glow" + ColorUtility.ToHtmlStringRGBA(c) + strength.ToString("0.00");
            if (cache.TryGetValue(key, out var m) && m != null) return m;
            m = new Material(Base) { color = c };
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", c * strength);
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
            cache[key] = m;
            return m;
        }

        /// <summary>A new textured material (not cached: its texture offset scrolls).</summary>
        public static Material Textured(Texture2D tex, Vector2 tiling)
        {
            var m = new Material(Base) { color = Color.white, mainTexture = tex };
            m.mainTextureScale = tiling;
            m.SetFloat("_Glossiness", 0.15f);
            return m;
        }

        /// <summary>A transparent material (the shield bubble).</summary>
        public static Material Transparent(Color c)
        {
            var m = new Material(Base) { color = c };
            m.SetFloat("_Mode", 3f);
            m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetInt("_ZWrite", 0);
            m.DisableKeyword("_ALPHATEST_ON");
            m.EnableKeyword("_ALPHABLEND_ON");
            m.renderQueue = 3000;
            return m;
        }

        /// <summary>A primitive with this material, no collider (the game does its own collisions).</summary>
        public static GameObject Prim(PrimitiveType type, Material mat, Transform parent, Vector3 pos, Vector3 scale, string name = null)
        {
            var go = GameObject.CreatePrimitive(type);
            Object.Destroy(go.GetComponent<Collider>());
            if (name != null) go.name = name;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            return go;
        }

        /// <summary>A stripes texture: bands of two colours across the track (repeats every `bands`).</summary>
        public static Texture2D Stripes(Color a, Color b, int bands = 2)
        {
            var t = new Texture2D(4, 64, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            var px = new Color[4 * 64];
            for (int y = 0; y < 64; y++)
                for (int x = 0; x < 4; x++)
                    px[y * 4 + x] = (y * bands / 64) % 2 == 0 ? a : b;
            t.SetPixels(px);
            t.Apply();
            return t;
        }

        /// <summary>A speckled texture for the ground beside the track.</summary>
        public static Texture2D Speckle(Color a, Color b, int seed)
        {
            var t = new Texture2D(128, 128, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            var rnd = new System.Random(seed);
            var px = new Color[128 * 128];
            for (int i = 0; i < px.Length; i++)
            {
                double v = rnd.NextDouble();
                px[i] = v < 0.82 ? Color.Lerp(a, a * 0.94f, (float)rnd.NextDouble()) : Color.Lerp(a, b, 0.6f);
                px[i].a = 1;
            }
            t.SetPixels(px);
            t.Apply();
            return t;
        }
    }
}
