// 开发用（小人 / 她 / 时间那几个戏包）：戏包里用到的姿势、画面、表情、小动作、表情符号、道具图，画的人现在还没有哪些
//   node pet/dev/scn_man_names.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '../web');
const ctx = vm.createContext({});
for (const f of ['config.js', 'fx.js', 'dogs.js', 'person.js']) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx);
const D = ctx.PET_DOGS, P = ctx.PET_PERSON, X = ctx.PET_FX.build(ctx.PET_CONFIG, 2);
const has = {
  frame: new Set(P.FRAMES), face: new Set(P.FACES), pact: new Set(P.ACTS),
  pose: new Set(D.POSES), dact: new Set(D.ACTS), mood: new Set(D.MOODS), fx: new Set(Object.keys(X)),
};
const miss = {};
const note = (k, n, f) => { (miss[k] = miss[k] || {})[n] = (miss[k][n] || new Set()).add(f); };
for (const f of ['man.js', 'her.js', 'time.js', 'micro_man.js']) {
  const src = fs.readFileSync(path.join(WEB, 'scenes', f), 'utf8');
  for (const m of src.matchAll(/'(p_[a-z0-9_]+)'/g)) if (!has.frame.has(m[1])) note('man frames', m[1], f);
  for (const m of src.matchAll(/S\.face\([^,]+,\s*'([a-z_]+)'/g)) if (!has.face.has(m[1])) note('man faces', m[1], f);
  for (const m of src.matchAll(/glance\(S,\s*'([a-z_]+)'/g)) if (!has.face.has(m[1])) note('man faces', m[1], f);
  for (const m of src.matchAll(/S\.act\((?:S\.)?(man|m)\b[^,]*,\s*(\[[^\]]*\]|'[a-z_]+')/g)) for (const n of m[2].match(/[a-z_]+/g)) if (!has.pact.has(n) && !/^p_/.test(n)) note('man acts', n, f);
  for (const m of src.matchAll(/act\(S,\s*'([a-z_]+)'/g)) if (!has.pact.has(m[1])) note('man acts', m[1], f);
  for (const m of src.matchAll(/S\.act\((?:S\.)?(dax|gold|d|g|o|who|dog|courier|carrier|other)\b[^,]*,\s*(\[[^\]]*\]|'[a-z_]+')/g)) for (const n of m[2].match(/[a-z_]+/g)) if (!has.dact.has(n)) note('dog acts', n, f);
  for (const m of src.matchAll(/S\.hold\((?:S\.)?(dax|gold|d|g|o|who|dog|courier|carrier|other)\b[^,]*,\s*(\[[^\]]*\]|'[a-z_]+')/g)) for (const n of m[2].match(/[a-z_]+/g)) if (!has.pose.has(n)) note('dog poses', n, f);
  for (const m of src.matchAll(/S\.mood\([^,]+,\s*'([a-z_]+)'/g)) if (!has.mood.has(m[1])) note('dog moods', m[1], f);
  for (const m of src.matchAll(/S\.emote(?:At|To)?\('([a-z_0-9]+)'/g)) { const b = 'fx_' + m[1]; if (!has.fx.has(b) && !has.fx.has(b + '0')) note('emotes', m[1], f); }
  for (const m of src.matchAll(/S\.(?:item\([^,]+,|decal\(|prop\.spawn\()\s*'([a-z_0-9]+)'/g)) if (!has.fx.has(m[1])) note('props / items', m[1], f);
}
for (const k of Object.keys(miss)) console.log(k + ': ' + Object.keys(miss[k]).map(n => n + ' (' + [...miss[k][n]].join(', ') + ')').join('; '));
if (!Object.keys(miss).length) console.log('everything used exists');
