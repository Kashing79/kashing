// 开发用（狗和地方那几个戏包）：在 Node 里把指定的几段戏一段一段硬演一遍，查报错、NaN、卡住、演完没收走的道具。
//   node pet/dev/scn_dogs_run.js [名字,名字… | pack:dogs,pack:place,pack:micro_dogs] [roam|band|both] [种子]
//   不开浏览器，很快；看图用 pet/dev/scenes.js。
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const WEB = path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'));

const want = (process.argv[2] || 'pack:dogs,pack:place,pack:micro_dogs').split(',');
const modes = process.argv[3] === 'roam' ? ['roam'] : (process.argv[3] === 'band' ? ['band'] : ['roam', 'band']);
let seed = +(process.argv[4] || 7);
function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }

function load() {
  const ctx = vm.createContext({});
  ctx.Math = Object.create(Math); ctx.Math.random = rnd;
  const packs = fs.readdirSync(path.join(WEB, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f);
  for (const f of ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'].concat(packs)) {
    const p = path.join(WEB, f);
    if (!fs.existsSync(p)) continue;
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { console.log('JS EXCEPTION ' + f + ': ' + e.message); }
  }
  return ctx;
}

// 测试用的准备：一段 solo，把记性里写上"昨天睡过的地方""一个埋了 30 分钟的土堆"
function setup(ctx) {
  ctx.PET_SCENES.push({ name: 'zz_setup', kind: 'solo', cast: 'dax', weight: 0, run: function* (S) {
    var F = S.field;
    S.mem.set('napSpots', [{ x: F.x0 + 120, y: F.y1 - 10, day: '2000-1-1', k: 'dax' }, { x: F.x0 + 260, y: F.y1 - 30, day: '2000-1-1', k: 'gold' }]);
    S.mem.set('mound', { x: F.x0 + 12, y: F.y1, id: S.decal('mound', F.x0 + 12, F.y1, { days: 2, overlay: true }), ms: (S.time.ms || 0) - 1800000, day: S.time.day });
  } });
}
function engine(ctx, mode, extra) {
  if (!ctx.PET_SCENES.some(r => r.name === 'zz_setup')) setup(ctx);
  let t = 0;
  const logs = [], pulses = [];
  const store = {};
  const host = {
    now: () => t, log: m => logs.push(m),
    storage: { get: k => store[k] || null, set: (k, v) => { store[k] = v; } },
    island: { center: () => 240, visible: () => true, hit: () => false, rim: () => ({ x0: 210, x1: 270, y: 8 }), pulse: k => pulses.push(k) },
  };
  const cfg = Object.assign({}, ctx.PET_CONFIG, { entrance: false }, extra || {});
  const eng = ctx.PET_ENGINE.create(host, cfg);
  eng.configure({ view: mode === 'roam' ? { w: 480, h: 300 } : { w: 480, h: 70 }, insets: { top: 0, bottom: 4, left: 0, right: 0 }, roam: mode === 'roam', res: 2, auto: false });
  const step = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { t += 1 / 60; eng._t.set('touch', t); eng.step(1 / 60); if (i % 3 === 0) eng.compose(); } };
  return { eng, step, logs, pulses, now: () => t };
}

const ctx0 = load();
const all = (() => { const { eng } = engine(ctx0, 'roam'); return eng._t.list(); })();
let names = [];
for (const w of want) {
  if (w.startsWith('pack:')) names = names.concat(all.filter(r => r.pack === w.slice(5)).map(r => r.name));
  else names.push(w);
}
let bad = 0;
for (const mode of modes) {
  for (const name of names) {
    const chain = name.split('>');
    const def = all.find(r => r.name === chain[chain.length - 1]);
    if (!def) { console.log('?? unknown', name); bad++; continue; }
    const ctx = load();
    const E = engine(ctx, mode, process.env.SCN_LINES ? { lines: true } : null);
    E.eng.sense({ cursor: [400, 60], idle: 1 });
    E.step(1.5);
    E.eng._t.scene('zz_setup'); E.step(0.5);
    for (const pre of chain.slice(0, -1)) {
      let started = false;
      for (let k = 0; k < 40 && !started; k++) { started = E.eng._t.scene(pre, {}); if (!started) E.step(0.25); }
      for (let i = 0; i < 60 * 120 && E.eng._t.state().scripts.indexOf(pre) >= 0; i++) E.step(1 / 60);
      E.step(1);
    }
    let ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      const s = E.eng._t.state();
      ok = E.eng._t.scene(def.name, { name: def.on ? def.on.split(' ')[0] : 'test', x: s.dax.x, y: s.dax.y - 10, zone: 'mid', power: 3, dist: 40 });
      // 等别的戏发的事件（比如 contagion）：先演一段会发这个事件的
      if (!ok && def.on === 'contagion') { E.eng._t.scene('m_shake_off'); E.step(1.6); ok = E.eng._t.state().scripts.indexOf(def.name) >= 0; }
      if (!ok) E.step(0.25);
    }
    if (!ok) { console.log(mode.padEnd(5), name.padEnd(24), 'could not start'); continue; }
    const t0 = E.now();
    let maxT = 0, nan = '', end = '';
    const timeout = { scene: 70, solo: 20, react: 30, care: 110 }[def.kind];
    for (let i = 0; i < 60 * 200; i++) {
      E.step(1 / 60);
      const s = E.eng._t.state();
      for (const a of ['dax', 'gold', 'person']) if (!Number.isFinite(s[a].x) || !Number.isFinite(s[a].y)) nan = a;
      if (s.scripts.indexOf(def.name) < 0) { end = 'done'; break; }
    }
    const dur = E.now() - t0;
    E.step(2);
    const props = E.eng._t.props().filter(p => p.owner === def.name);
    const errs = E.eng._t.sceneErrors().concat(E.logs.filter(l => /scene/.test(l)));
    const s = E.eng._t.state();
    const stuck = ['dax', 'gold'].filter(a => s[a].st === 'scene' && !s[a].scene);
    const line = [mode.padEnd(5), name.padEnd(24), (end || 'NOT ENDED').padEnd(9), dur.toFixed(1).padStart(5) + 's',
      props.length ? 'ORPHAN ' + props.map(p => p.kind).join('/') : '', nan ? 'NaN ' + nan : '', stuck.length ? 'STUCK ' + stuck : '',
      errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : '', E.pulses.length ? 'pulse ' + E.pulses.join(',') : ''].filter(Boolean).join('  ');
    if (!end || props.length || nan || stuck.length || errs.length) bad++;
    console.log(line);
  }
}
console.log(bad ? 'PROBLEMS: ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
