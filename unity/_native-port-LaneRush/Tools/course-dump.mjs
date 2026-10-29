// Prints courses for a few seeds with the web game's generator (compared with CourseDump.cs).
const L = await import(process.argv[2]);
const K = { hurdle: 1, gate: 2, crate: 3, roller: 4 };
let out = "";
const n = (x) => String(x);
for (const s of [1, 42, 123456, 987654321, 4000000000]) for (const len of [700, 9000]) {
  const c = L.buildCourse(s, len);
  out += `seed ${s} len ${len}\n`;
  for (const r of c.rows) out += `R ${n(r.z)} ${r.lanes.map((k) => (k ? K[k] : 0)).join(" ")} ${r.looks.join(" ")} ${r.intro ? K[r.intro] : 0}\n`;
  for (const b of c.buses) out += `B ${b.lane} ${n(b.z0)} ${n(b.z1)} ${b.look} ${b.ramp ? 1 : 0}\n`;
  for (const p of c.boosts) out += `U ${n(p.z)} ${p.lane}\n`;
  for (const p of c.slows) out += `S ${n(p.z)} ${p.lane}\n`;
  for (const p of c.boxes) out += `X ${n(p.z)} ${p.lane}\n`;
  for (const p of c.hearts) out += `H ${n(p.z)} ${p.lane}\n`;
}
process.stdout.write(out);
