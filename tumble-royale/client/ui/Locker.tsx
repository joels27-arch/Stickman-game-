import { useEffect, useMemo, useState } from 'react';
import { CATS, type Cosmetics, type CosCat, ITEMS, type Item, LOOKS, RARITY_COLOR } from '../../shared/cosmetics';
import { audio } from '../game/audio';
import type { Engine } from '../game/engine';
import { profile, profileAction } from '../net/api';
import { Btn, Coins, Modal, useStore } from './common';

const ICON: Record<CosCat, string> = { color: '🎨', outfit: '👕', hat: '🎩', acc: '🕶️', face: '😀', victory: '🏆' };
const HAT_ICON: Record<string, string> = { h_none: '∅', h_cap: '🧢', h_beanie: '🧶', h_party: '🥳', h_propeller: '🌀', h_cowboy: '🤠', h_tophat: '🎩', h_bunny: '🐰', h_viking: '⚔️', h_chef: '👨‍🍳', h_crown: '👑', h_halo: '😇' };
const ACC_ICON: Record<string, string> = { a_none: '∅', a_shades: '🕶️', a_scarf: '🧣', a_backpack: '🎒', a_cape: '🦸', a_wings: '🧚', a_mustache: '👨', a_bowtie: '🎀' };
const FACE_ICON: Record<string, string> = { f_happy: '🙂', f_grin: '😁', f_cool: '😏', f_wink: '😉', f_angry: '😠', f_sleepy: '😪', f_star: '🤩' };
const VIC_ICON: Record<string, string> = { v_wave: '👋', v_jump: '🦘', v_dance: '💃', v_spin: '🌪️', v_flex: '💪', v_flip: '🤸' };
const OUT_ICON: Record<string, string> = { o_none: '∅', o_stripes: '〰️', o_dots: '⚪', o_overalls: '👖', o_tux: '🤵', o_hero: '🦸', o_ninja: '🥷', o_astro: '🧑‍🚀' };

export function itemIcon(i: Item): React.ReactNode {
  if (i.cat === 'color') return <span className="sw" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, #${(i.hex ?? 0).toString(16).padStart(6, '0')} 60%)` }} />;
  const map = i.cat === 'hat' ? HAT_ICON : i.cat === 'acc' ? ACC_ICON : i.cat === 'face' ? FACE_ICON : i.cat === 'victory' ? VIC_ICON : OUT_ICON;
  return <span className="sw" style={{ background: '#ffffff' }}>{map[i.id] ?? '★'}</span>;
}

export function Locker({ engine, onClose, shop }: { engine: Engine; onClose: () => void; shop?: boolean }) {
  const { p, online } = useStore(profile);
  const [cat, setCat] = useState<CosCat>(shop ? 'hat' : 'color');
  const [draft, setDraft] = useState<Cosmetics>(p.equipped);
  const [buying, setBuying] = useState<Item | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const owned = useMemo(() => new Set(p.owned), [p.owned]);
  useEffect(() => { engine.setLineup([{ cos: draft, name: p.name }]); }, [draft, engine, p.name]);
  useEffect(() => { engine.setShowcaseOffset(window.innerWidth > 700 ? 2.2 : 1.7); return () => engine.setShowcaseOffset(0); }, [engine]);
  const key = CATS.find((c) => c.cat === cat)!.key;
  const list = ITEMS.filter((i) => i.cat === cat && (!shop || !owned.has(i.id)));
  const pick = (i: Item) => {
    setDraft({ ...draft, [key]: i.id });
    if (!owned.has(i.id) && !i.free) setBuying(i);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.equipped);
  const canEquip = CATS.every((c) => owned.has(draft[c.key]) || ITEMS.find((i) => i.id === draft[c.key])?.free);
  const save = async () => {
    if (!canEquip) { setMsg('Unlock the highlighted items first.'); return; }
    const err = await profileAction('equip', { cos: draft });
    if (err) setMsg(err); else { audio.coin(); onClose(); }
  };
  const buy = async (i: Item) => {
    const err = await profileAction('buy', { item: i.id });
    setBuying(null);
    if (err) setMsg(err); else { audio.coin(); setMsg(`Unlocked ${i.name}!`); }
  };
  return (
    <div className="screen fade-in">
      <div className="topbar">
        <Btn className="white small" onClick={() => { engine.setLineup([{ cos: p.equipped, name: p.name }]); onClose(); }}>◀ Back</Btn>
        <div className="logo" style={{ fontSize: 'calc(var(--u)*2.4)', transform: 'none' }}>{shop ? 'SHOP' : 'LOCKER'}</div>
        <div className="grow" />
        <Coins n={p.coins} />
      </div>
      <div className="locker" style={{ marginTop: 'var(--u)' }}>
        <div className="pass" />
        <div className="panel col" style={{ minHeight: 0, gap: '0.6em' }}>
          {!shop && (
            <div className="looks">
              {LOOKS.map((l) => {
                const have = CATS.every((c) => owned.has(l.cos[c.key]));
                return <div key={l.name} className="look" onClick={() => { audio.click(); setDraft(l.cos); }}>{have ? '' : '🔒'}{l.name}</div>;
              })}
            </div>
          )}
          <div className="tabs">
            {CATS.map((c) => <button key={c.cat} className={cat === c.cat ? 'on' : ''} onClick={() => { audio.click(); setCat(c.cat); }}>{ICON[c.cat]} {c.label}</button>)}
          </div>
          <div className="items scroll grow" style={{ minHeight: 0 }}>
            {list.length === 0 && <div className="muted" style={{ gridColumn: '1/-1', fontWeight: 800 }}>You own everything here!</div>}
            {list.map((i) => {
              const have = owned.has(i.id) || i.free;
              return (
                <div key={i.id} className={'item' + (draft[key] === i.id ? ' on' : '')} onClick={() => { audio.click(); pick(i); }}>
                  {!have && <span className="lock">🔒</span>}
                  {itemIcon(i)}
                  <span>{i.name}</span>
                  {!have && <span className="price"><span className="coin" style={{ fontSize: '0.8em' }} />{i.price}</span>}
                  <span className="rar" style={{ background: RARITY_COLOR[i.rarity] }} />
                </div>
              );
            })}
          </div>
          {msg && <div className="error" style={{ background: msg.startsWith('Unlocked') ? '#d7f7df' : undefined, color: msg.startsWith('Unlocked') ? '#1d8a3b' : undefined }}>{msg}</div>}
          {!online && <div className="muted" style={{ fontWeight: 800, fontSize: 'calc(var(--u)*0.9)' }}>Offline: only free items. Connect to the server to unlock more.</div>}
          {!shop && <Btn className="green" onClick={save} disabled={!dirty}>{canEquip ? 'Equip' : 'Locked items selected'}</Btn>}
        </div>
      </div>
      {buying && (
        <Modal onClose={() => setBuying(null)}>
          <h2>Unlock {buying.name}?</h2>
          <div className="row" style={{ fontWeight: 800, marginBottom: '0.8em' }}>
            <span style={{ color: RARITY_COLOR[buying.rarity], textTransform: 'uppercase' }}>{buying.rarity}</span>
            <span className="grow" />
            <span className="price" style={{ fontFamily: 'var(--title)', fontSize: '1.4em', color: '#a86a00', display: 'flex', alignItems: 'center', gap: '0.3em' }}><span className="coin" />{buying.price}</span>
          </div>
          {p.coins < buying.price && <div className="error">You need {buying.price - p.coins} more coins. Play matches to earn them!</div>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.8em' }}>
            <Btn className="white small" onClick={() => setBuying(null)}>Not now</Btn>
            <Btn className="green small" onClick={() => buy(buying)} disabled={p.coins < buying.price || !online}>Buy</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
