// 球球 · 玩法引擎（第三版）
//
// 一个穿西装的小人、一只小腊肠、一只大金毛，和一颗小球。
//   · 可以满屏幕到处跑（roam），也可以只待在屏幕最下面一条
//   · 小人丢球，狗狗去追；她也可以拖球、点小人、摸狗、把它们拎起来
//   · 没事的时候它们自己会找事做：互相闻闻、追着玩、挤在一起睡、揉肚子、握手、吃零食、散步……
//   · 晚上或者她说"回家"时，它们会跑回屏幕顶上的"灵动岛"里睡觉
//
// 这个文件只管"玩法"：不碰网页、不碰画布、不用定时器，只用得到语言自带的东西。
// 所以同一份代码可以跑在浏览器 / 手机网页里（外壳是 web.js），也可以跑在 Mac 外壳的 JavaScriptCore 里。
// 画图的活在别的文件里：dogs.js（狗）、person.js（小人）、fx.js（小球、表情、影子……）；
// 后两个不在时，就用 sprites.js 里旧的手画图。
//
// 单位：一个"世界单位"= 旧版的一个像素（金毛大约 45 长）。x 向右，y 向下，z 是离地的高度。
//       图可以画得更细：R = 一个世界单位里有几个像素（默认 2）。
//
// ---------------- 外壳怎么用它 ----------------
//   var eng = PET_ENGINE.create(host, cfg);
//
//   host（除了 now 都可以不给）：
//     now()                    现在几秒了（只要一直往前走就行）
//     storage.get(k) / set(k, v)   存"今天丢了几次球"（键是 qiuqiu-stats）
//     haptic(kind)             'light' | 'soft'：手机上震一下
//     island                   屏幕顶上有没有岛：{ center() 岛的中心在哪（世界单位的 x）, visible() 现在显示着吗,
//                              hit(x, y) 把谁拎到这里放下算不算"放到岛上" }；没有岛就给 null
//     log(msg)                 画图的文件出了错时会说一声（引擎自己换旧的画法顶上，不会停）
//   cfg：config.js 里的设定，外壳可以再加几样：
//     res（R，默认 2）、rigFps（原地做动作时每秒重画几次，默认 12）、auto（自动丢球，默认开）、
//     roam、grass（有草地：影子深一点，打滚会带起草屑）、
//     entrance（刚打开时从岛里跳出来，默认开）、lawnTap（点空地 = 往那儿丢球；只有网页版开）
//
//   eng.configure({ view: { w, h }, insets: { top, bottom, left, right }, res, roam, auto, grass, soft })
//       画面多大、四边各让出多少（都是世界单位）。第一次给 view 时角色才摆到场地上。
//   eng.step(dt)        往前走 dt 秒（每画一帧调一次就行；隔得久它自己会拆成几小步走）
//   eng.compose()       这一帧该画什么 → { items, hot, drag, bubble }
//       items   从后到前排好的清单，每一项 { id, img, x, y, flip, a }：
//               img = { w, h, data(RGBA), scale, ox, oy, key, ver }；(x, y) 是图的左上角（世界单位，不取整）；
//               flip = 左右镜像；a = 不透明度。id 每个东西固定不变：
//               gold / person / dax / ball / held（手里的零食）/ shadow:gold… / puff:编号 / px:编号 / item:编号 / bfly / emote:编号
//               三个角色各自一直用同一张 img：像素变了它的 ver 才加一（key 是 null）；其余的图 key 不变就不会变
//       hot     可以点的范围 [x, y, w, h]（已经留好边）：先是球（抓得到的时候），然后金毛、小人、小腊肠
//       drag    她正拖着球 / 拎着谁
//       bubble  小人在说话：{ text, x, y, id }，(x, y) 是他头顶；换了一句 id 会变；没在说就是 null
//       顺便会更新"可以点的范围"和嘴、手的位置，所以每画一帧调一次就好
//   eng.pointer(type, x, y)   'down' | 'move' | 'up' | 'hover' | 'leave'（世界单位）；返回 true = 点在球或者谁身上了
//   eng.command(name)   'throw' | 'wave' | 'home' | 'out' | 'toggleHome' | 'love' | 'gather'
//   eng.status()        { home: 'out' | 'going' | 'in' | 'leaving', fetch, pets, night, auto, roam, scene,
//                         phase: 'day' | 'dusk' | 'night'（草地该用哪套颜色）, drag }
//   eng.busy()          0 没什么在动 / 1 鼠标在附近、有蝴蝶 / 2 正在动（外壳据此决定画得多勤）
//   eng.den(R)          它们在岛里睡觉时，岛上那一小格里画什么 → { w, h, items }（坐标相对那一格的左上角；
//                       id 是 den:gold / den:person / den:dax / den:z）
//   eng.setQuality(q)   0..1：机器吃力时调低，角色就少重画几次
//   eng._t              给测试脚本用的
(function (G) {
  'use strict';

  // ------------------------------------------------------------
  //  设定
  // ------------------------------------------------------------
  var DEF = { messages: [], messageMinutes: [25, 60], autoPlaySeconds: [35, 90], nightSleep: [0, 7], dachshund: 'red',
              roam: true, grass: false, res: 2, rigFps: 12 };
  var GRAV = 420;
  var BALL_R = 4;
  var KIND = {
    dax:  { half: 17, accel: 760, run: 150, back: 105, trot: 64, walk: 26, reach: 12, grab: 7 },
    gold: { half: 21, accel: 340, run: 170, back: 90,  trot: 62, walk: 24, reach: 22, grab: 8 },
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }
  function range(r, fallback) { return (r && r.length === 2) ? rand(r[0], r[1]) : fallback; }
  function resOf(v) { v = Math.round(+v); return v >= 1 ? (v > 4 ? 4 : v) : 2; }
  function rgbOf(c) {
    c = String(c).replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.substr(0, 2), 16) || 0, parseInt(c.substr(2, 2), 16) || 0, parseInt(c.substr(4, 2), 16) || 0];
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayPhase() { var h = new Date().getHours(); return (h >= 19 || h < 5) ? 'night' : ((h >= 17 || h < 7) ? 'dusk' : 'day'); }

  // 小人的每个旧画面名字属于哪一类姿势（同一类里的几张只是呼吸 / 眨眼 / 走路的不同帧）
  var PCLASS = { p_front: 1, p_front2: 1, p_front_blink: 1, p_wave_a: 2, p_wave_b: 2, p_idle: 3, p_idle2: 3, p_blink: 3,
                 p_hold: 4, p_hold2: 4, p_walk0: 5, p_walk1: 5, p_walk2: 5, p_walk3: 5, p_windup: 6, p_release: 7, p_follow: 8,
                 p_pat: 9, p_cheer: 10, p_cheer2: 10, p_crouch: 11, p_crouch2: 11, p_sit: 12, p_tie_a: 13, p_tie_b: 13, p_watch: 14 };
  var PMOVES = { 2: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 13: 1 };      // 这几类姿势本身一直在动
  var POSE_ID = { stand: 1, alert: 2, sit: 3, paw: 4, scratch: 5, lie: 6, sleep: 7, bow: 8, dig: 9, beg: 10, roll: 11, sniff: 12, tug: 13, lick: 14, air: 15 };

  // ============================================================
  //  host：外壳提供的几样东西（除了 now 都可以不给）
  //    now() 秒；storage.get/set；haptic(kind)；island { center(), visible(), hit(x, y) }；log(msg)
  // ============================================================
  function create(host, cfg) {
    host = host || {};
    var CFG = Object.assign({}, DEF, cfg || {});
    var opt = { auto: CFG.auto !== false, roam: !!CFG.roam, grass: !!CFG.grass, soft: !!CFG.soft };
    var R = resOf(CFG.res);          // 一个世界单位画成几个像素
    var RIG_FPS = +CFG.rigFps > 0 ? +CFG.rigFps : 12;     // 角色在原地做动作的时候，每秒重画几次
    var CALM_FPS = 6;                                      // 只是呼吸、轻轻摇尾巴的时候，每秒重画几次
    var STRIDE = 0.5;                                      // 在地上每走出这么远（世界单位；再细不过一个像素）就重画一次，脚才不会打滑
    var quality = 1;

    // 画图的文件要是出了错：记下来、告诉外壳（同样的话只说一次），然后用旧的画法顶上，玩法照常
    var artErrors = [];
    function artFail(what, e) {
      var m = what + ': ' + ((e && e.message) || e);
      if (artErrors.indexOf(m) >= 0 || artErrors.length >= 20) return;
      artErrors.push(m);
      if (host.log) { try { host.log(m); } catch (e2) {} }
    }
    function makeRig(what, fn) { try { return fn() || null; } catch (e) { artFail(what, e); return null; } }

    var DOGS = G.PET_DOGS || null;
    var FXM = G.PET_FX || null;          // 新的小道具画法（没有就用旧的手画图）
    var PERSON = G.PET_PERSON || null;   // 新的小人画法（同上）
    var SPR = (G.PET_SPRITES && G.PET_SPRITES.build) ? G.PET_SPRITES.build(CFG) : {};
    var personRig = (PERSON && PERSON.create) ? makeRig('person.js create', function () { return PERSON.create(CFG); }) : null;
    // 新画法的小人比旧的高：多高、半个身子多宽、手能伸多远，听画的人的（没有就按旧图：26 高、半宽 8、手伸 6）
    var PM = (personRig && PERSON.METRICS) || null;
    var P_H = PM && PM.height > 0 ? +PM.height : 26;
    var P_HALF = PM && PM.half > 0 ? +PM.half : 8;
    var P_REACH = PM && PM.reach > 0 ? +PM.reach : 6;
    var P_GRAB = Math.round(P_H * 0.54);          // 被拎起来时，手抓在脚上面多高的地方
    function pr(n) { return n + Math.max(0, P_REACH - 6); }     // 狗凑到他手边要站多远：手伸得远就站远一点
    var PY0 = 0;               // 小人的脚最靠上能站到哪里（头不能顶到菜单栏）

    var VW = 300, VH = 110;    // 外壳给的画面大小（世界单位）
    var INS = { top: 0, bottom: 0, left: 0, right: 0 };   // 菜单栏、程序坞、刘海各占多少（世界单位）
    var LW = 300, LH = 110;    // 场地的大小
    var F = { x0: 0, x1: 300, y0: 110, y1: 110 };   // 脚能踩到的范围
    var SK = 1;                // 场地小的时候（手机）跑慢一点
    var now = 0;               // 游戏时间（秒）
    var booted = false;
    var serial = 0;            // 给表情、灰尘这些小东西编号

    function clock() { return host.now ? host.now() : now; }
    function after(sec) { var t = now + sec; return function () { return now >= t; }; }
    function all() { var fs = arguments; return function () { for (var i = 0; i < fs.length; i++) if (!fs[i]()) return false; return true; }; }
    // 对齐到像素格子。图的位置不取整（那是外壳的事），只用在两处：
    // 贴在别人身上的东西（手里、嘴里的球）的相对位置；"可以点的范围"（看到哪里就点得到哪里）
    function qz(v) { return Math.round(v * R) / R; }

    // ------------------------------------------------------------
    //  角色
    // ------------------------------------------------------------
    // 每个角色自己的那张图（img）和重画的节奏；骨架上嘴、手、头顶的位置也记在这里
    function makeVis(phase) {
      return {
        im: { w: 0, h: 0, data: null, scale: 1, ox: 0, oy: 0, key: null, ver: 0 },
        ph: phase, acc: 0, seen: 0, sig: -1, cls: -1, left: false, R: 0, hot: 0, dist: 0, lx: 0, ly: 0,
        bx0: 0, by0: 0, bx1: 0, by1: 0, px: 1, top: 0, mx: 0, my: 0, hand: false, holds: false, hx: 0, hy: 0, seat: false, sx: 0, sy: 0,
        ry0: 0, ry1: 0, s8: null, s32: null, p32: null, n: 0, ch: 0, bad: 0,
      };
    }
    function makeDog(kind) {
      var m = DOGS && DOGS.METRICS && DOGS.METRICS[kind];
      return {
        kind: kind, name: kind, K: KIND[kind], half: m && m.half > 0 ? +m.half : KIND[kind].half,
        rig: (DOGS && DOGS.create) ? makeRig('dogs.js create ' + kind, function () { return DOGS.create(kind, kind === 'gold' ? 'gold' : 'dax_' + (CFG.dachshund || 'red')); }) : null,
        vis: makeVis(kind === 'gold' ? 0 : 0.66), ri: {},
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sp: 0, face: 1, lift: 0,
        st: 'idle', pose: 'stand', t: 0, dur: 0, wag: 0.3, energy: 1,
        tx: 0, ty: 0, spd: 0, react: 0, hopAt: 0, sideAt: 0, way: null,
        pant: false, happy: 0, hype: 0, bark: 0, look: 0,
        box: null, bpx: 1, top: 0, mx: kind === 'gold' ? 15 : 16, zAt: 0, dustAt: 0, lastSp: 0,
        land: 0, rSp: 0, rFace: 1, rLook: 0, near: false, la: null,
        scene: null, cmd: null, hidden: false, carried: false,
      };
    }
    var gold = makeDog('gold');
    var dax = makeDog('dax');
    var dogs = [gold, dax];
    function other(d) { return d === dax ? gold : dax; }
    var person = {
      isPerson: true, name: 'person', half: P_HALF, x: 0, y: 0, z: 0, vz: 0, lift: 0, face: 1, st: 'idle', t: 0, dur: 0, anim: 0, tx: 0, ty: 0, next: 4,
      msgAt: 0, waveCd: 0, hoverT: 0, box: null, bpx: 1, top: 0, zAt: 0, giveTo: null, spr: null, sprAt: 0, act: null, patSpr: null, item: null,
      scene: null, cmd: null, hidden: false, carried: false, moving: false, spd: 0, la: null,
      rig: personRig, vis: makeVis(0.33), ri: { frame: 'p_idle' },
    };
    var actors = [gold, person, dax];
    var ball = { x: 0, y: 0, z: BALL_R, vx: 0, vy: 0, vz: 0, st: 'hand', holder: null, other: null, rot: 0, sq: 0, box: null, bpx: 1, freeT: 0, vis: true, tugEnd: 0 };
    var play = { phase: 'rest', rounds: 0, nextAt: 9, throwAt: 0, fetcher: null, lastPlay: 0, faked: false, want: 0 };
    var pointer = { x: -999, y: -999, inside: false, down: false, drag: false, hist: [], grab: null, gx: 0, gy: 0 };
    var emotes = [], parts = [], items = [];
    var bfly = { on: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, t: 0, until: 0, nextAt: rand(25, 60), color: 0, land: 0 };
    var home = { st: 'out', t: 0, q: [], auto: false, inAt: 0, wasNight: false };     // out 在外面 | going 正在回岛 | in 在岛里 | leaving 正在出来
    function islandOn() { var I = host.island; return !!(I && (!I.visible || I.visible())); }
    var lastTouch = 0;
    var stats = { day: '', fetch: 0, pets: 0 };
    var scene = null, nextSceneAt = 14, sceneCount = {};
    var entered = false, enterAt = 0, preHidden = false;     // 刚打开时的"出场"

    function loadStats() {
      try { var s = JSON.parse((host.storage && host.storage.get('qiuqiu-stats')) || 'null'); if (s && s.day === today()) stats = s; } catch (e) {}
      if (stats.day !== today()) stats = { day: today(), fetch: 0, pets: 0 };
    }
    function saveStats() { try { if (host.storage) host.storage.set('qiuqiu-stats', JSON.stringify(stats)); } catch (e) {} }
    function bump(k) { if (stats.day !== today()) stats = { day: today(), fetch: 0, pets: 0 }; stats[k]++; saveStats(); }

    // ------------------------------------------------------------
    //  版面
    // ------------------------------------------------------------
    function relayout() {
      LW = Math.max(150, VW);
      LH = Math.max(70, VH);
      F.x0 = Math.ceil(INS.left); F.x1 = LW - Math.ceil(INS.right);
      F.y1 = LH - Math.ceil(INS.bottom);
      F.y0 = opt.roam ? Math.min(F.y1, Math.ceil(INS.top) + 34) : F.y1;
      SK = clamp(Math.min(LW, 400) / 400, 0.55, 1);
      PY0 = clamp(Math.ceil(INS.top) + P_H + 6, F.y0, F.y1);
      if (!booted) boot();
      actors.forEach(function (a) { a.x = clamp(a.x, F.x0 + a.half + 1, F.x1 - a.half - 1); a.y = clamp(a.y, a.isPerson ? PY0 : F.y0, F.y1); });
      ball.x = clamp(ball.x, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = clamp(ball.y, F.y0, F.y1);
    }
    function boot() {
      booted = true;
      loadStats();
      var cx = (F.x0 + F.x1) / 2, cy = F.y0 + (F.y1 - F.y0) * 0.62;
      person.x = Math.round(cx + rand(-10, 10)); person.y = Math.round(cy); person.face = 1;
      gold.x = person.x - 44; gold.y = Math.round(cy + (opt.roam ? -4 : 0)); gold.face = 1;
      dax.x = person.x + 34; dax.y = Math.round(cy + (opt.roam ? 6 : 0)); dax.face = -1;
      setPose(gold, 'sit', 5); setPose(dax, 'stand', 2);
      ball.x = person.x; ball.y = person.y;
      person.msgAt = range(CFG.messageMinutes, 40) * 60 * rand(0.2, 0.6);
      // 刚打开：有岛的话，过半秒从岛里一个一个跳出来（这半秒先不露面）；没有岛就过一会儿转过来挥挥手
      enterAt = host.island ? 0.5 : 1.6;
      if (wantEntrance()) { actors.forEach(function (a) { a.hidden = true; }); home.st = 'in'; preHidden = true; }
    }
    function wantEntrance() { return !!host.island && opt.roam && CFG.entrance !== false; }
    function enter() {
      if (preHidden && home.st !== 'in') return;          // 这半秒里她已经把它们叫出来了
      if (wantEntrance()) {
        actors.forEach(function (a) { a.hidden = true; });
        home.st = 'in'; comeOut();
        return;
      }
      if (preHidden) { actors.forEach(function (a) { a.hidden = false; }); home.st = 'out'; }
      if (person.st === 'idle' && play.phase === 'rest') personWave();
    }
    function spd(d, k) { return d.K[k] * SK; }
    function islandPt() {
      var I = host.island, cx = LW / 2;
      if (I && I.center) cx = I.center();
      return { x: clamp(cx, F.x0 + 30, F.x1 - 30), y: F.y0 };
    }

    // ------------------------------------------------------------
    //  表情、粒子、说话、震动
    // ------------------------------------------------------------
    function emote(type, ent, dx, life) {
      emotes.push({ id: ++serial, type: type, ent: ent, dx: dx || 0, t: 0, life: life || 1.1, ph: emotes.length });
    }
    function emoteAt(type, x, y, life) { emote(type, { x: x, top: y }, 0, life); }
    function puff(x, y, big) { parts.push({ id: ++serial, k: 'puff', x: x, y: y, t: 0, life: big ? 0.42 : 0.3, vx: rand(-6, 6), vy: -6 }); }
    function bits(x, y, n, colors, spread, up) {
      for (var i = 0; i < n; i++) {
        parts.push({ id: ++serial, k: 'px', x: x + rand(-2, 2), y: y, vx: rand(-spread, spread), vy: -rand(up * 0.5, up), g: 220, t: 0, life: rand(0.35, 0.7), c: pick(colors) });
      }
    }
    function haptic(k) { if (host.haptic) { try { host.haptic(k); } catch (e) {} } }
    // 在草地上打滚带起来的草屑是什么颜色：新的草地会告诉我们这个时段的颜色，没有就用旧草地的
    function grassBits() {
      var L = G.PET_LAWN, p = (L && L.palette) ? L.palette(dayPhase()) : null;
      return (p && p.bits && p.bits.length) ? p.bits : ['#9ad584', '#77b363'];
    }
    var bubble = null;         // 小人正在说的话：{ text, until, id }（气泡本身由外壳画）
    function say(text) {
      bubble = { text: text, until: now + Math.max(4.5, Math.min(9, text.length * 0.35 + 3)), id: ++serial };
    }

    function isNight() {
      var n = CFG.nightSleep;
      if (!n || n.length !== 2) return false;
      var h = new Date().getHours();
      return n[0] <= n[1] ? (h >= n[0] && h < n[1]) : (h >= n[0] || h < n[1]);
    }
    // 夜里、而且好一阵子没人理 → 该睡了
    function sleepyTime() { return isNight() && (now - lastTouch) > 150; }

    // ------------------------------------------------------------
    //  移动
    // ------------------------------------------------------------
    function setPose(d, pose, dur) { d.st = 'pose'; d.pose = pose; d.t = 0; d.dur = dur || 2; }
    function walkTo(d, tx, ty, speed, pose) {
      d.st = 'walk'; d.pose = pose || 'stand'; d.t = 0;
      d.tx = clamp(tx, F.x0 + d.half + 2, F.x1 - d.half - 2); d.ty = clamp(ty, F.y0, F.y1);
      d.spd = speed;
    }
    function awake(d) { return !(d.st === 'pose' && d.pose === 'sleep'); }
    function wake(d, quiet) {
      if (!awake(d)) { d.st = 'idle'; d.pose = 'stand'; d.t = 0; d.dur = 0; if (!quiet) emote('bang', d); }
    }
    // 往 (tx, ty) 跑，返回是否到了
    function drive(e, tx, ty, maxSpd, dt) {
      var acc = e.K.accel * SK;
      tx = clamp(tx, F.x0 + e.half + 1, F.x1 - e.half - 1); ty = clamp(ty, F.y0, F.y1);
      var dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy), sp = hyp(e.vx, e.vy);
      if (d < 1.8 && sp < 45) { e.vx = e.vy = 0; e.x = tx; e.y = ty; return true; }
      var brake = sp * sp / (2 * acc);
      var want = d <= brake + 1 ? 0 : maxSpd;
      // 目标正好在脚下（比如屏幕变小后两个都被挤到边上）时 d 是 0：只刹车，不能除以 0
      var inv = d > 1e-6 ? 1 / d : 0;
      var wx = dx * inv * want, wy = dy * inv * want * 0.8;
      var ax = wx - e.vx, ay = wy - e.vy, al = hyp(ax, ay), step = acc * dt;
      if (al > step) { ax *= step / al; ay *= step / al; }
      e.vx += ax; e.vy += ay;
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < F.x0 + e.half + 1) { e.x = F.x0 + e.half + 1; e.vx = 0; }
      if (e.x > F.x1 - e.half - 1) { e.x = F.x1 - e.half - 1; e.vx = 0; }
      if (e.y < F.y0) { e.y = F.y0; e.vy = 0; }
      if (e.y > F.y1) { e.y = F.y1; e.vy = 0; }
      if (Math.abs(e.vx) > 5) e.face = e.vx > 0 ? 1 : -1;
      return false;
    }
    function coast(e, dt) {
      var sp = hyp(e.vx, e.vy);
      if (sp < 0.01) { e.vx = e.vy = 0; return; }
      var step = e.K.accel * SK * dt, k = Math.max(0, sp - step) / sp;
      e.vx *= k; e.vy *= k;
      e.x = clamp(e.x + e.vx * dt, F.x0 + e.half + 1, F.x1 - e.half - 1);
      e.y = clamp(e.y + e.vy * dt, F.y0, F.y1);
    }
    function faceTo(e, x) { if (Math.abs(x - e.x) > 2) e.face = x > e.x ? 1 : -1; }
    function hop(d, power) { if (d.z === 0) { d.vz = power; d.z = 0.01; } }
    function mouthX(d) { return d.x + d.face * d.mx; }
    function randPt(far, from) {
      for (var i = 0; i < 12; i++) {
        var x = rand(F.x0 + 24, F.x1 - 24), y = rand(F.y0, F.y1);
        if (!from || hyp(x - from.x, y - from.y) > far) return { x: x, y: y };
      }
      return { x: rand(F.x0 + 24, F.x1 - 24), y: rand(F.y0, F.y1) };
    }
    function ry(v) { return opt.roam ? v : 0; }   // 只有满屏幕跑的时候才有"前后"的偏移

    // ------------------------------------------------------------
    //  小剧场：几个角色一起演的一小段互动
    //  每一段是一个 generator：yield 秒数 = 等这么久；yield 函数 = 等它返回 true
    // ------------------------------------------------------------
    function go(a, x, y, speed, pose) {
      a.cmd = { k: 'go', x: x, y: y, spd: speed, done: false, t: now, pose: pose || 'stand' };
      var c = a.cmd;
      return function () { return c.done || a.cmd !== c || now - c.t > 8; };
    }
    function follow(a, target, back, dy, speed) { a.cmd = { k: 'follow', target: target, back: back, dy: dy, spd: speed }; }
    function hold(a, pose) {
      a.cmd = null;
      if (a.isPerson) { a.spr = pose || null; a.sprAt = now; } else a.pose = pose || 'stand';
    }
    function startScene(name, list, gen) {
      if (scene) return false;
      scene = { name: name, actors: list, it: null, wait: null, t0: now };
      list.forEach(function (a) {
        a.scene = scene; a.cmd = null;
        if (a.isPerson) { a.st = 'idle'; a.spr = null; a.sprAt = now; a.act = null; } else { wake(a, true); a.st = 'scene'; a.pose = 'stand'; a.wag = 0.4; a.pant = false; }
      });
      scene.it = gen();
      sceneCount[name] = (sceneCount[name] || 0) + 1;
      return true;
    }
    function endScene(cancel) {
      if (!scene) return;
      var sc = scene; scene = null;
      sc.actors.forEach(function (a) {
        a.scene = null; a.cmd = null; a.lift = 0;
        if (a.isPerson) { a.spr = null; a.item = null; if (a.st !== 'carried') personIdle(); }
        else if (a.st === 'scene') { a.st = 'idle'; a.pose = 'stand'; a.t = 0; a.pant = false; a.wag = 0.3; a.happy = 0; }
      });
      items = items.filter(function (i) { return !i.scene; });
      nextSceneAt = now + (cancel ? rand(5, 9) : rand(6, 15));
    }
    function runScene() {
      if (!scene) return;
      if (now - scene.t0 > 70) { endScene(true); return; }
      for (var guard = 0; scene && guard < 30; guard++) {
        if (scene.wait) { if (!scene.wait()) return; scene.wait = null; }
        var r = scene.it.next();
        if (r.done) { endScene(false); return; }
        scene.wait = typeof r.value === 'number' ? after(r.value) : (r.value || null);
      }
    }
    // 小人把东西丢出去的那一下，手在哪里（旧画面 p_release 里手的位置）
    function handPos(sprName, face) {
      if (PM) { var k = P_H / 26; return { x: person.x + face * 9.5 * k, z: 17 * k }; }      // 新画法：按身高放大
      var s = SPR[sprName], w = s ? s.w : 22, hh = s ? s.h : 28, h = (s && s.hand) || [19, 10];
      var x0 = Math.round(person.x - w / 2), ax = h[0] + 1;
      return { x: face < 0 ? x0 + (w - 1 - ax) : x0 + ax, z: hh - (h[1] + 1) };
    }
    function toss(sprName, fromX, fromZ, toEnt, dur, peak) {
      items.push({ id: ++serial, spr: sprName, x0: fromX, y0: person.y, z0: fromZ, to: toEnt, t: 0, dur: dur, peak: peak, scene: true });
    }

    // 狗狗之间的戏：主角要是正挤在小人身边，先小跑到旁边的空地上再演
    function stage(a) {
      if (person.hidden) return 0;
      var dx = a.x - person.x, dy = a.y - person.y;
      if (Math.abs(dx) > 44 || Math.abs(dy) > 24) return 0;
      var s = dx >= 0 ? 1 : -1, far = rand(56, 84);
      var tx = person.x + s * far;
      if (tx < F.x0 + 44 || tx > F.x1 - 44) tx = person.x - s * far;
      return go(a, tx, clamp(person.y + ry(rand(-8, 16)), F.y0, F.y1), spd(a, 'trot') * 1.2);
    }
    // —— 狗狗和狗狗 ——
    function* scSniff() {      // 凑过去闻一闻
      yield stage(gold);
      var s = dax.x < gold.x ? -1 : 1;
      hold(gold, 'alert'); faceTo(gold, dax.x); gold.wag = 0.6;
      yield go(dax, gold.x + s * (gold.mx + dax.mx + 7), gold.y + ry(1), spd(dax, 'trot'));
      faceTo(dax, gold.x); faceTo(gold, dax.x);
      hold(dax, 'sniff'); hold(gold, 'sniff'); dax.wag = 0.8; gold.wag = 0.8;
      yield 1.6;
      hold(dax, 'stand'); hold(gold, 'stand'); emote('heart', dax);
      yield 0.5;
      hold(dax, 'bow'); dax.wag = 1;
      yield 0.8;
      hold(gold, 'bow'); gold.wag = 1;
      yield 0.9;
      hop(dax, 110);
      yield 0.4;
    }
    function* scChase() {      // 你追我赶
      faceTo(dax, gold.x); faceTo(gold, dax.x);
      hold(dax, 'bow'); dax.wag = 1; dax.bark = 0.5; emote('woof', dax, dax.face * 12, 0.6);
      yield 0.7;
      hold(gold, 'bow'); gold.wag = 1;
      yield 0.6;
      for (var i = 0; i < 3; i++) {
        var p = randPt(70 * SK, dax);
        var c = go(dax, p.x, p.y, spd(dax, 'run') * 0.95);
        follow(gold, dax, 16, ry(2), spd(gold, 'run') * 0.82);
        yield c;
        if (i === 1) { hop(dax, 120); yield 0.25; }
      }
      // 换过来：金毛跑，小腊肠追
      emote('bang', gold, 0, 0.6);
      p = randPt(90 * SK, gold);
      c = go(gold, p.x, p.y, spd(gold, 'run') * 0.9);
      follow(dax, gold, 14, ry(-2), spd(dax, 'run'));
      yield c;
      hold(gold, 'lie'); gold.pant = true;
      yield go(dax, gold.x + gold.face * (gold.mx + dax.mx + 2), gold.y + ry(3), spd(dax, 'trot'));
      hold(dax, 'sit'); dax.pant = true; faceTo(dax, gold.x);
      emote('note', dax);
      yield 2.4;
    }
    function* scCuddle() {     // 挤在一起睡
      yield stage(gold);
      hold(gold, 'lie');
      yield 0.7;
      yield go(dax, gold.x + gold.face * 3, gold.y + ry(3), spd(dax, 'walk') * 1.6);
      dax.face = gold.face; hold(dax, 'lie');
      yield 1.0;
      hold(gold, 'sleep'); hold(dax, 'sleep');
      yield rand(7, 12);
      hold(dax, 'bow'); dax.wag = 0.6;
      yield 0.9;
      hold(gold, 'stand'); gold.wag = 0.7; emote('heart', gold);
      yield 0.7;
    }
    function* scRide() {       // 小腊肠跳到金毛背上
      yield stage(gold);
      hold(gold, 'lie'); gold.wag = 0.5;
      yield 0.6;
      yield go(dax, gold.x - gold.face * 22, gold.y + ry(1), spd(dax, 'trot'));
      faceTo(dax, gold.x); hold(dax, 'bow'); dax.wag = 1;
      yield 0.5;
      hold(dax, 'stand'); hop(dax, 150);
      yield function () { return dax.vz < 0 && dax.z <= 9; };
      var seat = gold.vis.seat;          // 新画法会说"背上哪里能坐"；旧画法按老位置
      dax.x = seat ? gold.x + gold.vis.sx : gold.x - gold.face * 4; dax.y = gold.y + ry(0.5); dax.vx = dax.vy = 0; dax.z = 0; dax.vz = 0; dax.lift = seat ? gold.vis.sy : 8;
      dax.face = gold.face; hold(dax, 'sit'); dax.wag = 1; gold.wag = 0.9; emote('heart', dax);
      yield 2.8;
      dax.lift = 0; hop(dax, 100);
      yield go(dax, gold.x + gold.face * 34, gold.y + ry(3), spd(dax, 'trot'));
      faceTo(dax, gold.x); hold(dax, 'bow'); dax.wag = 1; hold(gold, 'stand');
      yield 0.8;
    }
    function* scLick() {       // 金毛给小腊肠舔毛
      yield stage(dax);
      hold(dax, 'sit'); dax.wag = 0.5;
      var s = gold.x < dax.x ? -1 : 1;
      yield go(gold, dax.x + s * (gold.mx + 6), dax.y + ry(-1), spd(gold, 'walk') * 1.6);
      faceTo(gold, dax.x); faceTo(dax, gold.x);
      hold(gold, 'lick'); gold.wag = 0.8; dax.happy = 1;
      yield 1.5;
      emote('heart', dax); hold(dax, 'roll');
      yield 1.6;
      hold(gold, 'stand'); hold(dax, 'stand'); dax.happy = 0; dax.wag = 0.9;
      yield 0.5;
    }
    // —— 人和狗狗 ——
    function* scBelly() {      // 揉肚子
      var s = person.x < dax.x ? -1 : 1;
      hold(dax, 'sit'); faceTo(dax, person.x); dax.wag = 0.8;
      yield go(person, dax.x + s * pr(19), dax.y + ry(-1), 26);
      person.face = -s; faceTo(dax, person.x);
      hold(dax, 'roll'); dax.happy = 1;
      hold(person, { f: ['p_crouch', 'p_crouch2'], fps: 5 });
      for (var i = 0; i < 3; i++) { emote(i % 2 ? 'hs' : 'heart', dax, rand(-4, 4)); yield 0.8; }
      // 金毛也要
      emote('bang', gold, 0, 0.6);
      yield go(gold, person.x + s * (gold.mx + pr(12)), person.y + ry(1), spd(gold, 'trot') * 1.3);
      faceTo(gold, person.x); hold(gold, 'sit'); gold.wag = 1;
      yield 0.4;
      person.face = s; hold(person, 'p_pat'); gold.happy = 1; emote('heart', gold);
      yield 1.1;
      hold(person, null); hold(dax, 'stand'); dax.happy = 0; gold.happy = 0;
      yield 0.4;
    }
    function* scPaw() {        // 握手
      var s = person.x < gold.x ? -1 : 1;
      hold(gold, 'sit'); faceTo(gold, person.x); gold.wag = 0.7;
      yield go(person, gold.x + s * (gold.mx + pr(13)), gold.y + ry(0), 26);
      person.face = -s; faceTo(gold, person.x);
      hold(person, 'p_crouch2');
      yield 0.5;
      hold(gold, 'paw'); gold.wag = 1;
      yield 0.5;
      emote('spark', gold, gold.face * 12);
      yield 1.1;
      hold(gold, 'sit'); gold.happy = 1; hold(person, { f: ['p_cheer', 'p_cheer2'], fps: 5 }); emote('heart', gold);
      yield 0.9;
      hold(person, null); gold.happy = 0;
      yield 0.3;
    }
    function* scTreat() {      // 发零食
      var d = person.face;
      hold(person, 'p_hold'); person.item = 'bone'; emote('note', person);
      yield all(go(dax, person.x + d * 24, person.y + ry(3), spd(dax, 'run') * 0.8), go(gold, person.x + d * 50, person.y + ry(-2), spd(gold, 'trot') * 1.5));
      faceTo(dax, person.x); faceTo(gold, person.x);
      hold(dax, 'beg'); dax.wag = 1; hold(gold, 'sit'); gold.wag = 1; gold.look = 0.6;
      yield 1.0;
      var list = [dax, gold];
      for (var i = 0; i < 2; i++) {
        var dog = list[i], h = handPos('p_release', d);
        hold(person, 'p_release'); person.item = null;
        toss('bone', h.x, h.z, dog, 0.42, 16);
        yield 0.3;
        hold(person, 'p_follow');
        if (dog === dax) { hold(dax, 'stand'); hop(dax, 125); } else hold(gold, 'alert');
        yield 0.25;
        emote('heart', dog); dog.happy = 1; dog.wag = 1;
        if (dog === dax) hold(dax, 'sit');
        yield 0.7;
        dog.happy = 0;
        if (i === 0) { hold(person, 'p_hold'); person.item = 'bone'; yield 0.5; }
      }
      hold(person, { f: ['p_cheer', 'p_cheer2'], fps: 5 });
      yield 0.8;
      hold(person, null); gold.look = 0;
    }
    function* scSit() {        // 一起坐在草地上发呆
      hold(person, 'p_sit');
      yield 0.6;
      yield go(dax, person.x + person.face * 6, person.y + ry(1), spd(dax, 'walk') * 1.8);
      dax.face = person.face; dax.lift = 3; hold(dax, 'lie'); dax.wag = 0.6; emote('heart', dax);
      yield go(gold, person.x - person.face * (gold.mx + 4), person.y + ry(2), spd(gold, 'walk') * 1.8);
      gold.face = person.face; hold(gold, 'lie'); gold.wag = 0.5;
      for (var i = 0; i < 3; i++) { yield rand(2, 3.2); emote(pick(['note', 'hs', 'heart']), pick([person, dax, gold])); }
      dax.lift = 0; hold(dax, 'stand'); hold(gold, 'stand'); hold(person, null);
      yield 0.5;
    }
    function* scWalk() {       // 散步：小人走在前面，狗狗排队跟着
      emote('note', person);
      follow(dax, person, 22, ry(4), spd(dax, 'run') * 0.75);
      follow(gold, person, 46, ry(-2), spd(gold, 'trot') * 1.5);
      var n = randInt(2, 3);
      for (var i = 0; i < n; i++) {
        var p = randPt(60 * SK, person);
        yield go(person, p.x, p.y, 30);
        yield 0.5;
      }
      hold(dax, 'sit'); hold(gold, 'sit'); faceTo(dax, person.x); faceTo(gold, person.x); dax.wag = 0.8; gold.wag = 0.8;
      hold(person, { f: ['p_wave_a', 'p_wave_b'], fps: 5 });
      yield 1.4;
      hold(person, null);
    }
    function* scPets() {       // 金毛来讨摸，小腊肠吃醋
      var s = gold.x < person.x ? -1 : 1;
      yield go(gold, person.x + s * (gold.mx + pr(12)), person.y + ry(1), spd(gold, 'trot') * 1.2);
      faceTo(gold, person.x); hold(gold, 'sit'); gold.wag = 1;
      person.face = s; hold(person, 'p_pat'); gold.happy = 1; emote('heart', gold);
      yield 1.2;
      emote('bang', dax, 0, 0.6);
      yield go(dax, person.x - s * pr(22), person.y + ry(2), spd(dax, 'run'));
      faceTo(dax, person.x); hold(dax, 'stand');
      for (var i = 0; i < 3; i++) { hop(dax, 105); dax.bark = 0.3; yield 0.42; }
      person.face = -s; gold.happy = 0;
      hold(person, { f: ['p_crouch', 'p_crouch2'], fps: 5 }); hold(dax, 'sit'); dax.happy = 1; dax.wag = 1; emote('heart', dax);
      yield 1.4;
      hold(person, null); dax.happy = 0;
      yield 0.3;
    }
    var SCENES = [
      ['sniff', 3, 'dd', scSniff], ['chase', 3, 'dd', scChase], ['cuddle', 2, 'dd', scCuddle], ['ride', 2, 'dd', scRide], ['lick', 2, 'dd', scLick],
      ['belly', 3, 'pdd', scBelly], ['paw', 3, 'pg', scPaw], ['treat', 3, 'pdd', scTreat], ['sit', 2, 'pdd', scSit], ['walk', 3, 'pdd', scWalk], ['pets', 3, 'pdd', scPets],
    ];
    function dogFree(d) {
      return !d.hidden && !d.carried && !d.scene && (d.st === 'idle' || d.st === 'pose' || d.st === 'walk' || d.st === 'zoom' || d.st === 'spin' || d.st === 'bfly');
    }
    function personFree() {
      return !person.hidden && !person.carried && !person.scene && (person.st === 'idle' || person.st === 'front' || person.st === 'act') && ball.st === 'hand';
    }
    function pickScene(only) {
      if (scene || home.st !== 'out' || play.phase !== 'rest' || sleepyTime()) return false;
      var okD = dogFree(dax) && dogFree(gold), okP = personFree();
      var list = SCENES.filter(function (s) {
        if (only && s[0] !== only) return false;
        if (s[2] === 'dd') return okD;
        if (s[2] === 'pg') return okP && dogFree(gold);
        return okP && okD;
      });
      if ((!only) && gold.energy < 0.45) list = list.filter(function (s) { return s[0] !== 'chase' && s[0] !== 'walk'; });
      if (!list.length) return false;
      var tot = 0, r, i;
      for (i = 0; i < list.length; i++) tot += list[i][1];
      r = Math.random() * tot;
      for (i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) break; }
      var sc = list[Math.min(i, list.length - 1)];
      var who = sc[2] === 'dd' ? [dax, gold] : (sc[2] === 'pg' ? [person, gold] : [person, dax, gold]);
      return startScene(sc[0], who, sc[3]);
    }

    // ------------------------------------------------------------
    //  狗狗自己的日常
    // ------------------------------------------------------------
    function think(d) {
      d.pant = false; d.wag = 0.3; d.happy = 0; d.look = 0;
      if (sleepyTime()) { setPose(d, 'sleep', rand(20, 40)); return; }
      var r = Math.random();
      var idleFor = now - Math.max(lastTouch, play.lastPlay);
      if (d.kind === 'dax') {
        if (r < 0.20) walkTo(d, person.x + rand(-90, 90) * SK, person.y + ry(rand(-30, 30)), rand(26, 60) * SK);
        else if (r < 0.30) { var p = randPt(0); walkTo(d, p.x, p.y, spd(d, 'trot')); }
        else if (r < 0.38) { faceTo(d, person.x); setPose(d, 'bow', rand(1.4, 2.6)); d.wag = 1; }
        else if (r < 0.47) { faceTo(d, person.x); setPose(d, 'sit', rand(3, 6)); d.wag = 0.5; }
        else if (r < 0.54) {   // 满场疯跑
          d.st = 'zoom'; d.t = 0; d.pose = 'stand';
          var a = randPt(80 * SK, d), b = randPt(80 * SK, a);
          d.way = [a, b, a, { x: d.x, y: d.y }];
        }
        else if (r < 0.58) { d.st = 'spin'; d.t = 0; d.pose = 'stand'; d.wag = 0.9; }      // 追自己的尾巴
        else if (r < 0.65) { setPose(d, 'scratch', rand(1.6, 2.6)); }
        else if (r < 0.74) { p = randPt(0); walkTo(d, d.x + clamp(p.x - d.x, -60, 60), d.y + clamp(p.y - d.y, -40, 40), 14 * SK, 'sniff'); }
        else if (r < 0.80) { setPose(d, 'dig', rand(1.8, 2.8)); d.wag = 0.9; }
        else if (r < 0.85) { setPose(d, 'roll', rand(1.8, 3)); }
        else if (r < 0.93 && bfly.on) { d.st = 'bfly'; d.t = 0; d.pose = 'stand'; d.wag = 0.9; emote('bang', d, 0, 0.6); }
        else if (r < 0.96 && idleFor > 40) setPose(d, 'lie', rand(6, 14));
        else if (idleFor > 180 && r < 0.99) setPose(d, 'sleep', rand(25, 60));
        else setPose(d, 'stand', rand(1.2, 3));
      } else {
        if (d.energy < 0.45) { setPose(d, 'lie', rand(8, 14)); d.pant = true; return; }
        if (r < 0.18) { faceTo(d, person.x); setPose(d, 'sit', rand(5, 10)); d.wag = 0.5; }
        else if (r < 0.34) setPose(d, 'lie', rand(8, 18));
        else if (r < 0.52) walkTo(d, person.x + pick([-1, 1]) * rand(28, 60), person.y + ry(rand(-14, 14)), spd(d, 'walk') * 1.3);
        else if (r < 0.60) { p = randPt(0); walkTo(d, p.x, p.y, spd(d, 'walk') * 1.3); }
        else if (r < 0.66) setPose(d, 'scratch', rand(1.8, 2.8));
        else if (r < 0.75) { p = randPt(0); walkTo(d, d.x + clamp(p.x - d.x, -50, 50), d.y + clamp(p.y - d.y, -30, 30), 12 * SK, 'sniff'); }
        else if (r < 0.80) setPose(d, 'roll', rand(2, 3.2));
        else if (r < 0.86 && bfly.on) { d.look = 0.6; faceTo(d, bfly.x); setPose(d, 'sit', rand(3, 5)); d.wag = 0.6; }
        else if (idleFor > 120 && r < 0.95) setPose(d, 'sleep', rand(30, 80));
        else { setPose(d, 'stand', rand(2, 4)); d.wag = 0.5; }
      }
    }

    // 站在小人 / 另一只狗的正后方会被挡住（看起来像骑在人家头上）：返回挡住它的那个
    function blocker(d) {
      if (!person.hidden && !person.carried && Math.abs(d.x - person.x) < d.half * 0.7 + P_HALF - 1 && d.y <= person.y && d.y > person.y - (P_H - 1)) return person;
      var o = other(d);
      if (!o.hidden && !o.carried && !o.scene && o.z === 0 && Math.abs(d.x - o.x) < o.half * 0.75 &&
          (d.y < o.y || (d.y === o.y && d === dax)) && d.y > o.y - 13) return o;
      return null;
    }
    function sidestep(d, b) {
      var s = d.x >= b.x ? 1 : -1, gap = (b.isPerson ? P_HALF + 1 : b.half) + d.half + rand(6, 14);
      var tx = b.x + s * gap;
      if (tx < F.x0 + d.half + 4 || tx > F.x1 - d.half - 4) tx = b.x - s * gap;
      walkTo(d, tx, b.y + ry(rand(1, 7)), spd(d, 'trot'));
    }

    function grab(d) {
      var o = other(d);
      ball.vx = ball.vy = ball.vz = 0;
      haptic('light');
      // 另一只也到了嘴边 → 拔河
      if (o.st === 'chase' && hyp(o.x - d.x, o.y - d.y) < 30 && Math.random() < 0.6 && d.z < 2) {
        ball.st = 'tug'; ball.holder = d; ball.other = o; ball.tugEnd = now + rand(1.3, 2.1);
        ball.x = mouthX(d); ball.y = d.y; ball.z = BALL_R + 2;
        d.st = 'tug'; d.t = 0; d.pose = 'tug'; d.wag = 0.9;
        o.st = 'tugGo'; o.t = 0; o.pose = 'stand'; o.wag = 0.9;
        play.phase = 'back'; play.fetcher = d;
        emote('bang', o, 0, 0.6);
        return;
      }
      if (d.z > 3 && (person.st === 'idle' || person.st === 'follow')) { personAct({ f: ['p_cheer', 'p_cheer2'], fps: 6 }, 0.8); emote('spark', d); }
      carry(d);
    }
    function carry(d) {
      ball.st = 'mouth'; ball.holder = d; ball.other = null;
      play.phase = 'back'; play.fetcher = d;
      d.st = 'return'; d.t = 0; d.pose = 'stand'; d.wag = 0.9;
      if (d.kind === 'gold') d.energy = Math.max(0, d.energy - 0.2);
      dogs.forEach(function (o) {
        if (o !== d && (o.st === 'chase' || o.st === 'alert' || o.st === 'tug' || o.st === 'tugGo')) { o.st = 'follow'; o.t = 0; o.pose = 'stand'; }
      });
      if (person.st === 'walk') personIdle();
    }
    // 球刚被丢出去：醒着的狗都去追
    function onBallFree() {
      ball.freeT = 0;
      endScene(true);
      dogs.forEach(function (d) {
        if (!awake(d) || d.hidden || d.carried) return;
        if (d.kind === 'gold' && d.energy < 0.3) {   // 金毛累了，趴着看
          if (!(d.st === 'pose' && d.pose === 'lie')) setPose(d, 'lie', 12);
          d.pant = true; d.wag = 0.6;
          return;
        }
        d.st = 'alert'; d.t = 0; d.pose = 'alert'; d.wag = 0.9; d.pant = false; d.happy = 0;
        d.react = d.kind === 'dax' ? rand(0.04, 0.16) : rand(0.22, 0.5);
      });
      if (awake(dax) && !dax.hidden) emote('bang', dax, 0, 0.7);
    }
    function landing() {
      var disc = ball.vz * ball.vz + 2 * GRAV * Math.max(0, ball.z - BALL_R);
      var t = (ball.vz + Math.sqrt(disc)) / GRAV;
      return { x: clamp(ball.x + ball.vx * t * 1.12, F.x0 + BALL_R + 2, F.x1 - BALL_R - 2), y: clamp(ball.y + ball.vy * t * 1.12, F.y0, F.y1) };
    }

    function updateDog(d, dt) {
      var K = d.K;
      d.t += dt;
      if (d.hype > 0) { d.hype -= dt; if (d.hype <= 0) { d.happy = 0; } }
      if (d.bark > 0) d.bark -= dt;
      if (d.land > 0) d.land = Math.max(0, d.land - dt * 4);
      // 跳
      if (d.z > 0) {
        d.vz -= GRAV * 1.5 * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; d.vz = 0; d.land = 1; if (!d.hidden) puff(d.x, d.y, false); }
      }
      // 金毛体力
      if (d.kind === 'gold' && d.st !== 'chase') {
        d.energy = Math.min(1, d.energy + dt * (d.pose === 'lie' || d.pose === 'sleep' ? 0.03 : 0.012));
      }
      if (d.hidden) { d.vx = d.vy = 0; d.sp = 0; d.pose = 'sleep'; return; }

      if (d.carried) {
        d.vx = d.vy = 0;
      } else if (d.scene) {
        var c = d.cmd;
        if (c && c.k === 'go') { d.pose = c.pose; if (drive(d, c.x, c.y, c.spd, dt)) c.done = true; }
        else if (c && c.k === 'follow') {
          d.pose = 'stand';
          drive(d, c.target.x - c.target.face * c.back, c.target.y + c.dy, c.spd, dt);
        } else coast(d, dt);
        if (d.pose === 'sleep' && now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * 8, 1.8); d.zAt = now + 1.7; }
        if (d.pose === 'dig' && Math.random() < dt * 14) bits(d.x + d.face * 10, d.y - 1, 1, ['#8a6a4a', '#6f5238', '#a98a62'], 26, 60);
      } else switch (d.st) {
        case 'idle':
          coast(d, dt);
          think(d);
          break;

        case 'pose':
          coast(d, dt);
          if (d.pose === 'sleep') {
            if (now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * 8, 1.8); d.zAt = now + 1.7; }
            if (d.t > d.dur) { if (sleepyTime()) d.t = 0; else think(d); }
          } else {
            if (d.pose === 'dig' && Math.random() < dt * 14) bits(d.x + d.face * 10, d.y - 1, 1, ['#8a6a4a', '#6f5238', '#a98a62'], 26, 60);
            if (d.pose === 'roll' && opt.grass && Math.random() < dt * 6) bits(d.x + rand(-8, 8), d.y - 2, 1, grassBits(), 18, 40);
            var blk = (d.t > 0.5 && d.z === 0 && now > d.sideAt) ? blocker(d) : null;
            if (blk) { d.sideAt = now + 2.5; sidestep(d, blk); break; }
            if (d.t > d.dur) think(d);
          }
          break;

        case 'walk':
          if (drive(d, d.tx, d.ty, d.spd, dt) || d.t > 14) think(d);
          break;

        case 'zoom':
          d.pant = true;
          if (!d.way || !d.way.length || d.t > 12) { think(d); break; }
          if (drive(d, d.way[0].x, d.way[0].y, spd(d, 'run'), dt)) d.way.shift();
          break;

        case 'spin':
          coast(d, dt);
          d.face = (Math.floor(d.t * 9) % 2) ? 1 : -1;
          if (d.t > 1.3) { setPose(d, 'sit', rand(1.5, 3)); d.wag = 0.8; emote('q', d, 0, 0.8); }
          break;

        case 'bfly': {   // 追蝴蝶
          if (!bfly.on || d.t > 9) { setPose(d, 'sit', rand(1.5, 3)); d.pant = true; break; }
          var by = opt.roam ? clamp(bfly.y + 16, F.y0, F.y1) : d.y;
          drive(d, bfly.x - sgn(bfly.x - d.x) * 6, by, spd(d, 'run') * 0.8, dt);
          d.look = 0.8;
          if (hyp(bfly.x - d.x, (bfly.y + 16) - d.y) < 20 && d.z === 0 && now > d.hopAt) {
            hop(d, 150); d.hopAt = now + rand(0.7, 1.2); d.bark = 0.25;
            bfly.vx += sgn(bfly.x - d.x || 1) * 50; bfly.vy -= 40; bfly.tx = rand(F.x0 + 20, F.x1 - 20); bfly.ty = rand(Math.max(12, F.y0 - 40), F.y1 - 30);
          }
          break;
        }

        case 'alert':
          coast(d, dt);
          faceTo(d, ball.x);
          d.look = clamp(ball.z / 40, 0, 1);
          if (d.t >= d.react) { d.st = 'chase'; d.t = 0; d.pose = 'stand'; }
          break;

        case 'chase': {
          if (ball.st !== 'free') { d.st = (ball.st === 'mouth' || ball.st === 'tug') ? 'follow' : 'wait'; d.t = 0; break; }
          var tgt = ball.z > 14 ? landing() : { x: ball.x + ball.vx * 0.12, y: ball.y + ball.vy * 0.12 };
          var dir = tgt.x > d.x + 0.5 ? 1 : (tgt.x < d.x - 0.5 ? -1 : d.face);
          var there = drive(d, tgt.x - dir * (d.mx - 2), tgt.y, spd(d, 'run'), dt);
          // 从正上方 / 正下方跑过来时身体不会自己转向：到了球边上要把头转向球，不然永远叼不到
          if (there || hyp(d.vx, d.vy) < 24 * SK) { if (Math.abs(ball.x - d.x) > 1) d.face = ball.x > d.x ? 1 : -1; }
          d.stall = (there && ball.z <= BALL_R + 1) ? (d.stall || 0) + dt : 0;
          if (d.stall > 0.5 && hyp(d.x - ball.x, d.y - ball.y) < d.mx + 14) { d.stall = 0; grab(d); break; }
          d.look = clamp(ball.z / 36, 0, 1); d.pant = true;
          // 小腊肠会跳起来接
          if (d.kind === 'dax' && d.z === 0 && ball.vz < 0 && ball.z > 12 && ball.z < 30 && hyp(mouthX(d) - ball.x, d.y - ball.y) < 18) hop(d, 165);
          if (hyp(mouthX(d) - ball.x, d.y - ball.y) < K.grab && ball.z <= d.z + K.reach) grab(d);
          break;
        }

        case 'tugGo': {   // 跑到球的另一边去抢
          var h = ball.holder;
          if (ball.st !== 'tug' || !h) { d.st = 'follow'; d.t = 0; break; }
          var gx = ball.x + h.face * (d.mx - 1);
          if (drive(d, gx, h.y, spd(d, 'run'), dt) || d.t > 0.9) { d.x = clamp(gx, F.x0 + d.half, F.x1 - d.half); d.y = h.y; d.vx = d.vy = 0; d.face = -h.face; d.st = 'tug'; d.pose = 'tug'; d.t = 0; }
          break;
        }
        case 'tug':
          d.vx = d.vy = 0;
          if (ball.st !== 'tug') { d.st = 'wait'; d.t = 0; d.pose = 'stand'; break; }
          if (now >= ball.tugEnd && ball.holder === d) {
            var o = ball.other, win = (o && o.st === 'tug' && Math.random() < 0.4) ? o : d, lose = win === d ? o : d;
            if (lose) { emote('sweat', lose, 0, 0.8); }
            emote('spark', win, win.face * 10, 0.6);
            carry(win);
          }
          break;

        case 'return': {
          if (ball.st !== 'mouth' || ball.holder !== d) { d.st = 'wait'; d.t = 0; break; }
          var side = sgn(d.x - person.x);
          if (drive(d, person.x + side * (d.mx + pr(9)), person.y + ry(1), spd(d, 'back'), dt) || d.t > 12) { d.face = -side; handover(d); }
          break;
        }

        case 'follow': {
          var f = play.fetcher;
          if (!f || (ball.st !== 'mouth' && ball.st !== 'tug')) { d.st = 'wait'; d.t = 0; break; }
          drive(d, f.x - f.face * (f.half + d.half * 0.6), f.y + ry(d === dax ? 5 : -4), d.kind === 'dax' ? spd(d, 'run') : spd(d, 'trot') * 1.5, dt);
          if (d.kind === 'dax' && d.z === 0 && Math.random() < dt * 1.6) hop(d, 105);
          break;
        }

        case 'fooled': {  // 被假动作骗了
          if (d.t < 0.55) drive(d, d.tx, d.ty, spd(d, 'run'), dt);
          else { coast(d, dt); if (!d.qd) { d.qd = true; emote('q', d, 0, 1.0); faceTo(d, person.x); d.pose = 'sit'; } }
          if (d.t > 1.7) { d.qd = false; d.st = 'wait'; d.t = 0; d.pose = 'stand'; }
          break;
        }

        case 'wait': {   // 围在小人旁边等他丢
          if (play.phase === 'rest' && d.t > 2.2) { think(d); break; }
          var sd2 = d === dax ? person.face : -person.face;
          if (drive(d, person.x + sd2 * (d === dax ? 30 : 42), person.y + ry(d === dax ? 5 : -3), spd(d, 'trot') * 1.4, dt)) {
            faceTo(d, person.x);
            d.pose = d.kind === 'dax' ? ((Math.floor(d.t * 0.7) % 2) ? 'bow' : 'stand') : ((Math.floor(d.t * 0.4) % 3 === 2) ? 'bow' : 'sit');
            if (d.kind === 'dax' && Math.random() < dt * 0.9) hop(d, 95);
            d.look = 0.5;
          } else d.pose = 'stand';
          d.wag = 1;
          break;
        }

        case 'beg': {   // 球被她拿在手里晃
          if (ball.st !== 'drag') { d.st = 'wait'; d.t = 0; break; }
          if (hyp(ball.x - d.x, ball.y - d.y) > d.mx + 8) drive(d, ball.x - sgn(ball.x - d.x) * (d.mx - 4), ball.y, spd(d, 'run') * 0.9, dt);
          else { coast(d, dt); faceTo(d, ball.x); }
          d.pose = 'stand'; d.wag = 1; d.look = clamp((ball.z + (d.y - ball.y)) / 30, 0, 1);
          if (d.z === 0 && now > d.hopAt && hyp(ball.x - d.x, ball.y - d.y) < 36 && d.kind === 'dax') {
            hop(d, rand(120, 170)); d.hopAt = now + rand(0.5, 1.3);
          }
          break;
        }

        case 'come': {  // 被叫过去
          if (drive(d, d.tx, d.ty, spd(d, d.kind === 'dax' ? 'run' : 'trot') * (d.kind === 'dax' ? 0.9 : 1.6), dt) || d.t > 6) { setPose(d, 'sit', rand(2, 4)); d.wag = 1; emote('heart', d); }
          break;
        }

        case 'home': {  // 回岛
          var ip = islandPt(), tx = ip.x + (d === dax ? 14 : -18);
          if (d.t < d.react) { coast(d, dt); break; }
          if (!d.hq && (drive(d, tx, ip.y, spd(d, 'run') * 0.9, dt) || d.t > 9)) { d.hq = true; d.vx = d.vy = 0; hop(d, 190); d.t = 0; }
          else if (d.hq && (d.t > 0.22)) { d.hq = false; d.hidden = true; d.z = 0; d.vz = 0; puff(d.x, d.y - 20, true); emoteAt('spark', d.x, d.y - 30, 0.5); }
          break;
        }
      }

      // 鼠标靠近：看过来、摇尾巴；小腊肠会蹦一下
      d.near = false;
      if (pointer.inside && !pointer.drag && !pointer.grab && !d.scene && !d.carried && awake(d) && (d.st === 'pose' || d.st === 'idle') && d.pose !== 'lie' && d.pose !== 'roll') {
        var px = pointer.x, near = hyp(px - d.x, (pointer.y - (d.y - 12)) * 1.2) < 46;
        d.near = near;
        if (near) {
          faceTo(d, px); d.wag = Math.max(d.wag, 0.8); d.look = clamp((d.y - 14 - pointer.y) / 30, -0.6, 1);
          if (d.kind === 'dax' && d.z === 0 && now > d.hopAt && Math.abs(px - d.x) < 24) { hop(d, 110); d.hopAt = now + rand(1.4, 3); }
        }
      }

      d.sp = d.st === 'tug' ? 0 : hyp(d.vx, d.vy);
      // 跑起来脚下扬起的灰
      if (d.z === 0 && d.sp > 95 * SK && now > d.dustAt) { puff(d.x - d.face * d.half * 0.6, d.y, false); d.dustAt = now + 0.13; }
      if (d.lastSp - d.sp > 70 * SK && d.z === 0) puff(d.x + d.face * 6, d.y, true);     // 急刹车
      d.lastSp = d.sp;
    }

    // 告诉狗的骨架"现在是什么状态"（每一步都要给，骨架自己会平滑过渡）
    function rigInput(d, dt) {
      var I = d.ri, pose = d.pose === 'sniffwalk' ? 'sniff' : d.pose;
      I.pose = d.carried ? 'air' : pose;
      I.speed = d.sp;
      I.air = (d.z > 1.5 || d.carried) ? 1 : 0;
      I.wag = d.carried ? 0.1 : d.wag;
      I.pant = d.pant || d.sp > 110 * SK;
      I.carry = (ball.st === 'mouth' || ball.st === 'tug') && ball.holder === d;
      I.look = d.look;
      I.happy = d.happy > 0;
      I.shake = d.st === 'tug' ? 1 : 0;
      I.bark = d.bark > 0;
      // 第三版新加的几样（旧的画法用不到）
      I.vx = d.vx; I.vy = d.vy; I.vz = d.z > 0 ? d.vz : 0;
      I.accel = dt > 0 ? (d.sp - d.rSp) / dt : 0;
      I.landing = d.land;
      I.turn = d.face !== d.rFace;
      I.sleepy = sleepyTime() ? 1 : clamp((now - Math.max(lastTouch, play.lastPlay) - 40) / 140, 0, 0.7);
      // 眼睛盯着什么：球、蝴蝶、或者凑过来的鼠标（相对脚下的位置：往前多远、多高）
      var L = d.la;
      if (d.hidden) L = null;
      else if (ball.st === 'free' || ball.st === 'drag' || d.st === 'wait') { L = L || [0, 0]; L[0] = ball.x - d.x; L[1] = d.y - ball.y + ball.z; }
      else if (bfly.on && (d.st === 'bfly' || (d.st === 'pose' && d.look > 0.5))) { L = L || [0, 0]; L[0] = bfly.x - d.x; L[1] = d.y - bfly.y; }
      else if (d.near) { L = L || [0, 0]; L[0] = pointer.x - d.x; L[1] = d.y - pointer.y; }
      else L = null;
      I.lookAt = L; if (L) d.la = L;
      d.rSp = d.sp; d.rFace = d.face;
      if (Math.abs(d.look - d.rLook) > 0.02) { d.rLook = d.look; d.vis.hot = now + 0.5; }     // 头在转：这阵子画勤一点
      return I;
    }

    // ------------------------------------------------------------
    //  小人
    // ------------------------------------------------------------
    function personIdle() { person.st = 'idle'; person.t = 0; person.act = null; }
    function personFront(dur) { person.st = 'front'; person.t = 0; person.dur = dur; }
    function personAct(spr, dur) { person.st = 'act'; person.t = 0; person.dur = dur; person.act = spr; }
    function personWave(text) {
      person.st = 'wave'; person.t = 0; person.waveCd = now + 25;
      if (text) say(text);
    }
    function personThink() {
      var r = Math.random();
      person.next = now + rand(5, 11);
      if (CFG.messages && CFG.messages.length && now >= person.msgAt) {
        person.msgAt = now + range(CFG.messageMinutes, 40) * 60;
        personWave(String(pick(CFG.messages)));
        return;
      }
      if (r < 0.20) {
        var p = randPt(30 * SK, person);
        person.st = 'walk'; person.t = 0;
        person.tx = clamp(person.x + clamp(p.x - person.x, -110 * SK, 110 * SK), F.x0 + (F.x1 - F.x0) * 0.12, F.x0 + (F.x1 - F.x0) * 0.88);
        person.ty = clamp(person.y + clamp(p.y - person.y, -60, 60), F.y0, F.y1);
      }
      else if (r < 0.32) personFront(rand(2.2, 4));
      else if (r < 0.42) personAct({ f: ['p_tie_a', 'p_tie_b'], fps: 3 }, 1.7);      // 整理领带
      else if (r < 0.50) personAct('p_watch', 1.5);                                   // 看手表
      else if (r < 0.56) personAct({ f: ['p_cheer', 'p_cheer2'], fps: 2 }, 1.2);     // 伸个懒腰
    }
    function throwDir() { return person.x < (F.x0 + F.x1) / 2 ? 1 : -1; }

    function startSession(n, target) {
      endScene(true);
      play.rounds = n; play.phase = 'ready'; play.throwAt = now + rand(0.9, 1.6); play.faked = false; play.target = target || null;
      if (person.st !== 'idle') personIdle();
      person.face = target ? sgn(target.x - person.x) : throwDir();
      wake(dax, true);
      if (gold.energy > 0.3) wake(gold, true);
      dogs.forEach(function (d) {
        if (!awake(d) || d.hidden || d.carried) return;
        if (d.kind === 'gold' && d.energy < 0.3) return;
        d.st = 'wait'; d.t = 0; d.pose = 'stand';
      });
    }
    function personThrow() {
      // 偶尔做个假动作逗小腊肠
      if (!play.faked && !play.target && Math.random() < 0.16 && awake(dax) && !dax.hidden && dax.st === 'wait') {
        play.faked = true;
        person.st = 'fake'; person.t = 0; person.face = throwDir();
        return;
      }
      person.st = 'windup'; person.t = 0;
      person.face = play.target ? sgn(play.target.x - person.x) : throwDir();
    }
    function doLaunch() {
      var dir = person.face, h = handPos('p_release', dir);
      var tx, ty;
      if (play.target) { tx = play.target.x; ty = play.target.y; play.target = null; }
      else if (opt.roam) {
        var best = null;
        for (var i = 0; i < 10; i++) {
          var p = randPt(0), dd = hyp(p.x - person.x, p.y - person.y);
          if (sgn(p.x - person.x) === dir && dd > 50 * SK && dd < 230 * SK) { best = p; break; }
        }
        if (!best) best = { x: clamp(person.x + dir * 90 * SK, F.x0 + 20, F.x1 - 20), y: clamp(person.y + rand(-30, 30), F.y0, F.y1) };
        tx = best.x; ty = best.y;
      } else {
        var room = (dir > 0 ? F.x1 - person.x : person.x - F.x0) - 24;
        tx = person.x + dir * Math.max(40, room * rand(0.32, 0.74)); ty = person.y;
      }
      var dist = hyp(tx - h.x, ty - person.y);
      var tMax = Math.sqrt(8 * Math.max(30, Math.min(LH - 34, 120)) / GRAV);
      var T = clamp(dist / (170 * SK) + rand(0.35, 0.55), 0.55, tMax);
      ball.st = 'free'; ball.holder = null;
      ball.x = clamp(h.x, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = person.y; ball.z = h.z;
      ball.vx = (tx - ball.x) / T / 1.12; ball.vy = (ty - ball.y) / T / 1.12;
      ball.vz = GRAV * T / 2 - (ball.z - BALL_R) / T;
      play.phase = 'fly'; play.rounds = Math.max(0, play.rounds - 1);
      play.lastPlay = now;
      haptic('light');
      onBallFree();
    }
    // 狗把球叼回来了
    function handover(d) {
      person.face = sgn(d.x - person.x);
      person.st = 'pat'; person.t = 0; person.giveTo = d;
      person.patSpr = (d.kind === 'dax' && Math.random() < 0.55) ? { f: ['p_crouch', 'p_crouch2'], fps: 6 } : 'p_pat';
      d.st = 'wait'; d.t = 0; d.pose = 'sit'; d.wag = 1; d.happy = 1; d.hype = 1.2;
      emote('heart', d, d.face * 6);
      ball.st = 'handing'; ball.holder = null;
      ball.x = mouthX(d); ball.y = d.y; ball.z = BALL_R;
      play.lastPlay = now;
      bump('fetch');
      if (play.rounds > 0 && !sleepyTime()) { play.phase = 'ready'; play.throwAt = now + rand(1.5, 2.9); }
      else { play.phase = 'rest'; play.nextAt = now + range(CFG.autoPlaySeconds, 60); person.next = now + rand(3, 6); nextSceneAt = Math.max(nextSceneAt, now + rand(4, 8)); }
    }

    function movePerson(tx, ty, speed, dt) {
      var p = person;
      if (PY0 > F.y0 && ty < PY0) ty = PY0;
      var dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      if (d < 1.4) { p.moving = false; return true; }
      var st = Math.min(d, speed * SK * dt);
      p.x = clamp(p.x + dx / d * st, F.x0 + P_HALF + 1, F.x1 - P_HALF - 1); p.y = clamp(p.y + dy / d * st * (Math.abs(dy) > Math.abs(dx) ? 0.85 : 1), PY0, F.y1);
      if (Math.abs(dx) > 1.5) p.face = sgn(dx);
      p.anim += dt * (speed > 40 ? 9 : 6.5);
      p.moving = true; p.spd = speed;
      return false;
    }
    function updatePerson(dt) {
      var p = person;
      p.t += dt;
      p.moving = false;
      if (p.z > 0) { p.vz -= GRAV * 1.5 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; puff(p.x, p.y, false); } }
      if (ball.st === 'handing' && (p.st !== 'pat' || p.hidden || p.carried)) { ball.st = 'hand'; ball.holder = null; p.giveTo = null; }
      if (p.hidden || p.carried) return;
      if (p.scene) {
        var c = p.cmd;
        if (c && c.k === 'go') { if (movePerson(c.x, c.y, c.spd, dt)) c.done = true; }
        return;
      }
      switch (p.st) {
        case 'idle':
          if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'mouth' || ball.st === 'tug') {
            var bx = (ball.st === 'mouth' || ball.st === 'tug') && ball.holder ? ball.holder.x : ball.x;
            if (Math.abs(bx - p.x) > 6) p.face = bx > p.x ? 1 : -1;
          }
          if (sleepyTime() && play.phase === 'rest' && home.st === 'out') {
            // 夜深了：有岛就回岛里睡（天亮自己出来）；没有岛就原地睡
            if (islandOn() && opt.roam) { home.auto = true; home.inAt = now; goHome(); } else { p.st = 'sleep'; p.t = 0; }
            break;
          }
          if (play.phase === 'rest' && now >= p.next) personThink();
          break;
        case 'walk':
          if (play.phase !== 'rest') { personIdle(); break; }
          if (movePerson(p.tx, p.ty, 24, dt) || p.t > 12) personIdle();
          break;
        case 'windup':
          if (p.t >= 0.4) { p.st = 'release'; p.t = 0; doLaunch(); }
          break;
        case 'release':
          if (p.t >= 0.15) { p.st = 'follow'; p.t = 0; }
          break;
        case 'follow':
          if (p.t >= 0.34) personIdle();
          break;
        case 'fake':     // 假动作：挥了手，球还在手里
          if (p.t >= 0.4 && !p.fk) {
            p.fk = true;
            if (awake(dax) && !dax.hidden && !dax.carried) {
              dax.st = 'fooled'; dax.t = 0; dax.pose = 'stand'; dax.qd = false;
              dax.tx = dax.x + p.face * 70 * SK; dax.ty = dax.y;
            }
          }
          if (p.t >= 1.9) { p.fk = false; personAct({ f: ['p_cheer', 'p_cheer2'], fps: 7 }, 0.7); play.throwAt = now + 1.3; }
          break;
        case 'pat':
          if (p.t >= 0.85) {
            if (ball.st === 'handing') { ball.st = 'hand'; ball.holder = null; }
            p.giveTo = null;
            personIdle();
            if (play.phase === 'ready') p.face = throwDir();
          }
          break;
        case 'act':
          if (p.t >= p.dur) personIdle();
          break;
        case 'front':
          if (p.t >= p.dur || play.phase !== 'rest') personIdle();
          break;
        case 'wave':
          if (p.t >= 2.0) { if (play.phase === 'rest') personFront(1.2); else personIdle(); }
          break;
        case 'sleep':
          if (now > p.zAt) { emote('z', p, 6, 1.8); p.zAt = now + 2.1; }
          if (!sleepyTime()) personIdle();
          break;
        case 'come':
          if (movePerson(p.tx, p.ty, 46, dt) || p.t > 8) personWave();
          break;
        case 'home': {
          var ip = islandPt();
          if (p.t < 0.1) break;
          if (!p.hq && (movePerson(ip.x, ip.y, 62, dt) || p.t > 12)) { p.hq = true; p.vz = 190; p.z = 0.01; p.t = 0; }
          else if (p.hq && p.t > 0.22) { p.hq = false; p.hidden = true; p.z = 0; p.vz = 0; puff(p.x, p.y - 20, true); emoteAt('spark', p.x, p.y - 30, 0.5); }
          break;
        }
      }
      // 鼠标停在他身上一会儿：转过来挥挥手
      if (pointer.inside && !pointer.drag && !pointer.grab && p.box && (p.st === 'idle' || p.st === 'front') && play.phase === 'rest') {
        var over = pointer.x > p.box[0] - 3 && pointer.x < p.box[2] + 3 && pointer.y > p.box[1] - 3 && pointer.y < p.box[3] + 2;
        p.hoverT = over ? p.hoverT + dt : 0;
        if (p.hoverT > 0.45 && now > p.waveCd) { p.hoverT = 0; personWave(); }
      } else p.hoverT = 0;
    }
    function frameOf(spec, t) {
      if (!spec) return null;
      if (typeof spec === 'string') return spec;
      return spec.f[Math.floor(t * (spec.fps || 4)) % spec.f.length];
    }
    // 小人现在该是哪个画面（旧画法直接画这一张；新画法把它当作"要摆成的姿势"）
    function personSprite() {
      var p = person, breath = Math.floor(now / 0.85) % 2, blink = (now % 4.3) < 0.14;
      if (p.carried) return (Math.floor(now * 6) % 2) ? 'p_cheer' : 'p_cheer2';
      if (p.moving) return 'p_walk' + (Math.floor(p.anim) % 4);
      if (p.scene) {
        var f = frameOf(p.spr, now);
        if (f) return f;
        return (ball.st === 'hand' && !p.item) ? (breath ? 'p_hold2' : 'p_hold') : (blink ? 'p_blink' : (breath ? 'p_idle2' : 'p_idle'));
      }
      switch (p.st) {
        case 'windup': return 'p_windup';
        case 'release': return 'p_release';
        case 'follow': return 'p_follow';
        case 'fake': return p.t < 0.4 ? 'p_windup' : (p.t < 0.6 ? 'p_release' : (breath ? 'p_hold2' : 'p_hold'));
        case 'pat': return frameOf(p.patSpr || 'p_pat', p.t);
        case 'act': return frameOf(p.act, p.t) || 'p_idle';
        case 'front': return blink ? 'p_front_blink' : (breath ? 'p_front2' : 'p_front');
        case 'wave': return (Math.floor(p.t * 5) % 2) ? 'p_wave_a' : 'p_wave_b';
        case 'sleep': return 'p_front_blink';
        default:
          if (ball.st === 'hand') return breath ? 'p_hold2' : 'p_hold';
          return blink ? 'p_blink' : (breath ? 'p_idle2' : 'p_idle');
      }
    }
    function personFace() {
      var p = person;
      return (p.st === 'front' || p.st === 'wave' || p.st === 'sleep') && !p.scene && !p.carried ? 1 : p.face;
    }
    // 告诉小人的骨架"现在是什么状态"
    function personInput() {
      var p = person, I = p.ri;
      I.frame = p.hidden ? 'p_sit' : personSprite();          // 在岛里：坐在两只睡着的狗狗中间守着
      I.moving = p.moving && !p.hidden;
      I.speed = I.moving ? p.spd * SK : 0;
      I.t = p.scene ? now - p.sprAt : p.t;
      I.carried = p.carried;
      I.air = p.z > 1.5 ? 1 : 0;
      I.holding = p.hidden ? null : (p.item ? p.item : (ball.st === 'hand' ? 'ball' : null));
      // 眼睛看哪里（相对脚下：往旁边多远、多高）：球在外面就跟着球；正在摸的那只狗；凑过来的鼠标
      var L = p.la, g = p.giveTo;
      if (p.hidden) L = null;
      else if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'mouth' || ball.st === 'tug') { L = L || [0, 0]; L[0] = ball.x - p.x; L[1] = (p.y - ball.y) + ball.z; }
      else if (g && g.mouthX !== undefined) { L = L || [0, 0]; L[0] = g.mouthX - p.x; L[1] = p.y - g.mouthY; }
      else if (pointer.inside && !p.scene && hyp(pointer.x - p.x, pointer.y - (p.y - P_H * 0.6)) < 70) { L = L || [0, 0]; L[0] = pointer.x - p.x; L[1] = p.y - pointer.y; }
      else L = null;
      I.look = L; if (L) p.la = L;
      return I;
    }

    // ------------------------------------------------------------
    //  小球
    // ------------------------------------------------------------
    function updateBall(dt) {
      if (ball.sq > 0) ball.sq -= dt;
      if (ball.st !== 'free') return;
      ball.freeT += dt;
      ball.vz -= GRAV * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.z += ball.vz * dt;
      if (ball.x < F.x0 + BALL_R) { ball.x = F.x0 + BALL_R; ball.vx = Math.abs(ball.vx) * 0.6; }
      if (ball.x > F.x1 - BALL_R) { ball.x = F.x1 - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.6; }
      if (ball.y < F.y0) { ball.y = F.y0; ball.vy = Math.abs(ball.vy) * 0.6; }
      if (ball.y > F.y1) { ball.y = F.y1; ball.vy = -Math.abs(ball.vy) * 0.6; }
      if (ball.z <= BALL_R) {
        ball.z = BALL_R;
        if (ball.vz < -45) {
          if (ball.vz < -150) { ball.sq = 0.07; puff(ball.x, ball.y, false); haptic('soft'); }
          ball.vz = -ball.vz * 0.52; ball.vx *= 0.74; ball.vy *= 0.74;
        } else {
          ball.vz = 0;
          var k = Math.exp(-2.4 * dt); ball.vx *= k; ball.vy *= k;
          if (hyp(ball.vx, ball.vy) < 3) { ball.vx = 0; ball.vy = 0; }
        }
      }
      ball.rot += (ball.vx + ball.vy * 0.5) * dt * 0.16;
      // 保险：球落地好一阵子都没狗去捡 → 叫醒小腊肠
      if (ball.freeT > 5 && ball.vx === 0 && ball.vy === 0 && home.st === 'out' && !dogs.some(function (d) { return d.st === 'chase' || d.st === 'alert'; })) {
        wake(dax); if (!dax.carried && !dax.hidden) { dax.st = 'chase'; dax.t = 0; dax.pose = 'stand'; } ball.freeT = 0;
      }
    }

    // ------------------------------------------------------------
    //  蝴蝶（白天偶尔飞来一只；小腊肠爱追）
    // ------------------------------------------------------------
    function updateBfly(dt) {
      var b = bfly;
      if (!b.on) {
        if (now >= b.nextAt && home.st === 'out' && dayPhase() !== 'night' && !isNight()) {
          b.on = true; b.color = Math.random() < 0.5 ? 0 : 1; b.until = now + rand(28, 50);
          b.x = Math.random() < 0.5 ? F.x0 - 6 : F.x1 + 6; b.y = rand(Math.max(10, F.y0 - 40), Math.max(20, F.y1 - 30));
          b.tx = rand(F.x0 + 30, F.x1 - 30); b.ty = rand(Math.max(12, F.y0 - 40), Math.max(20, F.y1 - 26)); b.vx = b.vy = 0; b.t = 0;
        }
        return;
      }
      b.t += dt;
      if (now > b.until) { b.tx = b.x < LW / 2 ? F.x0 - 20 : F.x1 + 20; b.ty = b.y - 20; if (b.x < F.x0 - 10 || b.x > F.x1 + 10) { b.on = false; b.nextAt = now + rand(60, 150); return; } }
      else if (hyp(b.tx - b.x, b.ty - b.y) < 6 || Math.random() < dt * 0.35) {
        b.tx = rand(F.x0 + 20, F.x1 - 20); b.ty = rand(Math.max(12, F.y0 - 44), Math.max(20, F.y1 - 24));
      }
      var dx = b.tx - b.x, dy = b.ty - b.y, d = hyp(dx, dy) || 1;
      b.vx += (dx / d * 26 - b.vx) * Math.min(1, dt * 2.5); b.vy += (dy / d * 20 - b.vy) * Math.min(1, dt * 2.5);
      b.x += (b.vx + Math.sin(b.t * 7) * 9) * dt; b.y += (b.vy + Math.cos(b.t * 9) * 12) * dt;
    }

    // ------------------------------------------------------------
    //  回岛睡觉 / 出来玩
    // ------------------------------------------------------------
    function goHome() {
      if (home.st !== 'out') return;
      endScene(true);
      pointer.drag = false; pointer.grab = null;
      ball.st = 'hand'; ball.holder = null; ball.other = null; ball.vx = ball.vy = ball.vz = 0;
      play.phase = 'rest'; play.rounds = 0; play.want = 0;
      home.st = 'going'; home.t = 0; home.wasNight = isNight();
      if (!opt.roam || !host.island) {   // 没有岛可回：原地消失
        actors.forEach(function (a) { if (!a.hidden) { puff(a.x, a.y - 10, true); a.hidden = true; } });
        return;
      }
      dogs.forEach(function (d, i) { d.carried = false; wake(d, true); d.st = 'home'; d.t = 0; d.hq = false; d.pose = 'stand'; d.react = 0.15 + i * 0.25; d.wag = 0.6; });
      person.carried = false; person.st = 'home'; person.t = 0; person.hq = false; person.spr = null; person.act = null;
    }
    function comeOut() {
      if (home.st !== 'in' && home.st !== 'going') return;
      lastTouch = now;
      var ip = islandPt(), k = 0;
      home.st = 'leaving'; home.t = 0; home.q = [];
      [dax, gold, person].forEach(function (a, i) {
        a.hq = false;
        if (a.hidden) { home.q.push({ a: a, at: now + 0.15 + k * 0.4, x: ip.x + [16, -20, 0][i] }); k++; }
        else if (a.isPerson) personIdle();                                   // 还没进岛就被叫住：原地转身
        else if (!a.carried) { setPose(a, 'stand', rand(0.4, 1.0)); a.wag = 1; }
      });
    }
    function updateHome() {
      if (home.st === 'going') {
        // 保险：回岛的路上不管被什么打断，都继续往岛里走
        play.phase = 'rest'; play.rounds = 0;
        if (ball.st !== 'hand') { ball.st = 'hand'; ball.holder = null; ball.other = null; pointer.drag = false; }
        dogs.forEach(function (d) { if (!d.hidden && !d.carried && d.st !== 'home') { d.st = 'home'; d.t = 0; d.hq = false; d.react = 0; d.pose = 'stand'; } });
        if (!person.hidden && !person.carried && person.st !== 'home') { person.st = 'home'; person.t = 0; person.hq = false; }
        if (actors.every(function (a) { return a.hidden; })) { home.st = 'in'; play.nextAt = now + 30; }
      } else if (home.st === 'leaving') {
        var ip = islandPt();
        for (var i = home.q.length - 1; i >= 0; i--) {
          var q = home.q[i];
          if (now < q.at) continue;
          var a = q.a;
          a.hidden = false; a.x = clamp(q.x, F.x0 + a.half + 2, F.x1 - a.half - 2); a.y = a.isPerson ? Math.max(ip.y, PY0) : ip.y; a.z = 0.01; a.vz = 120; a.scene = null; a.cmd = null; a.lift = 0;
          puff(a.x, a.y - 16, true);
          if (a.isPerson) { a.st = 'come'; a.t = 0; a.tx = ip.x + rand(-20, 20); a.ty = clamp(ip.y + (F.y1 - F.y0) * rand(0.4, 0.6), F.y0, F.y1); }
          else { var p = randPt(60 * SK, a); a.st = 'zoom'; a.t = 0; a.pose = 'stand'; a.wag = 1; a.vx = a.vy = 0; a.way = [p, { x: ip.x + (a === dax ? 30 : -40), y: clamp(ip.y + (F.y1 - F.y0) * 0.5, F.y0, F.y1) }]; }
          home.q.splice(i, 1);
        }
        if (!home.q.length) { home.st = 'out'; play.nextAt = now + rand(8, 14); nextSceneAt = now + rand(10, 18); }
      } else if (home.st === 'in') {
        // 天亮了自己出来：不管是夜里自己回去睡的，还是她前一天让它们回去的
        var night = isNight();
        if ((home.wasNight && !night) || (home.auto && !night && now - home.inAt > 5)) { home.auto = false; home.wasNight = night; comeOut(); }
        else home.wasNight = night;
      }
    }

    // ------------------------------------------------------------
    //  总导演
    // ------------------------------------------------------------
    function updatePlay() {
      if (home.st !== 'out') return;
      // 她按了"丢球"，但小人当时正忙（刚从岛里出来、正在摸狗……）：等他一有空就丢
      if (play.want) {
        if (now > play.want) play.want = 0;
        else if (ball.st === 'hand' && !person.hidden && !person.carried && (play.phase === 'rest' || play.phase === 'ready') &&
                 (person.st === 'idle' || person.st === 'front' || person.st === 'wave' || person.st === 'walk' || person.st === 'act' || person.st === 'come')) {
          play.want = 0; clickPerson();
        }
      }
      if (play.phase === 'rest') {
        if (opt.auto && !scene && !sleepyTime() && now >= play.nextAt && ball.st === 'hand' && !person.carried &&
            (person.st === 'idle' || person.st === 'front' || person.st === 'walk' || person.st === 'act')) {
          startSession(randInt(2, 4));
        } else if (!scene && now >= nextSceneAt) {
          if (!pickScene()) nextSceneAt = now + 3;
        }
      } else if (play.phase === 'ready') {
        if (ball.st === 'hand' && person.st === 'idle' && !person.carried && now >= play.throwAt) personThrow();
      }
    }

    // ------------------------------------------------------------
    //  鼠标 / 手指（坐标都是世界单位）
    // ------------------------------------------------------------
    function inBox(b, x, y, pad) { return b && x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad; }
    function touchAll() {
      lastTouch = now;
      dogs.forEach(function (d) { if (!d.hidden) wake(d); });
      if (person.st === 'sleep') personIdle();
    }
    function pet(d) {
      emote('heart', d, d.face * 6);
      d.wag = 1; d.happy = 1; d.hype = 1.6;
      bump('pets'); haptic('light');
      if (!d.scene && (d.st === 'pose' || d.st === 'idle' || d.st === 'walk')) {
        if (d.kind === 'dax') { if (Math.random() < 0.4) setPose(d, 'roll', 2.2); else { setPose(d, 'stand', 1.6); hop(d, 120); } }
        else setPose(d, Math.random() < 0.3 ? 'roll' : 'sit', 2.4);
        d.wag = 1; d.happy = 1;
      }
    }
    function clickPerson() {
      var p = person;
      if (p.scene) endScene(true);
      if (ball.st === 'hand' && (p.st === 'idle' || p.st === 'front' || p.st === 'wave' || p.st === 'walk' || p.st === 'act' || p.st === 'come')) {
        personIdle();
        if (play.phase === 'rest') startSession(1);
        play.phase = 'ready'; play.throwAt = now + 0.05; play.faked = true;
      } else if (p.st === 'idle' || p.st === 'front') {
        personWave();
      }
    }
    // 点在空地上：有球就往那儿丢，没球就把大家叫过去
    function lawnTap(x, y) {
      var tx = clamp(x, F.x0 + 12, F.x1 - 12), ty = opt.roam ? clamp(y, F.y0, F.y1) : F.y1;
      if (home.st !== 'out') return;
      if (ball.st === 'hand' && !person.carried && (person.st === 'idle' || person.st === 'front' || person.st === 'wave' || person.st === 'walk' || person.st === 'act' || person.scene)) {
        if (hyp(tx - person.x, ty - person.y) < 26) { clickPerson(); return; }
        startSession(1, { x: tx, y: ty });
        play.throwAt = now + 0.05; play.faked = true;
      } else if (play.phase === 'rest') {
        endScene(true);
        emoteAt('note', tx, ty - 10, 0.9);
        dogs.forEach(function (d, i) {
          if (d.hidden || d.carried) return;
          wake(d, true); d.st = 'come'; d.t = 0; d.pose = 'stand'; d.wag = 1;
          d.tx = clamp(tx + (i ? 16 : -22), F.x0 + d.half + 2, F.x1 - d.half - 2); d.ty = clamp(ty + ry(i ? 4 : -2), F.y0, F.y1);
        });
      }
    }
    function ptDown(x, y) {
      pointer.x = x; pointer.y = y; pointer.down = true; pointer.inside = true; pointer.grab = null;
      var sleepy = sleepyTime();
      touchAll();
      if (ball.vis && home.st === 'out' && inBox(ball.box, x, y, 4)) {
        // 抓住小球
        endScene(true);
        if ((ball.st === 'mouth' || ball.st === 'tug') && ball.holder) { ball.holder.st = 'beg'; ball.holder.t = 0; if (ball.other) { ball.other.st = 'beg'; ball.other.t = 0; } }
        if (person.st === 'windup' || person.st === 'pat' || person.st === 'fake') personIdle();
        ball.st = 'drag'; ball.holder = null; ball.other = null; ball.vx = ball.vy = ball.vz = 0;
        pointer.drag = true; pointer.hist = [];
        play.phase = 'drag';
        dogs.forEach(function (d) {
          if (d.hidden || d.carried) return;
          if (d.kind === 'gold' && d.energy < 0.3) return;
          d.st = 'beg'; d.t = 0; d.pose = 'stand';
        });
        ptMove(x, y);
        return true;
      }
      var hit = null;
      if (!dax.hidden && inBox(dax.box, x, y, 1)) hit = dax;
      else if (!gold.hidden && inBox(gold.box, x, y, 1)) hit = gold;
      else if (!person.hidden && inBox(person.box, x, y, 1)) hit = person;
      if (hit) { pointer.grab = { a: hit, x: x, y: y, moved: false, sleepy: sleepy }; return true; }
      if (CFG.lawnTap) lawnTap(x, y);     // Mac 上"草地"就是她的桌面和别的 App，点那里不归我们管
      return false;
    }
    function ptMove(x, y) {
      pointer.x = x; pointer.y = y; pointer.inside = true;
      var g = pointer.grab;
      if (g) {
        if (!g.moved && hyp(x - g.x, y - g.y) > 5) {   // 拎起来
          g.moved = true;
          var a = g.a;
          if (a.scene) endScene(true);
          if ((ball.st === 'mouth' || ball.st === 'tug') && (ball.holder === a || ball.other === a)) { ball.st = 'free'; ball.holder = null; ball.other = null; ball.z = 10; ball.vz = 40; onBallFree(); }
          a.carried = true; a.z = 0; a.vz = 0; a.vx = 0; a.vy = 0; a.lift = 0;
          if (a.isPerson) { if (a.st === 'windup' || a.st === 'fake' || a.st === 'pat') personIdle(); }
          else { a.st = 'carried'; a.pose = 'stand'; emote('q', a, 0, 0.7); }
          haptic('light');
        }
        if (g.moved) {
          var c = g.a;
          c.x = clamp(x, F.x0 + c.half + 1, F.x1 - c.half - 1);
          if (opt.roam) { c.y = clamp(y + (c.isPerson ? P_GRAB : 8), c.isPerson ? PY0 : F.y0, F.y1); c.z = 5; }
          else { c.y = F.y1; c.z = clamp(F.y1 - y - (c.isPerson ? P_GRAB : 8), 0, LH); }
        }
        return true;
      }
      if (!pointer.drag) return false;
      ball.x = clamp(x, F.x0 + BALL_R, F.x1 - BALL_R);
      if (opt.roam) { ball.z = 12; ball.y = clamp(y + ball.z, F.y0, F.y1 + 10); if (ball.y > F.y1) { ball.z = Math.max(BALL_R, 12 - (ball.y - F.y1)); ball.y = F.y1; } }
      else { ball.y = F.y1; ball.z = clamp(F.y1 - y, BALL_R, LH + 30); }
      var t = clock();
      pointer.hist.push([t, x, y]);
      while (pointer.hist.length > 2 && t - pointer.hist[0][0] > 0.11) pointer.hist.shift();
      return true;
    }
    function ptUp() {
      pointer.down = false;
      var g = pointer.grab;
      pointer.grab = null;
      if (g) {
        var a = g.a;
        if (g.moved) {     // 放下
          a.carried = false; a.vz = 0;
          if (a.z <= 0) a.z = 0.01;
          // 拎到灵动岛上放下 = 送它们回岛睡觉
          var I = host.island;
          if (I && I.hit && opt.roam && home.st === 'out' && I.hit(pointer.x, pointer.y)) {
            if (a.isPerson) personIdle(); else { a.st = 'idle'; a.pose = 'stand'; a.t = 0; }
            home.auto = false; goHome(); home.inAt = now;
            return true;
          }
          if (home.st === 'going') { a.st = 'home'; a.t = 0; a.hq = false; a.react = 0.2; if (!a.isPerson) a.pose = 'stand'; }
          else if (a.isPerson) { personIdle(); }
          else { a.st = 'pose'; a.pose = 'sit'; a.t = 0; a.dur = 1.6; a.wag = 0.9; }
        } else if (a.isPerson) { if (g.sleepy) personWave(); else clickPerson(); }
        else pet(a);
        return true;
      }
      if (!pointer.drag) return false;
      pointer.drag = false;
      var h = pointer.hist, vx = 0, vy = 0;
      if (h.length >= 2) {
        var p0 = h[0], p1 = h[h.length - 1], dtt = Math.max(0.016, p1[0] - p0[0]);
        vx = (p1[1] - p0[1]) / dtt; vy = (p1[2] - p0[2]) / dtt;
      }
      ball.st = 'free';
      if (opt.roam) {
        var sp = hyp(vx, vy);
        ball.vx = clamp(vx * 0.85, -520, 520); ball.vy = clamp(vy * 0.85, -420, 420);
        ball.vz = clamp(30 + sp * 0.32, 0, 250);
      } else {
        ball.vx = clamp(vx * 0.9, -560, 560); ball.vy = 0;
        ball.vz = clamp(-vy * 0.9, -400, Math.sqrt(2 * GRAV * (LH * 1.1)));
      }
      play.phase = 'fly'; play.lastPlay = now;
      if (opt.auto) play.rounds = Math.max(play.rounds, 1);   // 她丢完，小人也回丢一个
      haptic('light');
      onBallFree();
      return true;
    }
    function ptHover(x, y) { pointer.x = x; pointer.y = y; pointer.inside = true; }
    function ptLeave() { pointer.inside = false; }
    function dragging() { return !!(pointer.drag || (pointer.grab && pointer.grab.moved)); }

    // ------------------------------------------------------------
    //  图：旧的手画图（sprites.js）和新的小道具（fx.js），按名字取
    // ------------------------------------------------------------
    var FXS = null;            // 新小道具的图（按现在的 R 做出来的）
    var SD = {};               // 名字 → { im, l, t, r, b }：图，和"按哪个框来摆"（世界单位，相对图的左上角）
    var shCache = {}, pxCache = {}, puffN = 0;
    var fxBall = !!(FXM && FXM.ball), fxShadow = !!(FXM && FXM.shadow), fxPx = !!(FXM && FXM.px);     // 新画法的这几样还能不能用
    function loadArt() {
      FXS = null;
      if (FXM && FXM.build) { try { FXS = FXM.build(CFG, R) || null; } catch (e) { artFail('fx.js build', e); } }
      SD = {}; shCache = {}; pxCache = {}; seqN = {};
      puffN = 0;
      while (sd('puff' + puffN)) puffN++;      // 灰尘有几帧就用几帧（旧图 3 帧，新图多一帧）
    }
    // 表情用哪张图。新画法给有的表情多画了几帧，有就用上（旧图没有，还是原来那一张）：
    //   名字_pop0 / _pop1 / _pop2   刚冒出来时"啵"的一下（小 → 涨大一圈 → 缩回来）
    //   名字0 / 名字1 / ……          从头到尾轮着放一遍（小星星：刚亮 → 最亮 → 快灭）
    var seqN = {};
    function emoteArt(e) {
      var base = 'fx_' + e.type, d = e.t < 0.21 ? sd(base + '_pop' + Math.floor(e.t / 0.07)) : null;
      if (d) return d;
      var n = seqN[base];
      if (n === undefined) { n = 0; while (sd(base + n)) n++; seqN[base] = n; }
      return n ? sd(base + Math.min(n - 1, Math.floor(e.t / e.life * n))) : sd(base);
    }
    // 旧图按整张来摆（和第二版一个像素不差）；新图四周留多少空白不一定，按"真正有像素"的范围来摆
    function boxed(im, tight) {
      var s = im.scale || 1, bb = tight ? im.bb : null;
      return bb ? { im: im, l: bb[0] / s, t: bb[1] / s, r: (bb[2] + 1) / s, b: (bb[3] + 1) / s }
                : { im: im, l: 0, t: 0, r: im.w / s, b: im.h / s };
    }
    function sd(name) {
      var d = SD[name];
      if (d !== undefined) return d;
      if (FXS && FXS[name]) d = boxed(FXS[name], true);
      else if (SPR[name]) d = boxed(SPR[name], false);
      else d = null;
      SD[name] = d;
      return d;
    }
    // 影子：{ im, cx, cy }，(cx, cy) 是图里对着"脚下那一点"的位置
    function shadowOf(w, al) {
      var key = w + '/' + al, s = shCache[key];
      if (s !== undefined) return s;
      if (fxShadow) {
        try {
          var im = FXM.shadow(w, al, R), k = im.scale || 1;
          s = { im: im, cx: im.ox / k, cy: im.oy / k + 0.5 };
        } catch (e) { artFail('fx.js shadow', e); fxShadow = false; s = undefined; }
      }
      if (!s) {
        // 旧画法：三行，中间一行最宽
        var W = w * 2, d = new Uint8ClampedArray(W * 3 * 4), a8 = Math.round(al * 255);
        for (var j = 0; j < 3; j++) {
          var x0 = j === 1 ? 0 : 2, x1 = j === 1 ? W : W - 2;
          for (var i = x0; i < x1; i++) { var o = (j * W + i) * 4; d[o] = 20; d[o + 1] = 24; d[o + 2] = 40; d[o + 3] = a8; }
        }
        s = { im: { w: W, h: 3, data: d, scale: 1, ox: w, oy: 1.5, key: 'sh_' + w + '_' + a8 + '@1', ver: 1 }, cx: w, cy: 2 };
      }
      shCache[key] = s;
      return s;
    }
    // 飞溅的小碎屑：一个世界单位见方的色块
    function pxOf(color) {
      var s = pxCache[color];
      if (s !== undefined) return s;
      if (fxPx) { try { s = boxed(FXM.px(color, R), true); } catch (e) { artFail('fx.js px', e); fxPx = false; s = undefined; } }
      if (!s) {
        var c = rgbOf(color), d = new Uint8ClampedArray(4);
        d[0] = c[0]; d[1] = c[1]; d[2] = c[2]; d[3] = 255;
        s = boxed({ w: 1, h: 1, data: d, scale: 1, ox: 0.5, oy: 0.5, key: 'px_' + color + '@1', ver: 1 }, false);
      }
      pxCache[color] = s;
      return s;
    }

    // ------------------------------------------------------------
    //  角色的图：把骨架画成像素是最费力气的事，所以不是每一帧都重画——
    //  看得出变化了才画，其余时候接着用上一张，只挪位置
    // ------------------------------------------------------------
    function qual() { return clamp(quality, 0.2, 1) * (opt.soft ? 0.56 : 1); }
    // 两张图在 [i0, i1) 这些像素上是不是一模一样
    function samePixels(v, src, i0, i1) {
      var dst = v.im.data, i;
      if (v.s8 !== src) { v.s8 = src; v.s32 = (src.byteOffset % 4 === 0) ? new Uint32Array(src.buffer, src.byteOffset, src.length >> 2) : null; }
      if (!v.p32) v.p32 = new Uint32Array(dst.buffer, dst.byteOffset, dst.length >> 2);
      var a = v.s32, b = v.p32;
      if (a) { for (i = i0; i < i1; i++) if (a[i] !== b[i]) return false; return true; }
      for (i = i0 * 4; i < i1 * 4; i++) if (src[i] !== dst[i]) return false;
      return true;
    }
    // 把骨架刚画好的那一帧收下来：像素抄进角色自己的图里（没变就不动 ver），顺便记下嘴、手、头顶的位置
    function adopt(a, o) {
      var v = a.vis, im = v.im, s = o.scale || 1, w = o.w, h = o.h, n = w * h * 4, fresh = false;
      if (!im.data || im.data.length !== n || im.w !== w || im.h !== h || im.scale !== s) {
        im.data = new Uint8ClampedArray(n); im.w = w; im.h = h; im.scale = s;
        v.p32 = null; fresh = true;
      }
      im.ox = o.ox; im.oy = o.oy;
      var b = o.box || [0, 0, w - 1, h - 1];
      // 只比"上一帧或这一帧有像素"的那几行
      var y0 = Math.max(0, Math.min(v.ry0, b[1]) - 2), y1 = Math.min(h - 1, Math.max(v.ry1, b[3]) + 2);
      if (fresh || !samePixels(v, o.data, y0 * w, (y1 + 1) * w)) { im.data.set(o.data); im.ver++; v.ch++; }
      v.ry0 = b[1]; v.ry1 = b[3];
      v.bx0 = b[0] / s; v.by0 = b[1] / s; v.bx1 = b[2] / s; v.by1 = b[3] / s; v.px = 1 / s;
      v.top = o.top || 0;
      if (o.mouth) { v.mx = o.mouth[0]; v.my = o.mouth[1]; }
      v.hand = !!o.hand; v.holds = !!o.hand && o.holds !== false;
      if (o.hand) { v.hx = o.hand[0]; v.hy = o.hand[1]; }
      v.seat = !!o.seat;
      if (o.seat) { v.sx = o.seat[0]; v.sy = o.seat[1]; }
    }
    // 该不该重画这个角色。下面任何一条成立就画，否则接着用上一张（位置照样每帧都挪）：
    //   · 出了大动静：换了姿势 / 画面 / 心情、起跳、落地、叼到球、转身
    //   · 在地上走出了半个世界单位（跑着的狗每一帧都重画，踩在地上的脚才不会打滑）
    //   · 在原地做动作，离上次画过了 1/rigFps 秒
    //   · 只是呼吸、轻轻摇尾巴，离上次画过了大约 1/6 秒
    // sx：这张图的原点（脚下）会画在横向的哪里。把它落在像素格子里的零头告诉骨架，
    // 骨架就能按整格子来画：踩在地上的脚不会跟着身体在两个像素之间来回跳（旧的画法不理会这个）
    function shoot(a, left, RR, sig, cls, active, sx) {
      var v = a.vis, q = qual(), per = 1 / ((active ? RIG_FPS : CALM_FPS) * q);
      var el = now - v.seen;
      v.seen = now;
      v.acc += el > 0 ? (el > 1 ? 1 : el) : 0;
      var must = v.im.ver === 0 || sig !== v.sig || left !== v.left || RR !== v.R;
      var moved = v.dist >= Math.min(STRIDE, 1 / RR) / q;
      if (!must && !moved && v.acc < per - 1e-6) return v;
      if (must) {
        v.acc = v.ph * per;                                                      // 三个角色的节拍互相错开
        if (cls !== v.cls || left !== v.left) v.hot = Math.max(v.hot, now + 0.6);   // 换了姿势，正在过渡：这阵子画勤一点
      }
      else if (moved) v.acc = 0;
      else v.acc = Math.min(v.acc - per, per * 0.5);
      v.dist = 0;
      v.sig = sig; v.cls = cls; v.left = left; v.R = RR;
      v.n++;
      try { adopt(a, a.rig.render(left, RR, sx * RR - Math.floor(sx * RR))); v.bad = 0; }
      catch (e) {      // 画不出来：先接着用上一张；连着三次都不行，这个角色就不用新画法了
        artFail((a.isPerson ? 'person.js' : 'dogs.js ' + a.name) + ' render', e);
        if (++v.bad >= 3) a.rig = null;
      }
      return v;
    }
    // 这一步在地上走了多远（被拎着、躲在岛里的不算）
    function travelled(a) {
      var v = a.vis;
      if (!a.carried && !a.hidden) v.dist += hyp(a.x - v.lx, a.y - v.ly);
      v.lx = a.x; v.ly = a.y;
    }
    function dogSig(d) {
      var I = d.ri;
      return (POSE_ID[I.pose] || 0) * 64 + (I.air ? 1 : 0) + (I.carry ? 2 : 0) + (I.happy ? 4 : 0) + (I.bark ? 8 : 0) + (I.pant ? 16 : 0) + (I.shake ? 32 : 0);
    }
    function dogActive(d) {
      var I = d.ri;
      return d.sp > 1 || d.z > 0 || d.carried || !!I.pant || !!I.bark || !!I.shake || d.wag > 0.55 || now < d.vis.hot ||
             d.st === 'spin' || d.pose === 'scratch' || d.pose === 'dig' || d.pose === 'roll' || d.pose === 'lick';
    }
    function personSig() {
      var I = person.ri;
      return I.frame + (I.holding === 'ball' ? 1 : (I.holding ? 2 : 0)) + (I.carried ? 'c' : '') + (I.air ? 'a' : '');
    }
    function personActive() {
      var p = person;
      return p.moving || p.carried || p.z > 0 || now < p.vis.hot || !!PMOVES[PCLASS[p.ri.frame]];
    }

    // ------------------------------------------------------------
    //  这一帧该画什么：一张从后到前排好的清单（位置是世界单位，不取整；对齐像素是外壳的事）
    // ------------------------------------------------------------
    function put(list, id, im, x, y, flip) { list.push({ id: id, img: im, x: x, y: y, flip: !!flip, a: 1 }); }
    function putShadow(list, id, x, y, w, al) {
      var s = shadowOf(Math.max(2, Math.round(w)), al);
      put(list, id, s.im, x - s.cx, y - s.cy, false);
    }
    // 画小球，球心在 (cx, cy)。
    // 贴在别人身上（手里 / 嘴里）时多给 (px, py) = 那张图的左上角，这时 (cx, cy) 是球心相对它的位置，对齐到像素格子：
    // 这样不管外壳怎么取整，球和手 / 嘴之间都不会差出一个像素来回抖
    function putBall(list, cx, cy, px, py) {
      var im = null, x, y, s;
      if (fxBall) { try { im = FXM.ball(ball.rot * Math.PI / 2, ball.sq > 0 ? clamp(ball.sq / 0.07, 0, 1) : 0, R); } catch (e) { artFail('fx.js ball', e); fxBall = false; im = null; } }
      if (im) {
        s = im.scale || 1;
        x = cx - im.ox / s; y = cy - im.oy / s;
        if (px !== undefined) { x = px + qz(x); y = py + qz(y); }
        cx = qz(x) + im.ox / s; cy = qz(y) + im.oy / s;
        ball.box = [cx - BALL_R, cy - BALL_R, cx + BALL_R - 1 / s, cy + BALL_R - 1 / s]; ball.bpx = 1 / s;
      } else {
        im = ball.sq > 0 ? SPR.ball_sq : SPR['ball' + (((Math.floor(ball.rot) % 4) + 4) % 4)];
        if (!im) return;
        x = cx - im.w / 2; y = cy - im.h / 2 + (ball.sq > 0 ? 2 : 0);
        if (px !== undefined) { x = px + qz(x); y = py + qz(y); }
        ball.box = [qz(x), qz(y), qz(x) + im.w - 1, qz(y) + im.h - 1]; ball.bpx = 1;
      }
      put(list, 'ball', im, x, y, false);
      ball.vis = true;
    }
    function ballLoose() { return ball.st === 'free' || ball.st === 'drag' || ball.st === 'handing'; }
    // 画小人；返回 true = 球画在他手里了
    function putPerson(list, a) {
      var face = personFace(), x, y, hx = 0, hy = 0, has = false, half = 0;      // (hx, hy)：手心相对这张图左上角的位置
      var v = a.rig ? shoot(a, face < 0, R, personSig(), PCLASS[a.ri.frame] || 0, personActive(), a.x) : null;
      if (v && v.im.data) {
        var gy = a.y - 1 - a.z, im = v.im, s = im.scale;
        x = a.x - im.ox / s; y = gy - im.oy / s;
        put(list, 'person', im, x, y, false);
        a.box = [qz(x) + v.bx0, qz(y) + v.by0, qz(x) + v.bx1, qz(y) + v.by1]; a.bpx = v.px;
        a.top = gy - v.top;
        if (v.holds) { has = true; hx = im.ox / s + v.hx; hy = im.oy / s - v.hy; }
      } else {
        var sp = SPR[personSprite()];
        if (!sp) return false;
        x = a.x - sp.w / 2; y = a.y - a.z - sp.h;
        put(list, 'person', sp, x, y, face < 0);
        var bb = sp.bb, bx0 = face < 0 ? sp.w - 1 - bb[2] : bb[0], bx1 = face < 0 ? sp.w - 1 - bb[0] : bb[2];
        a.box = [qz(x) + bx0, qz(y) + bb[1], qz(x) + bx1, qz(y) + bb[3]]; a.bpx = 1;
        a.top = a.box[1];
        if (sp.hand) {       // 旧图里手的位置记的是"哪一个像素"：球心在那个像素的正中
          var ax = sp.hand[0] + 1, ay = sp.hand[1] + 1;
          has = true; half = 0.5;        // （手里拿的零食，旧版是按那个像素的左上角摆的，差半个像素）
          hx = (face < 0 ? sp.w - 1 - ax : ax) + 0.5; hy = ay + 0.5;
        }
      }
      if (has && a.item) {
        var it = sd(a.item);
        if (it) put(list, 'held', it.im, x + qz(hx - half - (it.l + it.r) / 2), y + qz(hy - half - (it.t + it.b) / 2), false);
      } else if (has && ball.st === 'hand') {
        putBall(list, hx, hy, x, y);
        ball.x = x + hx; ball.y = a.y; ball.z = Math.max(BALL_R, a.y - (y + hy));
        return true;
      }
      return false;
    }
    // 画一只狗；返回 true = 球画在它嘴里了
    function putDog(list, d) {
      if (!d.rig) return false;
      var sig = dogSig(d), v = shoot(d, d.face < 0, R, sig, sig, dogActive(d), d.x), im = v.im, s = im.scale;
      if (!im.data) return false;
      var gy = d.y - 1 - d.z - d.lift, x = d.x - im.ox / s, y = gy - im.oy / s;
      put(list, d.name, im, x, y, false);
      d.box = [qz(x) + v.bx0, qz(y) + v.by0, qz(x) + v.bx1, qz(y) + v.by1]; d.bpx = v.px;
      d.top = gy - v.top;
      d.mx = Math.abs(v.mx);
      d.mouthX = d.x + v.mx; d.mouthY = gy - v.my;
      if ((ball.st === 'mouth' || ball.st === 'tug') && ball.holder === d) {
        var jx = ball.st === 'tug' ? (Math.sin(now * 46) > 0 ? 0.6 : -0.6) : 0;
        putBall(list, im.ox / s + v.mx + jx, im.oy / s - v.my, x, y);
        ball.x = d.mouthX; ball.y = d.y; ball.z = Math.max(BALL_R, d.y - d.mouthY);
        return true;
      }
      return false;
    }
    function byDepth(p, q) {
      return (p.y + p.lift * 0.01 + (p === dax ? 0.02 : p === person ? 0.01 : 0)) - (q.y + q.lift * 0.01 + (q === dax ? 0.02 : q === person ? 0.01 : 0));
    }
    function addHot(hot, b, pad, px) {
      if (b) hot.push([b[0] - pad, b[1] - pad, b[2] - b[0] + px + pad * 2, b[3] - b[1] + px + pad * 2]);
    }
    var order = [];
    function compose() {
      if (!booted) relayout();
      var list = [], i, a, shade = opt.grass ? 0.2 : 0.16;

      // 贴着地面的：灰尘
      for (i = 0; i < parts.length; i++) {
        var pp = parts[i];
        if (pp.k !== 'puff' || !puffN) continue;
        var ps = sd('puff' + Math.min(puffN - 1, Math.floor(pp.t / pp.life * puffN)));
        put(list, 'puff:' + pp.id, ps.im, pp.x - (ps.l + ps.r) / 2, pp.y - ps.b, false);
      }
      // 影子
      if (opt.roam || opt.grass) {
        for (i = 0; i < actors.length; i++) {
          a = actors[i];
          if (a.hidden) continue;
          putShadow(list, 'shadow:' + a.name, a.x, a.y, a.isPerson ? a.half * 0.75 : a.half * 0.8, shade * (a.z > 8 || a.lift ? 0.6 : 1));
        }
        if (ballLoose()) putShadow(list, 'shadow:ball', ball.x, ball.y, clamp(4 - ball.z / 30, 2, 4), shade);
      }

      // 角色：谁站得靠下（离我们近）谁后画；球按它落在谁的前后插进去
      order.length = 0;
      for (i = 0; i < actors.length; i++) if (!actors[i].hidden) order.push(actors[i]);
      order.sort(byDepth);
      var ballDrawn = false;
      ball.vis = false;
      for (i = 0; i < order.length; i++) {
        a = order[i];
        if (!ballDrawn && ballLoose() && ball.y <= a.y - 0.5) { putBall(list, ball.x, ball.y - ball.z); ballDrawn = true; }
        if (a.isPerson ? putPerson(list, a) : putDog(list, a)) ballDrawn = true;
      }
      if (!ballDrawn && ballLoose()) { putBall(list, ball.x, ball.y - ball.z); ballDrawn = true; }
      if (ball.st === 'hand' && !ballDrawn) ball.box = null;

      // 丢出去的零食
      for (i = 0; i < items.length; i++) {
        var itm = items[i], k = clamp(itm.t / itm.dur, 0, 1), si = sd(itm.spr);
        if (!si) continue;
        var ex = itm.to.mouthX !== undefined ? itm.to.mouthX : itm.to.x, ey = itm.to.mouthY !== undefined ? itm.to.mouthY : itm.to.y - 8;
        var sx = itm.x0, sy = itm.y0 - itm.z0;
        put(list, 'item:' + itm.id, si.im, sx + (ex - sx) * k - (si.l + si.r) / 2, sy + (ey - sy) * k - Math.sin(Math.PI * k) * itm.peak - (si.t + si.b) / 2, false);
      }
      // 飞溅的小碎屑
      for (i = 0; i < parts.length; i++) {
        pp = parts[i];
        if (pp.k !== 'px') continue;
        var pd = pxOf(pp.c);
        put(list, 'px:' + pp.id, pd.im, pp.x - pd.l, pp.y - pd.t, false);
      }
      // 蝴蝶
      if (bfly.on) {       // 扇翅膀：旧图两帧 a b；新图多一帧"往下压"的 c，按 a b c b 轮
        var bn = bfly.color ? 'bfly2_' : 'bfly_';
        var bs = sd(bn + 'c') ? sd(bn + 'abcb'.charAt(Math.floor(now * 14) % 4)) : sd(bn + ((Math.floor(now * 9) % 2) ? 'a' : 'b'));
        if (bs) put(list, 'bfly', bs.im, bfly.x - (bs.l + bs.r) / 2, bfly.y - (bs.t + bs.b) / 2, false);
      }
      // 表情
      for (i = 0; i < emotes.length; i++) {
        var e = emotes[i], es = emoteArt(e);
        if (!es || e.ent.hidden) continue;
        var kk = e.t / e.life;
        if (kk > 0.8 && Math.floor(e.t * 16) % 2) continue;   // 快消失时闪一闪
        var zz = e.type === 'z' || e.type === 'zs';
        var ex2 = e.ent.x + e.dx - (es.l + es.r) / 2 + (zz ? e.t * 4 : Math.sin(e.t * 5 + e.ph) * 1.2);
        var ey2 = (e.ent.top || 0) - es.b - 2 - e.t * 9;
        put(list, 'emote:' + e.id, es.im, ex2, Math.max(-es.t, ey2), false);
      }

      // 哪些地方是"可以点的"（其余地方鼠标直接穿过去）：球、金毛、小人、小腊肠
      var hot = [];
      if (ball.vis && home.st === 'out') addHot(hot, ball.box, 4, ball.bpx);
      for (i = 0; i < actors.length; i++) if (!actors[i].hidden) addHot(hot, actors[i].box, 1, actors[i].bpx);

      if (bubble && (now > bubble.until || person.hidden)) bubble = null;
      return {
        items: list, hot: hot, drag: dragging(),
        bubble: bubble ? { text: bubble.text, x: person.x, y: person.top, id: bubble.id } : null,
      };
    }

    // 在岛里睡觉的时候，岛上那一小格里画什么（坐标相对那一格的左上角，世界单位）
    var DEN_W = 124, DEN_H = 28;
    function den(RR) {
      if (!booted) relayout();
      RR = RR ? resOf(RR) : R;
      var list = [], w = DEN_W, h = DEN_H;
      var slots = [[gold, w * 0.22], [person, w * 0.5], [dax, w * 0.78]];
      for (var i = 0; i < slots.length; i++) {
        var a = slots[i][0], cx = slots[i][1];
        if (!a.hidden) continue;
        if (a.rig) {
          var sig = a.isPerson ? personSig() : dogSig(a), v = shoot(a, !a.isPerson && cx > w / 2, RR, sig, a.isPerson ? PCLASS[a.ri.frame] || 0 : sig, false, cx), im = v.im;
          if (im.data) put(list, 'den:' + a.name, im, cx - im.ox / im.scale, h - im.oy / im.scale, false);
        }
        if (a.isPerson && !(a.rig && a.vis.im.data)) {
          var s = SPR.p_sit || SPR.p_front_blink;      // 坐在两只睡着的狗狗中间守着
          if (s) put(list, 'den:person', s, cx - s.w / 2, h - s.h + 1, false);
        }
      }
      if ((home.st === 'in' || home.st === 'going') && Math.floor(now * 0.8) % 2) {
        var z = sd('fx_zs');
        if (z) put(list, 'den:z', z.im, w * 0.62 - z.l, 1 - z.t, false);
      }
      return { w: w, h: h, items: list };
    }

    // ------------------------------------------------------------
    //  主循环
    // ------------------------------------------------------------
    // 往前走 dt 秒。一小步最多 1/60 秒（外壳一帧隔得久，这里自己拆成几小步）；隔了太久（电脑刚睡醒）就不追了
    function step(dt) {
      if (!(dt > 0)) return;
      if (dt > 0.25) dt = 0.25;
      var n = Math.ceil(dt * 60 - 1e-6);
      for (var i = 0; i < n; i++) tick(dt / n);
    }
    function tick(dt) {
      if (!booted) relayout();
      now += dt;
      if (!entered && now >= enterAt) { entered = true; enter(); }
      updateHome();
      updatePlay();
      runScene();
      updatePerson(dt);
      updateDog(gold, dt);
      updateDog(dax, dt);
      updateBall(dt);
      updateBfly(dt);
      var i;
      for (i = 0; i < dogs.length; i++) feed(dogs[i], rigInput(dogs[i], dt), dt);
      feed(person, personInput(), dt);
      for (i = 0; i < actors.length; i++) travelled(actors[i]);
      for (i = emotes.length - 1; i >= 0; i--) { emotes[i].t += dt; if (emotes[i].t >= emotes[i].life) emotes.splice(i, 1); }
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.t += dt;
        if (p.k === 'px') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.t >= p.life) parts.splice(i, 1);
      }
      for (i = items.length - 1; i >= 0; i--) { items[i].t += dt; if (items[i].t >= items[i].dur) items.splice(i, 1); }
    }
    function feed(a, I, dt) {
      if (!a.rig) return;
      try { a.rig.update(dt, I); }
      catch (e) { artFail((a.isPerson ? 'person.js' : 'dogs.js ' + a.name) + ' update', e); if (++a.vis.bad >= 3) a.rig = null; }
    }
    // 现在有多"忙"：0 = 什么都不动，2 = 正在动（外壳据此决定画得多勤）
    function busy() {
      if (!booted) relayout();
      if (!entered) return 2;                                                // 马上要出场了
      if (home.st === 'in' && !pointer.drag && !pointer.grab) return 0;     // 都在岛里睡觉：没什么要画的
      if (pointer.drag || pointer.grab || ball.st === 'free' || ball.st === 'mouth' || ball.st === 'tug' || emotes.length || parts.length || scene || home.st === 'going' || home.st === 'leaving') return 2;
      if (person.moving || (person.st !== 'idle' && person.st !== 'front' && person.st !== 'sleep')) return 2;
      if (dogs.some(function (d) { return !d.hidden && (d.sp > 1 || d.z > 0 || d.st === 'wait' || d.st === 'spin' || d.wag > 0.55 || (d.st === 'pose' && d.t < 0.6) || d.pose === 'scratch' || d.pose === 'dig' || d.pose === 'roll'); })) return 2;
      if (bfly.on || pointer.inside) return 1;
      return 0;
    }

    // ------------------------------------------------------------
    //  对外接口
    // ------------------------------------------------------------
    function configure(o) {
      if (!o) return;
      var re = false;
      if (typeof o.auto === 'boolean') { opt.auto = o.auto; if (!o.auto) play.rounds = 0; }
      if (typeof o.roam === 'boolean' && o.roam !== opt.roam) { opt.roam = o.roam; re = true; endScene(true); }
      if (typeof o.grass === 'boolean') opt.grass = o.grass;
      if (typeof o.soft === 'boolean') opt.soft = o.soft;     // 画得吃力的机器：角色少重画几次
      if (o.view && o.view.w > 0 && o.view.h > 0) { VW = +o.view.w; VH = +o.view.h; re = true; }
      if (o.insets) {
        INS = { top: +o.insets.top || 0, bottom: +o.insets.bottom || 0, left: +o.insets.left || 0, right: +o.insets.right || 0 };
        re = true;
      }
      if (o.res !== undefined && resOf(o.res) !== R) { R = resOf(o.res); loadArt(); }
      if (re && (booted || o.view)) relayout();
    }
    function command(name) {
      if (!booted) relayout();
      if (name === 'throw') { touchAll(); if (home.st === 'in' || home.st === 'going') comeOut(); play.want = now + 9; }
      else if (name === 'wave') { if (home.st === 'in') comeOut(); else { touchAll(); personWave(); } }
      else if (name === 'home') { home.auto = false; goHome(); home.inAt = now; }
      else if (name === 'out') comeOut();
      else if (name === 'toggleHome') { if (home.st === 'out') { home.auto = false; goHome(); home.inAt = now; } else comeOut(); }
      else if (name === 'love') {
        touchAll();
        if (home.st === 'in') { comeOut(); return; }
        dogs.forEach(function (d) { if (!d.hidden) pet(d); });
        if (!person.scene && (person.st === 'idle' || person.st === 'front')) personWave();
      }
      else if (name === 'gather') {
        if (home.st === 'in') { comeOut(); return; }
        touchAll(); endScene(true);
        var ip = islandPt(), gy = clamp(ip.y + 46, F.y0, F.y1);
        if (play.phase === 'rest') {
          dogs.forEach(function (d, i) { if (d.hidden || d.carried) return; d.st = 'come'; d.t = 0; d.pose = 'stand'; d.wag = 1; d.tx = ip.x + (i ? 26 : -34); d.ty = gy + ry(i ? 4 : -2); });
          if (!person.carried && (person.st === 'idle' || person.st === 'front' || person.st === 'walk' || person.st === 'act')) { person.st = 'come'; person.t = 0; person.tx = ip.x; person.ty = gy; }
        }
      }
    }
    // type: down | move | up | hover | leave；返回 true = 这一下落在球或者谁身上了（正在拖 / 拎的过程也算）
    function onPointer(type, x, y) {
      if (!booted) relayout();
      if (type === 'down') return ptDown(x, y);
      if (type === 'move') return ptMove(x, y);
      if (type === 'up') return ptUp();
      if (type === 'hover') ptHover(x, y);
      else if (type === 'leave') ptLeave();
      return false;
    }
    function status() {
      if (!booted) relayout();
      return { home: home.st, fetch: stats.fetch, pets: stats.pets, night: isNight(), auto: opt.auto, roam: opt.roam,
               scene: scene ? scene.name : '', phase: dayPhase(), drag: dragging() };
    }

    loadArt();
    return {
      configure: configure,
      step: step,
      compose: compose,
      pointer: onPointer,
      command: command,
      status: status,
      busy: busy,
      den: den,
      setQuality: function (q) { quality = +q >= 0 ? +q : 1; },
      // 给测试用
      _t: {
        step: step,
        compose: compose,
        state: function () {
          if (!booted) relayout();
          return {
            now: now, phase: play.phase, rounds: play.rounds, home: home.st, scene: scene ? scene.name : null, scenes: sceneCount,
            ball: { st: ball.st, x: ball.x, y: ball.y, z: ball.z, holder: ball.holder && ball.holder.kind },
            person: { st: person.st, x: person.x, y: person.y, hidden: person.hidden },
            dax: { st: dax.st, pose: dax.pose, x: dax.x, y: dax.y, z: dax.z, sp: dax.sp, hidden: dax.hidden },
            gold: { st: gold.st, pose: gold.pose, x: gold.x, y: gold.y, z: gold.z, sp: gold.sp, energy: gold.energy, hidden: gold.hidden },
            LW: LW, LH: LH, F: F, R: R, roam: opt.roam, bfly: bfly.on,
          };
        },
        boxes: function () { return { ball: ball.vis ? ball.box : null, dax: dax.hidden ? null : dax.box, gold: gold.hidden ? null : gold.box, person: person.hidden ? null : person.box }; },
        set: function (k, v) {
          if (k === 'nextAt') play.nextAt = v; if (k === 'msgAt') person.msgAt = v; if (k === 'energy') gold.energy = v;
          if (k === 'sceneAt') nextSceneAt = v; if (k === 'bfly') bfly.nextAt = v; if (k === 'touch') lastTouch = v;
          if (k === 'rigFps') { RIG_FPS = v; CALM_FPS = v; }      // 测试时可以让骨架每一帧都重画
        },
        scene: function (name) { nextSceneAt = 1e9; return pickScene(name); },
        endScene: function () { endScene(true); },
        // 画图的文件出过什么错（没出过就是空的）
        errors: function () { return artErrors.slice(); },
        // 每个角色的骨架一共重画了几次、其中几次像素真的变了
        perf: function () {
          var o = {};
          actors.forEach(function (a) { o[a.name] = { renders: a.vis.n, changed: a.vis.ch }; });
          return o;
        },
      },
    };
  }

  G.PET_ENGINE = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
