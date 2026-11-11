#!/usr/bin/env python3
"""progress.py — regenerate progress.md from the live state of the project.

  python3 tools/progress.py [--journals <workflow transcript dir>]

Reads the storyboards (docs/storyboard*.json), counts scene files / previews / finished videos / research files,
and, if the multi-agent workflow journals are available, summarises how far each shot is through the quality gates.
"""
import glob, json, os, re, subprocess, sys, datetime

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
argv = sys.argv[1:]
JDIR = argv[argv.index('--journals') + 1] if '--journals' in argv else os.environ.get('GJ_JOURNALS', '')

FILMS = [
    ('arch', '中国古建筑', 'docs/storyboard.json', 'src/scenes', 'build/preview', 'out/zhongguo-gujianzhu.mp4'),
    ('coins', '中国古钱币', 'docs/storyboard-coins.json', 'src/films/coins/scenes', 'build/coins/preview', 'out/zhongguo-guqianbi.mp4'),
    ('antiques', '中国古玩', 'docs/storyboard-antiques.json', 'src/films/antiques/scenes', 'build/antiques/preview', 'out/zhongguo-guwan.mp4'),
    ('tcm', '中国中医药', 'docs/storyboard-tcm.json', 'src/films/tcm/scenes', 'build/tcm/preview', 'out/zhongyi.mp4'),
]
TAG = {'arch': ('一道弧线 / 藏着 / 千年', '营造', '千年营造 等你发现'), 'coins': ('一枚圆钱 / 藏着 / 千年', '通宝', '千年通宝 等你发现'),
       'antiques': ('一层包浆 / 藏着 / 千年', '雅玩', '千年雅玩 等你发现'), 'tcm': ('一味草木 / 藏着 / 千年', '本草', '千年本草 等你发现')}
BEAT = {0: '无文字', 1: '第 1 拍', 2: '第 2 拍', 3: '第 3 拍'}
ids = [f's{i:02d}' for i in range(1, 38)]

# ── workflow journals: latest result per (stage, film, shot) ──
gate = {}   # (film, sid) -> dict(author=…, crit=…, pol=…, ver=…)
running = {}
if JDIR and os.path.isdir(JDIR):
    for jf in glob.glob(os.path.join(JDIR, 'wf_*', 'journal.jsonl')):
        started, done = {}, {}
        for line in open(jf, encoding='utf-8'):
            try: j = json.loads(line)
            except Exception: continue
            if j.get('type') == 'started': started[j['agentId']] = j.get('label') or ''
            if j.get('type') == 'result': done[j['agentId']] = j.get('result')
        for aid, label in started.items():
            m = re.match(r'(scene|critique|polish|verify):(?:(\w+):)?(s\d\d)$', label)
            if not m: continue
            stage, film, sid = m.group(1), m.group(2) or 'arch', m.group(3)
            g = gate.setdefault((film, sid), {})
            if aid in done:
                r = done[aid] or {}
                if stage == 'scene' and r.get('status') == 'failed' and not r.get('previewClean'): continue   # duplicate author that stood down
                g[stage] = r
            else:
                running[(film, sid)] = stage

def count(pattern):
    return len(glob.glob(os.path.join(ROOT, pattern)))

def probe(path):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p): return None
    try:
        out = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1:nk=1', p]).decode().split()
        return f'{float(out[0]):.1f} 秒，{int(out[1]) / 1e6:.1f} MB'
    except Exception:
        return '存在'

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
L = []
A = L.append
A('# 「藏着千年」系列宣传短片 · 进度')
A('')
A(f'生成时间：{now}（由 `python3 tools/progress.py` 生成，可随时重新生成；数字取自当时磁盘上的文件和代理流水线的记录）')
A('')
A('四支片子共用同一套结构：20 秒、1920×1080、25 fps，37 个快切镜头共用一条居中隆起的弧线，后 23 个镜头在弧顶上方叠三拍标语，')
A('最后是片名卡并摇回开场画面形成循环。全部画面由代码绘制，配乐由代码合成。')
A('')

# ── 1. progress ──
A('## 一、进度')
A('')
A('| 影片 | 标语 | 印文 · 号召语 | 分镜 | 镜头文件 | 已过作者自审 | 审片 / 打磨 / 复核 | 成片 |')
A('|---|---|---|---|---|---|---|---|')
detail = {}
for film, title, sbp, sdir, pdir, outp in FILMS:
    sb_ok = os.path.exists(os.path.join(ROOT, sbp))
    files = {os.path.basename(f)[:3] for f in glob.glob(os.path.join(ROOT, sdir, 's[0-9][0-9]-*.js'))}
    authored = sum(1 for s in ids if (film, s) in gate and 'scene' in gate[(film, s)]) if gate else None
    if film == 'arch': authored = 37   # film one was authored and delivered in the previous round
    crit = sum(1 for s in ids if 'critique' in gate.get((film, s), {}))
    pol = sum(1 for s in ids if 'polish' in gate.get((film, s), {}))
    ver = sum(1 for s in ids if 'verify' in gate.get((film, s), {}))
    video = probe(outp)
    detail[film] = (files, video)
    A(f"| {title}（`{film}`） | {TAG[film][0]} | 「{TAG[film][1]}」· {TAG[film][2]} | {'37 条已定稿' if sb_ok else '未完成'} | {len(files)}/37 | "
      f"{'—' if authored is None else f'{authored}/37'} | {crit} / {pol} / {ver} | {video or '尚未渲染'} |")
A('')
A('说明：')
A('- 「镜头文件」是磁盘上已存在的场景文件数（作者可能还在迭代）；「已过作者自审」是作者正式交稿的数量。')
A('- 「审片 / 打磨 / 复核」是已完成该关卡的镜头数。复核的裁决见下表；复核认为没有变好或损坏的，会自动还原为打磨前的版本。')
A('- 古建筑片已有一版成片（上一轮交付的未打磨版）；本轮打磨完成后会重新渲染替换。')
A('')
if gate:
    A('### 各镜头所处关卡')
    A('')
    A('图例：✍ 作者在画 · ① 作者已交稿 · ② 审片完成 · ③ 打磨完成 · ④ 复核通过（保留打磨）· ↩ 复核还原 · — 排队中（同组前面的镜头做完就开始）· 带「…」表示下一关正在进行')
    A('')
    A('| 影片 | ' + ' | '.join(s[1:] for s in ids) + ' |')
    A('|---|' + '---|' * 37)
    for film, title, *_ in FILMS:
        cells = []
        for s in ids:
            g = gate.get((film, s), {})
            r = running.get((film, s))
            if 'verify' in g:
                v = (g['verify'] or {}).get('verdict', '')
                c = '↩' if 'reverted' in v else '④'
            elif 'polish' in g: c = '③'
            elif 'critique' in g: c = '②'
            elif 'scene' in g or film == 'arch': c = '①'
            elif r == 'scene': c = '✍'
            else: c = '—'
            if r and r != 'scene' and c in '①②③': c += '…'
            cells.append(c)
        A(f'| {title} | ' + ' | '.join(cells) + ' |')
    A('')
    scores = [(f, s, (g.get('verify') or {}).get('finalScore')) for (f, s), g in gate.items() if g.get('verify')]
    if scores:
        A('已复核镜头的最终评分（复核员给留在磁盘上的版本打的 1–10 分）：' + '、'.join(f'{f}:{s}={v}' for f, s, v in sorted(scores) if v is not None))
        A('')

A('### 事实核实')
A('')
A('| 资料文件 | 题材数 | 事实条数 | ≥2 个独立来源 | 单一来源 | 互相矛盾 | 未核实 |')
A('|---|---|---|---|---|---|---|')
for f in sorted(glob.glob(os.path.join(ROOT, 'docs', 'research', '*.json'))):
    try: d = json.load(open(f, encoding='utf-8'))
    except Exception: continue
    c = {}
    for s in d.get('subjects', []):
        for x in s.get('captionFacts', []): c[x.get('status')] = c.get(x.get('status'), 0) + 1
    A(f"| `docs/research/{os.path.basename(f)}` | {len(d.get('subjects', []))} | {sum(c.values())} | {c.get('verified-2plus-independent', 0)} | {c.get('single-source', 0)} | {c.get('conflicting', 0)} | {c.get('unverified', 0)} |")
missing = [f'{film}-{k}' for film in ('coins', 'antiques', 'tcm') for k in ('a', 'b') if not os.path.exists(os.path.join(ROOT, 'docs', 'research', f'{film}-{k}.json'))]
if missing:
    A('')
    A('尚未交回的核实文件：' + '、'.join(missing) + '（研究员仍在检索；每人限 17 次检索，只依据搜索结果摘要，无法抓取原页面）。')
A('')
A('注意：核实只依据搜索结果摘要（这个环境的网络白名单拦截了大多数站点的页面抓取），标为「单一来源 / 互相矛盾 / 未核实」的内容不会写进画面文字。')
A('')

# ── 2. QC ──
A('''## 二、质检标准

### 单镜头验收标准（每个镜头都必须满足）

1. **弧线**：画面里最显著的边缘精确落在共用弧线上（误差 ≤ 6 px），横贯全宽，弧顶在画面正中。`tools/arccheck.py` 的客观指标：最强边缘在弧线 ±8 px 以内。
2. **一眼可读**：镜头只停留 0.2–1.2 秒，必须一眼认出是什么；主体大、轮廓肯定、对比强。
3. **质感与光**：满画面的材质肌理、明暗、高光、投影，不能是扁平的矢量图。
4. **色调**：大胆、明确、干净、有记忆点，符合任务单配色；与前后两个镜头在色相和明度上都有明显反差。
5. **文字**（带标语的 23 个镜头）：弧顶正上方 x 630–1290、高 260 px 的文字安全区平静均匀；白字或墨字对比充足、清晰好读。
6. **形制与事实**：符合任务单和核实资料；不编造文字、数字、年代、款识；器物上的字只用核实过的真实铭文。
7. **运动与边界**：首帧、中间帧、末帧都没有露边、穿帮、黑边；运动小而确定。
8. **技术**：预览无报错；初始化 ≤ 4 秒、单帧绘制 ≤ 120 毫秒（空闲时读数）；不使用随机数、系统时间、网络或外部图片，保证每次渲染结果一致。
9. **内容红线**：古玩片不出现象牙、犀角、玳瑁；中医片不出现任何功效、主治、用法用量，人物只取手部局部；古建筑片最后一个镜头的椽头不画「卍」。

### 六道质检关卡

| 关卡 | 谁来做 | 做什么 | 不过关怎么办 |
|---|---|---|---|
| 1 作者自审 | 镜头作者 | 渲染预览、亲眼看图、对照任务单修改，至少 3 轮（上限 6 轮） | 继续迭代 |
| 2 美术指导审片 | 独立的审片代理 | 对弧线、一眼可读、材质、光、色调、细节收尾、准确、文字 8 项各打 1–10 分；列出最多 6 条具体到位置和色值的修改 | 进入打磨 |
| 3 打磨 | 打磨代理 | 先备份原文件，再按清单修改；至少 2 轮渲染并与「打磨前」对比 | 试过反而更差的修改逐条撤回 |
| 4 独立复核 | 没参与前面工作的复核代理 | 默认怀疑；并排比较打磨前后，再跑一次弧线客观检查 | 变差或损坏就还原备份 |
| 5 导演审看 | 主会话 | 看全片总览图和弧线检查表，逐镜头列问题 | 点名返工 |
| 6 成片质检 | 主会话 + 质检代理 | 见下 | 修复后重渲 |

### 成片质检清单（每支片子出片前逐项核对）

- 500 帧渲染零报错。
- 首帧与末帧一致，循环播放无跳变。
- 剪辑点与配乐卡点对齐（剪辑表与配乐共用同一份帧数表）。
- 编码规格：1920×1080、25 fps、H.264（yuv420p、BT.709）、AAC 48 kHz 立体声；时长 20.00 秒。
- 响度约 −16 LUFS，峰值不过 −1 dBFS。
- 抽看压缩后的画面：标语清晰、细节没有糊成块。
- 标语、片名、印文无错别字；全系列字体统一为思源宋体。
- 事实核查表更新完毕，画面上出现的文字都能对上已核实的条目。

### 事实核查标准

- 每条会出现在画面或说明里的事实，至少两个相互独立的来源；来源冲突时写明冲突内容、采信哪个、为什么。
- 没能核实的标「未核实」，不写进画面文字。
- 会随时间变化的信息注明截止时间。
''')

# ── 3. plan ──
A('''## 三、下一步计划

1. **三支新片交稿后**：渲染全片总览，我逐镜头审看，列返工清单；缺失或报错的镜头单独补派。
2. **三支新片的调色与打磨**：每支先定全片的色彩走向（相邻镜头反差、最后 13 个镜头每一下颜色不同），再让每个镜头过审片 → 打磨 → 复核三关。
3. **古建筑片**：本轮三关打磨完成后，我审看总览 → 重渲 500 帧 → 按成片质检清单核对 → 替换上一版成片。
4. **三支新片出片**：配乐（各自的音色预设已备好）→ 渲染 → 成片质检 → 交付。
5. **收尾**：四支成片、来源与核查说明、更新 README 和拉取请求。

### 风险

- **用量上限**：上一轮曾触发账户的七日用量上限。如果再次触发，进行中的代理会中断；已经落盘的镜头文件不会丢，可以从中断处续跑。
- **事实核实的局限**：只依据搜索结果摘要，无法通读原页面；检索次数有限，部分细节会停留在「单一来源」或「未核实」。
- **配乐**：只按响度曲线和频谱核对过，没有人耳试听。
- **画面性质**：是示意性的插画，不是对具体文物的精确复原。

### 等你确认的事项

- 后三支的标语句式（一枚圆钱 / 一层包浆 / 一味草木，都接「藏着 / 千年」）。
- 中医片片名暂定「中国中医药」，印文「本草」；钱币片印文「通宝」；古玩片印文「雅玩」。
- 古建筑片最后一个镜头的椽头用金色圆珠而不是原物上的「卍」（文件里留了开关）。
''')

# ── 4. storyboards ──
A('## 四、分镜任务单')
A('')
A('每条任务单是镜头作者拿到的全部要求。「参考」是参考广告片同一位置画面的描述（只借构图、质感和明暗，不照抄内容）。')
A('古建筑片的 s01、s02 和片名卡是引擎搭建时直接完成的，没有任务单。')
A('')
for film, title, sbp, sdir, pdir, outp in FILMS:
    p = os.path.join(ROOT, sbp)
    A(f'### {title}（`{film}`）')
    A('')
    if not os.path.exists(p):
        A('分镜尚未生成。'); A(''); continue
    sb = json.load(open(p, encoding='utf-8'))
    files, _ = detail[film]
    for s in sb['shots']:
        state = '已有文件' if s['id'] in files else '未开画'
        A(f"#### {s['id']} {s['name']} · {s['frames']} 帧 · {BEAT.get(s.get('beat', 0), '')} · {'墨字' if s.get('tone') == 'dark' else '白字'} · {state}")
        A('')
        if s.get('refDesc'): A(f"- **参考**：{s['refDesc']}")
        A(f"- **画面**：{s.get('brief', '')}")
        if s.get('palette'): A(f"- **配色**：{s['palette'] if isinstance(s['palette'], str) else '；'.join(map(str, s['palette']))}")
        if s.get('motion'): A(f"- **运动**：{s['motion']}")
        if s.get('accuracy'): A(f"- **形制**：{s['accuracy']}")
        ftv = s.get('factsToVerify') or []
        if ftv: A('- **待核实**：' + '；'.join(map(str, ftv)))
        A('')

open(os.path.join(ROOT, 'progress.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('progress.md written:', len('\n'.join(L)), 'chars;', {f: len(detail[f][0]) for f in detail})
