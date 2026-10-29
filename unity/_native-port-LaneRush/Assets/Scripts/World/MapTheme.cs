// The 12 maps' colours, taken from the web game's public/themes.js (same ids and palettes).
using UnityEngine;

namespace LaneRush
{
    public sealed class MapTheme
    {
        public string Id, Label;
        public Color SkyTop, SkyMid, Horizon, Fog;
        public float FogNear, FogFar;
        public Color Ground, Ground2, Track, Track2, Kerb, Lines, Far, Near, Prop;
        public Color HemiSky, HemiGround, Sun;
        public float HemiIntensity, SunIntensity;
        public bool Night;
        /// <summary>What stands behind the start: ice, drop (candy), scoop, crystal, pyramid or rock.</summary>
        public string Backdrop;

        static Color C(string hex) { ColorUtility.TryParseHtmlString(hex, out var c); return c; }

        static MapTheme T(string id, string label, string top, string mid, string hor, string fog, float near, float far,
            string ground, string ground2, string track, string track2, string kerb, string lines, string farC, string nearC,
            bool night, string hemiSky, string hemiGround, float hemiI, string sun, float sunI, string prop, string backdrop) =>
            new MapTheme
            {
                Id = id, Label = label, SkyTop = C(top), SkyMid = C(mid), Horizon = C(hor), Fog = C(fog), FogNear = near, FogFar = far,
                Ground = C(ground), Ground2 = C(ground2), Track = C(track), Track2 = C(track2), Kerb = C(kerb), Lines = C(lines),
                Far = C(farC), Near = C(nearC), Night = night, HemiSky = C(hemiSky), HemiGround = C(hemiGround), HemiIntensity = hemiI,
                Sun = C(sun), SunIntensity = sunI, Prop = C(prop), Backdrop = backdrop,
            };

        public static readonly MapTheme[] All =
        {
            T("candy", "Candy Land", "#7ac8ff", "#ffc2e4", "#fff0f8", "#ffe4f2", 80, 280, "#ffb8dc", "#ffd0e8", "#ff5aa0", "#ffffff", "#7ad8ff", "#ffffff", "#ff9ad0", "#ffb8e0", false, "#fff0fa", "#ff9ad0", 1.2f, "#ffffff", 1.6f, "#ff4a8a", "drop"),
            T("snowy", "Snowy Peaks", "#2f6fc4", "#9cc9ef", "#eef6ff", "#eef6ff", 60, 240, "#f4f8ff", "#ffffff", "#9fc4e8", "#b7d4f0", "#ffffff", "#2f6fc4", "#c8d8f0", "#e8f0fb", false, "#ffffff", "#9ab4d4", 1.25f, "#ffffff", 1.6f, "#2f5a46", "ice"),
            T("space", "Space", "#05040c", "#0b0722", "#1b1240", "#1b1240", 60, 260, "#3a3a46", "#2e2e38", "#2a3550", "#334066", "#38f0ff", "#38f0ff", "#14102a", "#1b1240", true, "#b8c0ff", "#14102a", 1.0f, "#e0e8ff", 1.2f, "#4a4a5a", "rock"),
            T("crystal", "Crystal Caves", "#0e0a24", "#2a1a5a", "#5a3a9a", "#2a1a5a", 40, 200, "#2a2240", "#3a3058", "#4a4070", "#5a5088", "#7af0ff", "#7af0ff", "#2a1a4a", "#3a2a6a", true, "#a8a0ff", "#1a1030", 1.0f, "#c0b0ff", 0.8f, "#5af0ff", "crystal"),
            T("mars", "Mars", "#5a2a2a", "#c8784a", "#f0b88a", "#e8a070", 60, 260, "#b8562e", "#c86a3e", "#8a8a92", "#a0a0a8", "#ffffff", "#ffffff", "#a0482a", "#b85a32", false, "#ffd0b0", "#8a3a1a", 1.0f, "#ffe0c0", 2.0f, "#9a4626", "rock"),
            T("deepsea", "Deep Sea", "#021a3a", "#0a4a7a", "#2a8ab0", "#0a5a80", 30, 170, "#d8c890", "#e8d8a0", "#3a7a8a", "#4a8a9a", "#ffe08a", "#ffffff", "#0a3a5a", "#14506a", false, "#7ad8ff", "#0a2a3a", 1.1f, "#a0e8ff", 1.2f, "#ff6a6a", "rock"),
            T("lava", "Lava Fields", "#1a0a0a", "#5a1a0a", "#c83a0a", "#4a1408", 40, 200, "#1a1414", "#ff4a0a", "#2a2222", "#3a3030", "#ffb03a", "#ffcf7a", "#2a0e0a", "#1e0a08", false, "#ff8a4a", "#1a0a0a", 0.9f, "#ff6a2a", 1.4f, "#2a2020", "rock"),
            T("egypt", "Pyramids", "#2f86d6", "#98d0f0", "#fff0cc", "#ffeec8", 90, 320, "#e8cc8a", "#f4dca0", "#d8b880", "#e8c890", "#fff4dc", "#ffffff", "#d8b07a", "#e8c890", false, "#fff4dc", "#c8a060", 1.1f, "#fff0c8", 2.3f, "#e0c080", "pyramid"),
            T("icecream", "Ice Cream Hills", "#8ad0ff", "#ffd8ec", "#fff8e8", "#fff4ec", 80, 280, "#fff0d8", "#ffe0f0", "#8a5a3a", "#a87048", "#ffffff", "#ffe0f0", "#ffc8e0", "#c8f0ff", false, "#fff8f4", "#f0c0d0", 1.25f, "#ffffff", 1.6f, "#ffb8d8", "scoop"),
            T("aurora", "Arctic Aurora", "#020a1a", "#0a3a4a", "#2ad0a0", "#0a2a3a", 60, 250, "#d8e8f4", "#ffffff", "#6aa8d0", "#8ac0e0", "#ffffff", "#2af0b0", "#0a2a3a", "#c8e0ec", true, "#a0ffe0", "#0a1a2a", 1.05f, "#c0fff0", 0.9f, "#d0e8f8", "ice"),
            T("artlist", "Artlist", "#050507", "#16161c", "#3a2e10", "#141418", 50, 230, "#1c1a40", "#ffc81e", "#3b3f9a", "#4549ab", "#ffc81e", "#ffc81e", "#101014", "#1c1c22", true, "#fff2cc", "#18181e", 1.15f, "#ffffff", 1.4f, "#1e1e24", "rock"),
            T("uranus", "Uranus", "#12062e", "#3a1260", "#5a1c78", "#3a1464", 70, 300, "#140a2a", "#1a0e34", "#1e2a4a", "#24325a", "#1a2240", "#a89ee0", "#3a1464", "#3a1464", false, "#c8a8ff", "#1a0c38", 0.9f, "#e0d0ff", 0.9f, "#2a2440", "rock"),
        };

        public static MapTheme Get(string id)
        {
            foreach (var t in All) if (t.Id == id) return t;
            return All[0];
        }
    }
}
