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
const FRAMES = {"ball0":{"rows":[".yYyw.","yYYwyy","yYwyyy","ywyyyv","wyyyvv",".yvvv."],"pal":{"y":"#d6e645","Y":"#f4f9ae","w":"#ffffff","v":"#9fb226"}},"p_front":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","sssessssesss","sssessssesss","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_front_blink":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","ssssssssssss","sseesssseess","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_wave_a":{"rows":["..hhhhhhhh.....",".hhhhhhhhhh....","hhhhhhhhhhhh...","hhhhhhhhhhhh...","hhhhhssshhhh...","hhsssssssshh...","hssssssssssh...","sssessssesss...","sssessssesss.ss","sdssssssssds.ss",".ssssmmssss..j.","..ssssssss...j.","....wwww....jj.",".jjjwttwjjjjj..","jjjjJttJjjjj...","jjjjJttJjjj....","jjjjjJJjjjj....","jjjjjjjjjjj....","sjjjjjjjjjj....",".jjjjjjjjjj....",".pppppppppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....","bbbbb..bbbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","j":"#3a4c7a","w":"#f6f4ef","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_hold":{"rows":["..hhhhhhhh....",".hhhhhhhhhh...","hhhhhhhhhhhh..","hhhhhhhhhhhh..","hhhhhhhsssshh.","hhhhsssssssss.","hhhssssssssss.","hhhsssessssess","hhhsssessssess","hhsssssssssdss",".hsssssssmmss.","..sssssssss...",".....wwww.....",".jjjjjwttwj...",".jJJjjJttJj...",".jJJjjJttJj...",".jjJJjjJssj...",".jjjJJJJssj...",".jjjjjjjjjj...",".jjjjjjjjjj...","..pppppppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..bbbb.bbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"fx_heart":{"rows":[".rr.rr.","rwrrrrr","rrrrrrr",".rrrrr.","..rrr..","...r..."],"pal":{"r":"#f0506e","w":"#ffd0da"}},"fx_z":{"rows":["zzzzz","...z.","..z..",".z...","zzzzz"],"pal":{"z":"#bcd8ff"}},"fx_zs":{"rows":["zzzz","..z.",".z..","zzzz"],"pal":{"z":"#bcd8ff"}},"g_sit":{"rows":["...........................aaaa........",".........................aabccca.......","........................abbbddeda......",".......................abbbbddedfa.....","......................gbbbccddedbbaaff.",".....................ghhcbddededccbbiif","....................abchhhdddeeedddddf.","...................abbbcchhjeeakkkkka..","..................abbbbbbeehhlmmmmmm...","..................accbbbbceelnom.......","..................accbbbccdeooolm......",".................abbbccccddkllllm......",".................abbbcdddddkllkkm......","................abbbbbcbbdddelmm.......","................abbbbcbbbddeea.........","...............abbbbccbcddeeea.........","...............abbbbcbbcdeeea..........","..............abbbbccbbbeeea...........","..............abbbccocceeaa............",".............abbbbcbocceea.............",".............abbbbbbpccdca.............","............acbbbbbbpccdda.............","..........aaacpppcccoccdda.............",".mm...aaaaqqecpppccdeecdea.............","mooaaabbbccccepppoddddcdem.............","moocccddddeeeekkeoeddlcookm............","acddcooooooollmmaecccllllm.............",".alooooooloolm...aacammmm..............","..mmooooolomm......a...................","....mmommmm............................","......m................................"],"pal":{"a":"#4a221e","b":"#fad378","c":"#e6a94e","d":"#b87133","e":"#854728","f":"#150f17","g":"#572133","h":"#d64945","i":"#291f29","j":"#992e40","k":"#ad7753","l":"#d6a774","m":"#61342b","n":"#ffd342","o":"#f2d29b","p":"#ffefc2","q":"#ffeea8"}},"g_lie":{"rows":["...................................aaaaa.......","..................................abccdda......","................................aabbddddef.....","..............................gghhbbddddffa....","..i.........................agjjcbccddddbbbaaf.",".ikiiiiii...............aaaahhbjjcddddddccccclf","ikkkkkkkkii..........aaahhhbhhhbmjdddnnndddddda","ikkkkkkkkkki....aaaaabhhhhhbbbbbcmjjnnoopppqaa.","ikkkkkkkkkkkaaaahbhhhbbbbbbbbbbbccnjjoiirrpppq.","acccccbbbbbbbnhhhbhhbbcbbbbcccccccnnst..iiqrppq","irrooodddddcnbbbbbbbbcccdcccccccccnooi.....qppq",".iiiiiaaaaaarbbbbbbbccccdcccdnbbcccri......qppq","............iuuucccccddddccccbbccccrii......qq.","............iuuuccdddddndddddbccccroiri........","............iuuukdddddndddddbbccckrokki........","............irrnvhcdonnnnddbbbdbbbbbkki........",".............iiancccookkkkacddddddddoi.........","................acaaiikiiiikaoarraaai..........",".................a....i....i.i.ii.............."],"pal":{"a":"#4a221e","b":"#fad378","c":"#e6a94e","d":"#b87133","e":"#ffffff","f":"#150f17","g":"#572133","h":"#ffeea8","i":"#61342b","j":"#d64945","k":"#f2d29b","l":"#291f29","m":"#992e40","n":"#854728","o":"#d6a774","p":"#f28399","q":"#7a3351","r":"#ad7753","s":"#ffd342","t":"#804219","u":"#ffefc2","v":"#fffae0"}},"g_sleep":{"rows":[".............................aaaa................","............................abbcca...............","..........................aabbcccda..............",".....................aaaaabcccccedda.............","...............aaaaaacbbbbbccccccefg..a..........",".........aaaaaabbcbbbccccccddcccddfeaacaa........","..aaaaaaabbcchbbbcbbccdccccdddddddedcddeea.......",".acccccdddddhccccccccddddddeedddddedceeeeda......","aeeeeehhhhhhhcccccccddddedddehcccdeddeehedaaaaii.","jkkkkkkkkkkklmmmdddddeeeedddddccceehddehdcccccnni",".jkkkkkkkkkkjmmmddeeeeeheedeecodhhheeeeheddddddi.","..jkjkpppjkjjmmmkeeeeeheeeeeccddhlheppehleppppa..","...j.jjjj.j.jllhqbdephhhheeccceccccckkaajajjjj...",".............jjahdddppkkkkedeeeeeeeepj...........","................adaajjlljjjkapappaaaj............",".................a....jj...j.j.jj................"],"pal":{"a":"#4a221e","b":"#ffeea8","c":"#fad378","d":"#e6a94e","e":"#b87133","f":"#992e40","g":"#572133","h":"#854728","i":"#150f17","j":"#61342b","k":"#f2d29b","l":"#ad7753","m":"#ffefc2","n":"#291f29","o":"#ffd342","p":"#d6a774","q":"#fffae0"}},"d_sit":{"rows":[".............................aaa........","............................abccad......","...........................abbeecdaa....","..........................abffeecbbbaad.",".........................gbbffeeccffffhd","........................giiiiceeejjjkkd.",".....................aaablleiiccammmmm..","...................aalllbbbfccaa........",".................aalllbbfffffca.........","...............aalllbbbbfeefffjm........","..............alllbbbffffbbffjjm........",".............allbbbffffffbbbcmm.........",".......aaaaaalbbbbbeeeeefffca...........","...aaaabbbbclbbbbffcecccffca............",".aafffeeeeecfffffeeccaaaaffcm...........","afffaaaaaaaaeeeeeekma...afnnjm..........",".aaa........acccffkm....mnnnm...........",".............aaaaam......mmm............"],"pal":{"a":"#3d181c","b":"#d98c4e","c":"#66261d","d":"#150f17","e":"#8f3f22","f":"#b86230","g":"#29224c","h":"#49404c","i":"#4981d6","j":"#7a3925","k":"#a86239","l":"#f2be7e","m":"#52221f","n":"#d18e54"}},"d_bow":{"rows":[".a....................................","aba...................................","abba..................................",".abba.................................","..abba................................","...abba...............................","....abba..............................",".....abba.............................","......accaaa..........................","......adddddaa........................","......aeeeeeddaa...........aaaf.aaaaf.",".....adbeegbeeddaaaa......aggcfaddeehf","......abeebgbbeeddddaaiiaabggcgbbggjf.","......abbbbggbbbeeeeddkkedbgggcgllam..","......acbggggbbbbbeeeeeebgggggaamm....","......aecggcggbbbbbeeeebbbcggga.......",".....abcggaaggggbbbeebbbbbcccca.......",".....acbba..aaggbbbbbgeebbnmaa........","......abba....aagggggeebbnop..........","......mnjjm.....accccggbbbnm..........",".......mmm.......aaaaallaam...........","......................mm.............."],"pal":{"a":"#3d181c","b":"#b86230","c":"#66261d","d":"#f2be7e","e":"#d98c4e","f":"#150f17","g":"#8f3f22","h":"#291f29","i":"#29224c","j":"#a86239","k":"#4981d6","l":"#7a3925","m":"#52221f","n":"#d18e54","o":"#ffd342","p":"#804219"}},"d_beg":{"rows":[".................aaa....abb.","................acdebbaacffb","...............aeccdbbggccb.","...............aecccdgghha..","..............aeecccchaii...",".............jeeccccai......","............jkkkcccca.......","............adlledchi.......","...........aeeeeddmga.......","...........aedddddcga.......","...........adcccddcgaii.....","...........accggddeeenni....","............agggdcccoohi....","...........aleeecgggiii.....","...........aeedddcca........","...........aeedddcca........","...........aeedddca.........","...........aeedddca.........","...........aeeddcca.........","...........aeeddcca.........","...........aeeddcca.........","...........aeddeeeea........","...aaaaaaa.addddddda........",".aaeeeeeeeaaddccccca........","adddgggccddgccgccoi.........",".aaaaaaaaaaaaaaaai.........."],"pal":{"a":"#3d181c","b":"#150f17","c":"#8f3f22","d":"#b86230","e":"#d98c4e","f":"#291f29","g":"#66261d","h":"#7a3925","i":"#52221f","j":"#29224c","k":"#4981d6","l":"#f2be7e","m":"#ffd342","n":"#edbc7b","o":"#a86239"}},"d_roll":{"rows":[".............aa.............................","............abba......................aacc..","............deedd...aaaaaaaaa........affggc.","...........dheeeedaaiibbbbbbbaddd..aabggggj.","...........dheeekkfbbbbbbbffkflllddffmmeeenj","...........dekkkoopfffppppfkkqkeelleeekkkkj.",".dddd.....dleoooorrrrrrkkeeeeeekeeeejhjddd..","deeeeddddddkkooookkkkkkkkkkkkookkkkhojj.....",".doookkkkeehooooooooooookokkooskoooohd......","..dddddddddeddhhhhhhhhhhhhooostddhhdd.......","...........d..ddddddddddddhhdt...dd.........","..........................dd................"],"pal":{"a":"#52221f","b":"#edbc7b","c":"#7a3351","d":"#3d181c","e":"#d98c4e","f":"#d18e54","g":"#f28399","h":"#66261d","i":"#fce2ac","j":"#150f17","k":"#b86230","l":"#f2be7e","m":"#b25074","n":"#291f29","o":"#8f3f22","p":"#a86239","q":"#ffd342","r":"#7a3925","s":"#3a4d99","t":"#29224c"}},"d_lie":{"rows":["...............................aaa........",".............................aabbbc.......","............................adebbbcaa.....","...........................fddebbbeddaacc.",".........................afggeebbbhbeeeiic",".aaaaa..........aaaaaaaaajjdgghbbbakkkkkc.","aeeeddaaaaaaaaaajjjjjjjjjddddlglhhammmmm..",".aaabbeeeddhjjjjddddddddedeeeehfaa........","....aaaaahhhddddddeddeedeeeeeeea..........",".........aaeeddeeebeeeeeebhdebbm..........","..........aeeeebbbhbbbbebbbdebnom.........","...........abhddbnhhbbbbbbeeedpom.........","............aaheenmaaaahhheeeeeom.........","..............aaam.....aaaaaaaam.........."],"pal":{"a":"#3d181c","b":"#8f3f22","c":"#150f17","d":"#d98c4e","e":"#b86230","f":"#29224c","g":"#4981d6","h":"#66261d","i":"#291f29","j":"#f2be7e","k":"#7a3925","l":"#3a4d99","m":"#52221f","n":"#a86239","o":"#d18e54","p":"#edbc7b"}},"d_sleep":{"rows":["..........................aa................","......................aaaabbac..............","...................aaadddbbbefc..aaa........","...............aaaadddddbbbbeffcaegga.......",".............aaddddbbbbbeeeeeeebeeggea......",".aaaaaaaaaaaaddbbbebbbeeggggeegeeeggghaaaa..","abbbbbbbbbbhdbbbbbgeeeeeeghbeegeegghgeeebbi.",".ahhhhhhhhhhbebeebgegggggggbeejjhggakkklgmmi","..aaaaaaaaaabeeggnnhgggggheeeojjahhappppaii.","...........aghhheejhhhahhheeeeejpaa.........","............aahaeapaaa.aaaaaaaap............","..............a.a..........................."],"pal":{"a":"#3d181c","b":"#d98c4e","c":"#29224c","d":"#f2be7e","e":"#b86230","f":"#4981d6","g":"#8f3f22","h":"#66261d","i":"#150f17","j":"#d18e54","k":"#7a3925","l":"#a86239","m":"#291f29","n":"#edbc7b","o":"#ffd342","p":"#52221f"}}};

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
