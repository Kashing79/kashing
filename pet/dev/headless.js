// 开发用：不开浏览器，把玩法放进一个"什么都没有"的 JavaScript 环境里快进跑一遍。
//
// Mac 外壳是在 JavaScriptCore 里跑 web/ 下面这几个文件的：那里只有语言自带的东西，
// 没有 window / document / 定时器 / console。这里用 Node 造一个同样空的环境，
// 能跑通 = 引擎和画图的文件没有偷偷用网页才有的东西。
//
// 跑的时候像真的有人在玩：乱拖球、乱点、把它们拎起来、丢到岛上、按各种按钮；
// 每一帧都检查引擎交出来的"该画什么"的清单是不是规规矩矩的。最后再演一遍"夜里回岛睡觉、天亮出来"。
//
// 用法：node headless.js [--res N] [--roam 分钟] [--band 分钟] [--seed N] [--web 目录] [--plain]
//   --plain  从一个空对象造环境（老办法，一样是空的，只是里面读全局变量慢几倍，量出来的时间偏大）
const fs = require('fs'), path = require('path'), vm = require('vm');

const args = process.argv.slice(2);
function arg(name, def) { const i = args.indexOf('--' + name); return i >= 0 && i + 1 < args.length ? args[i + 1] : def; }
const RES = parseInt(arg('res', '2'), 10) || 2;
const MIN = { roam: parseFloat(arg('roam', '20')), band: parseFloat(arg('band', '10')) };
const SEED = (parseInt(arg('seed', String((Date.now() ^ (process.pid << 8)) >>> 0)), 10) >>> 0) || 1;
const WEB = path.resolve(arg('web', path.join(__dirname, '../web')));
// 和 Mac 外壳一样的顺序（SPEC 8.7）：这几个，再加 scenes/ 下面所有的戏包（按文件名排）
const FILES = ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'];
const PACKS = fs.existsSync(path.join(WEB, 'scenes')) ? fs.readdirSync(path.join(WEB, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f) : [];
const MINE = ['scenes/classic.js', 'scenes/care.js', 'scenes/examples.js'];

let failed = false;
const problems = [];
function fail(m) { failed = true; if (problems.length < 25) { problems.push(m); console.log('FAIL:', m); } }
// 会让画面出错的算失败；只是和约定不一样、引擎自己兜得住的，提个醒
let warned = 0;
function warn(m) { if (++warned <= 30) console.log('WARN:', m); }

// ---------- 一个空的环境 ----------
// 新一点的 Node 可以要一个"原生的"空环境（里面读全局变量不绕路，量出来的速度才和真机接近）；
// 老的 Node 就从一个空对象造，一样是空的，只是慢几倍。
const ctx = vm.createContext((!args.includes('--plain') && vm.constants && vm.constants.DONT_CONTEXTIFY) || {});
vm.runInContext('delete globalThis.console;', ctx);      // V8 自己会塞一个 console 进来；JavaScriptCore 里没有
// 可以重现的随机数；可以拨的钟（用来演"夜里"和"天亮"）
vm.runInContext(`
  var __seed = ${SEED} >>> 0, __hour = 14;
  Math.random = function () {
    __seed = (__seed + 0x6D2B79F5) >>> 0;
    var t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Date.prototype.getHours = function () { return __hour; };
`, ctx);
const rnd = () => vm.runInContext('Math.random()', ctx);
const builtins = new Set(Object.getOwnPropertyNames(vm.runInContext('globalThis', ctx)));

// 这些名字只有网页里才有：写在代码里（注释和 typeof 判断除外）就是隐患。
// 引擎自己的文件里出现就算错；画图的文件里出现先提个醒（真跑到那一行时下面自然会报错）
const WEB_ONLY = /\b(window|document|navigator|location|URLSearchParams|setTimeout|setInterval|requestAnimationFrame|performance|localStorage|console)\b/;
const STRICT = ['config.js', 'sprites.js', 'needs.js', 'pet.js'].concat(MINE);
function lint(file, src) {
  src.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/typeof\s+(window|globalThis)\s*[!=]==?\s*""\s*\?\s*(window|globalThis)\s*:/g, '').replace(/typeof\s+\w+/g, '');
    const m = WEB_ONLY.exec(code);
    if (!m) return;
    const msg = file + ':' + (i + 1) + ' mentions "' + m[1] + '", which does not exist outside a web page';
    if (STRICT.includes(file)) fail(msg); else warn(msg);
  });
}

// 有 acorn 的话顺便查一下写法：这些文件只能用到 ES2017（JavaScriptCore 的老版本也要能跑）
let acorn = null;
try { acorn = require('acorn'); } catch (e) {}
function syntax(file, src) {
  if (!acorn) return;
  try { acorn.parse(src, { ecmaVersion: 2017 }); }
  catch (e) { const msg = file + ' is not plain ES2017: ' + e.message; if (STRICT.includes(file)) fail(msg); else warn(msg); }
}

const loaded = [];
for (const f of FILES.concat(PACKS)) {
  const p = path.join(WEB, f);
  if (!fs.existsSync(p)) { console.log('skip', f, '(missing)'); continue; }
  const src = fs.readFileSync(p, 'utf8');
  if (!src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim()) { console.log('skip', f, '(placeholder)'); continue; }
  lint(f, src);
  syntax(f, src);
  try { vm.runInContext(src, ctx, { filename: f }); loaded.push(f); }
  catch (e) { if (f.indexOf('scenes/') === 0 && !MINE.includes(f)) warn('loading ' + f + ' threw (the host skips such a pack): ' + (e && e.message || e)); else fail('loading ' + f + ': ' + (e && e.stack || e)); }
}
const G = vm.runInContext('globalThis', ctx);
const added = Object.getOwnPropertyNames(G).filter(k => !builtins.has(k) && k.indexOf('__') !== 0);
console.log('loaded', loaded.filter(f => f.indexOf('scenes/') < 0).join(' '), '+', loaded.filter(f => f.indexOf('scenes/') === 0).length, 'scene packs | globals:', added.join(' '), '| res', RES, '| seed', SEED);
for (const k of added) if (!/^PET_[A-Z]+$/.test(k)) warn('a file left an extra global behind: "' + k + '" (each file should add exactly one PET_... name)');
if (!G.PET_ENGINE) { console.log('RESULT: FAILED (no PET_ENGINE)'); process.exit(1); }
if (!G.PET_DOGS) fail('PET_DOGS is missing (dogs.js did not define it): the engine still runs, but the dogs cannot be drawn');

// ---------- 数一数骨架画了几次、每次多久 ----------
const rigStat = {};
function watch(mod, label) {
  if (!mod || typeof mod.create !== 'function') return;
  const create = mod.create;
  mod.create = function () {
    const rig = create.apply(this, arguments), render = rig.render, name = label || arguments[0];
    const st = rigStat[name] || (rigStat[name] = { n: 0, ns: 0n, max: 0 });
    rig.render = function () {
      const t0 = process.hrtime.bigint(), o = render.apply(this, arguments), d = process.hrtime.bigint() - t0;
      st.n++; st.ns += d; if (Number(d) > st.max) st.max = Number(d);
      return o;
    };
    return rig;
  };
}
watch(G.PET_DOGS, null);
watch(G.PET_PERSON, 'person');

// ---------- 检查一帧 ----------
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function checkImg(im, where) {
  if (!im || typeof im !== 'object') return fail(where + ': no img');
  if (!Number.isInteger(im.w) || !Number.isInteger(im.h) || im.w < 1 || im.h < 1) return fail(where + ': bad size ' + im.w + 'x' + im.h);
  if (!im.data || im.data.constructor.name !== 'Uint8ClampedArray') return fail(where + ': data is not a Uint8ClampedArray');
  if (im.data.length !== im.w * im.h * 4) return fail(where + ': data.length ' + im.data.length + ' != ' + im.w + '*' + im.h + '*4');
  if (!isNum(im.scale) || im.scale < 1) return fail(where + ': bad scale ' + im.scale);
  if (!isNum(im.ox) || !isNum(im.oy)) return fail(where + ': bad origin');
  if (!(im.key === null || (typeof im.key === 'string' && im.key))) return fail(where + ': key must be a string or null');
  if (!Number.isInteger(im.ver)) return fail(where + ': ver must be an integer (got ' + im.ver + ')');
}
function checkItems(items, where, view) {
  if (!Array.isArray(items) && !(items && typeof items.length === 'number')) return fail(where + ': items is not an array');
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const it = items[i], w = where + ' item ' + (it && it.id);
    if (!it || typeof it.id !== 'string' || !it.id) { fail(where + ': item without id'); continue; }
    if (seen.has(it.id)) fail(where + ': duplicate id ' + it.id);
    seen.add(it.id);
    if (!isNum(it.x) || !isNum(it.y)) fail(w + ': position not finite (' + it.x + ', ' + it.y + ')');
    if (!isNum(it.a) || it.a < 0 || it.a > 1) fail(w + ': bad opacity ' + it.a);
    if (it.clip !== undefined && !(it.clip && it.clip.length === 4 && it.clip.every(isNum))) fail(w + ': bad clip ' + JSON.stringify(it.clip));
    if (typeof it.flip !== 'boolean') fail(w + ': flip must be a boolean');
    checkImg(it.img, w);
    if (isNum(it.x) && it.img && it.img.w) {
      const iw = it.img.w / it.img.scale, ih = it.img.h / it.img.scale;
      // 往上可以飞得很高：只在底部一条活动时，把球举到顶再用力往上甩，它会飞出画面再掉回来
      if (it.x + iw < -120 || it.x > view.w + 120 || it.y + ih < -(view.h * 2.3 + 100) || it.y > view.h + 120) fail(w + ': far outside the view (' + it.x.toFixed(1) + ', ' + it.y.toFixed(1) + ')');
    }
  }
}
// 角色的图：同一张（同一个对象）一直用下去；像素变了 ver 才变，ver 没变像素就不能变
const track = {};
function sum32(im) {
  const a = new Uint32Array(im.data.buffer, im.data.byteOffset, im.data.length >> 2);
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function checkVersions(run, items, deep) {
  for (const it of items) {
    if (it.id !== 'gold' && it.id !== 'dax' && it.id !== 'person') continue;
    const im = it.img;
    if (!im || im.key !== null) continue;          // 旧画法的小人是一张张现成的图，不归这里管
    const key = run + ':' + it.id, t = track[key] || (track[key] = { im: im, ver: -1, sum: 0, deepVer: -1 });
    if (t.im !== im) { fail(key + ': the image object changed identity'); t.im = im; t.deepVer = -1; }
    if (im.ver < t.ver) fail(key + ': ver went backwards');
    // 认得"零头"的骨架（原点不在整像素上）：刚画好的那一帧，图应该正好落在像素格子上。
    // 头一回见到这张图（t.ver 还是 -1，比如换到"夜里"那一段）不算：它是早些时候画的，角色已经挪过了
    if (t.ver !== -1 && im.ver !== t.ver && Math.abs(im.ox - Math.round(im.ox)) > 1e-6) {
      const gx = it.x * im.scale;
      if (Math.abs(gx - Math.round(gx)) > 1e-4) fail(key + ': freshly drawn image is not on the pixel grid (x*R = ' + gx.toFixed(4) + ')');
    }
    if (deep) {
      const s = sum32(im);
      if (t.deepVer === im.ver && s !== t.sum) fail(key + ': pixels changed but ver did not (ver ' + im.ver + ')');
      if (t.deepVer >= 0 && t.deepVer !== im.ver && s === t.sum) fail(key + ': ver changed but pixels did not (ver ' + im.ver + ')');
      t.sum = s; t.deepVer = im.ver;
    } else t.deepVer = -1;
    t.ver = im.ver;
  }
}
function checkFrame(run, fr, view, deep) {
  if (!fr || typeof fr !== 'object') return fail(run + ': compose() returned nothing');
  checkItems(fr.items, run, view);
  checkVersions(run, fr.items, deep);
  if (typeof fr.drag !== 'boolean') fail(run + ': drag must be a boolean');
  if (!fr.hot || typeof fr.hot.length !== 'number' || fr.hot.length > 12) fail(run + ': bad hot list');
  else for (const r of fr.hot) {
    if (!r || r.length !== 4 || !r.every(isNum)) { fail(run + ': hot rect not finite ' + JSON.stringify(r)); continue; }
    if (r[2] <= 0 || r[3] <= 0 || r[2] > 140 || r[3] > 140) fail(run + ': hot rect has a silly size ' + JSON.stringify(r));
    if (r[0] + r[2] < -60 || r[0] > view.w + 60 || r[1] + r[3] < -(view.h * 2.3 + 100) || r[1] > view.h + 60) fail(run + ': hot rect far outside the view ' + JSON.stringify(r));
  }
  if (fr.decals !== undefined) {
    if (!Array.isArray(fr.decals)) fail(run + ': decals is not an array');
    else for (const d of fr.decals) { if (!d || typeof d.id !== 'string' || !isNum(d.x) || !isNum(d.y) || typeof d.overlay !== 'boolean') fail(run + ': bad decal ' + JSON.stringify(d && d.id)); else checkImg(d.img, run + ' decal ' + d.id); }
  }
  if (fr.bubble !== null) {
    const b = fr.bubble;
    if (!b || typeof b.text !== 'string' || !isNum(b.x) || !isNum(b.y)) fail(run + ': bad bubble ' + JSON.stringify(b));
  }
}

// ---------- 画图的几个文件守不守约定（有哪个查哪个）----------
const FX_NAMES = ['bone', 'bfly_a', 'bfly_b', 'bfly2_a', 'bfly2_b', 'puff0', 'puff1', 'puff2', 'fx_heart', 'fx_hs', 'fx_bang', 'fx_note', 'fx_z', 'fx_zs', 'fx_q', 'fx_spark', 'fx_sweat', 'fx_woof'];
const FRAMES = ['p_front', 'p_front2', 'p_front_blink', 'p_wave_a', 'p_wave_b', 'p_idle', 'p_idle2', 'p_blink', 'p_hold', 'p_hold2', 'p_walk0', 'p_walk1', 'p_walk2', 'p_walk3',
  'p_windup', 'p_release', 'p_follow', 'p_pat', 'p_cheer', 'p_cheer2', 'p_crouch', 'p_crouch2', 'p_sit', 'p_tie_a', 'p_tie_b', 'p_watch'];
const POSES = ['stand', 'alert', 'sit', 'paw', 'scratch', 'lie', 'sleep', 'bow', 'dig', 'beg', 'roll', 'sniff', 'tug', 'lick', 'air'];
const pair = v => v && v.length === 2 && isNum(v[0]) && isNum(v[1]);
function contracts() {
  const cfg = G.PET_CONFIG || {}, tell = [];
  const box = (o, w) => { if (!o.box || o.box.length !== 4 || !o.box.every(isNum)) fail(w + ': bad box'); };
  if (G.PET_FX) {
    const F = G.PET_FX, set = F.build(cfg, RES);
    for (const n of FX_NAMES) {
      const im = set[n];
      if (!im) { warn('PET_FX.build has no "' + n + '" (the old sprite will be used)'); continue; }
      checkImg(im, 'PET_FX ' + n);
      if (!im.key) warn('PET_FX ' + n + ': key missing');
      if (im.scale !== RES) warn('PET_FX ' + n + ': scale ' + im.scale + ' instead of ' + RES);
      if (!im.bb || im.bb.length !== 4 || !(im.bb[0] >= 0 && im.bb[1] >= 0 && im.bb[2] < im.w && im.bb[3] < im.h && im.bb[2] >= im.bb[0] && im.bb[3] >= im.bb[1])) fail('PET_FX ' + n + ': bad bb ' + JSON.stringify(im.bb));
    }
    for (const [w, im] of [['ball', F.ball(0, 0, RES)], ['ball turned', F.ball(2.2, 0, RES)], ['ball squashed', F.ball(0.4, 1, RES)], ['shadow', F.shadow(17, 0.16, RES)], ['px', F.px('#8a6a4a', RES)]]) {
      checkImg(im, 'PET_FX ' + w);
      if (im && !im.key) warn('PET_FX ' + w + ': key missing');
      if (im && im.scale !== RES) warn('PET_FX ' + w + ': scale ' + im.scale + ' instead of ' + RES);
    }
    if (F.ball(0, 0, RES).key === F.ball(Math.PI / 2, 0, RES).key) warn('PET_FX.ball gives the same image for rot 0 and a quarter turn');
    tell.push('fx: ' + Object.keys(set).length + ' sprites' + (F.EXTRA && F.EXTRA.length ? ', ' + F.EXTRA.length + ' extra' : ''));
  }
  if (G.PET_PERSON) {
    const rig = G.PET_PERSON.create(cfg);
    for (const f of FRAMES) for (const left of [false, true]) {
      for (let i = 0; i < 40; i++) rig.update(1 / 60, { frame: f, moving: /walk/.test(f), speed: /walk/.test(f) ? 24 : 0, t: i / 60, carried: false, air: 0, holding: 'ball', look: null });
      const o = rig.render(left, RES), w = 'PET_PERSON ' + f + (left ? ' (left)' : '');
      checkImg(o, w); box(o, w);
      if (o.scale !== RES) warn(w + ': scale ' + o.scale + ' instead of ' + RES);
      if (!isNum(o.top) || o.top < 8 || o.top > 60) fail(w + ': top = ' + o.top);
      if (o.hand && !pair(o.hand)) fail(w + ': hand = ' + JSON.stringify(o.hand));
      if (!o.hand && f !== 'p_follow') warn(w + ': no hand anchor (the ball will not be drawn in this pose)');
      if (typeof o.holds !== 'boolean') warn(w + ': holds should be true or false');
    }
    const M = G.PET_PERSON.METRICS;
    tell.push('person: ' + (M ? 'height ' + M.height + ', half ' + M.half + ', reach ' + M.reach : 'no METRICS (the engine assumes 26 / 8 / 6)'));
  }
  if (G.PET_DOGS) {
    for (const [kind, coat] of [['gold', 'gold'], ['dax', 'dax_' + (cfg.dachshund || 'red')]]) for (const left of [false, true]) {
      const rig = G.PET_DOGS.create(kind, coat);      // 每个朝向用一只新的：有的骨架转身是慢慢转过去的，这里不查那个
      rig.update(1 / 60, { pose: 'stand' }); rig.render(left, RES);
      for (const pose of POSES) {
        for (let i = 0; i < 60; i++) rig.update(1 / 60, { pose: pose, speed: 0, air: pose === 'air' ? 1 : 0, wag: 0.5 });
        const o = rig.render(left, RES), w = 'PET_DOGS ' + kind + ' ' + pose + (left ? ' (left)' : '');
        if (o.scale === undefined) { if (!o.data || o.data.length !== o.w * o.h * 4) fail(w + ': bad buffer'); }      // 旧的画法：没有 scale，一个像素一个世界单位
        else { checkImg(o, w); if (o.scale !== RES) warn(w + ': scale ' + o.scale + ' instead of ' + RES); }
        box(o, w);
        if (!pair(o.mouth)) fail(w + ': mouth = ' + JSON.stringify(o.mouth));
        else if (left ? o.mouth[0] > 0 : o.mouth[0] < 0) warn(w + ': the mouth is behind the body centre (dx = ' + o.mouth[0].toFixed(1) + ')');
        if (!isNum(o.top) || o.top < 2 || o.top > 60) fail(w + ': top = ' + o.top);
      }
    }
    tell.push('dogs: ' + (G.PET_DOGS.create('gold', 'gold').render(false, RES).scale === undefined ? 'old rig (ignores R)' : 'R-aware'));
  }
  if (G.PET_LAWN) {
    for (const ph of (G.PET_LAWN.PHASES || ['day', 'dusk', 'night'])) for (const mode of ['full', 'strip']) {
      const t0 = Date.now(), im = G.PET_LAWN.render(96, 64, ph, RES, { mode: mode }), w = 'PET_LAWN ' + ph + ' ' + mode;
      checkImg(Object.assign({}, im, { ver: im.ver === undefined ? 1 : im.ver }), w);
      if (im.w !== 96 * RES || im.h !== 64 * RES) warn(w + ': size ' + im.w + 'x' + im.h + ', expected ' + 96 * RES + 'x' + 64 * RES);
      if (Date.now() - t0 > 1000) warn(w + ': took ' + (Date.now() - t0) + ' ms for a small patch');
    }
    tell.push('lawn ok');
  }
  if (tell.length) console.log('art modules: ' + tell.join(' | '));
}
try { contracts(); } catch (e) { fail('art module check: ' + (e && e.stack || e)); }

// ---------- 跑一种版面 ----------
function simulate(mode, minutes) {
  const roam = mode === 'roam';
  let view = roam ? { w: 480, h: 300 } : { w: 480, h: 110 };
  const insets = roam ? { top: 8, bottom: 22, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 };
  let clock = 0;
  const store = {}, haptics = {};
  const host = {
    now: () => clock,
    storage: { get: k => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); } },
    haptic: k => { haptics[k] = (haptics[k] || 0) + 1; },
    island: { center: () => view.w / 2, visible: () => true, hit: (x, y) => y < 16 && Math.abs(x - view.w / 2) < 40 },
    log: m => { fail(mode + ': the engine reported: ' + m); },
  };
  // 满屏那一遍照 Mac 的样子配（点空地不归我们管）；底部一条那一遍照网页的样子配（点空地 = 往那儿丢球）
  const cfg = Object.assign({}, G.PET_CONFIG || {}, { roam: roam, res: RES, grass: !roam, lawnTap: !roam, entrance: true, messages: ['test', '你好'], messageMinutes: [0.5, 1] });
  const eng = G.PET_ENGINE.create(host, cfg);
  eng.configure({ view: view, insets: insets });
  const T = eng._t;
  const dt = 1 / 60, frames = Math.round(minutes * 60 * 60);
  const stats = { throws: 0, grabs: { dax: 0, gold: 0 }, tugs: 0, userThrows: 0, pets: 0, carries: 0, drops: 0, taps: 0, homes: 0, cmds: 0, resizes: 0, bubbles: 0, maxItems: 0, phases: {} };
  let prevSt = 'hand', stuckFor = 0, lastPhase = '', lastScene = null, lastSceneT = 0, bad = 0;
  let dragging = false, carrying = false, holdT = 0, holdFor = 0, px = 0, py = 0, toIsland = false;
  let spent = 0n, lastBubble = 0;
  const r = (a, b) => a + rnd() * (b - a);
  const mid = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const note = m => { if (++bad <= 6) fail(mode + ': ' + m); };

  for (let i = 0; i < frames && bad <= 6; i++) {
    clock += dt;
    const s0 = T.state();
    const deep = i > 600 && i < 600 + 60 * 25;      // 有 25 秒把每个角色的像素逐帧核对一遍
    T.set('touch', s0.now);     // 这一段先别让它们因为"好久没人理"去睡觉
    try {
      if (dragging || carrying) {
        holdT += dt;
        if (toIsland && holdT > holdFor * 0.6) { px = view.w / 2 + r(-20, 20); py = r(2, 12); }
        else if (rnd() < 0.2) { px = r(0, view.w); py = r(0, view.h); }
        else { px += r(-14, 14); py += r(-10, 10); }
        eng.pointer('move', px, py);
        if (holdT > holdFor) { eng.pointer('up', 0, 0); if (carrying && toIsland) stats.drops++; dragging = carrying = toIsland = false; }
      } else {
        const k = rnd();
        if (k < 0.0008) {
          const b = T.boxes();
          if (b.ball) { const m = mid(b.ball); px = m[0]; py = m[1]; const took = eng.pointer('down', px, py); if (T.state().ball.st === 'drag') { if (took !== true) note('pointer(down) on the ball did not return true'); dragging = true; holdT = 0; holdFor = r(0.2, 1.5); stats.userThrows++; } else eng.pointer('up', 0, 0); }
        } else if (k < 0.0014) {
          const b = T.boxes(), who = [b.dax, b.gold, b.person][(rnd() * 3) | 0];
          if (who) {
            const m = mid(who); px = m[0]; py = m[1];
            eng.pointer('down', px, py);
            if (rnd() < 0.4) { px += 10; py -= 10; eng.pointer('move', px, py); carrying = true; holdT = 0; holdFor = r(0.3, 1.2); toIsland = roam && rnd() < 0.25; stats.carries++; }
            else { eng.pointer('up', 0, 0); stats.pets++; }
          }
        } else if (k < 0.0018) { eng.pointer('down', r(10, view.w - 10), r(40, view.h - 6)); eng.pointer('up', 0, 0); stats.taps++; }
        else if (k < 0.0021) { eng.command(['throw', 'love', 'gather', 'wave'][(rnd() * 4) | 0]); stats.cmds++; }
        else if (k < 0.00216) { eng.command('toggleHome'); stats.homes++; }
        else if (k < 0.0022) { eng.command(rnd() < 0.5 ? 'home' : 'out'); stats.homes++; }
        else if (k < 0.004) eng.pointer('hover', r(0, view.w), r(0, view.h));
        else if (k < 0.0045) eng.pointer('leave', 0, 0);
        else if (deep) { /* 核对像素的这一小段里不折腾版面 */ }
        else if (k < 0.00453) {      // 窗口变了大小 / 换了精细度 / 机器变慢了
          view = roam ? { w: Math.round(r(300, 640)), h: Math.round(r(200, 400)) } : { w: Math.round(r(240, 640)), h: Math.round(r(80, 130)) };
          eng.configure({ view: view, insets: insets }); stats.resizes++;
        } else if (k < 0.00456) { eng.configure({ res: 1 + ((rnd() * 3) | 0) }); eng.compose(); eng.configure({ res: RES }); }
        else if (k < 0.0046) eng.setQuality(rnd() < 0.5 ? r(0, 1) : 1);
        else if (k < 0.00463) eng.configure({ soft: rnd() < 0.5, auto: rnd() < 0.9 });
      }
      const t0 = process.hrtime.bigint();
      eng.step(dt);
      const fr = eng.compose();
      spent += process.hrtime.bigint() - t0;
      checkFrame(mode, fr, view, deep);
      if (fr.items && fr.items.length > stats.maxItems) stats.maxItems = fr.items.length;
      if (fr.bubble && fr.bubble.id !== lastBubble) { lastBubble = fr.bubble.id; stats.bubbles++; }
      if (fr.drag && !dragging && !carrying) note('frame.drag is true while nothing is held');
      const st = eng.status();
      if (i % 7 === 0 || st.home !== 'out') {
        const d = eng.den(RES);
        if (!d || !isNum(d.w) || !isNum(d.h)) note('den() returned no size'); else checkItems(d.items, mode + ' den', { w: d.w, h: d.h });
      }
      const b = eng.busy();
      if (b !== 0 && b !== 1 && b !== 2) note('busy() returned ' + b);
    } catch (e) { note('exception at t=' + s0.now.toFixed(2) + ': ' + (e && e.stack || e)); break; }

    const s = T.state();
    for (const [k, v] of [['ball.x', s.ball.x], ['ball.y', s.ball.y], ['ball.z', s.ball.z], ['person.x', s.person.x], ['person.y', s.person.y], ['dax.x', s.dax.x], ['dax.y', s.dax.y], ['dax.z', s.dax.z], ['gold.x', s.gold.x], ['gold.y', s.gold.y]]) {
      if (!Number.isFinite(v)) note(k + ' not finite at ' + s.now.toFixed(1));
    }
    for (const a of [s.dax, s.gold, s.person]) {
      if (a.x < s.F.x0 - 1 || a.x > s.F.x1 + 1 || a.y < s.F.y0 - 1 || a.y > s.F.y1 + 1) note('actor out of field at ' + s.now.toFixed(1) + ' ' + JSON.stringify(a) + JSON.stringify(s.F));
    }
    if (s.ball.st === 'free' && prevSt !== 'free') stats.throws++;
    if (s.ball.st === 'mouth' && prevSt !== 'mouth') stats.grabs[s.ball.holder]++;
    if (s.ball.st === 'tug' && prevSt !== 'tug') stats.tugs++;
    prevSt = s.ball.st;
    stats.phases[s.phase] = (stats.phases[s.phase] || 0) + dt;
    // 除了休息以外，任何阶段都不该卡超过 45 秒；一段小剧场也不该超过 75 秒
    if (s.phase === lastPhase && s.phase !== 'rest' && !dragging) stuckFor += dt; else stuckFor = 0;
    lastPhase = s.phase;
    if (stuckFor > 45) { note('stuck in ' + s.phase + ' at ' + s.now.toFixed(1) + ' ' + JSON.stringify(s)); stuckFor = 0; }
    if (s.scene !== lastScene) { lastScene = s.scene; lastSceneT = s.now; }
    if (s.scene && s.now - lastSceneT > 75) { note('scene too long: ' + s.scene); lastSceneT = s.now; }
  }
  if (dragging || carrying) eng.pointer('up', 0, 0);
  eng.pointer('leave', 0, 0);
  const perf = T.perf(), simSec = frames * dt;
  for (const k in perf) {
    if (perf[k].renders > frames + 50) note(k + ' was rasterised more often than once per frame (' + perf[k].renders + ' renders in ' + frames + ' frames)');
    if (perf[k].changed > perf[k].renders) note(k + ': more version bumps than renders');
  }

  // ---------- 夜里：没人理 → 回岛睡觉（没有岛就原地睡）；天亮 → 自己出来 ----------
  const run = (sec, touch) => { for (let i = 0; i < sec * 60; i++) { clock += dt; if (touch) T.set('touch', T.state().now); eng.step(dt); checkFrame(mode + ' night', eng.compose(), view, false); checkItems(eng.den(RES).items, mode + ' night den', { w: 124, h: 28 }); } };
  let night = 'skipped';
  try {
    eng.configure({ auto: true, view: view, insets: insets });
    if (eng.status().home !== 'out') eng.command('out');
    run(40, true);
    vm.runInContext('__hour = 1', ctx);
    if (!eng.status().night) note('status().night is false at 1 am');
    run(330, false);
    const sN = T.state();
    if (roam) { if (sN.home !== 'in') note('night: they did not go home to sleep (home=' + sN.home + ', person=' + sN.person.st + ', phase=' + sN.phase + ')'); }
    else if (sN.person.st !== 'sleep' || sN.dax.pose !== 'sleep') note('night: not asleep in place (person=' + sN.person.st + ', dax=' + sN.dax.pose + ')');
    const denItems = eng.den(RES).items.length;
    if (roam && denItems < 3) note('night: the den shows only ' + denItems + ' sleepers');
    if (roam && eng.busy() !== 0) note('night: busy() should be 0 while everyone sleeps in the island');
    vm.runInContext('__hour = 8', ctx);
    run(20, false);
    const sM = T.state();
    if (sM.home !== 'out' || sM.person.st === 'sleep') note('morning: they did not come back out (home=' + sM.home + ', person=' + sM.person.st + ')');
    night = roam ? 'home at night, out in the morning' : 'asleep in place at night, awake in the morning';
  } catch (e) { note('exception in the night routine: ' + (e && e.stack || e)); }
  vm.runInContext('__hour = 14', ctx);

  const e = T.state();
  for (const m of T.errors()) fail(mode + ': a drawing module threw: ' + m);
  if (T.sceneErrors) for (const m of T.sceneErrors()) fail(mode + ': a scene failed: ' + m);
  for (const k in stats.phases) stats.phases[k] = Math.round(stats.phases[k]);
  stats.scenes = e.scenes; stats.fetch = eng.status().fetch; stats.haptics = haptics;
  const renders = Object.keys(perf).reduce((n, k) => n + perf[k].renders, 0), changed = Object.keys(perf).reduce((n, k) => n + perf[k].changed, 0);
  console.log(mode + ':', JSON.stringify(stats));
  console.log(mode + ': night routine:', night);
  console.log(mode + ': ' + (Number(spent) / 1e6 / frames).toFixed(3) + ' ms per step+compose (' + frames + ' frames = ' + minutes + ' simulated min); rig renders ' +
    (renders / simSec).toFixed(1) + ' per simulated second (' + Object.keys(perf).map(k => k + ' ' + (perf[k].renders / simSec).toFixed(1)).join(', ') +
    '); of those ' + (100 * changed / Math.max(1, renders)).toFixed(0) + '% changed pixels');
  if (bad) return;
  // 下面几条是"玩得像不像样"的统计，跑得太短不作数
  if (minutes >= 5) {
    if (stats.throws < minutes * 0.5) fail(mode + ': too few throws');
    if (stats.grabs.dax + stats.grabs.gold < stats.throws * 0.6) fail(mode + ': dogs are not fetching reliably');      // 这里捣乱捣得比 sim.js 凶，标准放松一点
    if (!stats.bubbles) fail(mode + ': the person never said anything');
  }
  const kinds = Object.keys(stats.scenes).length;
  if (minutes >= 10 && kinds < (minutes >= 20 ? 8 : 6)) fail(mode + ': too few different scenes played: ' + Object.keys(stats.scenes).join(','));
}

const t0 = Date.now();
for (const mode of ['roam', 'band']) {
  if (!(MIN[mode] > 0)) continue;
  try { simulate(mode, MIN[mode]); } catch (e) { fail(mode + ': ' + (e && e.stack || e)); }
}
for (const k in rigStat) {
  const s = rigStat[k];
  if (s.n) console.log('rig ' + k + ': ' + s.n + ' renders, ' + (Number(s.ns) / 1e6 / s.n).toFixed(3) + ' ms each on average, slowest ' + (s.max / 1e6).toFixed(2) + ' ms');
}
if (warned) console.log(warned + ' warning(s) above: places where a drawing module differs from the contract but the engine copes');
console.log('took ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log(failed ? 'RESULT: FAILED' : 'RESULT: OK');
process.exit(failed ? 1 : 0);
