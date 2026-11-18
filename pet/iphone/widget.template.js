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
const PAGE_URL = "__PAGE_URL__";   // 点小组件时打开的网页版（可以丢球的那个）。留空 "" 就是点了不跳转。
const NIGHT = [0, 7];               // 几点到几点睡觉

// ---------- 像素画数据（由 pet/iphone/build.js 从 web/sprites.js 生成，不用手改）----------
const INK = "__INK__";
const FRAMES = __FRAMES__;

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

// 给所有有颜色的像素描一圈深色的边
function outline(grid, groundY) {
  const H = grid.length, W = grid[0].length, add = [];
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

// 决定这次画什么场景
function scene(family, now) {
  const h = now.getHours();
  const seed = Math.floor(now.getTime() / (15 * 60 * 1000));   // 每 15 分钟换一次
  const small = family === "small";
  const W = small ? 46 : 104, H = 40, ground = H - 5;
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(null));
  const night = isNight(h);
  const mood = night ? "sleep" : pick(["play", "wave", "rest", "love", "play"], seed);

  if (small) {
    // 小尺寸：小人 + 小腊肠
    if (mood === "sleep") { stamp(grid, "p_front_blink", 3, ground, false); stamp(grid, "d_sleep", 18, ground, false); stamp(grid, "fx_zs", 14, ground - 27, false); }
    else if (mood === "play") { stamp(grid, "p_hold", 3, ground, false); stamp(grid, "d_bow_a", 17, ground, true); stamp(grid, "ball0", 16, ground - 9, false); }
    else if (mood === "wave") { stamp(grid, "p_wave_a", 3, ground, false); stamp(grid, "d_stand_b", 17, ground, true); }
    else if (mood === "love") { stamp(grid, "p_front", 3, ground, false); stamp(grid, "d_sit_a", 17, ground, true); stamp(grid, "fx_heart", 25, ground - 22, false); }
    else { stamp(grid, "p_front", 3, ground, false); stamp(grid, "d_lie", 17, ground, true); }
  } else {
    // 中 / 大尺寸：金毛 + 小人 + 小腊肠
    if (mood === "sleep") {
      stamp(grid, "g_sleep", 2, ground, false); stamp(grid, "p_front_blink", 44, ground, false); stamp(grid, "d_sleep", 68, ground, true);
      stamp(grid, "fx_z", 60, ground - 29, false); stamp(grid, "fx_zs", 32, ground - 12, false);
    } else if (mood === "play") {
      stamp(grid, "g_sit_a", 2, ground, false); stamp(grid, "p_hold", 46, ground, false); stamp(grid, "ball0", 59, ground - 12, false); stamp(grid, "d_bow_a", 70, ground, true);
    } else if (mood === "wave") {
      stamp(grid, "g_stand_b", 2, ground, false); stamp(grid, "p_wave_a", 46, ground, false); stamp(grid, "d_stand_b", 70, ground, true);
    } else if (mood === "love") {
      stamp(grid, "g_sit_b", 2, ground, false); stamp(grid, "fx_heart", 32, ground - 28, false); stamp(grid, "p_front", 46, ground, false); stamp(grid, "d_sit_b", 70, ground, true);
    } else {
      stamp(grid, "g_lie", 2, ground, false); stamp(grid, "p_front", 46, ground, false); stamp(grid, "d_sit_a", 70, ground, true);
    }
  }
  outline(grid, ground);
  // 草地
  const grass = night ? "#2f5a45" : "#9fd18b", grass2 = night ? "#244a39" : "#86bf74";
  for (let y = ground; y < H; y++) for (let x = 0; x < W; x++) grid[y][x] = y === ground ? grass : grass2;
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
