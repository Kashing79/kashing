// 球球 · 浏览器外壳
//
// 玩法在 pet.js 里（它不碰网页）。这个文件负责网页这一头的事：
//   · 一张画布：每一帧问引擎"现在该画什么"，照着清单一张一张贴上去
//   · 鼠标 / 手指事件、网址里的选项（?scale= roam= grass= auto= entrance= res=）
//   · 小人说话的气泡、屏幕顶上的岛（island.js）、预览 / 手机版用的草地
// 手机网页版、在线预览、直接用浏览器打开 index.html，用的都是这一份。
(function () {
  'use strict';

  var CFG = window.PET_CONFIG || {};
  var QS = new URLSearchParams(location.search);
  // 旧版的 Mac 外壳把网页放在一个网页视图里；第三版的 Mac 外壳不用网页了，这几行只是让旧外壳也还能用
  var NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.pet);
  function send(o) { try { window.webkit.messageHandlers.pet.postMessage(JSON.stringify(o)); } catch (e) {} }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var cfg = Object.assign({}, CFG);
  if (QS.has('roam')) cfg.roam = QS.get('roam') !== '0';
  if (QS.has('grass')) cfg.grass = QS.get('grass') !== '0';
  if (QS.has('res')) cfg.res = parseInt(QS.get('res'), 10) || 2;
  cfg.auto = QS.get('auto') !== '0';
  cfg.entrance = QS.get('entrance') !== '0';
  cfg.lawnTap = !NATIVE;            // 浏览器里点空地 = 往那儿丢球；Mac 上"空地"是她的桌面，不归我们管

  var R = clamp(Math.round(+cfg.res) || 2, 1, 4);      // 一个世界单位画成几个像素
  var grass = !!cfg.grass;
  var optScale = parseInt(QS.get('scale') || '0', 10) || 0;   // 0 = 自动
  var optInsets = null;      // Mac 外壳告诉我们：菜单栏、程序坞各占多少
  var paused = false;

  var canvas = document.getElementById('stage');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'stage'; document.body.appendChild(canvas); }
  var ctx = canvas.getContext('2d');
  var bubbleLayer = document.getElementById('bubbles');

  var S = 3;                 // 一个世界单位放大成几个 CSS 像素
  var LW = 300, LH = 110;    // 画面的大小（世界单位）
  var offX = 0, offY = 0;    // 画布左上角在页面里的位置（CSS 像素）
  var last = null;           // 上一帧的清单

  // ------------------------------------------------------------
  //  引擎
  // ------------------------------------------------------------
  var ISL = window.PET_ISLAND || null;
  var eng = window.PET_ENGINE.create({
    now: function () { return performance.now() / 1000; },
    storage: {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    },
    haptic: function (k) { if (NATIVE) send({ t: 'haptic', k: k }); },
    island: ISL ? {
      center: function () { return ((ISL.center ? ISL.center() : window.innerWidth / 2) - offX) / S; },
      visible: function () { return !ISL.visible || ISL.visible(); },
      // 把谁拎到岛上（或者岛附近）放下
      hit: function (x, y) {
        var ir = ISL.rects ? ISL.rects() : null, px = x * S + offX, py = y * S + offY;
        return !!(ir && ir.length >= 4 && px >= ir[0] - 12 && px <= ir[0] + ir[2] + 12 && py <= ir[1] + ir[3] + 30);
      },
    } : null,
  }, cfg);

  // ------------------------------------------------------------
  //  版面
  // ------------------------------------------------------------
  var probe = null;
  function cssInsets() {
    var ex = CFG.insets || {};
    if (optInsets) return optInsets;
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe);
    return {
      top: (parseFloat(cs.paddingTop) || 0) + (ex.top || 0), right: (parseFloat(cs.paddingRight) || 0) + (ex.right || 0),
      bottom: (parseFloat(cs.paddingBottom) || 0) + (ex.bottom || 0), left: (parseFloat(cs.paddingLeft) || 0) + (ex.left || 0),
    };
  }
  function layout() {
    var box = canvas.parentElement || document.body;
    var vw = box.clientWidth || window.innerWidth, vh = box.clientHeight || window.innerHeight;
    var autoS = typeof CFG.autoScale === 'function' ? CFG.autoScale(vw, vh) : 0;
    S = optScale || autoS || (vw < 520 ? 2 : (vw < 1150 ? 3 : 4));
    LW = Math.max(150, Math.floor(vw / S));
    LH = Math.max(70, Math.floor(vh / S));
    // 画布里一格是一个像素（LW*R × LH*R），再整体放大到 LW*S × LH*S
    canvas.width = LW * R; canvas.height = LH * R;
    canvas.style.width = (LW * S) + 'px';
    canvas.style.height = (LH * S) + 'px';
    var rect = canvas.getBoundingClientRect();
    offX = rect.left; offY = rect.top;
    ctx.imageSmoothingEnabled = false;
    var ins = cssInsets();
    eng.configure({ view: { w: LW, h: LH }, insets: { top: ins.top / S, bottom: ins.bottom / S, left: ins.left / S, right: ins.right / S } });
    if (grass) makeLawn();
  }

  // ------------------------------------------------------------
  //  把一张图（一块 RGBA 像素）变成可以直接贴的小画布；像素没变就一直用同一张。
  //  有名字（key）的图内容不会变，按名字记；没名字的（三个角色）按 ver 看变没变
  // ------------------------------------------------------------
  var byKey = {}, byImg = new WeakMap();
  function canvasOf(im) {
    var c = im.key ? byKey[im.key] : byImg.get(im);
    if (!c) {
      c = { cv: document.createElement('canvas'), cx: null, id: null, ver: -1 };
      c.cx = c.cv.getContext('2d');
      if (im.key) byKey[im.key] = c; else byImg.set(im, c);
    }
    if (c.cv.width !== im.w || c.cv.height !== im.h) { c.cv.width = im.w; c.cv.height = im.h; c.id = null; c.ver = -1; }
    if (c.ver === -1 || (!im.key && c.ver !== im.ver)) {
      if (!c.id) c.id = c.cx.createImageData(im.w, im.h);
      c.id.data.set(im.data);
      c.cx.putImageData(c.id, 0, 0);
      c.ver = im.key ? 1 : (im.ver == null ? -1 : im.ver);
    }
    return c.cv;
  }
  // 照着清单画：位置对齐到像素；图自己的精细度和画布不一样时（比如旧图），照比例放大，不抹匀
  function paint(c, items, RR) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i], im = it.img, cv = canvasOf(im), k = RR / (im.scale || 1);
      var x = Math.round(it.x * RR), y = Math.round(it.y * RR), w = im.w * k, h = im.h * k;
      if (it.a < 1) c.globalAlpha = it.a;
      if (it.flip) {       // 左右镜像
        c.setTransform(-1, 0, 0, 1, x + w, y);
        c.drawImage(cv, 0, 0, w, h);
        c.setTransform(1, 0, 0, 1, 0, 0);
      } else if (k === 1) c.drawImage(cv, x, y);
      else c.drawImage(cv, x, y, w, h);
      if (it.a < 1) c.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------
  //  草地（手机版 / 预览用；Mac 上草地是桌面上另一个窗口）
  // ------------------------------------------------------------
  var lawn = null, lawnKey = '';
  function makeLawn() {
    var ph = eng.status().phase, key = LW + 'x' + LH + ph + '@' + R;
    if (key === lawnKey) return;
    lawnKey = key;
    var L = window.PET_LAWN;
    var im = (L && L.render) ? L.render(LW, LH, ph, R, { mode: 'full' }) : oldLawn(LW, LH, ph);
    if (!lawn) lawn = document.createElement('canvas');
    lawn.width = im.w; lawn.height = im.h;
    var c = lawn.getContext('2d'), id = c.createImageData(im.w, im.h);
    id.data.set(im.data);
    c.putImageData(id, 0, 0);
  }
  // 没有 lawn.js 时的旧草地：一条深一条浅的底色，上面撒草丛和小花（一个世界单位一个像素）
  function oldLawn(w, h, ph) {
    var P = { day: ['#8fca78', '#84c06e', '#9ad584', '#77b363', '#ffffff', '#ffe27a', '#ff9fc0'],
              dusk: ['#86b96e', '#7bae65', '#94c57c', '#6c9f59', '#fff1dc', '#ffd07a', '#ff9aa8'],
              night: ['#2f5a45', '#2a5340', '#37664f', '#234737', '#b9d6c9', '#c9c27a', '#b98aa6'] }[ph];
    var d = new Uint8ClampedArray(w * h * 4), seed = 1234567;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function rect(col, x0, y0, rw, rh) {
      var r = parseInt(col.substr(1, 2), 16), g = parseInt(col.substr(3, 2), 16), b = parseInt(col.substr(5, 2), 16);
      for (var y = Math.max(0, y0); y < Math.min(h, y0 + rh); y++) {
        for (var x = Math.max(0, x0); x < Math.min(w, x0 + rw); x++) { var o = (y * w + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; }
      }
    }
    rect(P[0], 0, 0, w, h);
    // 一条深一条浅，像刚割过的草坪
    for (var y = 0; y < h; y += 26) rect(P[1], 0, y + 13, w, 13);
    // 草丛
    var n = Math.round(w * h / 260), i, x, yy, k, col;
    for (i = 0; i < n; i++) {
      x = Math.floor(rnd() * w); yy = Math.floor(rnd() * h); k = rnd();
      col = k < 0.5 ? P[2] : P[3];
      rect(col, x, yy, 1, 2); rect(col, x + 2, yy + 1, 1, 1);
      if (k > 0.8) rect(col, x - 1, yy + 1, 1, 1);
    }
    // 小花
    n = Math.round(w * h / 2600);
    for (i = 0; i < n; i++) {
      x = Math.floor(rnd() * w); yy = Math.floor(rnd() * h);
      col = P[4 + Math.floor(rnd() * 3)];
      rect(col, x, yy, 1, 1); rect(col, x - 1, yy + 1, 3, 1); rect(col, x, yy + 2, 1, 1);
      rect(P[5], x, yy + 1, 1, 1);
    }
    return { w: w, h: h, data: d, scale: 1, ox: 0, oy: 0, key: null, ver: 1 };
  }

  // ------------------------------------------------------------
  //  小人说话的气泡
  // ------------------------------------------------------------
  var bub = null;            // { el, id }
  function placeBubble(b) {
    if (!bubbleLayer) return;
    if (bub && (!b || b.id !== bub.id)) {
      var old = bub.el; bub = null;
      if (b) old.remove();                // 换了一句：旧的马上拿掉
      else { old.classList.remove('on'); setTimeout(function () { old.remove(); }, 400); }
    }
    if (!b) return;
    if (!bub) {
      var el = document.createElement('div');
      el.className = 'bubble';
      el.textContent = b.text;
      bubbleLayer.appendChild(el);
      bub = { el: el, id: b.id };
      requestAnimationFrame(function () { el.classList.add('on'); });
    }
    var lr = bubbleLayer.getBoundingClientRect();
    bub.el.style.left = clamp(b.x * S + offX - lr.left, 130, Math.max(130, lr.width - 130)) + 'px';
    bub.el.style.top = (b.y * S + offY - lr.top - 14) + 'px';
  }

  // ------------------------------------------------------------
  //  画
  // ------------------------------------------------------------
  function draw() {
    var fr = eng.compose();
    last = fr;
    if (grass && lawn) ctx.drawImage(lawn, 0, 0, LW * R, LH * R); else ctx.clearRect(0, 0, LW * R, LH * R);
    paint(ctx, fr.items, R);
    drawIsland();
    placeBubble(fr.bubble);
  }
  // 告诉岛现在的状态；在岛里睡觉的时候，把它们画到岛上的小画布里
  function drawIsland() {
    if (!ISL) return;
    var cv = ISL.canvas ? ISL.canvas() : null;
    if (ISL.state) ISL.state(eng.status());
    if (!cv) return;
    var d = eng.den(R), w = Math.round(d.w * R), h = Math.round(d.h * R);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var c = cv.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.imageSmoothingEnabled = false;
    paint(c, d.items, R);
  }

  // 告诉旧版 Mac 外壳：现在哪些地方是"可以点的"（其余地方鼠标直接穿过去）
  var lastPost = 0, lastMsg = '';
  function post() {
    if (!NATIVE || !last) return;
    var rects = [], hot = last.hot, i;
    for (i = 0; i < hot.length; i++) {
      rects.push(Math.round(hot[i][0] * S + offX), Math.round(hot[i][1] * S + offY), Math.round(hot[i][2] * S), Math.round(hot[i][3] * S));
    }
    if (ISL && ISL.rects) { var ir = ISL.rects(); for (i = 0; i < ir.length; i++) rects.push(Math.round(ir[i])); }
    var msg = JSON.stringify({ t: 'hot', r: rects, d: eng.status().drag ? 1 : 0 });
    if (msg === lastMsg) return;
    lastMsg = msg;
    try { window.webkit.messageHandlers.pet.postMessage(msg); } catch (e) {}
  }

  // ------------------------------------------------------------
  //  主循环
  // ------------------------------------------------------------
  var lastMs = 0, raf = 0, tmo = 0, MINF = 1000 / 36;
  function frame(ms) {
    raf = 0;
    if (paused) return;
    if (lastMs && ms - lastMs < MINF - 2) { raf = requestAnimationFrame(frame); return; }   // 最多每秒画三十几次
    var dt = lastMs ? (ms - lastMs) / 1000 : 0.016;
    lastMs = ms;
    dt = clamp(dt, 0, 0.25);
    var n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (var i = 0; i < n; i++) eng.step(dt / n);
    draw();
    if (ms - lastPost > 80) { lastPost = ms; post(); }
    schedule();
  }
  function schedule() {
    if (raf || tmo || paused) return;
    // 没事的时候慢一点画，省电；都在岛里睡觉时每秒只画两次
    var b = eng.busy();
    if (b === 2) raf = requestAnimationFrame(frame);
    else tmo = setTimeout(function () { tmo = 0; if (!raf && !paused) raf = requestAnimationFrame(frame); }, b === 1 ? 40 : (eng.status().home === 'in' ? 450 : 80));
  }
  // 她碰了一下 / 按了按钮：别等慢速的那一拍，马上画
  function kick() {
    if (tmo) { clearTimeout(tmo); tmo = 0; }
    if (!raf && !paused) raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------
  //  对外接口（灵动岛、测试脚本、旧版 Mac 外壳会调用这些）
  // ------------------------------------------------------------
  var down = false;          // 手指 / 鼠标是不是按着（按在岛上的不算）
  window.pet = {
    configure: function (o) {
      if (!o) return;
      var relayout = false, redraw = false, e = {};
      if (typeof o.auto === 'boolean') e.auto = o.auto;
      if (typeof o.scale === 'number' && o.scale !== optScale) { optScale = o.scale; relayout = true; }
      if (typeof o.roam === 'boolean') { e.roam = o.roam; redraw = true; }
      if (o.insets) { optInsets = o.insets; relayout = true; }
      if (typeof o.soft === 'boolean') { MINF = 1000 / (o.soft ? 20 : 36); e.soft = o.soft; }   // 不用显卡画的时候少画几帧，省一点电
      if (typeof o.grass === 'boolean' && o.grass !== grass) { grass = o.grass; e.grass = grass; lawnKey = ''; if (grass) makeLawn(); redraw = true; }
      if (typeof o.res === 'number' && clamp(Math.round(o.res) || 2, 1, 4) !== R) { R = clamp(Math.round(o.res) || 2, 1, 4); e.res = R; relayout = true; }
      eng.configure(e);
      if (relayout) layout();
      if (relayout || redraw) draw();
      if (typeof o.paused === 'boolean') {
        paused = o.paused;
        if (!o.paused) { lastMs = 0; schedule(); }
      }
    },
    command: function (name) { eng.command(name); kick(); },
    // type: down | move | up | hover | leave ；坐标是页面里的 CSS 像素
    pointer: function (type, x, y) {
      // 手里正拖着球 / 拎着谁的时候，岛先不要展开挡住视线
      if (ISL && ISL.pointer && !eng.status().drag && ISL.pointer(type, x, y)) { schedule(); return; }
      if (type === 'down') down = true; else if (type === 'up') down = false;
      eng.pointer(type, (x - offX) / S, (y - offY) / S);
      if (type === 'down' || type === 'up') { post(); kick(); } else schedule();
    },
    status: function () { return eng.status(); },
    // 给测试用
    _t: {
      step: function (dt) { eng.step(dt); },
      draw: draw,
      state: function () { var s = eng._t.state(); s.S = S; return s; },
      boxes: function () { var b = eng._t.boxes(); b.S = S; b.offX = offX; b.offY = offY; return b; },
      set: eng._t.set,
      scene: eng._t.scene,
      endScene: eng._t.endScene,
      perf: eng._t.perf,
      engine: eng,
    },
  };

  // 浏览器 / 手机：直接用网页自己的鼠标 / 触摸事件
  if (!NATIVE) {
    window.addEventListener('pointerdown', function (e) { window.pet.pointer('down', e.clientX, e.clientY); if (e.cancelable) e.preventDefault(); });
    window.addEventListener('pointermove', function (e) { window.pet.pointer(down ? 'move' : 'hover', e.clientX, e.clientY); });
    window.addEventListener('pointerup', function () { window.pet.pointer('up', 0, 0); });
    window.addEventListener('pointercancel', function () { window.pet.pointer('up', 0, 0); });
    document.addEventListener('mouseleave', function () { window.pet.pointer('leave', 0, 0); });
  }
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // 改变大小会清空画布，所以马上重画一次，免得闪一下空白
  window.addEventListener('resize', function () { layout(); draw(); schedule(); });
  setInterval(function () { if (grass) { makeLawn(); schedule(); } }, 5 * 60 * 1000);

  layout();
  schedule();

  // 画布到底能不能用：画一块红色再读回来。读不回来 = 这台机器上显卡画布是坏的，
  // 告诉旧版 Mac 外壳换一种画法重新载入。
  function canvasOK() {
    try {
      var t = document.createElement('canvas'); t.width = 96; t.height = 64;
      var x = t.getContext('2d'); x.fillStyle = '#f00'; x.fillRect(0, 0, 96, 64);
      var d = x.getImageData(20, 20, 1, 1).data;
      return d[3] === 255 && d[0] > 200;
    } catch (e) { return false; }
  }
  if (NATIVE) send({ t: 'ready', canvas: canvasOK() });
})();
