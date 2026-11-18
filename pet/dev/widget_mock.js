// 开发用：没有 iPhone 也能大致检查小组件脚本——用假的 Scriptable 接口跑一遍，把画出来的图存成 PPM。
// 只能检查"脚本逻辑不报错、画面长什么样"，不能代替真机。
// 用法：node widget_mock.js <输出目录>
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || '.';
const src = fs.readFileSync(path.resolve(__dirname, '../iphone/qiuqiu-widget.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function hex(c) { c = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); }
async function run(family, hour, tag) {
  let image = null, widget = null, used = [];
  class Size { constructor(w, h) { this.width = w; this.height = h; } }
  class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } }
  class Color { constructor(h) { if (!/^#[0-9a-fA-F]{6}$/.test(h)) throw new Error('bad color ' + h); this.hex = h; } }
  class LinearGradient {}
  class DrawContext {
    setFillColor(c) { this.c = c; }
    fillRect(r) { if (!this.buf) { this.buf = new Uint8Array(this.size.width * this.size.height * 3).fill(255); this.bg = true; }
      const [R, G, B] = hex(this.c.hex);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const o = (y * this.size.width + x) * 3; this.buf[o] = R; this.buf[o + 1] = G; this.buf[o + 2] = B; } }
    getImage() { return { w: this.size.width, h: this.size.height, buf: this.buf }; }
  }
  const stack = () => ({ addSpacer() {}, addImage(img) { image = img; return {}; }, addStack: stack });
  class ListWidget { constructor() { widget = this; } setPadding() {} addSpacer() {} addStack() { return stack(); } async presentMedium() { used.push('presentMedium'); } async presentSmall() {} }
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...a); } getHours() { return hour; } static now() { return RealDate.now(); } }
  const config = { runsInWidget: family !== 'app', widgetFamily: family };
  const Script = { setWidget(w) { used.push('setWidget'); }, complete() { used.push('complete'); } };
  await new AsyncFunction('DrawContext', 'Size', 'Rect', 'Color', 'LinearGradient', 'ListWidget', 'config', 'Script', 'Date', src)(DrawContext, Size, Rect, Color, LinearGradient, ListWidget, config, Script, FakeDate);
  if (!image || !image.buf) throw new Error('no image drawn');
  // 背景色（模拟小组件的渐变底）
  const bgc = widget.backgroundGradient.colors[0].hex, [R, G, B] = hex(bgc);
  const out = Buffer.alloc(image.w * image.h * 3);
  for (let i = 0; i < image.w * image.h; i++) { const o = i * 3; const white = image.buf[o] === 255 && image.buf[o + 1] === 255 && image.buf[o + 2] === 255; out[o] = white ? R : image.buf[o]; out[o + 1] = white ? G : image.buf[o + 1]; out[o + 2] = white ? B : image.buf[o + 2]; }
  fs.writeFileSync(path.join(outDir, tag + '.ppm'), Buffer.concat([Buffer.from(`P6\n${image.w} ${image.h}\n255\n`), out]));
  console.log(tag, image.w + 'x' + image.h, used.join(','), 'url=' + (widget.url || ''));
}
(async () => {
  await run('medium', 14, 'w_medium_day'); await run('small', 14, 'w_small_day');
  await run('medium', 18, 'w_medium_dusk'); await run('medium', 2, 'w_medium_night'); await run('small', 2, 'w_small_night');
  await run('app', 10, 'w_app');
})().catch(e => { console.error('FAILED', e); process.exit(1); });
