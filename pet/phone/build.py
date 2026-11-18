#!/usr/bin/env python3
"""把 pet/web 里的像素画和玩法打包成 iPhone 用的网页 App，输出到仓库根目录的 docs/qiuqiu/。
用法：python3 pet/phone/build.py        （图标需要先有 docs/qiuqiu/icon-*.png，见 dev/icon.js）
     想拿另一份 web/ 来打包：PET_WEB=那个目录 python3 pet/phone/build.py"""
import pathlib, json, hashlib, os, re, sys
here = pathlib.Path(__file__).resolve().parent
web = pathlib.Path(os.environ['PET_WEB']).resolve() if os.environ.get('PET_WEB') else here.parent / 'web'
out = here.parent.parent / 'docs' / 'qiuqiu'
out.mkdir(parents=True, exist_ok=True)
js = lambda n: (web / n).read_text(encoding='utf-8').replace('</script', '<\\/script') if (web / n).exists() else ''
page = (here / 'template.html').read_text(encoding='utf-8')
# 模板里每个 __名字__ 换成 web/ 里对应的那个文件（顺序见模板最后；画图的几个文件在前，玩法在后）
for mark, name in [('__CONFIG__', 'config.js'), ('__SPRITES__', 'sprites.js'), ('__FX__', 'fx.js'), ('__DOGS__', 'dogs.js'),
                   ('__PERSON__', 'person.js'), ('__LAWN__', 'lawn.js'), ('__PET__', 'pet.js'), ('__WEB__', 'web.js')]:
    assert mark in page, mark
    page = page.replace(mark, js(name))
# 保险：这几个文件要是有人正改到一半（里面还没把自己挂出来），打出来的页面会缺东西，不如不打
for name, glob in [('config.js', 'PET_CONFIG'), ('sprites.js', 'PET_SPRITES'), ('dogs.js', 'PET_DOGS'), ('pet.js', 'PET_ENGINE')]:
    if not re.search(glob + r'\s*=', js(name)):
        sys.exit('%s does not define %s (is someone still editing it?) - not building' % (name, glob))
(out / 'index.html').write_text(page, encoding='utf-8')
(out / 'manifest.webmanifest').write_text(json.dumps({
    "name": "球球", "short_name": "球球", "start_url": "./", "scope": "./", "display": "standalone",
    "orientation": "any", "background_color": "#bfe3f7", "theme_color": "#bfe3f7",
    "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}],
}, ensure_ascii=False, indent=2), encoding='utf-8')
ver = hashlib.sha1(page.encode('utf-8')).hexdigest()[:10]
(out / 'sw.js').write_text('''// 离线缓存：第一次打开时把页面存下来，之后没有网络也能玩。有网络时会顺便更新。
var CACHE = 'qiuqiu-%s';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r && r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return r;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
''' % ver, encoding='utf-8')
(out.parent / '.nojekyll').write_text('', encoding='utf-8')
print('wrote', out, 'version', ver)
