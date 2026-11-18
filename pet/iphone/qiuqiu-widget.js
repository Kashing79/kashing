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
const FRAMES = {"ball0":{"rows":[".yYyw.","yYYwyy","yYwyyy","ywyyyv","wyyyvv",".yvvv."],"pal":{"y":"#d6e645","Y":"#f4f9ae","w":"#ffffff","v":"#9fb226"}},"p_front":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","sssessssesss","sssessssesss","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_front_blink":{"rows":["..hhhhhhhh..",".hhhhhhhhhh.","hhhhhhhhhhhh","hhhhhhhhhhhh","hhhhhssshhhh","hhsssssssshh","hssssssssssh","ssssssssssss","sseesssseess","sdssssssssds",".ssssmmssss.","..ssssssss..","....wwww....",".jjjwttwjjj.","jjjjJttJjjjj","jjjjJttJjjjj","jjjjjJJjjjjj","jjjjjjjjjjjj","sjjjjjjjjjjs",".jjjjjjjjjj.",".pppppppppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.",".pppp..pppp.","bbbbb..bbbbb"],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_wave_a":{"rows":["..hhhhhhhh.....",".hhhhhhhhhh....","hhhhhhhhhhhh...","hhhhhhhhhhhh...","hhhhhssshhhh...","hhsssssssshh...","hssssssssssh...","sssessssesss...","sssessssesss.ss","sdssssssssds.ss",".ssssmmssss..j.","..ssssssss...j.","....wwww....jj.",".jjjwttwjjjjj..","jjjjJttJjjjj...","jjjjJttJjjj....","jjjjjJJjjjj....","jjjjjjjjjjj....","sjjjjjjjjjj....",".jjjjjjjjjj....",".pppppppppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....",".pppp..pppp....","bbbbb..bbbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","j":"#3a4c7a","w":"#f6f4ef","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"p_hold":{"rows":["..hhhhhhhh....",".hhhhhhhhhh...","hhhhhhhhhhhh..","hhhhhhhhhhhh..","hhhhhhhsssshh.","hhhhsssssssss.","hhhssssssssss.","hhhsssessssess","hhhsssessssess","hhsssssssssdss",".hsssssssmmss.","..sssssssss...",".....wwww.....",".jjjjjwttwj...",".jJJjjJttJj...",".jJJjjJttJj...",".jjJJjjJssj...",".jjjJJJJssj...",".jjjjjjjjjj...",".jjjjjjjjjj...","..pppppppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..ppp..ppp....","..bbbb.bbbb..."],"pal":{"h":"#2b2530","s":"#f3c9a5","e":"#2a1f2d","d":"#efa995","m":"#b4524e","w":"#f6f4ef","j":"#3a4c7a","t":"#d0353f","J":"#2a3758","p":"#324169","b":"#2a2024"}},"fx_heart":{"rows":[".rr.rr.","rwrrrrr","rrrrrrr",".rrrrr.","..rrr..","...r..."],"pal":{"r":"#f0506e","w":"#ffd0da"}},"fx_z":{"rows":["zzzzz","...z.","..z..",".z...","zzzzz"],"pal":{"z":"#bcd8ff"}},"fx_zs":{"rows":["zzzz","..z.",".z..","zzzz"],"pal":{"z":"#bcd8ff"}},"g_sit":{"rows":[".........................aaaaaaa.......","........................abbcdddda......",".......................abeeecffgga.....",".......................aeeehcdiadaa....",".......................aeeecddaadddaa..","......................aeeeecgggggggjka.","......................aeeeeclgggglkkkla",".....................aeeeehclllmlllllla","......................aeehhcflnnmmmnnna","......................ahhhcffffoaaaaaa.",".....................adcccooooopqa.....","....................adggggggggfgga.....","...................addgggggggffrra.....","..................adddgggggfffrrra.....",".................adddgggffffforrrra....","................adddggggodfgforrrra....","...............adddgggggodggoorrrsa....",".aaaaa........adddgggggtoggforrssa.....","aggdddaaa....adddgggggoooggfosssa......","arfffgggdaaaaaddgggooododddoouaa.......",".asrrfffgggddaggooodddgogggova.........","..assrrrffgggdgoodddgggoggggvva........","...aasrsrrfffggoddgggdggogggvva........",".....asssrsrrfgoggggfggfvgggvva........","......aasssrssroggffftttwagtttwa.......","........aaassasaofffgrrrvvgrrrvva......","...........aa.a.aaaaaaaaaaaaaaaa......."],"pal":{"a":"#2a1f2d","b":"#d9a044","c":"#8f5d1c","d":"#f8d889","e":"#c98b30","f":"#c58a2f","g":"#e8b04f","h":"#a87024","i":"#ffffff","j":"#68565c","k":"#2f2226","l":"#f6d896","m":"#7a3b36","n":"#e3b96a","o":"#a56f22","p":"#d2443f","q":"#ffd24a","r":"#fbe3a8","s":"#eecb82","t":"#fff2cf","u":"#9c6920","v":"#c0862c","w":"#d79b3c"}},"g_lie":{"rows":[".................................aaaaaa.......","................................abbcccca......","...............................adddbeeffa.....","..............................adddgbchacfaa...","..............................adddgbcaacccfaa.","............................aaidddbfffffffjkla","....................aaaaaaaacbddddblffffllkkla","................aaaacccccccccbdddgblllllllllla","...............acccccccccccccbdddgbelmmmmmmmma","......aaaaaaaaaccccccnnnnfffcbdggbbeeeenoopaa.",".aaaaacccccccccccffnnccffnffffbbbbnnnaamoqla..","afffffffffeffefffnncccfffnffffffffeersaammma..","aeetteeeeeeeetffncccffffffffffffeeetta..aaa...","auuuutttuttutufnccfffeefffffnfeeeeetta..aaa...",".aaaauuuuuuuuufnffffeennffffnffeefcnnaaacvva..",".....aaaauaaaaanfffeenneftttnneffffccccfvttta.",".........a.....aneeennttttuttnnnefcffffeeeaa..","................aannneuuutttteenanfeeeewwa....","..................aaaaaaaaaaaaaa.annnwwaa.....","..................................awwwa.......","...................................aaa........"],"pal":{"a":"#2a1f2d","b":"#8f5d1c","c":"#f8d889","d":"#c98b30","e":"#c58a2f","f":"#e8b04f","g":"#a87024","h":"#ffffff","i":"#d9a044","j":"#68565c","k":"#2f2226","l":"#f6d896","m":"#e3b96a","n":"#a56f22","o":"#f27f95","p":"#7a3b36","q":"#d9627b","r":"#d2443f","s":"#ffd24a","t":"#fbe3a8","u":"#eecb82","v":"#fff2cf","w":"#9c6920"}},"g_sleep":{"rows":["..................................aaaaaaa.......","...........................aaaaaaabbcdddda......","....................aaaaaaaddddccbeeecffffa.....","................aaaaddddddddddccbeeegcdddfa.....","...............adddddddddddddcbbeeegcdaaaddaa...","...........aaaadddddfhhhhffdcceeeegcffffffffia..","......aaaaaddddddffhhddffhffceeeegccfjfffffklka.",".aaaaaddddfffffffhhdddfffhfffceggccffjjjmjjkkkja","adddfffffnnnnnffhdddfffffffffcccccffnjjommmjjooa","afnnnnppppppppfhddfffnnfffffhnnnnnhnnnnnooooooa.","appppqppqpqqqqfhffffnnhhfffnhfffffrhhaaadssaaa..",".aaaqqqqqqqaqaahfffnnhhnfppphhnnffddddffspppa...","....aaaaaaa.a..ahnnnhhpppnqppnhhnnfffffnnnaa....","................aahaaaqqqqqqqaaaahfnnntuua......","..................a...aaaaaaa....ahhhuuaa.......","..................................auuaa.........","...................................aa..........."],"pal":{"a":"#2a1f2d","b":"#d9a044","c":"#8f5d1c","d":"#f8d889","e":"#c98b30","f":"#e8b04f","g":"#a87024","h":"#a56f22","i":"#fdebc0","j":"#f6d896","k":"#2f2226","l":"#68565c","m":"#7a3b36","n":"#c58a2f","o":"#e3b96a","p":"#fbe3a8","q":"#eecb82","r":"#ffd24a","s":"#fff2cf","t":"#c0862c","u":"#9c6920"}},"d_sit":{"rows":["..........................aaa........",".........................abcdaa......","........................aeecfgaa.....",".......................abeecfaaaaaa..",".......................aeeecdffdddha.","......................abeeicfjkjfflla",".....................aaeeeicmnkkkkjma","..................aaadceeecmmmaaaaaa.","...............aaaddddceiicooopa.....",".aa.........aaadddddffcccccfmfa......","afdaaa....aadddddfffffffffmmjfa......",".amfffaaaaddddfffffffffommmojja......","..aaammffddffooffffffffodffojna......",".....aammffooddoffffmmmoffmoma.......",".......aafoddffommmmmmmoffoqa........","........afoffffommmmaaaaffrsa........",".........aofmmtttsaa....atttsa.......","..........aaaaaaaa.......aaaa........"],"pal":{"a":"#2a1f2d","b":"#8a441c","c":"#47200b","d":"#dc915a","e":"#783816","f":"#bb6730","g":"#ffffff","h":"#5a484c","i":"#5c2a10","j":"#cd8648","k":"#5e2a22","l":"#2a1c1e","m":"#93481c","n":"#aa6832","o":"#743514","p":"#ffd24a","q":"#6b3012","r":"#eebd8a","s":"#8a421a","t":"#dfa063"}},"d_bow":{"rows":[".a..................................","aba.................................","aba.................................","acba................................",".aba................................",".abba.....................aa........",".abcbaaaaaa.............aaddaa.aaaa.","..abbbdddddaaaaaaaa....aeffgabaddhia","...acddbbbdddddddddaaaajjjfaadbbbiba","...adbbbbbbbbbbbbdddddfjjkfbbllllmca","...abbnnnnbbbbbbbbbbdfejjfbbmmocaaa.","....anddbnbbbbbbbbbddfjjjfbcccaa....","....anbbbnbbbbbbbbbbfejjjfccca......",".....abbbncccccbbbbbfjjjkfnaa.......","......abbnpccccccccnfjjkkfqaa.......",".....adbcnraaaaacccnbffffsstpa......",".....attnppa....aaaancdbbcura.......","......aaaaa.........aaaccnaa........",".......................aaa.........."],"pal":{"a":"#2a1f2d","b":"#bb6730","c":"#93481c","d":"#dc915a","e":"#8a441c","f":"#47200b","g":"#ffffff","h":"#5a484c","i":"#2a1c1e","j":"#783816","k":"#5c2a10","l":"#5e2a22","m":"#cd8648","n":"#743514","o":"#aa6832","p":"#8a421a","q":"#ffd24a","r":"#6b3012","s":"#eebd8a","t":"#dfa063","u":"#c58248"}},"d_beg":{"rows":["..............aaaaa.......",".............abccdda......",".............aeecfgaaaaaa.","............aeehcdaadddija","............aeehcfklfffjja","...........aeeehcflmmmmlna","...........aeeecnnnaaaaaa.","..........aeeeecnnooa.....","...........aehhcoofpfa....","............accfffkkqra...","...........adffnnnodfna...","...........adfnnnfdfnssa..","..........adffofnnfnota...","..........adfffooooooa....","..........affffffnnta.....",".........adffffffnaa......",".........adfffffnna.......","........adffffffna........","........adfffffnna........","........affffffna.........",".......adfffffnna.........",".......adfffoona..........",".......affooddoa..........",".....aaafoddffosa.........",".aaaadddodfffqoa..........","annnnnnnoofnrrrsa.........",".aaaaaaaaaaaaaaa.........."],"pal":{"a":"#2a1f2d","b":"#8a441c","c":"#47200b","d":"#dc915a","e":"#783816","f":"#bb6730","g":"#ffffff","h":"#5c2a10","i":"#5a484c","j":"#2a1c1e","k":"#e0a36a","l":"#cd8648","m":"#5e2a22","n":"#93481c","o":"#743514","p":"#ffd24a","q":"#eebd8a","r":"#dfa063","s":"#8a421a","t":"#6b3012"}},"d_roll":{"rows":["...........................aaa........aa..","..........aaaaaa..........abcca......adea.",".........acffbbgaaaaaaaaaaggffaaaaaaaheea.",".........aiijjghhhhhkkkkkjjjijlhhahhiimma.",".a.......ainhjjkkkkkkkkkkjhhllolahaimmpa..","ahaaaaa.aiiniijmmmmmmmmmjiilloqqlimmmpraa.","annnihhaajnninjmmmmmmmmmmjllqqqllinpnjsspa",".aaannninjjjnjjpppiiiiiiillqqqtliinnaaaaa.","....aaaaaniijiinnnnnnnnnilqqqtlnnnna......",".........aannnnnnnnnnnnnnlqqttljaaa.......","...........aaaaaaaaaaaaaaallllaaua........","..........................aaaa..a........."],"pal":{"a":"#2a1f2d","b":"#9c4f20","c":"#eebd8a","d":"#5a484c","e":"#2a1c1e","f":"#dfa063","g":"#8a421a","h":"#dc915a","i":"#bb6730","j":"#743514","k":"#e0a36a","l":"#47200b","m":"#cd8648","n":"#93481c","o":"#8a441c","p":"#aa6832","q":"#783816","r":"#ff9fb0","s":"#f27f95","t":"#5c2a10","u":"#ffd24a"}},"d_lie":{"rows":["............................aaaaa.......","...........................abcdefa......","..........................abccdfgaaa.a..",".........................adcchdeaaeeaia.","................aaaaaaaaaaacchdfjjfffkka","...........aaaaaeeeeeeeeedccchdfjlllljma",".....aaaaaaeeeeeeeeeeefffdcccdmmmaaaaaa.",".aaaaeeeefeefnnnffffffffedcchdnna.......","afmmmmmmmmffneenfffffffffdhhhdfoa.......",".aaaaaaaaffnefffnfffffffffdddmjaaa......",".........anefffpqqfmmmmmnefmenepqra.....","..........affmnmsmmmmmmmnnffeffmta......","...........amanaaaaaaaaaaanmfmnta.......","............a.a...........aaanna........",".............................aa........."],"pal":{"a":"#2a1f2d","b":"#8a441c","c":"#783816","d":"#47200b","e":"#dc915a","f":"#bb6730","g":"#ffffff","h":"#5c2a10","i":"#5a484c","j":"#cd8648","k":"#2a1c1e","l":"#5e2a22","m":"#93481c","n":"#743514","o":"#ffd24a","p":"#eebd8a","q":"#dfa063","r":"#8a421a","s":"#c58248","t":"#6b3012"}},"d_sleep":{"rows":[".............................aaaaa.......",".........................aaaabcbdda......","...............aaaaaaaaaaddbceeebffa.....","...........aaaaddddddddddbbceegbaafaa....",".......aaaaddddddddfffffbbceegbbdffddaaa.","...aaaadddddfhhhffffffffbeeegbbffijfffkla",".aadfffmmmffhddhffffffffbeeggbfmmnjjjjlla","afmmmaaaaffhdfffhfffffffbbggbhhmmaaaanma.",".aaaa....ahdfffoppmmmmmmhbbbdqhhhha..aa..","..........affmhmrmmmmmmmmhmffffmsa.......","...........amahaaaaaaaaaaahhmmhsa........","............a.a...........aaahaa.........",".............................a..........."],"pal":{"a":"#2a1f2d","b":"#47200b","c":"#8a441c","d":"#dc915a","e":"#783816","f":"#bb6730","g":"#5c2a10","h":"#743514","i":"#cd8648","j":"#5e2a22","k":"#5a484c","l":"#2a1c1e","m":"#93481c","n":"#aa6832","o":"#eebd8a","p":"#dfa063","q":"#2c5fa8","r":"#c58248","s":"#6b3012"}}};

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
