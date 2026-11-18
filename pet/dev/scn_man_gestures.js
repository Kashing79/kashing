// 开发用（她那个戏包）：真的用"鼠标"做一遍手势，看对应的那段戏有没有演起来、演完有没有收干净。
//   node pet/dev/scn_man_gestures.js [--band]
// 每一项：摆好场面 → 做手势（蹭、按住、甩、慢慢挪、停在金毛胸口前、拎起来放到谁身上、点领带、走开又回来、整点……）→ 看 _t.list() 里那一段的次数有没有加一
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROAM = !process.argv.includes('--band');
const WEB = path.join(__dirname, '../web');
const ctx = vm.createContext({});
vm.runInContext('var __hour = 14, __min = 5; Date.prototype.getHours = function () { return __hour; }; Date.prototype.getMinutes = function () { return __min; };', ctx);
const packs = fs.readdirSync(path.join(WEB, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f);
for (const f of ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'].concat(packs)) {
  const p = path.join(WEB, f);
  if (fs.existsSync(p)) { try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { console.log('LOAD FAIL', f, e.message); } }
}
const G = vm.runInContext('globalThis', ctx);
let clock = 0;
const logs = [];
const view = ROAM ? { w: 480, h: 300 } : { w: 480, h: 110 };
const host = { now: () => clock, storage: { get: () => null, set: () => {} }, island: { center: () => view.w / 2, visible: () => true, hit: (x, y) => y < 16 && Math.abs(x - view.w / 2) < 40 }, log: m => logs.push(m) };
const eng = G.PET_ENGINE.create(host, Object.assign({}, G.PET_CONFIG, { roam: ROAM, res: 2, entrance: false, auto: false }));
eng.configure({ view, insets: { top: 0, bottom: 0, left: 0, right: 0 } });
const T = eng._t;
const count = n => { const r = T.list().find(d => d.name === n); return r ? r.n : -1; };
let cx = 200, cy = 100;
const step = (sec, fn) => { for (let i = 0; i < Math.round(sec * 60); i++) { clock += 1 / 60; if (fn) fn(i / 60); eng.sense({ cursor: [cx, cy], idle: 0.5 }); T.set('touch', T.state().now); eng.step(1 / 60); eng.compose(); } };
const mid = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const settle = () => { eng.pointer('up', 0, 0); T.endScene(); T.set('sceneAt', 1e12); cx = 30; cy = 20; step(3); };
const results = [];
function check(name, scene, fn) {
  settle();
  const n0 = count(scene);
  const before = {}; for (const d of T.list()) before[d.name] = d.n;
  try { fn(); } catch (e) { results.push(['FAIL', name, 'exception ' + e.message]); return; }
  const n1 = count(scene);
  step(8);
  const errs = T.sceneErrors().filter(e => e.indexOf(scene) >= 0);
  results.push([n1 > n0 && !errs.length ? 'ok' : 'FAIL', name, scene + (n1 > n0 ? ' played' : ' did NOT play (events: ' + T.events().slice(-4).join(' ') + '; played instead: ' + T.list().filter(d => d.n > (before[d.name] || 0)).map(d => d.name).join(',') + ')') + (errs.length ? ' ERR ' + errs[0] : '')]);
}
step(2);
// C01：在金毛身上来回蹭
check('rub on gold', 'rub_to_pet', () => {
  let b = T.boxes().gold, m = mid(b), k = 0;
  cx = m[0]; cy = m[1];
  step(2.5, t => { b = T.boxes().gold; const mm = mid(b); cx = mm[0] + Math.sin(t * 14) * 9; cy = mm[1]; });
});
// C12：一直蹭金毛（3 秒以上）→ 小腊肠挤进来（蹭的那一下有时会被 examples.js 的 ex_rub 接走：那就再蹭一次）
check('keep rubbing the golden', 'wedge_in', () => {
  for (let k = 0; k < 3 && count('wedge_in') < 1; k++) {
    step(4.5, t => { const mm = mid(T.boxes().gold); cx = mm[0] + Math.sin(t * 14) * 9; cy = mm[1]; });
    if (count('wedge_in') < 1) { cx = 30; cy = 20; T.endScene(); step(2.5); }
  }
});
// C14：在小人身上来回蹭
check('rub on the man', 'tickle_him', () => {
  step(2.5, t => { const mm = mid(T.boxes().person); cx = mm[0] + Math.sin(t * 14) * 4; cy = mm[1]; });
});
// C15：按住小人不动
check('press the man', 'hand_on_heart', () => {
  const b = T.boxes().person; cx = (b[0] + b[2]) / 2; cy = b[1] + 4;      // 按在头上（胸口那儿常常是他手里的球）
  eng.pointer('down', cx, cy); step(1.1); eng.pointer('up', cx, cy);
});
// C13：他领带歪了（刚被拱过 / 被咬过）的时候点他一下
check('click him while his tie is askew', 'fix_his_tie', () => {
  T.set('world', { v: 1, first: '', day: '', days: 0, plays: {}, mem: { tie: Date.now() }, dateDay: '', decals: [] });
  const m = mid(T.boxes().person); cx = m[0]; cy = T.boxes().person[3] - 6;
  eng.pointer('down', cx, cy); eng.pointer('up', cx, cy);
});
// C05：在屏幕上甩鼠标
check('shake the cursor', 'find_my_cursor', () => {
  cx = 240; cy = ROAM ? 120 : 60;
  step(0.8, t => { cx = 240 + (Math.floor(t * 16) % 2 ? 40 : -40); });
});
// C09：拎起小腊肠一会儿再放下 → 护送 + 落地
check('carry the dachshund', 'carried_escort', () => {
  const m = mid(T.boxes().dax); cx = m[0]; cy = m[1];
  eng.pointer('down', cx, cy); eng.pointer('move', cx + 10, cy - 10);
  step(2.0, t => { cx = m[0] + 10 + t * 20; cy = m[1] - 12; eng.pointer('move', cx, cy); });
  eng.pointer('up', cx, cy);
});
// C10：把小腊肠放到金毛背上
check('drop the dachshund on the golden', 'piggyback_parade', () => {
  const s = T.state(), m = mid(T.boxes().dax); cx = m[0]; cy = m[1];
  eng.pointer('down', cx, cy); eng.pointer('move', cx + 8, cy - 8);
  const g = T.state().gold, sx = g.x - (T.state().gold.x > 0 ? 1 : 1) * 2;
  step(0.6, () => { cx = sx; cy = g.y - 12; eng.pointer('move', cx, cy); });
  eng.pointer('up', cx, cy);
});
// C11：把小腊肠放进他怀里
check('drop the dachshund on the man', 'into_his_arms', () => {
  const m = mid(T.boxes().dax); cx = m[0]; cy = m[1];
  eng.pointer('down', cx, cy); eng.pointer('move', cx + 8, cy - 8);
  const p = T.state().person;
  step(0.6, () => { cx = p.x + 3; cy = p.y - 12; eng.pointer('move', cx, cy); });
  eng.pointer('up', cx, cy);
});
// C02：点小腊肠的鼻尖
check('boop the nose', 'nose_boop', () => {
  const s = T.state(), b = T.boxes().dax;
  // 鼻尖在身体朝着的那一头、头的高度：沿着那一头扫几个点
  for (const fx of [0.98, 0.95, 0.92, 0.02, 0.05, 0.08]) for (const fy of [0.15, 0.25, 0.35, 0.45]) {
    if (count('nose_boop') > 0) break;
    cx = b[0] + (b[2] - b[0]) * fx; cy = b[1] + (b[3] - b[1]) * fy;
    eng.pointer('down', cx, cy); eng.pointer('up', cx, cy); step(0.6);
  }
});
// C16：走开 25 分钟再回来
check('come back after 25 minutes', 'welcome_back', () => {
  for (let i = 0; i < 1500 * 4; i++) { clock += 0.25; eng.sense({ idle: i * 0.25 + 1 }); eng.step(0.25); }
  cx = 300; cy = 150;
  step(0.5, () => {});
  eng.sense({ idle: 0 }); step(4);
});
// D02：整点
check('on the hour', 'on_the_hour', () => {
  vm.runInContext('__hour = 15; __min = 59', ctx); step(1);
  const st = T.state(); console.log('   before the hour:', st.scripts.join(','), st.person.st, st.dax.st, st.gold.st, st.ball.st, st.phase);
  vm.runInContext('__hour = 16; __min = 0', ctx); step(0.6);
  const s2 = T.state(); console.log('   events:', T.events().slice(-5).join(' '), '| running:', s2.scripts.join(','), s2.person.scene, s2.dax.scene, s2.gold.scene);
  step(1.4);
});
// D09：13:14
check('13:14', 'secret_minute', () => {
  vm.runInContext('__hour = 13; __min = 13', ctx); step(1);
  vm.runInContext('__hour = 13; __min = 14', ctx); step(2);
});
// D04：变成黄昏
check('dusk', 'sunset_watch', () => {
  vm.runInContext('__hour = 16; __min = 59', ctx); step(1);
  vm.runInContext('__hour = 17; __min = 0', ctx); step(4);
});
for (const r of results) console.log(r[0].padEnd(5) + r[1].padEnd(36) + r[2]);
const errs = T.sceneErrors();
if (errs.length) console.log('scene errors:\n  ' + errs.join('\n  '));
if (logs.length) console.log('host log:\n  ' + logs.slice(0, 10).join('\n  '));
console.log('props left now: ' + T.props().length + (ROAM ? ' (roam)' : ' (band)'));
