// 像素画：每个字符是一个像素，'.' 是透明。
// 所有角色都画成"面向右"，引擎会自动镜像出面向左的版本。
(function () {
  'use strict';

  // ---------- 小工具 ----------
  function blank(w) { return '.'.repeat(w); }

  // 把 patch 盖到 rows 上。patch.px 是 [x, y, ch] 列表；ch 为 '_' 表示擦成透明。
  function put(rows, px) {
    var g = rows.map(function (r) { return r.split(''); });
    px.forEach(function (p) {
      var x = p[0], y = p[1], ch = p[2];
      if (y < 0 || y >= g.length || x < 0 || x >= g[y].length) return;
      g[y][x] = ch === '_' ? '.' : ch;
    });
    return g.map(function (r) { return r.join(''); });
  }
  // 一段横线像素
  function run(x0, x1, y, ch) {
    var out = [];
    for (var x = x0; x <= x1; x++) out.push([x, y, ch]);
    return out;
  }
  function cat() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) out = out.concat(arguments[i]);
    return out;
  }
  // 替换某几行
  function rowsAt(rows, y0, repl) {
    var g = rows.slice();
    repl.forEach(function (r, i) { g[y0 + i] = r; });
    return g;
  }
  // 整体上移 n 行（腾空）
  function up(rows, n) {
    var w = rows[0].length, g = rows.slice(n);
    for (var i = 0; i < n; i++) g.push(blank(w));
    return g;
  }
  // 顶部补空行到 h 行
  function padTop(rows, h) {
    var w = rows[0].length, g = rows.slice();
    while (g.length < h) g.unshift(blank(w));
    return g;
  }
  // 上半身下沉 1 像素（呼吸 / 迈步）：顶部加一行，删掉 removeRow 这一行
  function sink(rows, removeRow) {
    var w = rows[0].length, g = rows.slice();
    g.splice(removeRow, 1);
    g.unshift(blank(w));
    return g;
  }

  // ============================================================
  //  小球（6x6）
  // ============================================================
  var BALL = [
    ['.yYyw.',
     'yYYwyy',
     'yYwyyy',
     'ywyyyv',
     'wyyyvv',
     '.yvvv.'],
    ['.wYyy.',
     'yywYyy',
     'yYywyy',
     'yyyywv',
     'yyyvvw',
     '.yvvv.'],
    ['.yYyy.',
     'wYYyyy',
     'ywwyyy',
     'yyywwv',
     'yyyvvw',
     '.yvvv.'],
    ['.yYyy.',
     'yYYyyw',
     'yYyyww',
     'yywwyv',
     'wwyyvv',
     '.yvvv.'],
  ];

  // ============================================================
  //  穿西装的小人（20x26）
  // ============================================================
  var P_FRONT = [
    '......hhhhhhhh......',
    '.....hhhhhhhhhh.....',
    '....hhhhhhhhhhhh....',
    '....hhhhhhhhhhhh....',
    '....hhhhhssshhhh....',
    '....hhsssssssshh....',
    '....hssssssssssh....',
    '....sssessssesss....',
    '....sssessssesss....',
    '....sdssssssssds....',
    '.....ssssmmssss.....',
    '......ssssssss......',
    '........wwww........',
    '.....jjjwttwjjj.....',
    '....jjjjJttJjjjj....',
    '....jjjjJttJjjjj....',
    '....jjjjjJJjjjjj....',
    '....jjjjjjjjjjjj....',
    '....sjjjjjjjjjjs....',
    '.....jjjjjjjjjj.....',
    '.....pppppppppp.....',
    '.....pppp..pppp.....',
    '.....pppp..pppp.....',
    '.....pppp..pppp.....',
    '.....pppp..pppp.....',
    '....bbbbb..bbbbb....',
  ];
  var P_FRONT_BLINK = rowsAt(P_FRONT, 7, [
    '....ssssssssssss....',
    '....sseesssseess....',
  ]);
  // 正面挥手：先擦掉右边那条手臂，再画举起来的手
  var P_FRONT_NOARM = put(P_FRONT, cat(
    [[15, 14, '_'], [15, 15, '_'], [15, 16, '_'], [15, 17, '_'], [15, 18, '_']]
  ));
  var P_WAVE_A = put(P_FRONT_NOARM, [
    [15, 14, 'j'], [15, 13, 'j'], [16, 13, 'j'], [16, 12, 'j'], [17, 12, 'j'],
    [17, 11, 'j'], [17, 10, 'j'], [17, 9, 's'], [18, 9, 's'], [17, 8, 's'], [18, 8, 's'],
  ]);
  var P_WAVE_B = put(P_FRONT_NOARM, [
    [15, 14, 'j'], [15, 13, 'j'], [16, 13, 'j'], [16, 12, 'j'], [17, 12, 'j'],
    [18, 11, 'j'], [18, 10, 'j'], [19, 9, 's'], [18, 9, 's'], [19, 8, 's'], [18, 8, 's'],
  ]);

  // 侧面（面向右的 3/4 视角），不含近侧手臂
  var P_SIDE = [
    '......hhhhhhhh......',
    '.....hhhhhhhhhh.....',
    '....hhhhhhhhhhhh....',
    '....hhhhhhhhhhhh....',
    '....hhhhhhhsssshh...',
    '....hhhhsssssssss...',
    '....hhhssssssssss...',
    '....hhhsssessssess..',
    '....hhhsssessssess..',
    '....hhsssssssssdss..',
    '.....hsssssssmmss...',
    '......sssssssss.....',
    '.........wwww.......',
    '.....jjjjjwttwj.....',
    '.....jjjjjJttJj.....',
    '.....jjjjjJttJj.....',
    '.....jjjjjjJJjj.....',
    '.....jjjjjjjjjj.....',
    '.....jjjjjjjjjj.....',
    '.....jjjjjjjjjj.....',
    '......pppppppp......',
    '......ppp..ppp......',
    '......ppp..ppp......',
    '......ppp..ppp......',
    '......ppp..ppp......',
    '......bbbb.bbbb.....',
  ];
  var P_SIDE_BLINK_PX = [[10, 7, 's'], [15, 7, 's'], [9, 8, 'e'], [14, 8, 'e']];
  var LEGS_STRIDE = [
    '......pppppppp......',
    '.....pppp..pppp.....',
    '.....ppp....ppp.....',
    '....ppp......ppp....',
    '....ppp......ppp....',
    '....bbbb.....bbbb...',
  ];
  var LEGS_PASS = [
    '......pppppppp......',
    '.......pppppp.......',
    '.......ppppp........',
    '.......ppppp........',
    '.......ppppp........',
    '.......bbbbbb.......',
  ];
  // 近侧手臂（袖子用 J，手用 s）。肩膀在 (7,14) 附近。
  var ARM = {
    down:   cat(run(6, 7, 14, 'J'), run(6, 7, 15, 'J'), run(6, 7, 16, 'J'), run(6, 7, 17, 'J'), run(6, 7, 18, 's')),
    fwd:    cat(run(6, 7, 14, 'J'), run(7, 8, 15, 'J'), run(8, 9, 16, 'J'), run(9, 10, 17, 'J'), run(10, 11, 18, 's')),
    back:   cat(run(6, 7, 14, 'J'), run(5, 6, 15, 'J'), run(4, 5, 16, 'J'), run(3, 4, 17, 'J'), run(2, 3, 18, 's')),
    hold:   cat(run(6, 7, 14, 'J'), run(6, 7, 15, 'J'), run(7, 8, 16, 'J'), run(8, 11, 17, 'J'), run(12, 13, 17, 's'), run(12, 13, 16, 's')),
    windup: cat(run(6, 7, 14, 'J'), run(4, 6, 13, 'J'), run(2, 4, 12, 'J'), run(1, 2, 11, 'J'), run(0, 1, 10, 's'), run(0, 1, 9, 's')),
    release: cat(run(7, 8, 14, 'J'), run(8, 10, 13, 'J'), run(10, 12, 12, 'J'), run(13, 15, 12, 'J'), run(16, 17, 12, 's'), run(16, 17, 11, 's')),
    follow: cat(run(7, 8, 14, 'J'), run(8, 9, 15, 'J'), run(9, 10, 16, 'J'), run(10, 11, 17, 'J'), run(12, 13, 18, 's')),
    pat:    cat(run(7, 8, 14, 'J'), run(8, 9, 15, 'J'), run(9, 10, 16, 'J'), run(10, 11, 17, 'J'), run(11, 12, 18, 'J'), run(13, 14, 19, 's'), run(14, 15, 20, 's')),
  };
  function pSide(arm, legs, lower) {
    var r = P_SIDE;
    if (legs) r = rowsAt(r, 20, legs);
    r = put(r, ARM[arm]);
    if (lower) r = sink(r, 21);
    return r;
  }

  // ---- 更多动作 ----
  var B20 = blank(20);
  // 蹲下（摸小腊肠、揉肚子）
  function pCrouch(v) {
    var r = [B20, B20, B20, B20, B20, B20, B20].concat(P_SIDE.slice(0, 17));
    r.push('....pppppppppp......');
    r.push('.....bbbb.bbbb......');
    var arm = v === 2
      ? cat(run(7, 8, 21, 'J'), run(9, 10, 21, 'J'), run(11, 12, 22, 'J'), run(13, 14, 22, 'J'), run(15, 16, 22, 's'))
      : cat(run(7, 8, 21, 'J'), run(9, 10, 22, 'J'), run(11, 12, 23, 'J'), run(13, 14, 23, 'J'), run(15, 16, 24, 's'));
    return put(r, arm);
  }
  // 坐在草地上
  function pSit() {
    var r = [B20, B20, B20, B20, B20, B20].concat(P_SIDE.slice(0, 18));
    r.push('.....jjjjjppppppp.b.');
    r.push('.....pppppppppppppb.');
    return put(r, cat(run(6, 7, 20, 'J'), run(7, 8, 21, 'J'), run(8, 9, 22, 'J'), run(10, 10, 23, 'J'), run(11, 12, 23, 's')));
  }
  // 举起双手（欢呼 / 伸懒腰）
  var P_CHEER = put(P_SIDE, cat(
    [[6, 14, 'J'], [5, 13, 'J'], [5, 12, 'J'], [4, 11, 'J'], [4, 10, 'J'], [3, 9, 's'], [3, 8, 's'], [4, 8, 's']],
    [[14, 14, 'j'], [15, 13, 'j'], [16, 12, 'j'], [17, 11, 'j'], [17, 10, 'j'], [18, 9, 's'], [18, 8, 's'], [17, 8, 's']],
    [[13, 10, 'm'], [14, 10, 'm'], [13, 11, 'm'], [14, 11, 'm']]
  ));
  // 整理领带
  var P_TIE_A = put(P_SIDE, cat(run(6, 7, 14, 'J'), run(6, 7, 15, 'J'), run(7, 8, 16, 'J'), run(8, 9, 15, 'J'), [[10, 14, 's'], [10, 13, 's']]));
  var P_TIE_B = put(P_SIDE, cat(run(6, 7, 14, 'J'), run(6, 7, 15, 'J'), run(7, 8, 16, 'J'), run(8, 9, 16, 'J'), [[10, 15, 's'], [10, 14, 's']]));
  // 看手表
  var P_WATCH = put(P_SIDE, cat(run(6, 7, 14, 'J'), run(6, 7, 15, 'J'), run(7, 9, 16, 'J'), [[10, 16, 'w'], [11, 16, 's'], [12, 16, 's']],
    [[10, 7, 's'], [15, 7, 's'], [10, 8, 'e'], [15, 8, 'e']]));

  // ============================================================
  //  小道具
  // ============================================================
  var BONE = [
    'ww...ww',
    'wwwwwww',
    'ww...ww',
  ];
  var BALL_SQ = [      // 落地那一下被压扁
    '.yYYYYy.',
    'yYYywyyy',
    'yywyyyvv',
    '.yvvvvv.',
  ];
  var BFLY_A = [
    'p...p',
    'pp.pp',
    '.pkp.',
    '..k..',
  ];
  var BFLY_B = [
    '.....',
    'ppkpp',
    '.pkp.',
    '..k..',
  ];
  var PUFF = [
    ['.dd.',
     'dddd',
     '.dd.'],
    ['.d.dd.',
     'dd..dd',
     'd....d',
     '.dd.d.'],
    ['d..d..d',
     '.......',
     'd.....d',
     '.......',
     '.d..d..'],
  ];

  // ============================================================
  //  表情小图标
  // ============================================================
  var HEART = [
    '.rr.rr.',
    'rwrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
  ];
  var BANG = [
    'yy',
    'yy',
    'yy',
    'yy',
    '..',
    'yy',
  ];
  var NOTE = [
    '..bbb',
    '..b.b',
    '..b.b',
    '..b..',
    'bbb..',
    'bbb..',
  ];
  var ZED = [
    'zzzzz',
    '...z.',
    '..z..',
    '.z...',
    'zzzzz',
  ];
  var ZED_S = [
    'zzzz',
    '..z.',
    '.z..',
    'zzzz',
  ];

  var QMARK = [
    '.yyy.',
    'y...y',
    '...yy',
    '..y..',
    '.....',
    '..y..',
  ];
  var SPARK = [
    '..y..',
    '..y..',
    'yywyy',
    '..y..',
    '..y..',
  ];
  var SWEAT = [
    '.b.',
    'bbb',
    'bbb',
    '.b.',
  ];
  var WOOF = [
    'y..',
    '.y.',
    '...',
    'yyy',
    '...',
    '.y.',
    'y..',
  ];
  var HEART_S = [
    'r.r',
    'rrr',
    '.r.',
  ];

  // ============================================================
  //  调色盘
  // ============================================================
  function hex(c) {
    c = c.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)];
  }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return '#' + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] + (y[i] - x[i]) * t);
      return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }).join('');
  }
  var INK = '#2a1f2d';

  function palettes(cfg) {
    var p = Object.assign({ hair: '#2b2530', skin: '#f3c9a5', suit: '#3a4c7a', shirt: '#f6f4ef', tie: '#d0353f', shoes: '#2a2024' }, (cfg && cfg.person) || {});
    return {
      person: {
        h: p.hair, s: p.skin, d: mix(p.skin, '#e8747c', 0.38), e: INK, m: '#b4524e',
        w: p.shirt, t: p.tie, j: p.suit, J: mix(p.suit, '#000000', 0.28), p: mix(p.suit, '#000000', 0.14), b: p.shoes,
      },
      ball: { y: '#d6e645', Y: '#f4f9ae', v: '#9fb226', w: '#ffffff' },
      fx: { r: '#f0506e', w: '#ffd0da', y: '#ffc93c', b: '#6fb7ff', z: '#bcd8ff' },
      item: { w: '#f7ecd0' },
      bfly: { p: '#ff8fb3', k: '#3a2a3a' },
      bfly2: { p: '#8fc8ff', k: '#3a2a3a' },
      puff: { d: '#efe9dc' },
    };
  }

  // ============================================================
  //  把字符画变成可以直接画的图
  // ============================================================
  function render(rows, pal, outline) {
    var h = rows.length, w = rows[0].length;
    for (var i = 0; i < h; i++) {
      if (rows[i].length !== w) throw new Error('row width mismatch at row ' + i + ': "' + rows[i] + '" (' + rows[i].length + ' != ' + w + ')');
    }
    var W = w + 2, H = h + 2;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var img = c.createImageData(W, H), d = img.data;
    var solid = new Uint8Array(W * H);
    var x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var ch = rows[y][x];
        if (ch === '.') continue;
        var col = pal[ch];
        if (!col) throw new Error('unknown color "' + ch + '"');
        var rgb = hex(col), o = ((y + 1) * W + (x + 1)) * 4;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
        solid[(y + 1) * W + (x + 1)] = 1;
      }
    }
    if (outline !== false) {
      var ink = hex(INK);
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          if (solid[y * W + x]) continue;
          var near = (x > 0 && solid[y * W + x - 1]) || (x < W - 1 && solid[y * W + x + 1]) ||
                     (y > 0 && solid[(y - 1) * W + x]) || (y < H - 1 && solid[(y + 1) * W + x]);
          if (near) {
            var k = (y * W + x) * 4;
            d[k] = ink[0]; d[k + 1] = ink[1]; d[k + 2] = ink[2]; d[k + 3] = 255;
          }
        }
      }
    }
    c.putImageData(img, 0, 0);
    var fl = document.createElement('canvas');
    fl.width = W; fl.height = H;
    var fc = fl.getContext('2d');
    fc.translate(W, 0); fc.scale(-1, 1);
    fc.drawImage(cv, 0, 0);
    return { img: cv, flip: fl, w: W, h: H };
  }

  // collect：只想拿到"字符画 + 调色盘"而不画图时用（给 iPhone 小组件的打包脚本用）
  function build(cfg, collect) {
    var pal = palettes(cfg);
    var S = {};
    function add(name, rows, p, extra, outline) {
      if (collect) { collect(name, rows, p, extra); return; }
      var s = render(rows, p, outline);
      if (extra) for (var k in extra) s[k] = extra[k];
      S[name] = s;
    }
    // 小球
    BALL.forEach(function (r, i) { add('ball' + i, r, pal.ball); });

    // 小人。hand = 拿球时球心的位置（相对未描边的图，面向右）
    var fh = { hand: [2, 20] };
    add('p_front', P_FRONT, pal.person, fh);
    add('p_front2', sink(P_FRONT, 21), pal.person, { hand: [2, 21] });
    add('p_front_blink', P_FRONT_BLINK, pal.person, fh);
    add('p_wave_a', P_WAVE_A, pal.person, fh);
    add('p_wave_b', P_WAVE_B, pal.person, fh);
    add('p_idle', pSide('down'), pal.person);
    add('p_idle2', pSide('down', null, true), pal.person);
    add('p_blink', put(pSide('down'), P_SIDE_BLINK_PX), pal.person);
    add('p_hold', pSide('hold'), pal.person, { hand: [15, 15] });
    add('p_hold2', pSide('hold', null, true), pal.person, { hand: [15, 16] });
    add('p_walk0', pSide('fwd', LEGS_STRIDE, true), pal.person, { hand: [12, 20] });
    add('p_walk1', pSide('down', LEGS_PASS), pal.person, { hand: [7, 20] });
    add('p_walk2', pSide('back', LEGS_STRIDE, true), pal.person, { hand: [2, 21] });
    add('p_walk3', pSide('down', LEGS_PASS), pal.person, { hand: [7, 20] });
    add('p_windup', pSide('windup'), pal.person, { hand: [0, 7] });
    add('p_release', pSide('release'), pal.person, { hand: [19, 10] });
    add('p_follow', pSide('follow'), pal.person);
    add('p_pat', pSide('pat'), pal.person);

    add('p_cheer', P_CHEER, pal.person);
    add('p_cheer2', up(P_CHEER, 1), pal.person);
    add('p_crouch', pCrouch(1), pal.person);
    add('p_crouch2', pCrouch(2), pal.person);
    add('p_sit', pSit(), pal.person);
    add('p_tie_a', P_TIE_A, pal.person);
    add('p_tie_b', P_TIE_B, pal.person);
    add('p_watch', P_WATCH, pal.person);

    // 小道具
    add('bone', BONE, pal.item);
    add('ball_sq', BALL_SQ, pal.ball);
    add('bfly_a', BFLY_A, pal.bfly, null, false);
    add('bfly_b', BFLY_B, pal.bfly, null, false);
    add('bfly2_a', BFLY_A, pal.bfly2, null, false);
    add('bfly2_b', BFLY_B, pal.bfly2, null, false);
    PUFF.forEach(function (r, i) { add('puff' + i, r, pal.puff, null, false); });

    // 表情
    add('fx_heart', HEART, pal.fx);
    add('fx_hs', HEART_S, pal.fx);
    add('fx_bang', BANG, pal.fx);
    add('fx_note', NOTE, pal.fx);
    add('fx_z', ZED, pal.fx);
    add('fx_zs', ZED_S, pal.fx);
    add('fx_q', QMARK, pal.fx);
    add('fx_spark', SPARK, pal.fx);
    add('fx_sweat', SWEAT, pal.fx);
    add('fx_woof', WOOF, pal.fx);
    return S;
  }

  window.PET_SPRITES = { build: build, INK: INK };
})();
