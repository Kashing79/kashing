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

  // ============================================================
  //  小腊肠（32x15）
  // ============================================================
  var D_BODY = [
    '................................',
    '................................',
    '.......................rrrr.....',
    '......................rrrrrr....',
    '.....................rrrrnrrr...',
    '.....................rrrrrrrrrn.',
    '.....................rrrrrrrrqq.',
    '....rrrrrrrrrrrrrrrrrrrrrrrqq...',
    '...rrrrrrrrrrrrrrrrrrrrrrr......',
    '...rrrrrrrrrrrrrrrrrrrrrrr......',
    '...rrrrrrrrrrrrrrrrrrrrrr.......',
    '....rRRRRRRRRRRRRRRRRrrr........',
    '................................',
    '................................',
    '................................',
  ];
  var D_EAR = {
    down: cat(run(21, 22, 4, 'E'), run(21, 22, 5, 'E'), run(21, 23, 6, 'E'), run(21, 23, 7, 'E'), run(22, 23, 8, 'E')),
    back: cat(run(21, 22, 4, 'E'), run(18, 22, 5, 'E'), run(17, 21, 6, 'E')),
    up:   cat(run(21, 22, 4, 'E'), run(19, 22, 3, 'E'), run(18, 20, 2, 'E')),
  };
  var D_TAIL = {
    a:   [[3, 7, 't'], [2, 6, 't'], [2, 5, 't'], [1, 4, 't']],
    b:   [[3, 7, 't'], [3, 6, 't'], [4, 5, 't'], [4, 4, 't']],
    run: [[3, 7, 't'], [2, 7, 't'], [1, 6, 't'], [0, 6, 't']],
  };
  var D_LEGS = {
    stand:   cat(run(5, 7, 12, 'r'), run(6, 7, 13, 'r'), run(6, 7, 14, 'r'), [[8, 14, 'q']],
                 run(20, 22, 12, 'r'), run(21, 22, 13, 'r'), run(21, 22, 14, 'r'), [[23, 14, 'q']]),
    stretch: cat(run(3, 6, 12, 'r'), run(1, 3, 13, 'r'), [[0, 13, 'q']],
                 run(21, 24, 12, 'r'), run(24, 26, 13, 'r'), [[27, 13, 'q']]),
    gather:  cat(run(7, 9, 12, 'r'), run(9, 10, 13, 'r'), run(10, 11, 14, 'r'), [[12, 14, 'q']],
                 run(18, 20, 12, 'r'), run(17, 18, 13, 'r'), run(16, 17, 14, 'r'), [[15, 14, 'q']]),
  };
  function dStand(ear, tail, legs, lift) {
    var r = put(D_BODY, cat(D_LEGS[legs], D_EAR[ear], D_TAIL[tail]));
    return lift ? up(r, 1) : r;
  }
  var D_SIT = [
    '................................',
    '......................rrrr......',
    '.....................rrrrrr.....',
    '....................EErrnrrr....',
    '....................EErrrrrrrn..',
    '....................EEErrrrrqq..',
    '...................rEEErrrqq....',
    '..................rrrEErrr......',
    '.................rrrrrrrrr......',
    '...............rrrrrrrrrrr......',
    '.............rrrrrrrrrrrrr......',
    '...........rrrrrrrrrrrr.rr......',
    '.........rrrrrrrrrrrrr..rr......',
    '........rrrrRRrrrrrrr...rr......',
    '........rrrrrrrrrrrqq...rrq.....',
  ];
  var D_SIT_TAIL = {
    a: [[8, 12, 't'], [7, 11, 't'], [6, 10, 't'], [6, 9, 't']],
    b: [[7, 13, 't'], [6, 12, 't'], [5, 12, 't'], [4, 11, 't']],
  };
  var D_BOW = [
    '................................',
    '................................',
    '................................',
    '....rrrr........................',
    '...rrrrrrr......................',
    '...rrrrrrrrrr...................',
    '...rrrrrrrrrrrrr......rrrr......',
    '....rrrrrrrrrrrrrrr..rrrrrr.....',
    '....rr.rrrrrrrrrrrrrEErrnrrr....',
    '....rr...rrrrrrrrrrrEErrrrrrrn..',
    '....rr.....rrrrrrrrrEEErrrrrqq..',
    '....rr.......rrrrrrrrEErrrqq....',
    '....rr.........rrrrrrrrr........',
    '....rr..........rrrrrrrrrrrr....',
    '....rrq...........rrrrrrrrrrq...',
  ];
  var D_BOW_TAIL = {
    a: [[3, 3, 't'], [2, 2, 't'], [2, 1, 't'], [1, 0, 't']],
    b: [[4, 2, 't'], [4, 1, 't'], [5, 0, 't']],
  };
  var D_LIE = padTop([
    '......rrrrrrrrrrrrrrr...........',
    '....rrrrrrrrrrrrrrrrrrEE........',
    '...rrrrrrrrrrrrrrrrrrrEEErrr....',
    '..rrrrrrrrrrrrrrrrrrrrEEErrrrr..',
    '..rrrrrrrrrrrrrrrrrrrrrEErnrrrn.',
    '..rrRRRRRRRRRRRRRRrrrrrrrrrrqq..',
    '.tttrrq..........qqrrrrrrqq.....',
  ], 15);
  var D_SLEEP = put(D_LIE, [[26, 12, 'R']]);
  var D_SLEEP2 = sink(D_SLEEP, 8);

  // ============================================================
  //  大金毛（40x24）
  // ============================================================
  // 头（站立时的位置）。gHead(dx, dy, opt) 可以把头挪到别的位置。
  var G_HEAD_ROWS = [
    // [y, x0, 字符串]
    [1, 29, 'gggggg'],
    [2, 28, 'gggggggg'],
    [3, 27, 'DDggggngggg'],
    [4, 27, 'DDDgggggggggn'],
    [5, 27, 'DDDgggggglll'],
    [6, 27, 'DDDgggggg'],
    [7, 28, 'DDgggggg'],
  ];
  function gHead(dx, dy, opt) {
    opt = opt || {};
    var px = [];
    G_HEAD_ROWS.forEach(function (r) {
      for (var i = 0; i < r[2].length; i++) px.push([r[1] + i + dx, r[0] + dy, r[2][i]]);
    });
    if (opt.tongue) { px.push([36 + dx, 6 + dy, 'k']); px.push([37 + dx, 6 + dy, 'k']); px.push([36 + dx, 7 + dy, 'k']); }
    if (opt.closed) { px.push([33 + dx, 3 + dy, 'g']); px.push([32 + dx, 4 + dy, 'G']); px.push([33 + dx, 4 + dy, 'G']); }
    return px;
  }
  // 身体（不含头、腿、尾巴）
  var G_BODY = [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '......................ggggggggggggl.....',
    '.......ggggggggggggggggggggggggggll.....',
    '.....ggggggggggggggggggggggggggglll.....',
    '....gggggggggggggggggggggggggggglll.....',
    '....ggggggggggggggggggggggggggggll......',
    '....gggggggggggggggggggggggggggll.......',
    '.....ggglllllllGGGGGGgggggggggll........',
    '...............gllllllggggggggl.........',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
  ];
  // 画一条腿：从 (hipX, topY) 往下 len 行，每行往 slope 方向偏移；thick = 顶部加粗几行
  function leg(hipX, topY, len, slope, width, ch, thick) {
    var px = [];
    for (var i = 0; i < len; i++) {
      var x = Math.round(hipX + slope * i);
      var extra = (thick && i < thick) ? (thick - i) : 0;
      for (var k = -extra; k < width; k++) px.push([x + k, topY + i, ch]);
      if (i === len - 1) px.push([x + width, topY + i, ch]);
    }
    return px;
  }
  var G_TAIL = {
    mid:  cat(run(2, 4, 10, 'g'), run(1, 3, 11, 'g'), run(0, 2, 12, 'g'),
              [[3, 12, 'l'], [1, 13, 'l'], [2, 13, 'l'], [0, 13, 'l'], [1, 14, 'l']]),
    up:   cat(run(3, 4, 9, 'g'), run(3, 4, 8, 'g'), run(2, 4, 7, 'g'), run(2, 3, 6, 'g'), run(1, 3, 5, 'g'), run(1, 2, 4, 'g'),
              [[1, 7, 'l'], [1, 6, 'l'], [0, 5, 'l'], [0, 4, 'l'], [0, 3, 'l'], [1, 3, 'l'], [2, 8, 'l']]),
  };
  var G_FEATHER = [[6, 19, 'l'], [6, 20, 'l'], [24, 18, 'l'], [24, 19, 'l'], [24, 20, 'l']];
  var G_LEGS = {
    // 远侧腿（G，深色）先画，近侧腿（g）后画
    stand: cat(
      leg(11, 15, 9, 0, 2, 'G'), leg(21, 16, 8, 0, 2, 'G'),
      leg(7, 15, 9, 0, 2, 'g', 3), leg(25, 16, 8, 0, 2, 'g', 1), G_FEATHER
    ),
    trotA: cat(
      leg(11, 15, 9, 0.3, 2, 'G'), leg(21, 16, 8, -0.3, 2, 'G'),
      leg(7, 15, 9, -0.3, 2, 'g', 3), leg(25, 16, 8, 0.3, 2, 'g', 1)
    ),
    trotB: cat(
      leg(11, 15, 9, -0.3, 2, 'G'), leg(21, 16, 8, 0.3, 2, 'G'),
      leg(7, 15, 9, 0.3, 2, 'g', 3), leg(25, 16, 8, -0.3, 2, 'g', 1)
    ),
    stretch: cat(
      leg(10, 15, 7, -1.0, 3, 'G'), leg(23, 16, 6, 1.0, 3, 'G'),
      leg(6, 15, 7, -1.1, 3, 'g', 3), leg(26, 16, 6, 1.1, 3, 'g', 1)
    ),
    gather: cat(
      leg(11, 15, 9, 0.4, 2, 'G'), leg(22, 16, 8, -0.4, 2, 'G'),
      leg(8, 15, 9, 0.45, 2, 'g', 3), leg(25, 16, 8, -0.45, 2, 'g', 1)
    ),
  };
  function gStand(tail, legs, lift, tongue) {
    var r = put(G_BODY, cat(G_LEGS[legs], G_TAIL[tail], gHead(0, 0, { tongue: tongue !== false })));
    return lift ? up(r, 1) : r;
  }
  var G_SIT_BODY = [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..........................ggggggggl.....',
    '.........................ggggggggll.....',
    '.......................ggggggggglll.....',
    '.....................ggggggggggglll.....',
    '...................gggggggggggggll......',
    '.................ggggggggggggggll.......',
    '...............ggggggggggggggggl........',
    '..............ggggggggggggggggg.........',
    '.............ggggggggggggg.ggg..........',
    '............gggggggggggggg.ggg..........',
    '...........ggggggggggggggg.ggg..........',
    '...........gggggggggggggg.lgg...........',
    '..........ggggggGGgggggg.GGgg...........',
    '..........gggggGGggggggg.GGgg...........',
    '..........ggggGGgggggggg.GGgg...........',
    '..........gggggggggggglllGGggg..........',
  ];
  var G_SIT = put(G_SIT_BODY, gHead(0, 0, { tongue: true }));
  var G_SIT_TAIL = {
    a: cat(run(6, 9, 23, 'g'), run(3, 5, 23, 'l'), run(5, 8, 22, 'l')),
    b: cat(run(8, 9, 22, 'g'), run(7, 8, 21, 'g'), run(6, 7, 20, 'g'), run(5, 6, 19, 'g'), [[5, 21, 'l'], [4, 20, 'l'], [4, 19, 'l'], [4, 18, 'l'], [5, 18, 'g']]),
  };
  var G_LIE_BODY = padTop([
    '.......ggggggggggggggggggggggggggll.....',
    '.....ggggggggggggggggggggggggggggll.....',
    '....gggggggggggggggggggggggggggggl......',
    '....gggggggggggggggggggggggggggggggggl..',
    '.lllgggGGGGGGGGGGGGGGGGGggggglllggggggl.',
  ], 24);
  var G_NECK = cat(run(23, 33, 18, 'g'), run(26, 29, 17, 'g'), [[34, 18, 'l']]);
  var G_LIE = put(G_LIE_BODY, cat(G_NECK, gHead(0, 10, { tongue: true })));
  var G_LIE2 = put(G_LIE_BODY, cat(G_NECK, gHead(0, 10, {})));
  var G_SLEEP = put(G_LIE_BODY, gHead(0, 16, { closed: true }));
  var G_SLEEP2 = sink(G_SLEEP, 20);

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

  var DAX_COLORS = {
    red:      { r: '#b8632b', R: '#8f4519', q: '#dfa063', E: '#7a3a16', t: '#8f4519' },
    blacktan: { r: '#3d3539', R: '#2b2528', q: '#c98a4b', E: '#2b2528', t: '#2b2528' },
    cream:    { r: '#e9c995', R: '#cba56a', q: '#f7e6c4', E: '#c39a5e', t: '#cba56a' },
  };

  function palettes(cfg) {
    var p = Object.assign({ hair: '#2b2530', skin: '#f3c9a5', suit: '#3a4c7a', shirt: '#f6f4ef', tie: '#d0353f', shoes: '#2a2024' }, (cfg && cfg.person) || {});
    var dax = DAX_COLORS[(cfg && cfg.dachshund) || 'red'] || DAX_COLORS.red;
    return {
      person: {
        h: p.hair, s: p.skin, d: mix(p.skin, '#e8747c', 0.38), e: INK, m: '#b4524e',
        w: p.shirt, t: p.tie, j: p.suit, J: mix(p.suit, '#000000', 0.28), p: mix(p.suit, '#000000', 0.14), b: p.shoes,
      },
      dax: Object.assign({ n: INK, k: '#f08a9a' }, dax),
      gold: { g: '#e6ad4c', G: '#c08a2e', l: '#f8dc9c', D: '#b97c24', n: INK, k: '#f08a9a' },
      ball: { y: '#d6e645', Y: '#f4f9ae', v: '#9fb226', w: '#ffffff' },
      fx: { r: '#f0506e', w: '#ffd0da', y: '#ffc93c', b: '#6fb7ff', z: '#bcd8ff' },
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

  function build(cfg) {
    var pal = palettes(cfg);
    var S = {};
    function add(name, rows, p, extra) {
      var s = render(rows, p);
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

    // 小腊肠。mouth = 叼球时球心的位置
    var dm = { mouth: [30, 7] };
    add('d_stand_a', dStand('down', 'a', 'stand'), pal.dax, dm);
    add('d_stand_b', dStand('down', 'b', 'stand'), pal.dax, dm);
    add('d_run0', dStand('back', 'run', 'stretch', true), pal.dax, { mouth: [30, 6] });
    add('d_run1', dStand('up', 'a', 'stand'), pal.dax, dm);
    add('d_run2', dStand('down', 'b', 'gather'), pal.dax, dm);
    add('d_run3', dStand('up', 'a', 'stand'), pal.dax, dm);
    add('d_jump', dStand('back', 'run', 'stretch'), pal.dax, dm);
    add('d_sit_a', put(D_SIT, D_SIT_TAIL.a), pal.dax, { mouth: [29, 6] });
    add('d_sit_b', put(D_SIT, D_SIT_TAIL.b), pal.dax, { mouth: [29, 6] });
    add('d_bow_a', put(D_BOW, D_BOW_TAIL.a), pal.dax, { mouth: [29, 11] });
    add('d_bow_b', put(D_BOW, D_BOW_TAIL.b), pal.dax, { mouth: [29, 11] });
    add('d_lie', D_LIE, pal.dax, { mouth: [30, 13] });
    add('d_sleep', D_SLEEP, pal.dax);
    add('d_sleep2', D_SLEEP2, pal.dax);

    // 大金毛
    var gm = { mouth: [39, 6] };
    add('g_stand_a', gStand('mid', 'stand'), pal.gold, gm);
    add('g_stand_b', gStand('up', 'stand'), pal.gold, gm);
    add('g_trot0', gStand('mid', 'trotA'), pal.gold, gm);
    add('g_trot1', gStand('up', 'stand', true), pal.gold, { mouth: [39, 5] });
    add('g_trot2', gStand('mid', 'trotB'), pal.gold, gm);
    add('g_trot3', gStand('up', 'stand', true), pal.gold, { mouth: [39, 5] });
    add('g_run0', gStand('mid', 'stretch', true), pal.gold, { mouth: [39, 5] });
    add('g_run1', gStand('up', 'stand'), pal.gold, gm);
    add('g_run2', gStand('mid', 'gather'), pal.gold, gm);
    add('g_run3', gStand('up', 'stand'), pal.gold, gm);
    add('g_sit_a', put(G_SIT, G_SIT_TAIL.a), pal.gold, gm);
    add('g_sit_b', put(G_SIT, G_SIT_TAIL.b), pal.gold, gm);
    add('g_lie', G_LIE, pal.gold, { mouth: [39, 16] });
    add('g_lie2', G_LIE2, pal.gold, { mouth: [39, 16] });
    add('g_sleep', G_SLEEP, pal.gold);
    add('g_sleep2', G_SLEEP2, pal.gold);

    // 表情
    add('fx_heart', HEART, pal.fx);
    add('fx_bang', BANG, pal.fx);
    add('fx_note', NOTE, pal.fx);
    add('fx_z', ZED, pal.fx);
    add('fx_zs', ZED_S, pal.fx);
    return S;
  }

  window.PET_SPRITES = { build: build, INK: INK };
})();
