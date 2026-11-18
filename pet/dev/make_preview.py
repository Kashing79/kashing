#!/usr/bin/env python3
"""开发用：把 web/ 里的三个脚本塞进一个单独的网页，方便在线预览。
用法：python3 make_preview.py <输出.html>"""
import sys, pathlib
web = pathlib.Path(__file__).resolve().parent.parent / 'web'
js = lambda n: (web / n).read_text(encoding='utf-8').replace('</script', '<\\/script')
page = r'''<title>球球桌宠</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap">
<style>
  /* 版面：上面一小段说明，下面整块是"桌面"，小人和狗狗站在最底下 */
  :root {
    --wall: #dde8f3; --wall-2: #eef4fa; --floor: #c3d0de; --floor-2: #b3c2d2;
    --ink: #223040; --muted: #57687c; --chip: #ffffffb3; --line: #22304026; --ball: #7d9412;
    --font-body: -apple-system, BlinkMacSystemFont, "PingFang SC", "PingFang TC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
    --font-label: "Silkscreen", ui-monospace, "SF Mono", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --wall: #1a2230; --wall-2: #212b3b; --floor: #121924; --floor-2: #0d131c;
      --ink: #e8eef6; --muted: #96a5b9; --chip: #ffffff14; --line: #ffffff24; --ball: #d6e645;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --wall: #1a2230; --wall-2: #212b3b; --floor: #121924; --floor-2: #0d131c;
    --ink: #e8eef6; --muted: #96a5b9; --chip: #ffffff14; --line: #ffffff24; --ball: #d6e645;
    color-scheme: dark;
  }
  html, body { height: 100%; }
  body {
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--wall); color: var(--ink); font-family: var(--font-body);
    -webkit-user-select: none; user-select: none; touch-action: none; cursor: default;
  }
  header {
    display: flex; flex-direction: column; gap: 10px;
    padding-block: 22px 14px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
  .label { font: 12px/1 var(--font-label); letter-spacing: .08em; color: var(--ball); }
  h1 { margin: 0; font-size: 26px; line-height: 1.2; font-weight: 700; text-wrap: balance; }
  header p { margin: 0; max-width: 34em; font-size: 14px; line-height: 1.6; color: var(--muted); }
  .how { display: flex; flex-wrap: wrap; gap: 8px; margin: 2px 0 0; padding: 0; list-style: none; }
  .how li { padding: 6px 11px; font-size: 13px; line-height: 1.3; background: var(--chip); border: 1px solid var(--line); border-radius: 999px; }
  #world {
    position: relative; flex: 1; min-height: 150px; overflow: hidden;
    background: linear-gradient(var(--wall) 0, var(--wall-2) calc(100% - 76px), var(--floor) calc(100% - 76px), var(--floor-2) 100%);
  }
  #stage { position: absolute; left: 0; bottom: 0; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated; }
  #bubbles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .bubble {
    position: absolute; transform: translate(-50%, -100%); max-width: 240px; padding: 6px 10px;
    font: 600 13px/1.35 var(--font-body); color: #2a1f2d; background: #fffdf7;
    border: 2px solid #2a1f2d; border-radius: 9px; white-space: pre-wrap; text-align: center;
    opacity: 0; transition: opacity .25s;
  }
  .bubble.on { opacity: 1; }
  @media (max-height: 520px) { header p { display: none; } h1 { font-size: 20px; } header { padding-block: 12px 8px; } }
</style>
<header>
  <span class="label">QIUQIU · PREVIEW</span>
  <h1>球球：小人、小腊肠、大金毛和一颗球</h1>
  <p>这是在线预览。装到 MacBook 上以后没有这块背景，它们直接站在屏幕最下面。</p>
  <ul class="how">
    <li>拖住小球甩出去</li>
    <li>点小人，他帮你丢球</li>
    <li>点小狗，摸摸它</li>
  </ul>
</header>
<div id="world"><canvas id="stage"></canvas><div id="bubbles"></div></div>
<script>__CONFIG__</script>
<script>__SPRITES__</script>
<script>__PET__</script>
'''
out = page.replace('__CONFIG__', js('config.js')).replace('__SPRITES__', js('sprites.js')).replace('__PET__', js('pet.js'))
pathlib.Path(sys.argv[1]).write_text(out, encoding='utf-8')
print('wrote', sys.argv[1], len(out), 'bytes')
