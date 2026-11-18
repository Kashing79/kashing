#!/usr/bin/env python3
"""把 pet/web 里的像素画和玩法打包成 iPhone 用的网页 App，输出到仓库根目录的 docs/qiuqiu/。
用法：python3 pet/phone/build.py        （图标需要先有 docs/qiuqiu/icon-*.png，见 dev/icon.js）"""
import pathlib, json, hashlib
here = pathlib.Path(__file__).resolve().parent
web = here.parent / 'web'
out = here.parent.parent / 'docs' / 'qiuqiu'
out.mkdir(parents=True, exist_ok=True)
js = lambda n: (web / n).read_text(encoding='utf-8').replace('</script', '<\\/script')
page = (here / 'template.html').read_text(encoding='utf-8')
page = page.replace('__CONFIG__', js('config.js')).replace('__SPRITES__', js('sprites.js')).replace('__PET__', js('pet.js'))
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
