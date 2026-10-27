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
  T("snowy", "Snowy Peaks", "🏔️", {
    sky: { top: "#2f6fc4", mid: "#9cc9ef", horizon: "#eef6ff" }, fog: ["#eef6ff", 60, 240],
    light: { hemi: ["#ffffff", "#9ab4d4", 1.25], sun: ["#ffffff", 1.6] }, far: "#c8d8f0", near: "#e8f0fb",
    ground: { style: "speckle", colors: ["#f4f8ff", "#ffffff", "#d8e4f4"] }, track: { style: "speckle", colors: ["#9fc4e8", "#b7d4f0", "#88b0d8"], kerb: "#ffffff", lines: "#2f6fc4" },
    props: [["pine", 5, { leaf: ["#2f5a46", "#3a6b54"] }], ["snowman", 1, { c: ["#ffffff"] }], ["rock", 1, { c: ["#c8d0dc"] }]],
    fx: "snow", hills: 2.5,
  }),
  T("candy", "Candy Land", "🍭", {
    sky: { top: "#7ac8ff", mid: "#ffc2e4", horizon: "#fff0f8" }, fog: ["#ffe4f2", 80, 280],
    light: { hemi: ["#fff0fa", "#ff9ad0", 1.2], sun: ["#ffffff", 1.6] }, far: "#ff9ad0", near: "#ffb8e0",
    ground: { style: "speckle", colors: ["#ffb8dc", "#ffd0e8", "#ff9ad0"] }, track: { style: "bands", colors: ["#ff5aa0", "#ffffff"], kerb: "#7ad8ff", lines: "#ffffff" },
    props: [["lollipop", 4, { c: ["#ff4a8a", "#ffb02a", "#7a5aff", "#2ad0a0"], accent: ["#ffffff"] }], ["gumdrop", 3, { c: ["#ff5a5a", "#5ad05a", "#5a8aff", "#ffd02a", "#d05aff"] }], ["icecream", 2, { c: ["#ffd0e0", "#c8f0ff", "#fff0b0"], accent: ["#c8884a"] }]],
    hills: 1.5,
  }),
  T("crystal", "Crystal Caves", "💎", {
    sky: { top: "#0e0a24", mid: "#2a1a5a", horizon: "#5a3a9a" }, sun: null, night: true, fog: ["#2a1a5a", 40, 200], clouds: false,
    light: { hemi: ["#a8a0ff", "#1a1030", 1.0], sun: ["#c0b0ff", 0.8] }, far: "#2a1a4a", near: "#3a2a6a",
    ground: { style: "speckle", colors: ["#2a2240", "#3a3058", "#1e1830"] }, track: { style: "tiles", colors: ["#4a4070", "#5a5088", "#2a2448"], kerb: "#7af0ff", lines: "#7af0ff" },
    props: [["crystal", 6, { c: ["#5af0ff", "#ff5af0", "#a05aff", "#5aff9a"] }, [1, 2.6], true], ["rock", 2, { c: ["#3a3058"] }]],
    fx: "fireflies", hills: 2,
  }),
  T("neon", "Neon Night", "🌃", {
    sky: { top: "#05031a", mid: "#2a0a4a", horizon: "#8a1a8a" }, sun: null, night: true, fog: ["#3a0a4a", 50, 230], clouds: false,
    light: { hemi: ["#8a6aff", "#1a0a2a", 0.9], sun: ["#d0a0ff", 0.7] }, far: "#1a0a3a", near: "#2a0a4a",
    ground: { style: "grid", colors: ["#120a24", "#ff3ad0"] }, track: { style: "grid", colors: ["#1a1030", "#3af0ff"], kerb: "#ff3ad0", lines: "#3af0ff" },
    props: [["building", 6, { c: ["#2a2a5a", "#3a1a5a", "#1a2a4a"] }, [1, 3], true], ["lamp", 1, { c: ["#3a3a5a"], accent: ["#ff3ad0", "#3af0ff"] }, null, true]],
    arches: ["#ff3ad0", "#3af0ff", "#ffe23a"], hills: 0, movers: "city",
  }),
  T("mars", "Mars", "🔴", {
    sky: { top: "#5a2a2a", mid: "#c8784a", horizon: "#f0b88a" }, sun: "#fff0d0", fog: ["#e8a070", 60, 260], clouds: false,
    light: { hemi: ["#ffd0b0", "#8a3a1a", 1.0], sun: ["#ffe0c0", 2.0] }, far: "#a0482a", near: "#b85a32",
    ground: { style: "speckle", colors: ["#b8562e", "#c86a3e", "#9a4626"] }, track: { style: "tiles", colors: ["#8a8a92", "#a0a0a8", "#6a6a72"], kerb: "#ffffff" },
    props: [["rock", 4, { c: ["#9a4626", "#7a3620"] }, [1, 2.5]], ["dome", 1, { c: ["#e8e8f0"], accent: ["#7ad0ff"] }], ["spire", 1, { c: ["#8a3a20"] }]],
    fx: "dust", hills: 2, movers: "space",
  }),
  T("deepsea", "Deep Sea", "🐠", {
    sky: { top: "#021a3a", mid: "#0a4a7a", horizon: "#2a8ab0" }, sun: null, fog: ["#0a5a80", 30, 170], clouds: false,
    light: { hemi: ["#7ad8ff", "#0a2a3a", 1.1], sun: ["#a0e8ff", 1.2] }, far: "#0a3a5a", near: "#14506a",
    ground: { style: "waves", colors: ["#d8c890", "#e8d8a0", "#c4b47c"] }, track: { style: "tiles", colors: ["#3a7a8a", "#4a8a9a", "#2a6070"], kerb: "#ffe08a" },
    props: [["coral", 4, { c: ["#ff6a6a", "#ff9a3a", "#ff5ab0", "#c05aff"] }, [0.8, 1.8]], ["seaweed", 4, { c: ["#2fa86a", "#3ac078"] }, [1, 2]], ["rock", 1, { c: ["#4a6a70"] }]],
    fx: "bubbles", hills: 1.6, movers: "beach",
  }),
  T("lava", "Lava Fields", "🔥", {
    sky: { top: "#1a0a0a", mid: "#5a1a0a", horizon: "#c83a0a" }, sun: null, fog: ["#4a1408", 40, 200], clouds: false,
    light: { hemi: ["#ff8a4a", "#1a0a0a", 0.9], sun: ["#ff6a2a", 1.4] }, far: "#2a0e0a", near: "#1e0a08",
    ground: { style: "lava", colors: ["#1a1414", "#ff4a0a", "#2a1e1e"] }, track: { style: "tiles", colors: ["#2a2222", "#3a3030", "#ff5a1a"], kerb: "#ffb03a", lines: "#ffcf7a" },
    props: [["rock", 4, { c: ["#2a2020", "#1a1414"] }, [1.2, 2.6]], ["crystal", 2, { c: ["#ff5a1a", "#ffb03a"] }, null, true]],
    fx: "embers", hills: 1.4,
  }),
  T("rainbow", "Rainbow Road", "🌈", {
    sky: { top: "#05021a", mid: "#1a0a4a", horizon: "#4a2a8a" }, sun: null, night: true, fog: ["#1a0a3a", 60, 260], clouds: false,
    light: { hemi: ["#ffffff", "#4a2a8a", 1.2], sun: ["#ffffff", 1.0] }, far: "#2a1a5a", near: "#1a0a3a",
    ground: { style: "speckle", colors: ["#0e0828", "#1a1040", "#ffffff"] }, track: { style: "rainbow", colors: ["#ff3a3a", "#ff9a2a", "#ffe23a", "#3ad06a", "#3a9aff", "#a04aff"], kerb: "#ffffff", lines: "#ffffff" },
    props: [["star", 3, { c: ["#ffe23a", "#ffffff", "#7af0ff"] }, [0.8, 1.6], true], ["crystal", 1, { c: ["#ff5af0", "#5af0ff"] }, null, true]],
    arches: ["#ff3a3a", "#ffe23a", "#3ad06a", "#3a9aff", "#a04aff"], hills: 0, movers: "space",
  }),
  T("clouds", "Cloud Kingdom", "☁️", {
    sky: { top: "#4aa0f0", mid: "#b8e0ff", horizon: "#ffffff" }, sun: "#fff8e0", fog: ["#ffffff", 70, 260],
    light: { hemi: ["#ffffff", "#c8d8f0", 1.35], sun: ["#fffbe8", 1.5] }, far: "#e0eefc", near: "#f4f8ff",
    ground: { style: "speckle", colors: ["#f4f8ff", "#ffffff", "#e0eaf8"] }, track: { style: "speckle", colors: ["#ffd24a", "#ffe07a", "#f0b82a"], kerb: "#ffffff", lines: "#ffffff" },
    props: [["puff", 5, { c: ["#ffffff", "#f0f6ff"] }, [1, 2.6]], ["balloon", 2, { c: ["#ff5a7a", "#ffd02a", "#5ab0ff", "#7ae07a"], accent: ["#ffffff"] }], ["island", 1, { c: ["#8a6a4a"], accent: ["#6ac05a"] }]],
    hills: 1, movers: "space",
  }),
  T("egypt", "Pyramids", "🐫", {
    sky: { top: "#2f86d6", mid: "#98d0f0", horizon: "#fff0cc" }, sun: "#fff8d8", fog: ["#ffeec8", 90, 320],
    light: { hemi: ["#fff4dc", "#c8a060", 1.1], sun: ["#fff0c8", 2.3] }, far: "#d8b07a", near: "#e8c890",
    ground: { style: "waves", colors: ["#e8cc8a", "#f4dca0", "#d4b470"] }, track: { style: "tiles", colors: ["#d8b880", "#e8c890", "#b89860"], kerb: "#fff4dc" },
    props: [["pyramid", 2, { c: ["#e0c080", "#d4b070"] }, [1.5, 4]], ["column", 2, { c: ["#e8d8b0"] }], ["palm", 2, { leaf: ["#3a9a4a"], trunk: ["#8a6a42"] }]],
    hills: 1.2, fx: "dust", movers: "farm",
  }),
  T("synth", "Synthwave", "🕹️", {
    sky: { top: "#0a0220", mid: "#5a0a6a", horizon: "#ff5a8a" }, sun: "#ffd05a", fog: ["#4a0a4a", 60, 260], clouds: false,
    light: { hemi: ["#ff8ad0", "#1a0a2a", 0.95], sun: ["#ffb07a", 1.0] }, far: "#ff3a9a", near: "#1a0a2a",
    ground: { style: "grid", colors: ["#140420", "#ff3ad0"] }, track: { style: "grid", colors: ["#1a0830", "#ffd05a"], kerb: "#3af0ff", lines: "#ff3ad0" },
    props: [["pillar", 3, { c: ["#3af0ff", "#ff3ad0"] }, [1, 2], true], ["palm", 2, { leaf: ["#1a0a2a"], trunk: ["#1a0a2a"] }]],
    arches: ["#ff3ad0", "#3af0ff"], hills: 0, movers: "space",
  }),
  T("icecream", "Ice Cream Hills", "🍦", {
    sky: { top: "#8ad0ff", mid: "#ffd8ec", horizon: "#fff8e8" }, fog: ["#fff4ec", 80, 280],
    light: { hemi: ["#fff8f4", "#f0c0d0", 1.25], sun: ["#ffffff", 1.6] }, far: "#ffc8e0", near: "#c8f0ff",
    ground: { style: "speckle", colors: ["#fff0d8", "#ffe0f0", "#d8f4ff"] }, track: { style: "bands", colors: ["#8a5a3a", "#a87048"], kerb: "#ffffff", lines: "#ffe0f0" },
    props: [["icecream", 5, { c: ["#ffb8d8", "#c8f0ff", "#fff0b0", "#c8ffd8"], accent: ["#d8a060"] }, [1, 2.4]], ["gumdrop", 2, { c: ["#ff8ac0", "#8ad0ff"] }]],
    hills: 1.8,
  }),
  T("aurora", "Arctic Aurora", "🌌", {
    sky: { top: "#020a1a", mid: "#0a3a4a", horizon: "#2ad0a0" }, sun: null, night: true, fog: ["#0a2a3a", 60, 250], clouds: false,
    light: { hemi: ["#a0ffe0", "#0a1a2a", 1.05], sun: ["#c0fff0", 0.9] }, far: "#0a2a3a", near: "#c8e0ec",
    ground: { style: "speckle", colors: ["#d8e8f4", "#ffffff", "#b8d0e4"] }, track: { style: "ice", colors: ["#6aa8d0", "#8ac0e0", "#4a88b8"], kerb: "#ffffff", lines: "#2af0b0" },
    props: [["iceberg", 3, { c: ["#d0e8f8", "#ffffff"] }, [1, 2.2]], ["pine", 2, { leaf: ["#1a3a3a"] }]],
    fx: "snow", hills: 1.6,
  }),
  // Artlist: a night-time film studio lot (its obstacles are Artlist 3D models; only Unit-X runs here)
  T("artlist", "Artlist", "🎬", {
    sky: { top: "#050507", mid: "#16161c", horizon: "#3a2e10" }, sun: null, night: true, fog: ["#141418", 50, 230], clouds: false,
    light: { hemi: ["#fff2cc", "#18181e", 1.15], sun: ["#ffffff", 1.4] }, far: "#101014", near: "#1c1c22",
    ground: { style: "grid", colors: ["#1c1a40", "#ffc81e"] }, track: { style: "tiles", colors: ["#3b3f9a", "#4549ab", "#30348a"], kerb: "#ffc81e", lines: "#ffc81e" },
    props: [["building", 5, { c: ["#1e1e24", "#26262e", "#2a2a2a"] }, [1, 2.4], true], ["lamp", 2, { c: ["#2a2a30"], accent: ["#ffc81e", "#ffffff"] }, null, true]],
    arches: ["#ffc81e", "#ffffff"], hills: 0, fx: "dust",
  }),
  // deep space: its nebula, stars, ringed planet, asteroids and glow are built in client.js (buildUranus)
  T("uranus", "Uranus", "🪐", {
    sky: { top: "#12062e", mid: "#3a1260", horizon: "#5a1c78" }, sun: null, fog: ["#3a1464", 70, 300], clouds: false,
    light: { hemi: ["#c8a8ff", "#1a0c38", 0.9], sun: ["#e0d0ff", 0.9] }, far: "#3a1464", near: "#3a1464",
    ground: { style: "speckle", colors: ["#140a2a", "#1a0e34", "#0e0820"] }, track: { style: "tiles", colors: ["#1e2a4a", "#24325a", "#141c36"], kerb: "#1a2240", lines: "#d8d0ff" },
    props: [], hills: 0,
  }),
];

