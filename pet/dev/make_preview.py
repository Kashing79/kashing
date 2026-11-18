#!/usr/bin/env python3
"""开发用：把 web/ 打包成一个单独的网页片段，方便在线预览（带草地背景）。
用法：python3 make_preview.py <输出.html>"""
import sys, pathlib, re
web = pathlib.Path(__file__).resolve().parent.parent / 'web'
js = lambda n: (web / n).read_text(encoding='utf-8').replace('</script', '<\\/script')
index = (web / 'index.html').read_text(encoding='utf-8')
style = re.search(r'<style>(.*?)</style>', index, re.S).group(1)
island = re.search(r'(<div id="island">.*?</div>\n  </div>\n</div>)', index, re.S).group(1)
HEAD = """<title>球球桌宠</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  :root { --lawn: #8fca78; --ink: #183222; --chip: #ffffffd9; color-scheme: light; }
  html, body { height: 100%; }
"""
EXTRA = """
  body { background: var(--lawn); position: relative; }
  #hint2 {
    position: absolute; left: 0; right: 0; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 2; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "PingFang TC", "Microsoft YaHei", sans-serif; color: var(--ink);
    transition: opacity .6s;
  }
  #hint2.quiet { opacity: 0; }
  #hint2 p { margin: 0; padding: 6px 12px; background: var(--chip); border-radius: 12px; text-align: center; max-width: 34em; }
  #hint2 ul { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  #hint2 li { padding: 5px 10px; background: var(--chip); border-radius: 999px; }
</style>
<div id="hint2">
  <p>这是在线预览，草地是为了看得清楚。装到 MacBook 上以后背景是透明的，它们直接在屏幕上跑；顶上那颗黑色的就是"灵动岛"。</p>
  <ul><li>点草地：把球丢到那里</li><li>拖住小球甩出去</li><li>点小狗摸摸它</li><li>把它们拎起来</li><li>鼠标移到顶上的岛</li></ul>
</div>
<canvas id="stage"></canvas>
<div id="bubbles"></div>
"""
TAIL = """
<script>__CONFIG__
window.PET_CONFIG.grass = true;
window.PET_CONFIG.roam = true;
(function () {   // 提示放在最下面，玩几下或者过一会儿就自己淡掉，不挡着它们
  var n = 0, h = document.getElementById('hint2');
  window.addEventListener('pointerdown', function () { if (++n >= 3) h.classList.add('quiet'); });
  setTimeout(function () { h.classList.add('quiet'); }, 20000);
})();
</script>
<script>__SPRITES__</script>
<script>__DOGS__</script>
<script>__ISLAND__</script>
<script>__PET__</script>
"""
page = HEAD + style + EXTRA + island + TAIL
out = (page.replace('__CONFIG__', js('config.js')).replace('__SPRITES__', js('sprites.js')).replace('__DOGS__', js('dogs.js'))
           .replace('__ISLAND__', js('island.js')).replace('__PET__', js('pet.js')))
pathlib.Path(sys.argv[1]).write_text(out, encoding='utf-8')
print('wrote', sys.argv[1], len(out), 'bytes')
