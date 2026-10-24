/**
 * Themed maps, built in code (no models to load): each one is a recipe of sky,
 * light, ground, track, scenery and weather. The ids must also be in MAPS in
 * src/logic.js (the server checks map picks against that list).
 *
 * sky:      top / mid / horizon colours of the sky dome; `night` adds stars and a moon
 * sun:      colour of the sun glow, or null for none
 * fog:      [colour, near, far]
 * light:    hemisphere [sky, ground, intensity] and sun [colour, intensity]
 * far/near: colours of the far mountain ring and the nearer hill ring
 * ground:   pattern of the land beside the track; hills: how high they roll (0 flat … 3)
 * track:    pattern of the running surface, kerb colour, lane line colour
 * props:    [kind, weight, colours, scale] scattered either side (kinds: see PROP_PARTS in client.js)
 * fx:       weather particles (snow, petals, leaves, fireflies, embers, bubbles, dust)
 * arches:   neon arches over the track (colours), lamps: lamp posts along the kerbs
 */
const T = (id, label, icon, o) => ({ id, label, icon, clouds: true, hills: 1, fx: null, sun: "#fff3c4", ...o });

export const THEMES = [
  T("candy", "Candy Land", "🍭", {
    sky: { top: "#7ac8ff", mid: "#ffc2e4", horizon: "#fff0f8" }, fog: ["#ffe4f2", 80, 280],
    light: { hemi: ["#fff0fa", "#ff9ad0", 1.2], sun: ["#ffffff", 1.6] }, far: "#ff9ad0", near: "#ffb8e0",
    ground: { style: "speckle", colors: ["#ffb8dc", "#ffd0e8", "#ff9ad0"] }, track: { style: "bands", colors: ["#ff5aa0", "#ffffff"], kerb: "#7ad8ff", lines: "#ffffff" },
    props: [["lollipop", 4, { c: ["#ff4a8a", "#ffb02a", "#7a5aff", "#2ad0a0"], accent: ["#ffffff"] }], ["gumdrop", 3, { c: ["#ff5a5a", "#5ad05a", "#5a8aff", "#ffd02a", "#d05aff"] }], ["icecream", 2, { c: ["#ffd0e0", "#c8f0ff", "#fff0b0"], accent: ["#c8884a"] }]],
    hills: 1.5,
  }),
  T("xmas", "Winter Village", "🎄", {
    sky: { top: "#1a2a5a", mid: "#5a7ab0", horizon: "#f0c8a0" }, sun: "#ffd0a0", fog: ["#d8dcec", 60, 240],
    light: { hemi: ["#ffffff", "#8aa0c8", 1.15], sun: ["#ffe0c0", 1.4] }, far: "#9ab0d0", near: "#e0e8f4",
    ground: { style: "speckle", colors: ["#f4f8ff", "#ffffff", "#dce6f4"] }, track: { style: "tiles", colors: ["#8a7a7a", "#9a8a8a", "#6a5a5a"], kerb: "#e83a3a", lines: "#ffffff" },
    props: [["pine", 4, { leaf: ["#1f5a3a", "#2a6a46"] }], ["house", 3, { c: ["#c8483a", "#3a7a5a", "#e8c070"], accent: ["#ffffff"] }], ["snowman", 1, { c: ["#ffffff"] }], ["lamp", 1, { c: ["#2a2a2a"], accent: ["#ffd08a"] }, null, true]],
    fx: "snow", hills: 1.2,
  }),
  T("lava", "Lava Fields", "🔥", {
    sky: { top: "#1a0a0a", mid: "#5a1a0a", horizon: "#c83a0a" }, sun: null, fog: ["#4a1408", 40, 200], clouds: false,
    light: { hemi: ["#ff8a4a", "#1a0a0a", 0.9], sun: ["#ff6a2a", 1.4] }, far: "#2a0e0a", near: "#1e0a08",
    ground: { style: "lava", colors: ["#1a1414", "#ff4a0a", "#2a1e1e"] }, track: { style: "tiles", colors: ["#2a2222", "#3a3030", "#ff5a1a"], kerb: "#ffb03a", lines: "#ffcf7a" },
    props: [["rock", 4, { c: ["#2a2020", "#1a1414"] }, [1.2, 2.6]], ["crystal", 2, { c: ["#ff5a1a", "#ffb03a"] }, null, true]],
    fx: "embers", hills: 1.4,
  }),
  T("desert", "Desert Dunes", "🏜️", {
    sky: { top: "#2f86d6", mid: "#8fd0f2", horizon: "#fff1cf" }, sun: "#fff6d0", fog: ["#fff1cf", 80, 300],
    light: { hemi: ["#fff4dc", "#c99a5a", 1.1], sun: ["#fff0c8", 2.3] }, far: "#d9a86a", near: "#e8bf7a",
    ground: { style: "waves", colors: ["#e8c27a", "#f2d394", "#d4a95e"] }, track: { style: "speckle", colors: ["#c98a4a", "#d89b5a", "#b47a3c"], kerb: "#fff3dc" },
    props: [["cactus", 4, { c: ["#3f9a4a", "#4fae54"] }], ["rock", 2, { c: ["#c4864a", "#a86e3a"] }]],
    hills: 2.4, fx: "dust",
  }),
];

