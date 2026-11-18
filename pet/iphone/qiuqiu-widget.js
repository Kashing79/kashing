// 球球 · iPhone 主画面小组件（给 Scriptable 这个 App 用）
//
// 怎么装：
//   1. 在 App Store 装 Scriptable。
//   2. 打开 Scriptable，点右上角 +，把这个文件的全部内容贴进去，名字改成「球球」。
//   3. 回到主画面，长按空白处 → 左上角 + → 找到 Scriptable → 选「中」或「小」尺寸 → 加入。
//   4. 长按刚加的小组件 → 编辑小组件 → Script 选「球球」。
//
// 它会画出穿西装的小人、小腊肠和大金毛。每隔一阵子换一个姿势；夜里它们会睡觉。
// 不联网，不读任何个人资料。

// ---------- 可以改的地方 ----------
const PAGE_URL = "https://kashing79.github.io/kashing/qiuqiu/";   // 点小组件时打开的网页版（可以丢球的那个）。留空 "" 就是点了不跳转。
const NIGHT = [0, 7];               // 几点到几点睡觉

// ---------- 像素画数据（由 pet/iphone/build.js 从 web/sprites.js 和 web/dogs.js 生成，不用手改）----------
const INK = "#2a1f2d";
const FRAMES = {"ball0":{"rows":[".yYyw.","yYYwyy","yYwyyy","ywyyyv","wyyyvv",".yvvv."],"pal":{"y":"#d6e645","Y":"#f4f9ae","w":"#ffffff","v":"#9fb226"}},"p_front":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","sssessssesss","sssessssesss","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_front_blink":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","ssssssssssss","sseesssseess","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_wave_a":{"rows":["..hhhhhhhh.....",".hhhhhhhhhh....","hhhhhhhhhhhh...","hhhhhhhhhhhh...","hhhhhssshhhh...","hhsssssssshh...","hssssssssssh...","sssessssesss...","sssessssesss.ss","sdssssssssds.ss",".ssssmmssss..j.","..ssssssss...j.","....wwww....jj.",".jjjwttwjjjjj..","jjjjJttJjjjj...","jjjjJttJjjj....","jjjjjJJjjjj....","jjjjjjjjjjj....","sjjjjjjjjjj....",".jjjjjjjjjj....",".pppppppppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....","bbbbb..bbbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","j":"#3a4c7a","w":"#f6f4ef","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_hold":{"rows":["..hhhhhhhh....",".hhhhhhhhhh...","hhhhhhhhhhhh..","hhhhhhhhhhhh..","hhhhhhhsssshh.","hhhhsssssssss.","hhhssssssssss.","hhhsssessssess","hhhsssessssess","hhsssssssssdss",".hsssssssmmss.","..sssssssss...",".....wwww.....",".jjjjjwttwj...",".jJJjjJttJj...",".jJJjjJttJj...",".jjJJjjJssj...",".jjjJJJJssj...",".jjjjjjjjjj...",".jjjjjjjjjj...","..pppppppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..bbbb.bbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"fx_heart":{"rows":[".rr.rr.","rwrrrrr","rrrrrrr",".rrrrr.","..rrr..","...r..."],"pal":{"r":"#f0506e","w":"#ffd0da"}},"fx_z":{"rows":["zzzzz","...z.","..z..",".z...","zzzzz"],"pal":{"z":"#bcd8ff"}},"fx_zs":{"rows":["zzzz","..z.",".z..","zzzz"],"pal":{"z":"#bcd8ff"}},"g_sit":{"rows":["...........................aaaaaa.......","..........................abbcccca......",".........................abdeeeccca.....","........................adddeeeefcaaa...",".......................addcceeeeccdddff.","......................gdddccceehccccdiif",".....................gjjjcceeeehecccccf.","....................adccjjjeeheheeeeeea.","...................addddeejjkhlammllla..","..................adddddechhjnopppppp...","..................accddddchelqqqp.......",".................adccddcccheqqqqp.......",".................addceccccclqqqqp.......","................adddddcccccclqqqp.......","................adddddcdcccclqqp........","...............adddddcddcccheqp.........","...............addddccdcccheea..........","..............addddccdccchhhqp..........",".............addddccddcchhhqp...........",".............addddccccchhhap............","............addddccqqcchha..............","............adrrreceqcccha..............","..pppppppp..adrqqdddqcccha..............",".pqqqqrrrraaacrqddddqcccha..............","pqqqqdddddddhcrrccccqcccea..............","accccceeeccchqqqqcccqhcceap.............","accqqlllllllhqpqqeeehecqqmmp............",".aapppppppppqppqqaaacqqqqpp.............","............p..pp...apppp..............."],"pal":{"a":"#4a221e","b":"#ffeea8","c":"#e6a94e","d":"#fad378","e":"#b87133","f":"#150f17","g":"#572133","h":"#854728","i":"#291f29","j":"#d64945","k":"#992e40","l":"#d6a774","m":"#ad7753","n":"#ffd342","o":"#804219","p":"#61342b","q":"#f2d29b","r":"#ffefc2"}},"g_lie":{"rows":["......................................aa.........","....................................aabbaa.......","...................................abcccbca......",".................................aabbddddca......","...............................aabbbbddddecaaae..","..............................fbbbbccddddccbbbge.","............................afhhcbbccddddcccccgge","........................aaaabbchhhdddiddidccccce.","................aaaaaaaabbbbbbbddhhdidiiiddddda..",".aaaaj........aabbbbbbbbbbbbbbbbcdhhiikkklllaa...","abbbbmaaaaaaaannbbbbbbbbbbbbbbbccdihhkjjjkklllo..","adddcccccbbbibbbbbbbbbbbbbbccccccciipqj..jjrllo..","jqqqqqqdddccimmmcbbcccccccccccccccckqj.....jolo..","jqqqqqqqqqqqrmqqbbbbbdccccccdibbccckqj.......o...",".jqqqqqqqqqjrmqbbbbcccdccccccbbcccckqj...........","..jqqqqjqqqjjmqcccccccccidcddbcccckqqjj..........","...jjjjjqjjjqqqqccccccccidddcccddqkqqirj.........","........j..jqjqqiddddqcciddccccccccccqqqj........","............j.jjaaacqqqkqqdccccccccccqqj.........","...................ajjjjjjaaaaaakaaaajj..........","................................j................"],"pal":{"a":"#4a221e","b":"#fad378","c":"#e6a94e","d":"#b87133","e":"#150f17","f":"#572133","g":"#291f29","h":"#d64945","i":"#854728","j":"#61342b","k":"#d6a774","l":"#f28399","m":"#ffefc2","n":"#ffeea8","o":"#7a3351","p":"#ffd342","q":"#f2d29b","r":"#ad7753"}},"g_sleep":{"rows":[".............................aaaa.................","............................abbbba................","........................aaaabbbbbca...............","................aaaaaaaabbbbbbbbccca..............","..............aabbbbbbbbbbbbbbbbbdef..aaaa........",".........aaaaaggbbbbbbbbbbbccbbccdedaabbbba.......",".haaaaaaabbbibbbbbbbbbbbbbbcccccccjdcbccdcca......","hkbbbbbcccccikkkcbcccccccccccccccccdbbddddccaa....","acddddddiiiiikllbbbbbdcccccccdbbcccdbbddddiibbamm.","hlllllllllllnklbbbbcccdccccclbbccccdccddddccbbboom","hllllllllllhhklcccccccccidcccbccccciicdddiddccccm.",".hlllllllllhllllccccccccidddcccpclidddididdddddda.","..hllhlhlhhhlhlliddddlcciddccccccccccqqqdaqqqqqa..","...hh.h.h...h.hhaaaclllqlldccccccccccllha.hhhhh...","...................ahhhhhhaaaaaaqaaaahh...........","................................h................."],"pal":{"a":"#4a221e","b":"#fad378","c":"#e6a94e","d":"#b87133","e":"#d64945","f":"#572133","g":"#ffeea8","h":"#61342b","i":"#854728","j":"#992e40","k":"#ffefc2","l":"#f2d29b","m":"#150f17","n":"#ad7753","o":"#291f29","p":"#ffd342","q":"#d6a774"}},"d_sit":{"rows":["..........................aa.........","........................aabbaa.......",".......................abccddda......","......................abccccdefaaa...",".....................abbccccdddbbbae.",".....................gbbcccfcccddddhe","....................giiiccccaajjjjje.","....................addcccca..kkkkk..","..................aabbbcffa..........",".................allbbbdfcmk.........","................albbddddfmmk.........","...............aabbbdddddfmk.........","..............abbbbbdcdddfk..........",".............abbbbdddbddfa...........","............albbbdddcbdda............","...........albbdddcccddfa............",".aaaaaaaaaalbbbbbbfffddfa............","abbdddddbbfbbbbdddfaaddfk............","affaaaaaccfdddddcca.admjnk...........",".aa.....aaaccdddmmk.kmmmk............","...........affaakk...kkk.............","............aa......................."],"pal":{"a":"#3d181c","b":"#d98c4e","c":"#8f3f22","d":"#b86230","e":"#150f17","f":"#66261d","g":"#29224c","h":"#291f29","i":"#4981d6","j":"#7a3925","k":"#52221f","l":"#f2be7e","m":"#d18e54","n":"#a86239"}},"d_bow":{"rows":[".a..................................","aba.................................","aba.................................","abba................................","abba................................",".aba................................",".aba................................",".aba................................",".abba...............................","..aba...............................","..acaaa...................a.........","..addddaaa..............aaeaaaaaaaf.",".adeeeeeeeaa...........agbeeeeeeeehf",".abeeegbeeddaaa.......aggbbefbbbbbf.",".abbeebgbbeedeeaa..iaaeggggbgggjkkl.","..abbbbgbbbbeeeedaambeegggcggkalll..","..acbbbgbbbbbbeeeeeebbbggggaal......","..acbbbbcgbbbbbeeebbbbggggga........",".acbbbbaggggbbbeebbbbbbcgcca........",".acbbaa.aabbbbbbbgbbbbnlaaa.........",".lkbol....aggggggbbbbbpokl..........","..loool....aagggcbbbbbool...........","...lll.......aaacckkaall............","................aall................"],"pal":{"a":"#3d181c","b":"#b86230","c":"#66261d","d":"#f2be7e","e":"#d98c4e","f":"#150f17","g":"#8f3f22","h":"#291f29","i":"#29224c","j":"#a86239","k":"#7a3925","l":"#52221f","m":"#4981d6","n":"#3a4d99","o":"#d18e54","p":"#ffd342"}},"d_beg":{"rows":["...............aaaaaaaaaab.","..............accccccccccdb",".............aeeeffbfffeeb.",".............aeeeefeeegga..","............aceeeehegaii...","............jcfeeehai......","...........jkfceeea........","..........jkllleeea........",".........acfccceegi........",".........afccfffmha........",".........affffffeeaa.......",".........afeeeffecchi......",".........aeehhfffffnni.....",".........affffeeehggi......",".........accccfhhhii.......",".........accfffeea.........",".........accfffeea.........",".........accfffea..........",".........accfffea..........",".........accfffea..........",".........accffeea..........",".aaaaa...acffehhaa.........","afffccaa.acfeccccfa........",".aaaffffaafeffffffa........","....aaaffhffhfeeea.........",".......aafhehffnni.........",".........aaaaaaii.........."],"pal":{"a":"#3d181c","b":"#150f17","c":"#d98c4e","d":"#291f29","e":"#8f3f22","f":"#b86230","g":"#7a3925","h":"#66261d","i":"#52221f","j":"#29224c","k":"#4981d6","l":"#3a4d99","m":"#ffd342","n":"#d18e54"}},"d_roll":{"rows":["............aa...............................","...........abbcaa.......................add..","...........abbeffa.......aa...........adghhd.","..........cijeefa..aaaaaafka........aaghhhhl.",".........ciijeeecaagggggfffbmmccc.ccffhhddenl","..........cjoooeefggfffffbfepqeoocoooooooeenl","..........ceooeeeebfffffboeeereoooooooeeiicl.",".ccc.....cseeeeiikbbbbeiooooeeieooeeljlccc...","cooocccccceeiieiieeeeeeieeeeeejieeiiill......","ciiieeeeeejiiijiiiiiiiieieeeepjiiiijijc......",".ccccccccccccjjjjjjjjjjjjiiijqmcjjcccc.......",".............ccccccccccccjjccm..cc...........",".........................cc.................."],"pal":{"a":"#52221f","b":"#a86239","c":"#3d181c","d":"#7a3351","e":"#b86230","f":"#d18e54","g":"#edbc7b","h":"#f28399","i":"#8f3f22","j":"#66261d","k":"#7a3925","l":"#150f17","m":"#29224c","n":"#291f29","o":"#d98c4e","p":"#3a4d99","q":"#4981d6","r":"#ffd342","s":"#f2be7e"}},"d_lie":{"rows":["..............................aaaaa.......",".............................abbbcba......","............................adeebbbbaa....","...........................acbeeeefbccaaf.","..........................gcceeeehebbbbbif",".a.....................aagjjjeeeehhkeeeeif","aeaaaa.........aaaaaaaaccccejjeeeaalaaamf.","aebbccaaaaaaaaacccddddcccccbejehha.....l..",".aaaeebbbchddddccccccccccbbbbhaaa.........","....aaaaaehcccccbbbbbbcbbbbbbba...........",".........abbccbbbebbbbbbehcbbba...........",".........abbbbbeeheeeebeeecbbnlll.........","..........aehbbbheeeeeeeebbbccooml........","...........aahbbkklaahhhhbbbbbkkl.........",".............aaall...aaaaaaaaall.........."],"pal":{"a":"#3d181c","b":"#b86230","c":"#d98c4e","d":"#f2be7e","e":"#8f3f22","f":"#150f17","g":"#29224c","h":"#66261d","i":"#291f29","j":"#4981d6","k":"#d18e54","l":"#52221f","m":"#7a3925","n":"#a86239","o":"#edbc7b"}},"d_sleep":{"rows":[".........................aa..................",".......................aabbaa................","..................aaaaabbbbcbda..aaaa........","..............aaaaeeeebbbbbccfcaagcbba.......","............aaeeebbbbbbcccccchcbcggccca......",".aaaaaaaaaaaeebbbcbbbcbcccccchgbcgggciiaaa...","abbbbbbbbbiebbbccgccccccgicccgccggggccccbbaj.",".aggggggiiibbbcccgccggcgggccciggggiigggcccckj","..aaaaaaaaabcccccigggggggccclbmgggiaaaannnaj.","..........agibbccooiiiiiicccccopiia....qqq...","...........aaiaggqqaaaaaaaaaaaqqaa...........",".............a.aa............................"],"pal":{"a":"#3d181c","b":"#d98c4e","c":"#b86230","d":"#29224c","e":"#f2be7e","f":"#4981d6","g":"#8f3f22","h":"#3a4d99","i":"#66261d","j":"#150f17","k":"#291f29","l":"#ffd342","m":"#edbc7b","n":"#7a3925","o":"#d18e54","p":"#a86239","q":"#52221f"}}};

// ---------- 画图 ----------
const K = 3;   // 一个像素画成 3x3 pt

function isNight(h) {
  return NIGHT[0] <= NIGHT[1] ? (h >= NIGHT[0] && h < NIGHT[1]) : (h >= NIGHT[0] || h < NIGHT[1]);
}

// 把一帧字符画贴到画布上：(x, y) 是这帧左下角站的位置；flip = 左右镜像
function stamp(grid, name, x, footY, flip) {
  const f = FRAMES[name];
  const h = f.rows.length, w = f.rows[0].length;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = f.rows[r][flip ? w - 1 - c : c];
      if (ch === ".") continue;
      const gx = x + c, gy = footY - h + r;
      if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) grid[gy][gx] = f.pal[ch];
    }
  }
}

// 给所有有颜色的像素描一圈深色的边（狗狗的图自己带边，所以要在贴狗之前做）
function outline(grid, groundY) {
  const W = grid[0].length, add = [];
  for (let y = 0; y < groundY; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x]) continue;
      const near = (x > 0 && grid[y][x - 1]) || (x < W - 1 && grid[y][x + 1]) || (y > 0 && grid[y - 1][x]) || (y < groundY - 1 && grid[y + 1][x]);
      if (near) add.push([x, y]);
    }
  }
  for (const p of add) grid[p[1]][p[0]] = INK;
}

function pick(arr, seed) { return arr[seed % arr.length]; }

// 决定这次画什么场景。每个场景：先贴小人 / 小球 / 表情（pre），描边，再贴狗（dogs）
function scene(family, now) {
  const h = now.getHours();
  const seed = Math.floor(now.getTime() / (15 * 60 * 1000));   // 每 15 分钟换一次
  const small = family === "small";
  const W = small ? 46 : 104, H = 40, ground = H - 5;
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(null));
  const night = isNight(h);
  const mood = night ? "sleep" : pick(["play", "wave", "rest", "love", "play"], seed);
  let pre = [], dogs = [];

  if (small) {
    // 小尺寸：小人 + 小腊肠
    if (mood === "sleep") { dogs = [["d_sleep", 4, false]]; pre = [["fx_zs", 30, ground - 16]]; }
    else if (mood === "play") { pre = [["p_hold", 3, ground], ["ball0", 16, ground - 9]]; dogs = [["d_beg", 27, true]]; }
    else if (mood === "wave") { pre = [["p_wave_a", 3, ground]]; dogs = [["d_beg", 27, true]]; }
    else if (mood === "love") { pre = [["p_front", 3, ground], ["fx_heart", 17, ground - 26]]; dogs = [["d_beg", 27, true]]; }
    else { dogs = [["d_lie", 4, false]]; }
  } else {
    // 中 / 大尺寸：金毛 + 小人 + 小腊肠
    if (mood === "sleep") { pre = [["p_front_blink", 48, ground], ["fx_z", 62, ground - 30], ["fx_zs", 36, ground - 16]]; dogs = [["g_sleep", 1, false], ["d_sleep", 64, true]]; }
    else if (mood === "play") { pre = [["p_hold", 43, ground], ["ball0", 56, ground - 12]]; dogs = [["g_sit", 0, false], ["d_bow", 65, true]]; }
    else if (mood === "wave") { pre = [["p_wave_a", 45, ground]]; dogs = [["g_sit", 0, false], ["d_beg", 70, true]]; }
    else if (mood === "love") { pre = [["p_front", 45, ground], ["fx_heart", 34, ground - 26], ["fx_heart", 74, ground - 16]]; dogs = [["g_sit", 0, false], ["d_roll", 61, true]]; }
    else { pre = [["p_front", 46, ground]]; dogs = [["g_lie", 0, false], ["d_sit", 64, true]]; }
  }
  for (const p of pre) stamp(grid, p[0], p[1], p[2], false);
  outline(grid, ground);
  for (const d of dogs) stamp(grid, d[0], d[1], ground + 1, d[2]);
  // 草地
  const grass = night ? "#2f5a45" : "#9fd18b", grass2 = night ? "#244a39" : "#86bf74";
  for (let y = ground; y < H; y++) for (let x = 0; x < W; x++) if (!grid[y][x]) grid[y][x] = y === ground ? grass : grass2;
  return { grid: grid, W: W, H: H, night: night, dusk: !night && (h >= 17 || h < 7) };
}

function drawImage(sc) {
  const ctx = new DrawContext();
  ctx.size = new Size(sc.W * K, sc.H * K);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  for (let y = 0; y < sc.H; y++) {
    for (let x = 0; x < sc.W; x++) {
      const col = sc.grid[y][x];
      if (!col) continue;
      ctx.setFillColor(new Color(col));
      ctx.fillRect(new Rect(x * K, y * K, K, K));
    }
  }
  return ctx.getImage();
}

function buildWidget(family) {
  const sc = scene(family, new Date());
  const w = new ListWidget();
  const bg = new LinearGradient();
  bg.colors = sc.night ? [new Color("#141c33"), new Color("#2a3558")]
            : sc.dusk ? [new Color("#f6b48a"), new Color("#fde3c4")]
            : [new Color("#bfe3f7"), new Color("#e9f5fc")];
  bg.locations = [0, 1];
  w.backgroundGradient = bg;
  w.setPadding(0, 0, 0, 0);
  w.addSpacer();
  const row = w.addStack();
  row.addSpacer();
  row.addImage(drawImage(sc)).imageSize = new Size(sc.W * K, sc.H * K);
  row.addSpacer();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (PAGE_URL) w.url = PAGE_URL;
  return w;
}

if (config.runsInWidget) {
  const fam = config.widgetFamily === "small" ? "small" : "medium";
  Script.setWidget(buildWidget(fam));
} else {
  // 在 Scriptable 里直接运行：先看一眼预览
  await buildWidget("medium").presentMedium();
}
Script.complete();
