# 中国古建筑 · 宣传短片（一道弧线，藏着千年）

一支 20 秒、1920×1080、25 fps 的宣传短片。**全部画面由代码程序化绘制（Canvas 2D），配乐由代码合成（numpy）**，
不含任何照片、视频素材或采样音频。

成片：[`out/gujian-promo.mp4`](out/gujian-promo.mp4)

## 创意

结构参照一支"同一条弧线贯穿所有画面"的匹配剪辑广告：37 个镜头越切越快（约 1 秒 → 0.5 秒 → 0.2 秒），
题材、媒介、颜色每个镜头都截然不同，但画面中部那条隆起的弧线始终重合 ——
长城的山脊、琉璃瓦的檐口、门钉、土楼、藻井、赵州桥的拱券、瓦当、月洞门、窑洞的拱窗、祈年殿的圆檐……
后半段弧顶上方依次叠出三拍文字「一道弧线 / 藏着 / 千年」，15.96 秒硬切到片名卡「中国古建筑」，
17.28 秒换成「千年营造 等你发现」，随后镜头下摇回到开场的长城晨曦，首尾相接可循环播放。

## 目录

```
src/lib/core.js      共用工具库：弧线几何、图层与镜头运动、噪声/材质/浮雕光影、毛笔/粉笔/速写笔触、文字
src/timeline.js      剪辑表：每个镜头的帧数、文字节拍、弧线参数（500 帧 = 20.00 秒）
src/player.js        合成器：加载场景、叠加文字与胶片颗粒，向渲染脚本暴露 window.GJ
src/scenes/*.js      38 个场景模块（37 个镜头 + 片名卡），每个导出 { name, tone, init(env), draw(ctx, env, p) }
tools/preview.js     渲染某个镜头的静帧小样（开头/中间/结尾/带参考线）
tools/render.js      逐帧渲染为 PNG（无头 Chromium / Playwright）
tools/audio.py       合成配乐（拨弦、鼓、梆子、钟、弦乐震音、噪声铺底 + 卷积混响）
tools/encode.sh      PNG 序列 + WAV → H.264/AAC MP4
tools/build.sh       一键：字体 → 配乐 → 渲染 → 编码
docs/AUTHORING.md    场景作者指南（弧线规则、文字安全区、质感要求）
docs/storyboard.json 分镜任务单
```

## 重新生成

需要 Node.js（带 Playwright 与 Chromium）、Python 3 + numpy、ffmpeg。

```bash
cd gujian-promo
bash tools/build.sh          # ≈ 3–4 分钟；输出 out/gujian-promo.mp4
# 或分步：
bash tools/fetch-fonts.sh    # 下载字体到 assets/fonts/（不入库）
python3 tools/audio.py build/soundtrack.wav
node tools/render.js         # 也可 --shots s05,s06 只重渲个别镜头
bash tools/encode.sh 20      # 参数为 x264 CRF，越小画质越高、文件越大
node tools/preview.js s07    # 看单个镜头的小样 → build/preview/
```

改文案：`src/timeline.js` 里的 `BEATS`（三拍文字）和 `src/scenes/title.js`（片名卡）。
改节奏：`src/timeline.js` 里每个镜头的 `frames`（同时要改 `tools/audio.py` 顶部的 `FRAMES`，音画卡点靠它对齐）。

## 素材与授权

- 画面、配乐：本仓库代码生成的原创内容。
- 字体（渲染时下载，不随仓库分发）：思源宋体 Noto Serif SC、马善政楷书 Ma Shan Zheng、站酷小薇 ZCOOL XiaoWei、
  刘建毛草 Liu Jian Mao Cao、Cormorant Garamond —— 均为 SIL Open Font License 1.1（许可证文本随字体一起下载到 `assets/fonts/OFL-*.txt`）。
- 画面是示意性的插画，不是对具体文物的精确复原；各镜头题材与形制要点见 `docs/storyboard.json`。
