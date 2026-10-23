// Cosmetic catalogue. One base character + modular parts: body colour, outfit
// pattern, hat, accessory, face and victory dance. Shared by client (rendering,
// shop) and server (ownership + price validation).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CosCat = 'color' | 'outfit' | 'hat' | 'acc' | 'face' | 'victory';

export interface Cosmetics { color: string; outfit: string; hat: string; acc: string; face: string; victory: string }

export interface Item { id: string; cat: CosCat; name: string; rarity: Rarity; price: number; free?: boolean; hex?: number; hex2?: number }

export const PRICES: Record<Rarity, number> = { common: 150, rare: 400, epic: 900, legendary: 2000 };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#7ed957', rare: '#3fa9ff', epic: '#b25cff', legendary: '#ffb300' };

const it = (cat: CosCat, id: string, name: string, rarity: Rarity, extra: Partial<Item> = {}): Item =>
  ({ id, cat, name, rarity, price: PRICES[rarity], ...extra });

export const ITEMS: Item[] = [
  // Body colours
  it('color', 'c_tangerine', 'Tangerine', 'common', { free: true, hex: 0xff8a3d }),
  it('color', 'c_bubblegum', 'Bubblegum', 'common', { free: true, hex: 0xff6fb5 }),
  it('color', 'c_sky', 'Sky', 'common', { free: true, hex: 0x4fb7ff }),
  it('color', 'c_lime', 'Lime', 'common', { free: true, hex: 0x8ee04e }),
  it('color', 'c_lemon', 'Lemon', 'common', { hex: 0xffd93d }),
  it('color', 'c_grape', 'Grape', 'common', { hex: 0x9b6bff }),
  it('color', 'c_mint', 'Mint', 'common', { hex: 0x4fe0c0 }),
  it('color', 'c_cherry', 'Cherry', 'rare', { hex: 0xff3b4e }),
  it('color', 'c_midnight', 'Midnight', 'rare', { hex: 0x3a3f8f }),
  it('color', 'c_snow', 'Snow', 'rare', { hex: 0xf2f6ff }),
  it('color', 'c_gold', 'Gold Rush', 'legendary', { hex: 0xffc531, hex2: 0xfff2a8 }),
  it('color', 'c_galaxy', 'Galaxy', 'epic', { hex: 0x5b2a9e, hex2: 0x22d3ee }),
  // Outfits (body patterns)
  it('outfit', 'o_none', 'Plain', 'common', { free: true }),
  it('outfit', 'o_stripes', 'Stripes', 'common', { free: true, hex: 0xffffff }),
  it('outfit', 'o_dots', 'Polka Dots', 'common', { hex: 0xffffff }),
  it('outfit', 'o_overalls', 'Overalls', 'rare', { hex: 0x2f6fdf }),
  it('outfit', 'o_tux', 'Tuxedo', 'epic', { hex: 0x22252e, hex2: 0xffffff }),
  it('outfit', 'o_hero', 'Super Suit', 'epic', { hex: 0xe8322f, hex2: 0xffd02b }),
  it('outfit', 'o_ninja', 'Ninja Wrap', 'rare', { hex: 0x1d1f27 }),
  it('outfit', 'o_astro', 'Astro Suit', 'legendary', { hex: 0xf4f6fb, hex2: 0xff7a1a }),
  // Hats
  it('hat', 'h_none', 'No Hat', 'common', { free: true }),
  it('hat', 'h_cap', 'Ball Cap', 'common', { free: true, hex: 0xe53d3d }),
  it('hat', 'h_beanie', 'Beanie', 'common', { hex: 0x3d7be5 }),
  it('hat', 'h_party', 'Party Cone', 'common', { hex: 0xff4fd8, hex2: 0xffe14f }),
  it('hat', 'h_propeller', 'Propeller Cap', 'rare', { hex: 0xffcf3d, hex2: 0x37c0ff }),
  it('hat', 'h_cowboy', 'Cowboy Hat', 'rare', { hex: 0xa46a3a }),
  it('hat', 'h_tophat', 'Top Hat', 'rare', { hex: 0x2a2a33, hex2: 0xe83b54 }),
  it('hat', 'h_bunny', 'Bunny Ears', 'epic', { hex: 0xffffff, hex2: 0xffa7c8 }),
  it('hat', 'h_viking', 'Viking Helm', 'epic', { hex: 0x9aa4b4, hex2: 0xfff1d0 }),
  it('hat', 'h_chef', 'Chef Hat', 'rare', { hex: 0xffffff }),
  it('hat', 'h_crown', 'Royal Crown', 'legendary', { hex: 0xffc531, hex2: 0xff3b6b }),
  it('hat', 'h_halo', 'Halo', 'legendary', { hex: 0xfff3a0 }),
  // Accessories
  it('acc', 'a_none', 'None', 'common', { free: true }),
  it('acc', 'a_shades', 'Cool Shades', 'common', { hex: 0x1b1b22 }),
  it('acc', 'a_scarf', 'Cosy Scarf', 'common', { hex: 0xe8433a, hex2: 0xffffff }),
  it('acc', 'a_backpack', 'Backpack', 'rare', { hex: 0x37b36b }),
  it('acc', 'a_cape', 'Hero Cape', 'epic', { hex: 0xd8263b }),
  it('acc', 'a_wings', 'Fairy Wings', 'legendary', { hex: 0xbfe8ff }),
  it('acc', 'a_mustache', 'Fancy Mustache', 'rare', { hex: 0x3b2516 }),
  it('acc', 'a_bowtie', 'Bow Tie', 'common', { hex: 0xe8322f }),
  // Faces
  it('face', 'f_happy', 'Happy', 'common', { free: true }),
  it('face', 'f_grin', 'Big Grin', 'common', { free: true }),
  it('face', 'f_cool', 'Smug', 'rare'),
  it('face', 'f_wink', 'Wink', 'rare'),
  it('face', 'f_angry', 'Determined', 'rare'),
  it('face', 'f_sleepy', 'Sleepy', 'epic'),
  it('face', 'f_star', 'Star Eyes', 'legendary'),
  // Victory animations
  it('victory', 'v_wave', 'Wave', 'common', { free: true }),
  it('victory', 'v_jump', 'Happy Hops', 'common', { free: true }),
  it('victory', 'v_dance', 'Wiggle Dance', 'rare'),
  it('victory', 'v_spin', 'Spin Out', 'rare'),
  it('victory', 'v_flex', 'Muscle Flex', 'epic'),
  it('victory', 'v_flip', 'Backflip', 'legendary'),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const FREE_ITEMS = ITEMS.filter((i) => i.free).map((i) => i.id);

export const DEFAULT_COS: Cosmetics = { color: 'c_tangerine', outfit: 'o_none', hat: 'h_none', acc: 'a_none', face: 'f_happy', victory: 'v_wave' };

/** Ready-made looks built from the modular parts (the "12+ combinations"). */
export const LOOKS: { name: string; cos: Cosmetics }[] = [
  { name: 'Sunny Bean', cos: { color: 'c_tangerine', outfit: 'o_none', hat: 'h_cap', acc: 'a_none', face: 'f_happy', victory: 'v_wave' } },
  { name: 'Bubble Pop', cos: { color: 'c_bubblegum', outfit: 'o_dots', hat: 'h_party', acc: 'a_bowtie', face: 'f_grin', victory: 'v_jump' } },
  { name: 'Sky Captain', cos: { color: 'c_sky', outfit: 'o_stripes', hat: 'h_propeller', acc: 'a_shades', face: 'f_cool', victory: 'v_spin' } },
  { name: 'Garden Gnome', cos: { color: 'c_lime', outfit: 'o_overalls', hat: 'h_beanie', acc: 'a_mustache', face: 'f_happy', victory: 'v_dance' } },
  { name: 'Shadow Step', cos: { color: 'c_midnight', outfit: 'o_ninja', hat: 'h_none', acc: 'a_scarf', face: 'f_angry', victory: 'v_flip' } },
  { name: 'Big Hero', cos: { color: 'c_cherry', outfit: 'o_hero', hat: 'h_none', acc: 'a_cape', face: 'f_angry', victory: 'v_flex' } },
  { name: 'Mr. Fancy', cos: { color: 'c_snow', outfit: 'o_tux', hat: 'h_tophat', acc: 'a_mustache', face: 'f_cool', victory: 'v_wave' } },
  { name: 'Moon Walker', cos: { color: 'c_snow', outfit: 'o_astro', hat: 'h_none', acc: 'a_backpack', face: 'f_star', victory: 'v_flip' } },
  { name: 'Lemon Drop', cos: { color: 'c_lemon', outfit: 'o_stripes', hat: 'h_chef', acc: 'a_bowtie', face: 'f_grin', victory: 'v_dance' } },
  { name: 'Rodeo Ruby', cos: { color: 'c_cherry', outfit: 'o_overalls', hat: 'h_cowboy', acc: 'a_scarf', face: 'f_wink', victory: 'v_jump' } },
  { name: 'Fluffy', cos: { color: 'c_snow', outfit: 'o_none', hat: 'h_bunny', acc: 'a_none', face: 'f_sleepy', victory: 'v_jump' } },
  { name: 'Norse Legend', cos: { color: 'c_grape', outfit: 'o_none', hat: 'h_viking', acc: 'a_cape', face: 'f_angry', victory: 'v_flex' } },
  { name: 'Pixie', cos: { color: 'c_mint', outfit: 'o_dots', hat: 'h_halo', acc: 'a_wings', face: 'f_wink', victory: 'v_spin' } },
  { name: 'Royal Gold', cos: { color: 'c_gold', outfit: 'o_none', hat: 'h_crown', acc: 'a_cape', face: 'f_cool', victory: 'v_flip' } },
  { name: 'Cosmic', cos: { color: 'c_galaxy', outfit: 'o_astro', hat: 'h_halo', acc: 'a_wings', face: 'f_star', victory: 'v_spin' } },
];

export const CATS: { cat: CosCat; label: string; key: keyof Cosmetics }[] = [
  { cat: 'color', label: 'Colour', key: 'color' },
  { cat: 'outfit', label: 'Outfit', key: 'outfit' },
  { cat: 'hat', label: 'Hat', key: 'hat' },
  { cat: 'acc', label: 'Accessory', key: 'acc' },
  { cat: 'face', label: 'Face', key: 'face' },
  { cat: 'victory', label: 'Victory', key: 'victory' },
];

/** Returns a valid Cosmetics object: unknown ids or wrong categories fall back to defaults; `owned` (if given) is enforced. */
export function sanitizeCos(c: unknown, owned?: Set<string>): Cosmetics {
  const out: Cosmetics = { ...DEFAULT_COS };
  if (!c || typeof c !== 'object') return out;
  for (const { cat, key } of CATS) {
    const id = (c as any)[key];
    const item = typeof id === 'string' ? ITEM_BY_ID.get(id) : undefined;
    if (item && item.cat === cat && (!owned || owned.has(id) || item.free)) out[key] = id;
  }
  return out;
}

/** Random look for bots (deterministic from a seed). */
export function botCos(r: () => number): Cosmetics {
  const pick = (cat: CosCat) => { const l = ITEMS.filter((i) => i.cat === cat && i.rarity !== 'legendary'); return l[Math.floor(r() * l.length)].id; };
  return { color: pick('color'), outfit: r() < 0.5 ? 'o_none' : pick('outfit'), hat: r() < 0.4 ? 'h_none' : pick('hat'), acc: r() < 0.6 ? 'a_none' : pick('acc'), face: pick('face'), victory: pick('victory') };
}
