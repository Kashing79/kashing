// 开发用（小人 / 她 / 时间那几个戏包）：不开浏览器，把每一段指名演一遍，看有没有出错、卡住、超时、道具没收走。
//
// 用法：node pet/dev/scn_man_run.js [名字,名字…] [--pack man,her,time,micro_man] [--band] [--hour 14] [--verbose]
//   不给名字：演这几个戏包里的每一段（react 会假装出了它等的那件事）
//   --band  只在底部一条演（默认满屏）  --hour 把钟拨到几点（默认 14）
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const WEB = path.resolve(opt('web', path.join(__dirname, '../web')));
const PACKS = opt('pack', 'man,her,time,micro_man').split(',');
const ONLY = args[0] && !args[0].startsWith('--') ? args[0].split(',') : null;
const ROAM = !flag('band');
const HOUR = +opt('hour', '14');
const VERB = flag('verbose');

const ctx = vm.createContext({});
vm.runInContext(`var __hour = ${HOUR}, __min = 0, __seed = 7;
  Math.random = function () { __seed = (__seed + 0x6D2B79F5) >>> 0; var t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Date.prototype.getHours = function () { return __hour; }; Date.prototype.getMinutes = function () { return __min; };`, ctx);
const files = ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'];
const packs = fs.readdirSync(path.join(WEB, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f);
for (const f of files.concat(packs)) {
  const p = path.join(WEB, f);
  if (!fs.existsSync(p)) continue;
  try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { console.log('LOAD FAIL', f, e.message); }
}
const G = vm.runInContext('globalThis', ctx);
let clock = 0;
const logs = [];
const view = ROAM ? { w: 480, h: 300 } : { w: 480, h: 110 };
const host = {
  now: () => clock, storage: { get: () => null, set: () => {} }, haptic: () => {},
  island: { center: () => view.w / 2, visible: () => true, hit: (x, y) => y < 16 && Math.abs(x - view.w / 2) < 40, rim: () => ({ x0: view.w / 2 - 40, x1: view.w / 2 + 40, y: 12 }), pulse: () => {} },
  log: m => logs.push(m),
};
const cfg = Object.assign({}, G.PET_CONFIG, { roam: ROAM, res: 2, entrance: false, auto: false, lines: true, reunion: '2027-01-10', dates: [{ on: '11-18', kind: 'birthday', line: '' }], clock: [{ label: 'A', tz: 'Asia/Taipei' }, { label: 'B', tz: 'America/Los_Angeles' }], hisClock: 1 });
const eng = G.PET_ENGINE.create(host, cfg);
eng.configure({ view, insets: ROAM ? { top: 8, bottom: 22, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 } });
const T = eng._t;
const AWAY = flag('away');
const step = (sec, f) => { for (let i = 0; i < sec * 60; i++) { clock += 1 / 60; T.set('touch', T.state().now); if (!AWAY && i % 120 === 0) eng.sense({ idle: 1 }); if (f) f(); eng.step(1 / 60); eng.compose(); } };
eng.sense({ cursor: [view.w * 0.8, view.h * 0.3], idle: 1 });
step(2);
const rows = T.list().filter(r => PACKS.includes(r.pack) && (!ONLY || ONLY.includes(r.name)));
let bad = 0;
const fin = v => Number.isFinite(v);
for (const r of rows) {
  T.endScene(); step(1.5);
  const s0 = T.state();
  // 假装出了它等的那件事
  const on = (r.on || '').split(' ')[0];
  const ev = { who: null, x: s0.dax.x, y: s0.dax.y - 10, zone: 'mid', power: 3, tier: 2, away: 1500, hm: '', h: HOUR, m: 0, kind: 'birthday', days: 0, phase: 'dusk' };
  if (/press|rub|click|hover|dblclick|pickup|drop|dropOn|notice/.test(on)) ev.who = null;
  if (on === 'petting') { ev.dog = 'DAX'; }
  if (r.at) { ev.hm = r.at.split(' ')[0]; }
  if (ev.dog === 'DAX') ev.dog = undefined;
  let ok = T.scene(r.name, ev);
  for (let k = 0; !ok && k < 120; k++) { step(0.3); ok = T.scene(r.name, ev); }
  if (!ok) { console.log('-- ' + r.name.padEnd(24) + ' could not start (when / cast)'); continue; }
  const t0 = T.state().now;
  let maxT = 0, nan = '', out = '';
  for (let i = 0; i < 80 * 60; i++) {
    clock += 1 / 60; T.set('touch', T.state().now); if (!AWAY && i % 120 === 0) eng.sense({ idle: 1 }); eng.step(1 / 60); const fr = eng.compose();
    const s = T.state();
    for (const a of [s.dax, s.gold, s.person]) {
      if (!fin(a.x) || !fin(a.y)) nan = 'NaN';
      if (a.x < s.F.x0 - 1 || a.x > s.F.x1 + 1 || a.y < s.F.y0 - 1 || a.y > s.F.y1 + 1) out = 'out of field';
    }
    for (const it of fr.items) if (!fin(it.x) || !fin(it.y)) nan = 'NaN item ' + it.id;
    if (!s.scripts.includes(r.name)) break;
    maxT = s.now - t0;
  }
  const s1 = T.state();
  const left = T.props().filter(p => p.owner === r.name || p.born >= t0).length;
  if (left && VERB) console.log('   props', JSON.stringify(T.props()));
  const errs = T.sceneErrors().filter(e => e.indexOf(r.name) >= 0);
  const still = s1.scripts.includes(r.name);
  const msg = [still ? 'STILL RUNNING' : '', errs.length ? 'ERR ' + errs.join(' | ') : '', left ? 'props left ' + left : '', nan, out,
    s1.ball.st !== 'hand' && s1.ball.st !== 'free' && s1.phase === 'rest' && !s1.scripts.length ? 'ball ' + s1.ball.st : '',
    s1.person.hidden ? 'man hidden' : '', s1.dax.hidden ? 'dax hidden' : '', s1.gold.hidden ? 'gold hidden' : ''].filter(Boolean);
  if (msg.length) bad++;
  console.log((msg.length ? '!! ' : 'ok ') + r.name.padEnd(24) + (r.kind + ' ' + (r.on || '')).padEnd(18) + maxT.toFixed(1).padStart(5) + ' s ' + msg.join('; '));
  if (VERB) console.log('   events', T.events().slice(-6).join(' '));
}
const allErr = T.sceneErrors();
if (allErr.length) { console.log('scene errors:'); allErr.slice(0, 20).forEach(e => console.log('  ' + e)); }
if (logs.length) { console.log('host log:'); logs.slice(0, 20).forEach(e => console.log('  ' + e)); }
console.log(rows.length + ' pieces, ' + bad + ' with problems' + (ROAM ? ' (roam)' : ' (band)'));
