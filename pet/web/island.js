// 屏幕顶上的"灵动岛"：小人和狗狗的家。
//   · 平时是一颗小小的黑色胶囊（有刘海的 MacBook 上会贴着刘海），显示今天丢了几次球
//   · 鼠标移上去会展开：丢球 / 摸摸 / 集合 / 回岛睡觉
//   · 它们回岛睡觉的时候，能在岛里看到它们睡着的样子
(function () {
  'use strict';
  var root = document.getElementById('island');
  if (!root) return;
  var CFG = window.PET_CONFIG || {};
  if (CFG.island === false || /[?&]island=0/.test(location.search)) { root.hidden = true; return; }

  var box = root.querySelector('.isl-box'), den = document.getElementById('isl-den');
  var elN = document.getElementById('isl-n'), elR = document.getElementById('isl-r');
  var elTitle = document.getElementById('isl-title'), elFoot = document.getElementById('isl-foot'), elHome = document.getElementById('isl-home');
  var btns = Array.prototype.slice.call(root.querySelectorAll('.isl-btn'));

  var lang = (navigator.languages && navigator.languages[0]) || navigator.language || 'zh';
  var hant = /^zh\b.*(tw|hk|mo|hant)/i.test(lang), zh = /^zh/i.test(lang);
  function T(a, b, c) { return hant ? a : (zh ? b : c); }
  var TXT = {
    throw: T('丟球', '丢球', 'Throw'), love: T('摸摸', '摸摸', 'Pet'), gather: T('集合', '集合', 'Come'),
    home: T('回島睡覺', '回岛睡觉', 'Nap'), out: T('出來玩', '出来玩', 'Play'),
    outside: T('在外面玩', '在外面玩', 'Out playing'), inside: T('在島裡睡覺', '在岛里睡觉', 'Napping at home'),
    going: T('正在回家', '正在回家', 'Heading home'), leaving: T('出來囉', '出来啦', 'Coming out'),
    fetch: T('今天丟了 # 次球', '今天丢了 # 次球', '# fetches today'), pets: T('摸了 # 次', '摸了 # 次', '# pets'),
    days: T('還有 # 天見面', '还有 # 天见面', '# days to go'),
  };
  btns.forEach(function (b) { var k = b.getAttribute('data-cmd'); if (TXT[k]) b.textContent = TXT[k]; });

  var G = { cx: 0, notchW: 0, h: 30 };          // 位置（Mac 外壳会告诉我们刘海多宽多高）
  var st = { home: 'out', fetch: 0, pets: 0 };
  var open = false, inside = false, pressed = null, downIn = false, closeT = 0, openT = 0;
  var W = 0, H = 0;

  function size() {
    var homey = st.home === 'in' || st.home === 'going';
    var wing = 46;
    var w0 = G.notchW > 0 ? G.notchW + wing * 2 : 132;
    if (open) { W = 324; H = G.h + (homey ? 60 : 0) + 124; }
    else if (homey) { W = Math.max(272, w0); H = G.h + 60; }
    else { W = w0; H = G.h; }
    box.style.width = W + 'px'; box.style.height = H + 'px';
    box.style.borderRadius = open ? '0 0 22px 22px' : '0 0 13px 13px';
    root.style.left = (G.cx || window.innerWidth / 2) + 'px';
    root.querySelector('.isl-bar').style.height = G.h + 'px';
    root.querySelector('.isl-gap').style.width = (G.notchW > 0 ? G.notchW : 0) + 'px';
    root.classList.toggle('open', open);
    root.classList.toggle('homey', homey);
  }
  function left() { return (G.cx || window.innerWidth / 2) - W / 2; }
  function clockText() {
    var c = CFG.clock, parts = [];
    if (c && c.length) {
      c.forEach(function (z) {
        try { parts.push(z.label + ' ' + new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: z.tz }).format(new Date())); } catch (e) {}
      });
    }
    return parts;
  }
  function daysText() {
    if (!CFG.reunion) return '';
    var d = Math.ceil((new Date(CFG.reunion + 'T00:00:00').getTime() - Date.now()) / 86400000);
    return d >= 0 ? TXT.days.replace('#', d) : '';
  }
  var lastKey = '';
  function paint() {
    var cl = clockText();
    var key = [st.home, st.fetch, st.pets, cl.join('|'), open].join('/');
    if (key === lastKey) return;
    lastKey = key;
    elN.textContent = st.fetch;
    // 右边：设了时钟就显示时间；在岛里睡觉显示 zzz；否则显示今天被摸了几次
    if (cl.length) elR.textContent = cl[cl.length - 1].split(' ').pop();
    else if (st.home === 'in') elR.textContent = 'zzz';
    else if (st.pets > 0) { elR.innerHTML = '<i>\u2665</i>'; elR.appendChild(document.createTextNode(String(st.pets))); }
    else elR.textContent = '';
    elTitle.textContent = { out: TXT.outside, 'in': TXT.inside, going: TXT.going, leaving: TXT.leaving }[st.home] || '';
    var foot = [TXT.fetch.replace('#', st.fetch), TXT.pets.replace('#', st.pets)];
    var extra = cl.concat(daysText() ? [daysText()] : []);
    elFoot.innerHTML = '';
    [foot.join(' · ')].concat(extra.length ? [extra.join(' · ')] : []).forEach(function (line) { var d = document.createElement('div'); d.textContent = line; elFoot.appendChild(d); });
    if (elHome) elHome.textContent = (st.home === 'out' || st.home === 'leaving') ? TXT.home : TXT.out;
    size();
  }
  function setOpen(v) { if (open !== v) { open = v; lastKey = ''; paint(); } }
  function hitBtn(x, y) {
    if (!open) return null;
    for (var i = 0; i < btns.length; i++) {
      var r = btns[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return btns[i];
    }
    return null;
  }

  window.PET_ISLAND = {
    configure: function (o) {
      if (!o) return;
      if (typeof o.cx === 'number') G.cx = o.cx;
      if (typeof o.notchW === 'number') G.notchW = o.notchW;
      if (typeof o.h === 'number') G.h = Math.max(22, o.h);
      if (typeof o.on === 'boolean') root.hidden = !o.on;
      lastKey = ''; paint();
    },
    center: function () { return G.cx || window.innerWidth / 2; },
    canvas: function () { return (st.home === 'in' || st.home === 'going') && !root.hidden ? den : null; },
    state: function (o) { st = o; paint(); },
    rects: function () { return root.hidden ? [] : [left() - 4, 0, W + 8, H + 6]; },
    // 返回 true = 这次鼠标事件归岛管，别传给小人和狗狗
    pointer: function (type, x, y) {
      if (root.hidden) return false;
      var isIn = type !== 'leave' && type !== 'up' && x >= left() - 6 && x <= left() + W + 6 && y <= H + 8;
      if (type === 'hover' || type === 'leave' || type === 'move') {
        inside = isIn;
        if (isIn) { clearTimeout(closeT); closeT = 0; if (!open && !openT) openT = setTimeout(function () { openT = 0; if (inside) setOpen(true); }, 160); }
        else { clearTimeout(openT); openT = 0; if (open && !closeT) closeT = setTimeout(function () { closeT = 0; if (!inside) setOpen(false); }, 380); }
        btns.forEach(function (b) { b.classList.toggle('hot', isIn && hitBtn(x, y) === b); });
        return type === 'move' ? downIn : false;
      }
      if (type === 'down') {
        downIn = isIn;
        if (!isIn) return false;
        inside = true;
        pressed = hitBtn(x, y);
        if (pressed) pressed.classList.add('down'); else setOpen(!open);
        return true;
      }
      if (type === 'up') {
        var was = downIn, p = pressed;
        downIn = false; pressed = null;
        if (p) {
          p.classList.remove('down');
          var cmd = p.getAttribute('data-cmd');
          if (window.pet) window.pet.command(cmd === 'home' ? 'toggleHome' : cmd);
        }
        return was;
      }
      return false;
    },
  };
  paint();
  setInterval(function () { lastKey = ''; paint(); }, 20000);
  window.addEventListener('resize', function () { lastKey = ''; paint(); });
})();
