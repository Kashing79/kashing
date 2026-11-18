// 球球 · 玩法引擎
// 一个穿西装的小人、一只小腊肠、一只大金毛，和一颗小球。
// 这个文件既能在 Mac 外壳（WKWebView）里跑，也能直接在浏览器里打开预览。
(function () {
  'use strict';

  // ------------------------------------------------------------
  //  设定
  // ------------------------------------------------------------
  var DEF = { messages: [], messageMinutes: [25, 60], autoPlaySeconds: [40, 110], nightSleep: [0, 7] };
  var CFG = Object.assign({}, DEF, window.PET_CONFIG || {});
  var QS = new URLSearchParams(location.search);
  var NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pet);
  var opt = {
    scale: parseInt(QS.get('scale') || '0', 10) || 0,   // 0 = 自动
    auto: QS.get('auto') !== '0',
    paused: false,
  };

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var bubbleLayer = document.getElementById('bubbles');
  var SPR = window.PET_SPRITES.build(CFG);

  // 每张图里"真正有像素"的范围，用来判断鼠标点没点中
  Object.keys(SPR).forEach(function (k) {
    var s = SPR[k], d = s.img.getContext('2d').getImageData(0, 0, s.w, s.h).data;
    var x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
    for (var y = 0; y < s.h; y++) for (var x = 0; x < s.w; x++) {
      if (d[(y * s.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    s.bb = [x0, y0, x1, y1];
  });

  var S = 3;            // 一个像素放大几倍
  var LW = 300, LH = 110;   // 画布的逻辑大小（像素画的像素）
  var offX = 0, offY = 0;   // 画布左上角在页面里的位置（CSS 像素）
  var now = 0;          // 游戏时间（秒）
  var GRAV = 420;
  var BALL_R = 4;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function range(r, fallback) { return (r && r.length === 2) ? rand(r[0], r[1]) : fallback; }

  // ------------------------------------------------------------
  //  角色
  // ------------------------------------------------------------
  var KIND = {
    dax:  { pre: 'd_', half: 15, accel: 720, run: 150, back: 105, trot: 62, walk: 30, reach: 11, grab: 6, runFps: 15 },
    gold: { pre: 'g_', half: 19, accel: 300, run: 168, back: 84,  trot: 58, walk: 22, reach: 20, grab: 7, runFps: 10 },
  };
  function makeDog(kind) {
    return {
      kind: kind, K: KIND[kind], x: 0, z: 0, vz: 0, v: 0, face: 1,
      st: 'idle', pose: 'stand', t: 0, dur: 0, anim: 0, wagT: Math.random() * 4, wag: 2,
      energy: 1, tx: 0, spd: 0, react: 0, hopAt: 0, way: null, pant: false, box: null, zAt: 0, hype: 0,
    };
  }
  var gold = makeDog('gold');
  var dax = makeDog('dax');
  var dogs = [gold, dax];
  var person = {
    x: 0, face: 1, st: 'idle', t: 0, dur: 0, anim: 0, tx: 0, next: 4,
    msgAt: 0, waveCd: 0, hoverT: 0, box: null, zAt: 0, giveTo: null,
  };
  var ball = { x: 0, z: BALL_R, vx: 0, vz: 0, st: 'hand', holder: null, rot: 0, box: null, freeT: 0, vis: true };
  var play = { phase: 'rest', rounds: 0, nextAt: 9, throwAt: 0, fetcher: null };
  var pointer = { x: -999, y: -999, inside: false, down: false, drag: false, hist: [] };
  var emotes = [];
  var lastTouch = 0;      // 上一次有人理它们的时间（刚打开也算一次）
  var booted = false;

  // ------------------------------------------------------------
  //  版面
  // ------------------------------------------------------------
  function layout() {
    var host = canvas.parentElement || document.body;
    var vw = host.clientWidth || window.innerWidth, vh = host.clientHeight || window.innerHeight;
    var autoS = typeof CFG.autoScale === 'function' ? CFG.autoScale(vw, vh) : 0;
    S = opt.scale || autoS || (vw < 520 ? 2 : (vw < 1150 ? 3 : 4));
    LW = Math.max(150, Math.floor(vw / S));
    LH = Math.max(70, Math.floor(vh / S));
    canvas.width = LW; canvas.height = LH;
    canvas.style.width = (LW * S) + 'px';
    canvas.style.height = (LH * S) + 'px';
    var rect = canvas.getBoundingClientRect();
    offX = rect.left;
    offY = rect.top;
    ctx.imageSmoothingEnabled = false;
    if (!booted) {
      booted = true;
      person.x = Math.round(LW * rand(0.42, 0.58));
      person.face = 1;
      gold.x = person.x - 46; gold.face = 1;
      dax.x = person.x + 34; dax.face = -1;
      setPose(gold, 'sit', 6);
      setPose(dax, 'stand', 2);
    }
    person.x = clamp(person.x, 14, LW - 14);
    dogs.forEach(function (d) { d.x = clamp(d.x, d.K.half + 1, LW - d.K.half - 1); });
    ball.x = clamp(ball.x, BALL_R, LW - BALL_R);
  }

  // ------------------------------------------------------------
  //  小工具：表情、说话
  // ------------------------------------------------------------
  function emote(type, ent, dx, life) {
    emotes.push({ type: type, ent: ent, dx: dx || 0, t: 0, life: life || 1.1 });
  }
  var bubble = null;
  function say(text) {
    if (bubble) { bubble.el.remove(); bubble = null; }
    var el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    bubbleLayer.appendChild(el);
    bubble = { el: el, until: now + Math.max(4.5, Math.min(9, text.length * 0.35 + 3)) };
    requestAnimationFrame(function () { el.classList.add('on'); });
    placeBubble();
  }
  function placeBubble() {
    if (!bubble) return;
    var top = person.box ? person.box[1] : LH - 30;
    var lr = bubbleLayer.getBoundingClientRect();
    bubble.el.style.left = clamp(person.x * S + offX - lr.left, 130, Math.max(130, lr.width - 130)) + 'px';
    bubble.el.style.top = (top * S + offY - lr.top - 14) + 'px';
    if (now > bubble.until) {
      var el = bubble.el; bubble = null;
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 400);
    }
  }

  function isNight() {
    var n = CFG.nightSleep;
    if (!n || n.length !== 2) return false;
    var h = new Date().getHours();
    return n[0] <= n[1] ? (h >= n[0] && h < n[1]) : (h >= n[0] || h < n[1]);
  }
  // 夜里、而且好一阵子没人理 → 大家睡觉
  function sleepyTime() { return isNight() && (now - lastTouch) > 150; }

  // ------------------------------------------------------------
  //  狗狗的动作
  // ------------------------------------------------------------
  function setPose(d, pose, dur) {
    d.st = 'pose'; d.pose = pose; d.t = 0; d.dur = dur; d.v = 0;
  }
  function walkTo(d, tx, spd) {
    d.st = 'walk'; d.pose = 'stand'; d.t = 0;
    d.tx = clamp(tx, d.K.half + 2, LW - d.K.half - 2);
    d.spd = spd;
  }
  function awake(d) { return !(d.st === 'pose' && d.pose === 'sleep'); }
  function wake(d, quiet) {
    if (!awake(d)) { d.st = 'idle'; d.pose = 'stand'; d.t = 0; d.dur = 0; if (!quiet) emote('bang', d); }
  }

  // 往 tx 跑，返回是否到了
  function drive(d, tx, maxSpd, dt) {
    var K = d.K;
    tx = clamp(tx, K.half + 1, LW - K.half - 1);
    var dx = tx - d.x, dist = Math.abs(dx);
    if (dist < 1.5 && Math.abs(d.v) < 40) { d.v = 0; d.x = tx; return true; }
    var brake = d.v * d.v / (2 * K.accel);
    var want = (dist <= brake + 1) ? 0 : sgn(dx) * maxSpd;
    var step = K.accel * dt;
    d.v += clamp(want - d.v, -step, step);
    d.x += d.v * dt;
    if (d.x < K.half + 1) { d.x = K.half + 1; d.v = 0; }
    if (d.x > LW - K.half - 1) { d.x = LW - K.half - 1; d.v = 0; }
    if (Math.abs(d.v) > 4) d.face = d.v > 0 ? 1 : -1;
    return false;
  }
  function coast(d, dt) {   // 慢慢停下来
    var step = d.K.accel * dt;
    d.v -= clamp(d.v, -step, step);
    d.x = clamp(d.x + d.v * dt, d.K.half + 1, LW - d.K.half - 1);
  }
  function faceTo(d, x) { if (Math.abs(x - d.x) > 2) d.face = x > d.x ? 1 : -1; }
  function hop(d, power) { if (d.z === 0) { d.vz = power; d.z = 0.01; } }

  // 闲着的时候自己找事做
  function think(d) {
    d.pant = false; d.wag = 2;
    if (sleepyTime()) { setPose(d, 'sleep', rand(20, 40)); return; }
    var r = Math.random();
    var idleFor = now - Math.max(lastTouch, play.lastPlay || 0);
    if (d.kind === 'dax') {
      if (r < 0.30) walkTo(d, person.x + rand(-90, 90), rand(28, 60));
      else if (r < 0.42) walkTo(d, rand(20, LW - 20), d.K.trot);
      else if (r < 0.54) { faceTo(d, person.x); setPose(d, 'bow', rand(1.5, 3)); d.wag = 7; }
      else if (r < 0.68) { faceTo(d, person.x); setPose(d, 'sit', rand(3, 7)); d.wag = 3; }
      else if (r < 0.76) {   // 满屏疯跑
        d.st = 'zoom'; d.t = 0; d.pose = 'stand';
        var a = clamp(d.x - rand(70, 160), 20, LW - 20), b = clamp(d.x + rand(70, 160), 20, LW - 20);
        d.way = Math.random() < 0.5 ? [a, b, a, d.x] : [b, a, b, d.x];
      }
      else if (r < 0.82) { d.st = 'spin'; d.t = 0; d.pose = 'stand'; d.wag = 6; }   // 追自己的尾巴
      else if (r < 0.92 && idleFor > 40) setPose(d, 'lie', rand(6, 14));
      else if (idleFor > 180 && r < 0.97) setPose(d, 'sleep', rand(25, 60));
      else setPose(d, 'stand', rand(1.5, 4));
    } else {
      if (d.energy < 0.45) { setPose(d, 'lie', rand(8, 14)); d.pant = true; return; }
      if (r < 0.26) { faceTo(d, person.x); setPose(d, 'sit', rand(6, 12)); }
      else if (r < 0.50) setPose(d, 'lie', rand(10, 22));
      else if (r < 0.72) walkTo(d, person.x + pick([-1, 1]) * rand(26, 60), d.K.walk);
      else if (r < 0.80) walkTo(d, rand(30, LW - 30), d.K.walk);
      else if (idleFor > 120 && r < 0.93) setPose(d, 'sleep', rand(30, 80));
      else setPose(d, 'stand', rand(2, 5));
    }
  }

  function mouthX(d) { return d.x + d.face * (d.K.half - 2); }

  function grab(d) {
    ball.st = 'mouth'; ball.holder = d; ball.vx = ball.vz = 0;
    play.phase = 'back'; play.fetcher = d;
    d.st = 'return'; d.t = 0; d.pose = 'stand'; d.wag = 6;
    if (d.kind === 'gold') d.energy = Math.max(0, d.energy - 0.2);
    dogs.forEach(function (o) {
      if (o !== d && (o.st === 'chase' || o.st === 'alert')) { o.st = 'follow'; o.t = 0; }
    });
    if (person.st === 'walk') { person.st = 'idle'; person.t = 0; }
  }

  // 球刚被丢出去：醒着的狗都去追
  function onBallFree() {
    ball.freeT = 0;
    dogs.forEach(function (d) {
      if (!awake(d)) return;
      if (d.kind === 'gold' && d.energy < 0.3) {   // 金毛累了，趴着看
        if (!(d.st === 'pose' && d.pose === 'lie')) { setPose(d, 'lie', 12); d.pant = true; }
        d.wag = 4;
        return;
      }
      d.st = 'alert'; d.t = 0; d.pose = 'stand'; d.wag = 6;
      d.react = d.kind === 'dax' ? rand(0.04, 0.16) : rand(0.22, 0.5);
    });
    if (awake(dax)) emote('bang', dax, 0, 0.7);
  }

  function landingX() {
    var disc = ball.vz * ball.vz + 2 * GRAV * Math.max(0, ball.z - BALL_R);
    var t = (ball.vz + Math.sqrt(disc)) / GRAV;
    return clamp(ball.x + ball.vx * t * 1.12, BALL_R + 2, LW - BALL_R - 2);
  }

  function updateDog(d, dt) {
    var K = d.K;
    d.t += dt;
    d.wagT += dt * d.wag;
    if (d.hype > 0) { d.hype -= dt; if (d.hype <= 0 && d.st !== 'chase' && d.st !== 'return') d.wag = 2; }
    // 跳
    if (d.z > 0) {
      d.vz -= GRAV * 1.5 * dt; d.z += d.vz * dt;
      if (d.z <= 0) { d.z = 0; d.vz = 0; }
    }
    // 金毛体力
    if (d.kind === 'gold' && d.st !== 'chase') {
      d.energy = Math.min(1, d.energy + dt * (d.pose === 'lie' || d.pose === 'sleep' ? 0.03 : 0.012));
    }

    switch (d.st) {
      case 'idle':
        coast(d, dt);
        think(d);
        break;

      case 'pose':
        coast(d, dt);
        if (d.pose === 'sleep') {
          if (now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * (K.half - 6), 1.8); d.zAt = now + 1.7; }
          if (d.t > d.dur) { if (sleepyTime()) d.t = 0; else think(d); }
        } else if (d.t > d.dur) think(d);
        break;

      case 'walk':
        if (drive(d, d.tx, d.spd, dt) || d.t > 14) think(d);
        break;

      case 'zoom':
        if (!d.way || !d.way.length || d.t > 12) { think(d); break; }
        if (drive(d, d.way[0], K.run, dt)) d.way.shift();
        break;

      case 'spin':
        coast(d, dt);
        d.face = (Math.floor(d.t * 9) % 2) ? 1 : -1;
        if (d.t > 1.3) { setPose(d, 'sit', rand(1.5, 3)); d.wag = 5; }
        break;

      case 'alert':
        coast(d, dt);
        faceTo(d, ball.x);
        if (d.t >= d.react) { d.st = 'chase'; d.t = 0; }
        break;

      case 'chase': {
        if (ball.st !== 'free') { d.st = ball.st === 'mouth' ? 'follow' : 'wait'; d.t = 0; break; }
        var tx = ball.z > 14 ? landingX() : ball.x + ball.vx * 0.12;
        var dir = sgn(tx - d.x);
        drive(d, tx - dir * (K.half - 4), K.run, dt);
        // 小腊肠会跳起来接
        if (d.kind === 'dax' && d.z === 0 && ball.vz < 0 && ball.z > 12 && ball.z < 30 && Math.abs(mouthX(d) - ball.x) < 16) hop(d, 165);
        if (Math.abs(mouthX(d) - ball.x) < K.grab && ball.z <= d.z + K.reach) grab(d);
        break;
      }

      case 'return': {
        if (ball.st !== 'mouth' || ball.holder !== d) { d.st = 'wait'; d.t = 0; break; }
        var side = sgn(d.x - person.x);
        if (drive(d, person.x + side * (K.half + 10), K.back, dt)) { d.face = -side; handover(d); }
        break;
      }

      case 'follow': {
        var f = play.fetcher;
        if (!f || ball.st !== 'mouth') { d.st = 'wait'; d.t = 0; break; }
        drive(d, f.x - f.face * (f.K.half + K.half + 5), d.kind === 'dax' ? K.run : K.trot * 1.5, dt);
        if (d.kind === 'dax' && d.z === 0 && Math.random() < dt * 1.6) hop(d, 105);
        break;
      }

      case 'wait': {   // 围在小人旁边等他丢
        if (play.phase === 'rest' && d.t > 2.2) { think(d); break; }
        var sd = d === dax ? person.face : -person.face;
        var wx = person.x + sd * (d === dax ? 30 : 40);
        if (drive(d, wx, K.trot * 1.4, dt)) {
          faceTo(d, person.x);
          d.pose = d.kind === 'dax' ? ((Math.floor(d.t * 0.7) % 2) ? 'bow' : 'stand') : 'sit';
          if (d.kind === 'dax' && Math.random() < dt * 0.9) hop(d, 95);
        } else d.pose = 'stand';
        d.wag = 6;
        break;
      }

      case 'beg': {   // 球被她拿在手里晃
        if (ball.st !== 'drag') { d.st = 'wait'; d.t = 0; break; }
        var bx = ball.x - sgn(ball.x - d.x) * (K.half - 6);
        if (Math.abs(ball.x - d.x) > K.half + 4) drive(d, bx, K.run * 0.9, dt); else { coast(d, dt); faceTo(d, ball.x); }
        d.pose = 'stand'; d.wag = 7;
        if (d.z === 0 && now > d.hopAt && Math.abs(ball.x - d.x) < 34 && ball.z < 70) {
          hop(d, d.kind === 'dax' ? rand(120, 170) : 0.01);
          d.hopAt = now + rand(0.5, 1.3);
        }
        break;
      }
    }

    // 鼠标靠近：看过来、摇尾巴；小腊肠会蹦一下
    if (pointer.inside && !pointer.drag && awake(d) && (d.st === 'pose' || d.st === 'idle') && d.pose !== 'lie') {
      var px = pointer.x, near = Math.abs(px - d.x) < 46 && pointer.y > LH - 70;
      if (near) {
        faceTo(d, px); d.wag = Math.max(d.wag, 5);
        if (d.kind === 'dax' && d.z === 0 && now > d.hopAt && Math.abs(px - d.x) < 24) { hop(d, 110); d.hopAt = now + rand(1.4, 3); }
      }
    }

    if (Math.abs(d.v) > 6) {
      var fps = K.runFps * clamp(Math.abs(d.v) / K.run, 0.45, 1);
      d.anim += dt * fps;
    }
  }

  function dogSprite(d) {
    var p = d.K.pre;
    if (Math.abs(d.v) > 6) {
      var i = Math.floor(d.anim) % 4;
      if (d.kind === 'gold' && Math.abs(d.v) < d.K.trot * 1.7) return 'g_trot' + i;
      return p + 'run' + i;
    }
    if (d.z > 1 && d.kind === 'dax') return 'd_jump';
    var w = (Math.floor(d.wagT) % 2) ? 'b' : 'a';
    switch (d.pose) {
      case 'sit': return p + 'sit_' + w;
      case 'bow': return d.kind === 'dax' ? 'd_bow_' + w : 'g_sit_' + w;
      case 'lie':
        if (d.kind === 'dax') return 'd_lie';
        return (d.pant && Math.floor(now * 4) % 2) ? 'g_lie' : (d.pant ? 'g_lie2' : 'g_lie');
      case 'sleep': return p + ((Math.floor(now * 0.7) % 2) ? 'sleep2' : 'sleep');
      default: return p + 'stand_' + w;
    }
  }

  // ------------------------------------------------------------
  //  小人
  // ------------------------------------------------------------
  function personIdle() { person.st = 'idle'; person.t = 0; }
  function personFront(dur) { person.st = 'front'; person.t = 0; person.dur = dur; }
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
    if (r < 0.22) {
      var tx = clamp(person.x + pick([-1, 1]) * rand(30, 110), LW * 0.16, LW * 0.84);
      if (Math.abs(tx - person.x) > 16) { person.st = 'walk'; person.t = 0; person.tx = tx; }
    } else if (r < 0.36) personFront(rand(2.2, 4));
  }
  function throwDir() { return person.x < LW / 2 ? 1 : -1; }

  function startSession(n) {
    play.rounds = n; play.phase = 'ready'; play.throwAt = now + rand(0.9, 1.6);
    if (person.st !== 'idle') personIdle();
    person.face = throwDir();
    wake(dax, true);
    if (gold.energy > 0.3) wake(gold, true);
    dogs.forEach(function (d) {
      if (!awake(d)) return;
      if (d.kind === 'gold' && d.energy < 0.3) return;
      d.st = 'wait'; d.t = 0; d.pose = 'stand';
    });
  }
  function personThrow() {
    person.st = 'windup'; person.t = 0; person.face = throwDir();
  }
  function doLaunch() {
    var dir = person.face;
    var room = (dir > 0 ? LW - person.x : person.x) - 24;
    var dist = Math.max(40, room * rand(0.32, 0.74));
    var tMax = Math.sqrt(8 * Math.max(30, Math.min(LH - 34, 120)) / GRAV);
    var T = clamp(rand(0.85, 1.25), 0.55, tMax);
    var s = SPR.p_release, hx = s.hand[0] + 1, hy = s.hand[1] + 1;
    var x0 = Math.round(person.x - s.w / 2), wx = dir > 0 ? x0 + hx : x0 + (s.w - 1 - hx);
    ball.st = 'free'; ball.holder = null;
    ball.x = clamp(wx, BALL_R, LW - BALL_R);
    ball.z = s.h - hy;
    ball.vx = dir * dist / T;
    ball.vz = GRAV * T / 2;
    play.phase = 'fly'; play.rounds = Math.max(0, play.rounds - 1);
    play.lastPlay = now;
    onBallFree();
  }
  // 狗把球叼回来了
  function handover(d) {
    person.face = sgn(d.x - person.x);
    person.st = 'pat'; person.t = 0; person.giveTo = d;
    d.st = 'wait'; d.t = 0; d.pose = 'sit'; d.wag = 7;
    emote('heart', d, d.face * (d.K.half - 8));
    ball.st = 'handing';
    ball.x = mouthX(d); ball.z = BALL_R;
    play.lastPlay = now;
    if (play.rounds > 0 && !sleepyTime()) { play.phase = 'ready'; play.throwAt = now + rand(1.5, 2.9); }
    else { play.phase = 'rest'; play.nextAt = now + range(CFG.autoPlaySeconds, 70); person.next = now + rand(3, 6); }
  }

  function updatePerson(dt) {
    var p = person;
    p.t += dt;
    switch (p.st) {
      case 'idle':
        if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'mouth') {
          var bx = ball.st === 'mouth' && ball.holder ? ball.holder.x : ball.x;
          if (Math.abs(bx - p.x) > 6) p.face = bx > p.x ? 1 : -1;
        }
        if (sleepyTime() && play.phase === 'rest') { p.st = 'sleep'; p.t = 0; break; }
        if (play.phase === 'rest' && now >= p.next) personThink();
        break;
      case 'walk':
        if (play.phase !== 'rest') { personIdle(); break; }
        var dx = p.tx - p.x;
        if (Math.abs(dx) < 1.2 || p.t > 10) { personIdle(); break; }
        p.face = sgn(dx);
        p.x += p.face * 24 * dt;
        p.anim += dt * 6.5;
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
      case 'pat':
        if (p.t >= 0.75) {
          if (ball.st === 'handing') { ball.st = 'hand'; ball.holder = null; }
          p.giveTo = null;
          personIdle();
          if (play.phase === 'ready') p.face = throwDir();
        }
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
    }
    // 鼠标停在他身上一会儿：转过来挥挥手
    if (pointer.inside && !pointer.drag && p.box && (p.st === 'idle' || p.st === 'front') && play.phase === 'rest') {
      var over = pointer.x > p.box[0] - 3 && pointer.x < p.box[2] + 3 && pointer.y > p.box[1] - 3 && pointer.y < p.box[3] + 2;
      p.hoverT = over ? p.hoverT + dt : 0;
      if (p.hoverT > 0.45 && now > p.waveCd) { p.hoverT = 0; personWave(); }
    } else p.hoverT = 0;
  }

  function personSprite() {
    var p = person, breath = Math.floor(now / 0.85) % 2, blink = (now % 4.3) < 0.14;
    switch (p.st) {
      case 'walk': return 'p_walk' + (Math.floor(p.anim) % 4);
      case 'windup': return 'p_windup';
      case 'release': return 'p_release';
      case 'follow': return 'p_follow';
      case 'pat': return 'p_pat';
      case 'front': return blink ? 'p_front_blink' : (breath ? 'p_front2' : 'p_front');
      case 'wave': return (Math.floor(p.t * 5) % 2) ? 'p_wave_a' : 'p_wave_b';
      case 'sleep': return 'p_front_blink';
      default:
        if (ball.st === 'hand') return breath ? 'p_hold2' : 'p_hold';
        return blink ? 'p_blink' : (breath ? 'p_idle2' : 'p_idle');
    }
  }

  // ------------------------------------------------------------
  //  小球
  // ------------------------------------------------------------
  function updateBall(dt) {
    if (ball.st !== 'free') return;
    ball.freeT += dt;
    ball.vz -= GRAV * dt;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x > LW - BALL_R) { ball.x = LW - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.6; }
    if (ball.z <= BALL_R) {
      ball.z = BALL_R;
      if (ball.vz < -45) { ball.vz = -ball.vz * 0.52; ball.vx *= 0.74; }
      else { ball.vz = 0; ball.vx *= Math.exp(-2.4 * dt); if (Math.abs(ball.vx) < 3) ball.vx = 0; }
    }
    ball.rot += ball.vx * dt * 0.16;
    // 保险：球落地好一阵子都没狗去捡（比如都睡了）→ 叫醒小腊肠
    if (ball.freeT > 5 && ball.vx === 0 && !dogs.some(function (d) { return d.st === 'chase' || d.st === 'alert'; })) {
      wake(dax); dax.st = 'chase'; dax.t = 0; dax.pose = 'stand'; ball.freeT = 0;
    }
  }

  // ------------------------------------------------------------
  //  总导演：什么时候开始玩
  // ------------------------------------------------------------
  function updatePlay() {
    if (play.phase === 'rest') {
      if (opt.auto && !sleepyTime() && now >= play.nextAt && ball.st === 'hand' && (person.st === 'idle' || person.st === 'front' || person.st === 'walk')) {
        startSession(randInt(2, 4));
      }
    } else if (play.phase === 'ready') {
      if (ball.st === 'hand' && person.st === 'idle' && now >= play.throwAt) personThrow();
    }
  }

  // ------------------------------------------------------------
  //  鼠标 / 手指
  // ------------------------------------------------------------
  function inBox(b, x, y, pad) { return b && x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad; }
  function touchAll() {
    lastTouch = now;
    dogs.forEach(function (d) { wake(d); });
    if (person.st === 'sleep') personIdle();
  }
  function pet(d) {
    emote('heart', d, d.face * (d.K.half - 8));
    d.wag = 8; d.hype = 3;
    if (d.st === 'pose' || d.st === 'idle') {
      if (d.kind === 'dax') { setPose(d, 'stand', 1.6); d.wag = 8; hop(d, 120); }
      else { setPose(d, 'sit', 2.4); d.wag = 8; }
    }
  }
  function clickPerson() {
    var p = person;
    if (ball.st === 'hand' && (p.st === 'idle' || p.st === 'front' || p.st === 'wave' || p.st === 'walk')) {
      personIdle();
      if (play.phase === 'rest') startSession(1); else play.rounds = Math.max(play.rounds, 0);
      play.phase = 'ready'; play.throwAt = now + 0.05;
    } else if (p.st === 'idle' || p.st === 'front') {
      personWave();
    }
  }
  function ptDown(x, y) {
    pointer.x = x; pointer.y = y; pointer.down = true; pointer.inside = true;
    var wasNightAsleep = sleepyTime();
    touchAll();
    if (ball.vis && inBox(ball.box, x, y, 4)) {
      // 抓住小球
      if (ball.st === 'mouth' && ball.holder) { ball.holder.st = 'beg'; ball.holder.t = 0; }
      if (person.st === 'windup' || person.st === 'pat') personIdle();
      ball.st = 'drag'; ball.holder = null; ball.vx = ball.vz = 0;
      pointer.drag = true; pointer.hist = [];
      play.phase = 'drag';
      dogs.forEach(function (d) {
        if (d.kind === 'gold' && d.energy < 0.3) return;
        d.st = 'beg'; d.t = 0; d.pose = 'stand';
      });
      ptMove(x, y);
      post();
      return;
    }
    if (inBox(dax.box, x, y, 1)) { pet(dax); return; }
    if (inBox(gold.box, x, y, 1)) { pet(gold); return; }
    if (inBox(person.box, x, y, 1)) { if (wasNightAsleep) personWave(); else clickPerson(); return; }
  }
  function ptMove(x, y) {
    pointer.x = x; pointer.y = y; pointer.inside = true;
    if (!pointer.drag) return;
    ball.x = clamp(x, BALL_R, LW - BALL_R);
    ball.z = clamp(LH - y, BALL_R, LH + 30);
    var t = performance.now() / 1000;
    pointer.hist.push([t, ball.x, ball.z]);
    while (pointer.hist.length > 2 && t - pointer.hist[0][0] > 0.11) pointer.hist.shift();
  }
  function ptUp() {
    pointer.down = false;
    if (!pointer.drag) return;
    pointer.drag = false;
    var h = pointer.hist, vx = 0, vz = 0;
    if (h.length >= 2) {
      var a = h[0], b = h[h.length - 1], dtt = Math.max(0.016, b[0] - a[0]);
      vx = (b[1] - a[1]) / dtt; vz = (b[2] - a[2]) / dtt;
    }
    var vMaxZ = Math.sqrt(2 * GRAV * (LH * 1.1));
    ball.vx = clamp(vx * 0.9, -560, 560);
    ball.vz = clamp(vz * 0.9, -400, vMaxZ);
    ball.st = 'free';
    play.phase = 'fly'; play.lastPlay = now;
    if (opt.auto) play.rounds = Math.max(play.rounds, 1);   // 她丢完，小人也回丢一个
    onBallFree();
    post();
  }
  function ptHover(x, y) { pointer.x = x; pointer.y = y; pointer.inside = true; }
  function ptLeave() { pointer.inside = false; }

  // ------------------------------------------------------------
  //  画
  // ------------------------------------------------------------
  function drawEnt(name, cx, z, face) {
    var s = SPR[name];
    if (!s) return null;
    var x = Math.round(cx - s.w / 2), y = Math.round(LH - s.h - z);
    ctx.drawImage(face < 0 ? s.flip : s.img, x, y);
    var bx0 = face < 0 ? s.w - 1 - s.bb[2] : s.bb[0], bx1 = face < 0 ? s.w - 1 - s.bb[0] : s.bb[2];
    return { s: s, x: x, y: y, box: [x + bx0, y + s.bb[1], x + bx1, y + s.bb[3]] };
  }
  function anchor(r, a, face) {   // 图上的锚点 → 画布坐标
    var ax = a[0] + 1, ay = a[1] + 1;
    return [face < 0 ? r.x + (r.s.w - 1 - ax) : r.x + ax, r.y + ay];
  }
  function drawBall(cx, cyTop) {
    var f = ((Math.floor(ball.rot) % 4) + 4) % 4, s = SPR['ball' + f];
    var x = Math.round(cx - s.w / 2), y = Math.round(cyTop - s.h / 2);
    ctx.drawImage(s.img, x, y);
    ball.box = [x, y, x + s.w - 1, y + s.h - 1];
    ball.vis = true;
  }

  function draw() {
    ctx.clearRect(0, 0, LW, LH);
    var held = null;

    // 金毛（最后面）
    var rg = drawEnt(dogSprite(gold), gold.x, gold.z, gold.face);
    gold.box = rg.box;
    // 小人
    var ps = personSprite();
    var pFace = (person.st === 'front' || person.st === 'wave' || person.st === 'sleep') ? 1 : person.face;
    var rp = drawEnt(ps, person.x, 0, pFace);
    person.box = rp.box;
    // 小腊肠（最前面）
    var rd = drawEnt(dogSprite(dax), dax.x, dax.z, dax.face);
    dax.box = rd.box;

    // 小球
    ball.vis = false;
    if (ball.st === 'hand') {
      if (rp.s.hand) { held = anchor(rp, rp.s.hand, pFace); drawBall(held[0] + 0.5, held[1] + 0.5); ball.x = held[0]; ball.z = LH - held[1]; }
      else ball.box = null;
    } else if (ball.st === 'mouth' && ball.holder) {
      var r = ball.holder === dax ? rd : rg;
      if (r.s.mouth) { held = anchor(r, r.s.mouth, ball.holder.face); drawBall(held[0] + 0.5, held[1] + 0.5); ball.x = held[0]; ball.z = LH - held[1]; }
    } else {
      drawBall(ball.x, LH - ball.z);
    }

    // 表情
    for (var i = 0; i < emotes.length; i++) {
      var e = emotes[i], s = SPR['fx_' + e.type];
      if (!s || !e.ent.box) continue;
      var k = e.t / e.life;
      if (k > 0.8 && Math.floor(e.t * 16) % 2) continue;   // 快消失时闪一闪
      var ex = Math.round(e.ent.x + e.dx - s.w / 2 + (e.type === 'z' || e.type === 'zs' ? e.t * 4 : 0));
      var ey = Math.round(e.ent.box[1] - s.h - 2 - e.t * 9);
      ctx.drawImage(s.img, ex, Math.max(0, ey));
    }
    placeBubble();
  }

  // 告诉 Mac 外壳：现在哪些地方是"可以点的"（其余地方鼠标直接穿过去）
  var lastPost = 0, lastMsg = '';
  function post() {
    if (!NATIVE) return;
    var rects = [];
    function add(b, pad) {
      if (!b) return;
      rects.push(Math.round((b[0] - pad) * S + offX), Math.round((b[1] - pad) * S + offY),
                 Math.round((b[2] - b[0] + 1 + pad * 2) * S), Math.round((b[3] - b[1] + 1 + pad * 2) * S));
    }
    if (ball.vis) add(ball.box, 4);
    add(dax.box, 1); add(gold.box, 1); add(person.box, 1);
    var msg = JSON.stringify({ t: 'hot', r: rects, d: pointer.drag ? 1 : 0 });
    if (msg === lastMsg) return;
    lastMsg = msg;
    try { window.webkit.messageHandlers.pet.postMessage(msg); } catch (e) {}
  }

  // ------------------------------------------------------------
  //  主循环
  // ------------------------------------------------------------
  function step(dt) {
    now += dt;
    updatePlay();
    updatePerson(dt);
    updateDog(gold, dt);
    updateDog(dax, dt);
    updateBall(dt);
    for (var i = emotes.length - 1; i >= 0; i--) { emotes[i].t += dt; if (emotes[i].t >= emotes[i].life) emotes.splice(i, 1); }
  }
  function busy() {
    if (pointer.drag || pointer.inside || ball.st === 'free' || ball.st === 'mouth' || emotes.length) return true;
    if (person.st !== 'idle' && person.st !== 'front' && person.st !== 'sleep') return true;
    return dogs.some(function (d) { return Math.abs(d.v) > 1 || d.z > 0 || d.st === 'wait' || d.st === 'spin'; });
  }
  var lastMs = 0, timer = 0;
  function frame(ms) {
    timer = 0;
    if (opt.paused) return;
    var dt = lastMs ? (ms - lastMs) / 1000 : 0.016;
    lastMs = ms;
    dt = clamp(dt, 0, 0.25);
    var n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (var i = 0; i < n; i++) step(dt / n);
    draw();
    if (now - lastPost > 0.08) { lastPost = now; post(); }
    schedule();
  }
  function schedule() {
    if (timer || opt.paused) return;
    // 没事的时候慢一点画，省电
    if (busy()) timer = requestAnimationFrame(frame);
    else timer = setTimeout(function () { timer = requestAnimationFrame(frame); }, 90);
  }

  // ------------------------------------------------------------
  //  对外接口（Mac 外壳会调用这些）
  // ------------------------------------------------------------
  function toL(x, y) { return [(x - offX) / S, (y - offY) / S]; }
  window.pet = {
    configure: function (o) {
      if (!o) return;
      if (typeof o.auto === 'boolean') { opt.auto = o.auto; if (!o.auto) play.rounds = 0; }
      if (typeof o.scale === 'number' && o.scale !== opt.scale) { opt.scale = o.scale; layout(); draw(); }
      if (typeof o.paused === 'boolean') {
        opt.paused = o.paused;
        if (!o.paused) { lastMs = 0; schedule(); }
      }
    },
    command: function (name) {
      if (name === 'throw') { touchAll(); clickPerson(); }
      else if (name === 'wave') { touchAll(); personWave(); }
    },
    // type: down | move | up | hover | leave ；坐标是页面里的 CSS 像素
    pointer: function (type, x, y) {
      var p = toL(x, y);
      if (type === 'down') ptDown(p[0], p[1]);
      else if (type === 'move') ptMove(p[0], p[1]);
      else if (type === 'up') ptUp();
      else if (type === 'hover') ptHover(p[0], p[1]);
      else if (type === 'leave') ptLeave();
      schedule();
    },
    // 给测试用
    _t: {
      step: function (dt) { step(dt); },
      draw: draw,
      state: function () {
        return {
          now: now, phase: play.phase, rounds: play.rounds, ball: { st: ball.st, x: ball.x, z: ball.z, holder: ball.holder && ball.holder.kind },
          person: { st: person.st, x: person.x }, dax: { st: dax.st, pose: dax.pose, x: dax.x, z: dax.z, v: dax.v },
          gold: { st: gold.st, pose: gold.pose, x: gold.x, v: gold.v, energy: gold.energy }, LW: LW, LH: LH, S: S,
        };
      },
      boxes: function () { return { ball: ball.box, dax: dax.box, gold: gold.box, person: person.box, S: S, offX: offX, offY: offY }; },
      set: function (k, v) { if (k === 'nextAt') play.nextAt = v; if (k === 'msgAt') person.msgAt = v; if (k === 'energy') gold.energy = v; },
    },
  };

  // 浏览器预览：直接用网页自己的鼠标 / 触摸事件
  if (!NATIVE) {
    document.body.classList.add('preview');
    if (QS.get('dark') === '1') document.body.classList.add('dark');
    if (QS.get('bare') === '1') document.body.classList.remove('preview');
    window.addEventListener('pointerdown', function (e) { window.pet.pointer('down', e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener('pointermove', function (e) { window.pet.pointer(pointer.down ? 'move' : 'hover', e.clientX, e.clientY); });
    window.addEventListener('pointerup', function () { window.pet.pointer('up', 0, 0); });
    window.addEventListener('pointercancel', function () { window.pet.pointer('up', 0, 0); });
    document.addEventListener('mouseleave', function () { window.pet.pointer('leave', 0, 0); });
  }
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // 改变大小会清空画布，所以马上重画一次，免得闪一下空白
  window.addEventListener('resize', function () { layout(); draw(); schedule(); });

  layout();
  person.msgAt = range(CFG.messageMinutes, 40) * 60 * rand(0.2, 0.6);
  // 刚打开：小人先转过来挥挥手
  setTimeout(function () { if (person.st === 'idle' && play.phase === 'rest') personWave(); }, 1600);
  schedule();
  if (NATIVE) { try { window.webkit.messageHandlers.pet.postMessage(JSON.stringify({ t: 'ready' })); } catch (e) {} }
})();
