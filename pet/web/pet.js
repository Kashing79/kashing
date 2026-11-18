// 球球 · 玩法引擎（第三版）
//
// 一个穿西装的小人、一只小腊肠、一只大金毛，和一颗小球。
//   · 可以满屏幕到处跑（roam），也可以只待在屏幕最下面一条
//   · 小人丢球，狗狗去追；她也可以拖球、点小人、摸狗、把它们拎起来
//   · 没事的时候它们自己会找事做：一段一段的"戏"写在 scenes/ 下面的戏包里（见下面"怎么写一场戏"）
//   · 晚上或者她说"回家"时，它们会跑回屏幕顶上的"灵动岛"里睡觉
//
// 这个文件只管"玩法"：不碰网页、不碰画布、不用定时器，只用得到语言自带的东西。
// 所以同一份代码可以跑在浏览器 / 手机网页里（外壳是 web.js），也可以跑在 Mac 外壳的 JavaScriptCore 里。
// 画图的活在别的文件里：dogs.js（狗）、person.js（小人）、fx.js（小球、表情、影子、道具……）；
// 后两个不在时，就用 sprites.js 里旧的手画图。
//
// 单位：一个"世界单位"= 旧版的一个像素（金毛大约 45 长）。x 向右，y 向下，z 是离地的高度。
//       图可以画得更细：R = 一个世界单位里有几个像素（默认 2）。
//
// ---------------- 外壳怎么用它 ----------------
//   读文件的顺序（SPEC 8.7，每个文件有才读）：config.js sprites.js fx.js dogs.js person.js lawn.js needs.js pet.js，
//   然后 scenes/ 下面所有 .js（按文件名排；每个往全局数组 PET_SCENES 里放戏），最后才 PET_ENGINE.create。
//   哪个文件读的时候出错：跳过它，接着读别的。
//
//   var eng = PET_ENGINE.create(host, cfg);
//
//   host（除了 now 都可以不给）：
//     now()                    现在几秒了（只要一直往前走就行）
//     date()                   墙上的钟：从 1970 年起的毫秒（不给就用电脑的钟；测试时拿它拨钟）
//     storage.get(k) / set(k, v)   存几小份东西（都是 JSON 字符串）：qiuqiu-stats 今天丢了几次球、
//                              qiuqiu-world 戏的记性（每段戏今天演了几次、草地上的小印子）、qiuqiu-care 喂饭拉粑粑
//     haptic(kind)             'light' | 'soft'：手机上震一下
//     island                   屏幕顶上有没有岛：{ center() 岛的中心在哪（世界单位的 x）, visible() 现在显示着吗,
//                              hit(x, y) 把谁拎到这里放下算不算"放到岛上"，
//                              rim() 可以不给：岛下沿 { x0, x1, y }，pulse(kind) 可以不给：岛弹一下
//                              （rummage | drop | gulp | shake | bulge）}；没有岛就给 null
//     log(msg)                 画图的文件或者戏包出了错时会说一声（引擎自己顶上 / 跳过那一段，不会停）
//   cfg：config.js 里的设定，外壳可以再加几样：
//     res（R，默认 2）、rigFps（原地做动作时每秒重画几次，默认 12）、auto（自动丢球，默认开）、
//     roam、grass（有草地：影子深一点，打滚会带起草屑）、lang（小人说话用 'hant' 繁体 | 'hans' 简体 | 'en'，默认 hans）、
//     entrance（刚打开时从岛里跳出来，默认开）、lawnTap（点空地 = 往那儿丢球；只有网页版开）
//
//   eng.configure({ view: { w, h }, insets: { top, bottom, left, right }, res, roam, auto, grass, soft, feeding, potty })
//       画面多大、四边各让出多少（都是世界单位）。第一次给 view 时角色才摆到场地上。
//       feeding / potty：她菜单里的两个开关（自动喂饭、拉粑粑）；不给就用 config.js 里 care.feeding / care.potty
//   eng.sense(o)        外面的事（SPEC 8.4 / 8.8；每样都可以不给，不给就当没变；一秒最多十来次）：
//       cursor [x, y] | null（她的鼠标在哪；null = 不知道 / 在别的屏幕）、idle 她几秒没碰键盘鼠标了、
//       woke: true（屏幕刚亮 / 电脑刚醒，说一次）、asleep: true | false、battery { level 0..1, charging } | null、
//       frontApp、dock { x, y, w, h } | null（程序坞在哪）、statusItem x | null（菜单栏上我们那个图标的 x）、menu: true（她打开了菜单）
//       从来没说过的：当她在、鼠标不知道在哪
//   eng.step(dt)        往前走 dt 秒（每画一帧调一次就行；隔得久它自己会拆成几小步走；墙上的钟跳了 90 秒以上 = 刚醒）
//   eng.compose()       这一帧该画什么 → { items, hot, drag, bubble, decals }
//       items   从后到前排好的清单，每一项 { id, img, x, y, flip, a, clip? }：
//               img = { w, h, data(RGBA), scale, ox, oy, key, ver }；(x, y) 是图的左上角（世界单位，不取整）；
//               flip = 左右镜像（绕图自己的中线）；a = 不透明度；clip = [x, y, w, h]（有的话只画图在这个框里的部分）。
//               id 每个东西固定不变：gold / person / dax / ball / held（他右手里的小东西）/ held2（左手）/ held:dax（嘴里）/
//               prop:编号（道具）/ shadow:gold… / shadow:prop:编号 / puff:编号 / px:编号 / item:编号 / bfly / emote:编号
//               三个角色各自一直用同一张 img：像素变了它的 ver 才加一（key 是 null）；其余的图 key 不变就不会变
//       hot     可以点的范围 [x, y, w, h]（已经留好边）：先是球（抓得到的时候），然后金毛、小人、小腊肠（藏起来的不算），
//               再后面是鼠标在上面停够了的道具（所以长度会变，别当成固定 4 个）
//       drag    她正拖着球 / 拎着谁
//       bubble  小人在说话：{ text, x, y, id }，(x, y) 是他头顶；换了一句 id 会变；没在说就是 null
//       decals  草地上的小印子 [{ id, img, x, y, overlay, flip }]：画在草地那一层（她的窗口后面）；草地关着的时候只画 overlay: true 的
//       顺便会更新"可以点的范围"和嘴、手的位置，所以每画一帧调一次就好
//   eng.pointer(type, x, y)   'down' | 'move' | 'up' | 'hover' | 'leave'（世界单位）；返回 true = 点在球、谁、或者能点的道具上了
//   eng.command(name)   'throw' | 'wave' | 'home' | 'out' | 'toggleHome' | 'love' | 'gather' | 'feed'（她说开饭）| 'tuck'（她点了岛里睡觉的那一格）
//   eng.status()        { home: 'out' | 'going' | 'in' | 'leaving', fetch, pets, night, auto, roam, scene（正在演的 scene 的名字）,
//                         phase: 'day' | 'dusk' | 'night'（草地该用哪套颜色）, drag,
//                         care（有喂饭那一套时才有）: { meal: 'idle' | 'due' | 'serving', kind, meals, poops, fedByHer, byHer, lucky, feeding, potty } }
//   eng.busy()          0 没什么在动 / 1 鼠标在附近、有蝴蝶 / 2 正在动（外壳据此决定画得多勤）
//   eng.den(R)          它们在岛里睡觉时，岛上那一小格里画什么 → { w, h, items }（坐标相对那一格的左上角；
//                       id 是 den:gold / den:person / den:dax / den:z）
//   eng.setQuality(q)   0..1：机器吃力时调低，角色就少重画几次
//   eng._t              给测试脚本用的（state boxes set scene endScene raise list events props sceneErrors care errors perf）
//
// ================================================================
//  怎么写一场戏（写 scenes/*.js 的人只看这一节就够了）
// ================================================================
// 一、戏包
//   一个文件就是一个戏包，放在 scenes/ 下面，只做一件事：往全局数组 PET_SCENES 里放记录。照 scenes/examples.js 的样子写：
//     (function (G) {
//       var L = G.PET_SCENES = G.PET_SCENES || [];
//       L.push({ name: 'nose_boop', kind: 'react', on: 'click', cast: 'who', tag: 'hers',
//                when: function (S, ev) { return ev.zone === 'nose'; },
//                run: function* (S, ev) { S.hold(S.who, 'sit'); S.emote('spark', S.who); yield 1; } });
//     })(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
//   只能用语言自带的东西（ES2017，generator 可以）：没有 window / document / console / 定时器；不改别的全局；不碰引擎里面。
//   一条记录写错了（没名字、重名、cast 不认得……）：这一条跳过、告诉外壳一声，别的照常。
//
// 二、一条记录有哪些字段（只有 name、cast、run 必须写）
//   name      全局唯一的名字（英文、下划线）                    zh       中文名（给人看的）
//   kind      'scene'（默认，几个角色一起演，导演闲着时挑）| 'solo'（一个角色自己的小动作，1-6 秒）|
//             'react'（出了什么事才演，要写 on）| 'care'（喂饭、拉粑粑那一套，由照料导演开演）
//   cast      谁来演：'man' 'dax' 'gold' 随便组合（'dax gold' 或 ['man', 'dax']）；
//             'dog' = 哪只狗都行（事件里带了狗就是那只）、'other' = 另一只狗、'who' = 事件落在谁身上就是谁
//             solo 只写一个：'man' | 'dax' | 'gold' | 'dog'（两只都可以）
//   weight    多常挑到它：数字（老的十一段是 2-3），或者 function (S) { return 数字; }；默认 2；0 = 这会儿不演
//   when      function (S, ev) { return true / false; }：这会儿能不能演（S 是"探路用"的，只能读，不能下指令）
//   on        react 回应哪个事件（名字见"六、事件"；可以是几个：['click', 'dblclick']）
//   at        'HH:MM' 或几个：只在这一分钟演（自动等于 on: 'minute'）；比如 at: '15:30'
//   chance    0..1：事件来了以后演的几率（默认 1）
//   keep      秒：事件来了演员一时没空，最多再等这么久（默认 0 = 不等）
//   cool      秒：演完以后至少隔多久才能再演          cap   一天最多演几次（本地时间过了半夜重新算）
//   timeout   秒：最长演多久，到了就当被打断（默认 scene 70、solo 20、react 30、care 110）
//   tag       'calm'（不跑远，她在忙也可以演）| 'lively'（跑来跑去：她不在时不演，傍晚以后少演）|
//             'seek'（会跑到她鼠标那儿去：只有她在玩、鼠标在附近又没在打字时才演）| 'hers'（她亲手引起的：总是可以演，
//             还能打断正在演的普通戏）| 'cursor'（要看她鼠标的小动作）| 'fetch'（丢球中途也能演）
//   mood      'funny' | 'playful' | 'mischievous' | 'tender' | 'proud' | 'sleepy'：一天里不同时候多演 / 少演（早上热闹、下午犯困……）
//   family    一家子（'tug' 'carry' 'sleep' 'nose' 'biscuit' 'island' 'cursor'……）：同一家子的三段里不连着来
//   cat       抽签袋的类别（默认：有小人的 'B'，只有狗的 'A'）：同一类里每段都轮过一遍才会重复
//   hours     [[9, 12], [14, 18]]：只在这几个钟点里演          fromDay  第几天起才演（第一次打开那天是 0；设定 discovery: false 就不管）
//   overlay   react 专用：true = 不占演员，只在他们身上叠表情 / 心情 / 眼神（S.face / S.mood / S.look / S.rig），谁都不挪
//   aware     solo 专用：演的时候鼠标凑过来还会看鼠标、摇尾巴（默认 true）
//   anytime   react 专用：丢球玩到一半也能演（默认只在休息时演）
//   care      care 专用：这段戏管哪件事（'meal' 'water' 'potty' 'cleanup' 'feednow' 'thanks' ……，见"照料"）
//   run       function* (S, ev) { ... }：剧本本身（必须是 generator）
//   end       function (S, cancelled, why) { ... }：演完 / 被打断以后调一次，收尾用（why：'input' 'ball' 'carried' 'home' 'timeout' 'error' ……）
//
// 三、导演怎么排
//   · 她的事永远先办：拖球、丢球、点人、拎人一来，正在演的戏马上让路（S.commit 说过"别打断"的那一小段演完再让，拎人不等）。
//   · 休息时（没在丢球）每隔 6-15 秒挑一段 scene；狗和小人闲下来就挑一个自己的 solo；出了事就看有没有 react 接。
//   · 挑的时候看：weight × 一天里的时候（mood / tag）× 她在不在（idle）；冷却（cool）、每天几次（cap）、抽签袋、一家子不连着来。
//   · 设定（config.js）里可以调：liveliness（0.5 安静 … 1.5 热闹，默认 1）、quietHours（[[9, 12]]：这几个钟点只演 calm 的）、
//     cursorPlay（false = 不演 seek / cursor 的戏）、discovery（false = fromDay 不管用）、lines（小人的台词，见 S.say）、dates（特别的日子）。
//   · 一段戏演完 / 被打断以后，引擎负责收拾：角色放回去（站好、不再骑在谁背上）、它放的道具收走、球回到小人手里。
//
// 四、run 怎么写：generator 里每一个 yield 都是"等一下"
//   yield 1.5;                       等 1.5 秒
//   yield S.go(S.dax, x, y, 'run');  等她跑到（S 上的走位函数都返回"等它做完"）
//   yield [a, b];  yield S.all(a, b);   都好了再往下        yield S.any(a, b);  有一样好了就往下
//   yield function () { return S.dax.z === 0; };          等这个条件成立        yield;  只等下一步（1/60 秒）
//   yield* S.run('treat');           把别的一段戏接进来演          yield* S.enterIsland(S.dax);   一个角色自己钻进岛里
//
// 五、S 上有什么（S = 这段戏拿到的舞台；ev = 引起它的那件事，没有就是 null）
//   —— 谁 ——
//   S.man / S.dax / S.gold        三个角色（S.dogs = [金毛, 小腊肠]）     S.me = 第一个演员（solo 就是它自己）
//   S.dog / S.other               cast 里那只狗 / 另一只          S.who = 事件落在谁身上          S.cast  演员列表
//   S.name / S.kind / S.ev        这段戏的名字 / 种类 / 事件
//   角色身上能读的：x y z（脚下的位置、离地多高）face（1 朝右 -1 朝左）half（半个身子多宽）mx（嘴离身体中心多远）
//     top（头顶的屏幕 y）kind（'man' | 'dax' | 'gold'）pose（狗现在的姿势）energy（金毛还有多少力气 0..1）hidden carried
//   自己演员身上能写的：wag（摇尾巴 0..1）pant（喘气）happy（1 = 开心的脸）bark（秒：叫几声）look（-1..1 低头 / 抬头）
//     lift（往上抬多少，比如坐在别人腿上）face（朝向）
//   —— 等、随机 ——
//   S.wait(2)  S.all(..)  S.any(..)  S.until(fn, 最多几秒)  S.each(秒, function (t, dt) {...})：这几秒里每一步都调一下
//   S.t()  这段戏演了几秒        S.now()  引擎时间（秒）
//   S.rand(a, b)  S.randInt(a, b)  S.pick([..])  S.chance(0.3)：每段戏有自己的随机数（不要用 Math.random）
//   —— 走位（只能指挥自己的演员；返回值可以 yield）——
//   S.go(who, x, y, 速度, 姿势, 最多几秒)  或  S.go(who, { x, y }, 速度, 姿势)
//       速度：数字（世界单位/秒）或名字——狗 'walk' 'trot' 'run' 'back' 'sniff'；小人 'stroll' 'brisk' 'hurry'（也认 walk trot run）
//       姿势：走的时候摆什么（狗：'sniff' 低头闻着走；小人：画面名字）；最多几秒默认 8；停的地方会自己躲开她的鼠标和地上的东西
//   S.follow(who, 跟着谁, 落后多远, dy, 速度)        S.track(who, function () { return { x, y }; }, 速度, 姿势)：追着会动的东西
//   S.stop(who)  停下                S.stage(dog)  它正挤在小人身边的话先小跑到旁边空地（狗狗之间的戏开头用）
//   S.orbit(who, 中心 {x, y}, rx, ry, 几圈, 速度)    绕圈跑               S.slide(who, dx, dy, 秒)  不迈步地挪（被拖着、蹭过去）
//   S.hop(who, 力气)   跳（60 ≈ 3 高、110 ≈ 10、150 ≈ 18、190 ≈ 29）     S.faceTo(who, 角色 | 道具 | x | 'cursor' | 'left' | 'right')
//   S.turn(who)  转身         S.spd(who, 'run')  这个速度名字是多少
//   S.attach(who, 安到谁身上, 锚点, dx, dz, 画在后面?, 朝向)  骑到背上（'seat'）、抱在怀里（'arms'）、叼在嘴边（'mouth'）……
//       之后那个角色走到哪它跟到哪；S.detach(who, 跳下来的力气)  放下来（0 = 直接落地）
//   yield* S.enterIsland(who) / yield* S.leaveIsland(who)    一个角色自己进出岛（别人不受影响；戏完了会自己出来）
//   —— 姿势、画面、表情、眼神（名字不认得也不会出错：狗画成站着，小人画成 p_idle）——
//   S.hold(dog, 'sit')          狗的姿势（PET_DOGS.POSES；画的人在加新的：'eat' 'squat' 'circle'……）
//   S.hold(S.man, 'p_watch')    小人的画面（PET_PERSON.FRAMES）；{ f: ['p_cheer', 'p_cheer2'], fps: 5 } = 几张轮着；null = 回到普通站姿
//   S.hold(who, ['squat', 'sit'])   给几个名字：用第一个画的人已经画了的（都没有就用最后一个）
//   S.has(who, 名字)  画的人有没有这个姿势 / 画面 / 动作 / 表情 / 心情          S.hasFx('bowl_full')  有没有这张道具图
//   S.face(S.man, 'smile')      小人的表情（PET_PERSON.FACES：smile grin laugh soft surprised wink blush sleepy yawn focus proud oops pout kiss wistful…）
//   S.mood(dog, 'happy')        狗的心情（PET_DOGS.MOODS：happy sleepy guilty curious proud worried focused）
//   S.look(who, 目标)           看哪儿：角色 / 道具 / 'ball' / 'cursor' / 'camera'（看她）/ { x, y, z } / null = 引擎自己挑
//   S.act(who, 'yawn', 最多几秒)   骨架自己演的一小段动作（PET_DOGS.ACTS / PET_PERSON.ACTS：伸懒腰、甩毛、打哈欠……）：
//       返回"演完了"；画的人还没做这个动作就马上算完（所以随便写，不会卡住）
//   S.rig(who, { tilt: 1, eyes: 'closed' })   直接递别的输入给骨架（画的人新加的那些）；S.rig(who, null) 收回
//   S.clip(who, [x, y, w, h])   只画这个框里的部分（躲在程序坞后面、从岛沿上探出头）；null = 整个画
//   不用收：戏一完，姿势、表情、心情、眼神、安在谁身上、裁切都会自己还原
//   —— 身上的位置、地方 ——
//   S.anchor(who, 'mouth')  → { x, y, z }：狗 mouth nose back seat head chin tailTip forepaw；小人 hand hand2 grip arms lap chest tie head mouth
//   S.hand('hand2')  小人的手现在在哪 → { x, y, z }       S.handPos()  他把东西丢出去那一下手在哪
//   S.beside(a, b, 空隙, dy)  a 站到 b 旁边（鼻尖之间留空隙）    S.inFront(b, 多远, dy) / S.behind(b, 多远, dy)
//   S.atHand(dog, dy)  狗站到小人手边    S.manAt(dog, 多远, dy)  小人站到狗旁边够得着它    S.ry(v)  满屏模式才有的前后偏移
//   S.pr(n)  按小人手长放大的距离    S.randPt(至少离多远, 离谁)  场地里随便一点    S.clear(x, y, r)  这附近地上没东西
//   S.field  脚能踩的范围 { x0, x1, y0, y1 }      S.view  画面 { w, h }      S.roam  是不是满屏跑      S.SK  小屏幕上的速度比例
//   S.island() → { x, y, on, rim } | null  岛     S.pulse('gulp')  岛弹一下     S.edge('left' | 'right' | 'top' | 'bottom')
//   S.corner('bl' | 'br' | 'tl' | 'tr', 留边)  → { x, y }     S.dock() → { x, y, w, h } | null 程序坞     S.statusItem()  菜单栏图标的 x
//   S.dist(a, b)  S.near(a, b, r)  S.side(a, b)（a 在 b 左边 -1 / 右边 1）  S.point(谁 | 道具 | 'cursor' | 'ball')  → { x, y, z }
//   —— 她 ——
//   S.cursor  她的鼠标 { known, x, y, speed（世界单位/秒）, still（停了几秒）, d（离最近的角色多远）, near（最近的是谁）}
//   S.her     她 { idle（几秒没动静）, active（< 1 分钟）, present（< 5 分钟）, away, engaged（在跟它们玩）, busy（在忙别的）,
//             typing（在打字）, battery, frontApp, dock }
//   S.below(n)  鼠标正下方 n 的地上 → { x, y } | null      S.toCursor(who)  走到她鼠标跟前该站的地方（停在下面一点、旁边，不挡着鼠标）
//   S.cursorNear(who, r)    S.dwell({ x, y, z }, r)  鼠标在那儿停了几秒    S.rubbing(who)  她正在蹭它吗（蹭得多快，0 = 没蹭）
//   S.quietFor()  多久没人理它们、也没玩球了（秒）     S.asleep(dog)  它在睡吗
//   —— 时间、日子 ——
//   S.time  { h, m, hm: 'HH:MM', wd（星期几，0 = 星期天）, day, md: 'MM-DD', ymd, phase: 'day' | 'dusk' | 'night', night }（本地时间）
//   S.night()  是不是该睡觉的钟点      S.daysTo('2027-02-14')  还有几天      S.reunion()  离见面还有几天（没设就是 null）
//   S.dates()  今天是设定 dates 里的哪几个日子      S.day()  第几天（第一次打开那天是 0）
//   —— 手里、嘴里的东西 ——
//   S.item(who, '图的名字')   小人右手 / 狗嘴里叼一样东西（fx.js 的图；没有这张图就不画）；S.item(who, 名字, 'hand2') 小人左手；
//       S.item(who, null) 放下。老写法 S.item('bone') = 小人右手。戏完了会自己放下
//   —— 道具（地上的东西：饭碗、树枝、小花……图是 fx.js 的 "种类_状态"，没有就用 "种类"，再没有就不画）——
//   var p = S.prop.spawn('bowl', 'full', x, y, { z, face, cap: 秒, hot, obstacle: 半径, shadow, keep, sprite, click: '戏名', amount, care, data })
//       hot: true 或 { w, h, dwell }：她可以点（鼠标在上面停 dwell 秒——默认 0.25——以后才算，点了出 click 事件，或者直接演 click 写的那段戏）
//       obstacle：大家绕开它、跳过它，球也弹开；keep: true = 这段戏演完它还留着（到 cap 秒自己没）；默认戏完就收走
//   S.prop.set(p, 'empty')  换状态（换图）       S.prop.move(p, x, y, z)       S.prop.carry(p, who, 'mouth' | 'hand' | 'hand2' | 'arms'……)
//   S.prop.drop(p[, x, y])  放到地上       S.prop.fling(p, vx, vy, vz)  扔出去 / 掉下来       S.prop.remove(p[, 冒烟?])
//   S.prop.where(p) → { x, y, z }     S.prop.find('stick')  S.prop.all('poop')     S.prop.hot(p, true | false)     S.prop.keep(p)
//   S.prop.alive(p)    道具身上能读能写：x y z face a（透明度）data（随便放东西）amount（0..1，比如碗里还有多少）
//   S.decal('bloom_y', x, y, { days: 1, overlay: false })  草地上的小印子（画在她的窗口后面；days > 0 会存下来）→ 编号；S.decalRemove(编号)
//   —— 球 ——
//   S.ball.where() → { st, x, y, z, holder }     S.ball.inHand()     S.ball.pocket()  收进口袋（他两只手都要用的时候）
//   S.ball.home()  回到他手里     S.ball.give(dog)  叼在狗嘴里     S.ball.take()  从狗嘴里拿回他手里
//   S.ball.lay(x, y)  放在地上（她可以去抓）     S.ball.toss(去哪：角色 | { x, y }, 秒, 抛多高)  扔过去（返回"到了"）
//   球只能在休息时（没在玩丢球）由戏来动；戏一完球一定回到他手里（她正拖着、正在玩的时候除外）
//   S.fetch(n, { x, y })   这段戏好好演完以后，小人接着丢 n 个球
//   —— 表情符号、碎屑、说话 ——
//   S.emote('heart' | 'hs' | 'bang' | 'note' | 'z' | 'zs' | 'q' | 'spark' | 'sweat' | 'woof' | fx.js 里别的 fx_ 名字, 谁 | 道具, dx, 秒)
//   S.emoteAt(类型, x, y, 秒)      S.emoteTo(类型, 从哪, 到哪, 秒)  一颗表情飞过去再"啵"一下
//   S.toss('bone', 从哪, 到哪, 秒, 抛多高)  丢一样小东西（从 / 到：角色、道具、{ x, y, z }、'cursor'）
//   S.puff(x, y, 大?)  一团灰    S.bits(x, y, 几颗, 'dirt' | 'water' | 'kibble' | 'spark' | 'white' | 'heart' | 'fur' | ['#rrggbb'], 散多开, 飞多高)
//   S.grass()  这会儿草的颜色    S.haptic('light')
//   S.say('key', ['繁體', '简体', 'English'])   小人说一句：先找设定 lines.key（一句或几句挑一句）；没有的话设定写了 lines: true
//       才说戏里自带的这一句；返回 false = 没说（就用一个表情符号代替）。S.sayText(字)  直接说      S.T(繁, 简, 英)  按语言挑一个
//   —— 记性 ——
//   S.mem.get(k) / S.mem.set(k, v)   存下来的小东西（关了再开还在；放能变成 JSON 的东西）
//   S.count(名字)  今天演了几次    S.last(名字)  上一次演完到现在几秒    S.playing(名字)  是不是正在演
//   —— 和导演打交道 ——
//   S.commit(秒)  接下来这几秒别打断我（≤ 1.5 秒最好；她拎人、回岛不等）     S.interrupted()  有人在等我让路（赶紧收尾）
//   S.join(who)  中途拉一个有空的角色进来     S.leave(who)  放一个走     S.free(who)  他现在有没有空
//   S.raise('名字', { ... })  自己发一个事件（别的 react 可以接）     S.shoo()  蝴蝶被扑了一下，飞开     S.log(话)  告诉外壳一句
//   S.bfly  蝴蝶 { on, x, y }     S.cfg  config.js 的设定（只读）     S.COLORS  碎屑的颜色
//
// 六、事件（react 的 on 写这些名字；ev 里有这些东西；ev.name 是名字，ev.t 是时间）
//   她用鼠标：
//   click      点了一下谁 { who, x, y, zone }：狗 zone = 'nose'（鼻尖 4 以内）| 'paw'（伸出来的爪子）| 'head' | 'mid' | 'rump' | 'tail'；
//              小人 'head' | 'tie' | 'mid' | 'legs'。点的是道具：{ prop, kind, x, y }（who 是 null）。有 react 接了，原来的反应（爱心 / 丢球）就不做了
//   dblclick   很快连点两下（同上）          press      按住谁不动（狗 0.5 秒、小人 0.8 秒）{ who, x, y, zone }，之后松开不算点
//   rub        鼠标在谁身上来回蹭（1.2 秒里掉头 3 次）{ who, power, zone, x, y }（之后用 S.rubbing(who) 看她还在不在蹭）
//   hover      鼠标停在谁身上 0.4 秒 { who, x, y, zone }     notice     鼠标在谁旁边（60 以内）停下来不动 0.6 秒 { who, dist, x, y }
//   flyby      鼠标嗖地从谁头顶划过（每秒 500 以上）{ who, vx, vy, speed }     drift  鼠标慢慢挪（每秒 10-60，一秒以上）{ x, y, speed }
//   shake      在哪儿又快又大地甩鼠标 { x, y }     sweep  很快地扫过一样能点的道具 { prop, kind, speed }
//   pickup     她把谁拎起来了 { who }     drop  放下 { who, x, y }     dropOn  放到了谁身上 { who, target, anchor: 'seat' | 'arms' }
//   dropIsland 放到了岛上（大家回岛）{ who }     grabBall  她抓住了球 { x, y }     throw  她把球丢出去了 { by: 'her', vx, vy }
//   她在不在：
//   return     她回来了（走开 5 分钟以上）{ away（秒）, tier: 1（5-20 分钟）| 2（20 分钟-3 小时）| 3（更久，或者今天头一回）, woke, first }
//   wake       屏幕刚亮 / 电脑刚醒 { gap（秒）}     menu  她打开了菜单     tuck  她点了岛里睡觉的那一格     battery { kind: 'plug' | 'unplug' | 'low' | 'full', level }
//   钟和日子：
//   minute { h, m, hm }   hour { h, hm }   dayphase { phase }   newday { day }
//   date       今天是个日子（她在、它们在外面的时候说一次）{ kind: 'reunion'（days = 还有几天）| 设定 dates 里写的 kind, days, entry, line }
//   地方和球：
//   out        从岛里出来了 { first: 今天头一回 }     home  要回岛了     edge  谁走到了屏幕边上 { who, side: 'left' | 'right' }
//   island     谁走到了岛下面 { who }     dock  谁走到了程序坞上面 { who }
//   catch      狗跳起来在空中接住了球 { who, z }     ballRest  丢出去的球停下来了 { x, y, far }     ballStuck  球停在地上好一阵没狗去捡 { x, y }
//   自己发的：S.raise('名字', ev) 发的任何名字
//   （照料那一套——喂饭、喝水、拉粑粑——的戏都在 scenes/care.js，由照料导演开演，别的戏包不用管。）
//
// 七、规矩
//   · 每一段都要 yield（等），不要写 while (true)：用 S.t() < 秒 或者数着次数，到了时间（timeout）引擎会直接停掉你。
//   · 不要以为某个姿势 / 画面 / 道具图一定有：画的人还在加，没有的名字画成站着 / p_idle / 不画，不会出错；要紧的地方用 ['新名字', '老名字']。
//   · 只指挥自己 cast 里的角色（S.join 拉进来的也算）；别人的只能读。
//   · 要等她的地方给个上限（S.until(fn, 秒)）；靠近她的鼠标用 S.toCursor，别停在鼠标底下。
//   · 收尾写在 end 里（被打断也会调）；角色、道具、球、手里的东西引擎会自己收拾，end 里只管你自己记的东西。
//   · 别用 Math.random（用 S.rand，每段戏有自己的种子）；别存角色对象到别处（S.mem 只放数字、字符串这类）。
//   · 台词只用 S.say(key, [繁, 简, 英])：她没写台词、也没开 lines: true 的时候小人不说话，戏要照样演得通。
//
// 八、怎么试
//   node pet/dev/scenes.js list                    列出登记了的每一段（种类、谁演、什么时候、weight）
//   node pet/dev/scenes.js <输出目录> 名字,名字      把这几段各演一遍拍成连环画（每一拍一张）
//   node pet/dev/sim.js 目录 30 ；node pet/dev/headless.js   快进乱玩半小时，查报错、卡住、角色飞出场地、道具没收走
(function (G) {
  'use strict';

  // ------------------------------------------------------------
  //  设定
  // ------------------------------------------------------------
  var DEF = { messages: [], messageMinutes: [25, 60], autoPlaySeconds: [35, 90], nightSleep: [0, 7], dachshund: 'red',
              roam: true, grass: false, res: 2, rigFps: 12 };
  var GRAV = 420;
  var BALL_R = 4;
  var KIND = {
    dax:  { half: 17, accel: 760, run: 150, back: 105, trot: 64, walk: 26, reach: 12, grab: 7 },
    gold: { half: 21, accel: 340, run: 170, back: 90,  trot: 62, walk: 24, reach: 22, grab: 8 },
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sgn(v) { return v < 0 ? -1 : 1; }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }
  function range(r, fallback) { return (r && r.length === 2) ? rand(r[0], r[1]) : fallback; }
  function resOf(v) { v = Math.round(+v); return v >= 1 ? (v > 4 ? 4 : v) : 2; }
  function rgbOf(c) {
    c = String(c).replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.substr(0, 2), 16) || 0, parseInt(c.substr(2, 2), 16) || 0, parseInt(c.substr(4, 2), 16) || 0];
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // 小人的每个旧画面名字属于哪一类姿势（同一类里的几张只是呼吸 / 眨眼 / 走路的不同帧）
  var PCLASS = { p_front: 1, p_front2: 1, p_front_blink: 1, p_wave_a: 2, p_wave_b: 2, p_idle: 3, p_idle2: 3, p_blink: 3,
                 p_hold: 4, p_hold2: 4, p_walk0: 5, p_walk1: 5, p_walk2: 5, p_walk3: 5, p_windup: 6, p_release: 7, p_follow: 8,
                 p_pat: 9, p_cheer: 10, p_cheer2: 10, p_crouch: 11, p_crouch2: 11, p_sit: 12, p_tie_a: 13, p_tie_b: 13, p_watch: 14 };
  var PMOVES = { 2: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 13: 1 };      // 这几类姿势本身一直在动
  var POSE_ID = { stand: 1, alert: 2, sit: 3, paw: 4, scratch: 5, lie: 6, sleep: 7, bow: 8, dig: 9, beg: 10, roll: 11, sniff: 12, tug: 13, lick: 14, air: 15 };

  // ============================================================
  //  host：外壳提供的几样东西（除了 now 都可以不给）
  //    now() 秒；storage.get/set；haptic(kind)；island { center(), visible(), hit(x, y) }；log(msg)
  // ============================================================
  function create(host, cfg) {
    host = host || {};
    var CFG = Object.assign({}, DEF, cfg || {});
    var opt = { auto: CFG.auto !== false, roam: !!CFG.roam, grass: !!CFG.grass, soft: !!CFG.soft };
    var R = resOf(CFG.res);          // 一个世界单位画成几个像素
    var RIG_FPS = +CFG.rigFps > 0 ? +CFG.rigFps : 12;     // 角色在原地做动作的时候，每秒重画几次
    var CALM_FPS = 6;                                      // 只是呼吸、轻轻摇尾巴的时候，每秒重画几次
    var STRIDE = 0.5;                                      // 在地上每走出这么远（世界单位；再细不过一个像素）就重画一次，脚才不会打滑
    var quality = 1;

    // 画图的文件要是出了错：记下来、告诉外壳（同样的话只说一次），然后用旧的画法顶上，玩法照常
    var artErrors = [];
    function artFail(what, e) {
      var m = what + ': ' + ((e && e.message) || e);
      if (artErrors.indexOf(m) >= 0 || artErrors.length >= 20) return;
      artErrors.push(m);
      if (host.log) { try { host.log(m); } catch (e2) {} }
    }
    function makeRig(what, fn) { try { return fn() || null; } catch (e) { artFail(what, e); return null; } }

    var DOGS = G.PET_DOGS || null;
    var FXM = G.PET_FX || null;          // 新的小道具画法（没有就用旧的手画图）
    var PERSON = G.PET_PERSON || null;   // 新的小人画法（同上）
    var SPR = (G.PET_SPRITES && G.PET_SPRITES.build) ? G.PET_SPRITES.build(CFG) : {};
    var personRig = (PERSON && PERSON.create) ? makeRig('person.js create', function () { return PERSON.create(CFG); }) : null;
    // 新画法的小人比旧的高：多高、半个身子多宽、手能伸多远，听画的人的（没有就按旧图：26 高、半宽 8、手伸 6）
    var PM = (personRig && PERSON.METRICS) || null;
    var P_H = PM && PM.height > 0 ? +PM.height : 26;
    var P_HALF = PM && PM.half > 0 ? +PM.half : 8;
    var P_REACH = PM && PM.reach > 0 ? +PM.reach : 6;
    var P_GRAB = Math.round(P_H * 0.54);          // 被拎起来时，手抓在脚上面多高的地方
    function pr(n) { return n + Math.max(0, P_REACH - 6); }     // 狗凑到他手边要站多远：手伸得远就站远一点
    var PY0 = 0;               // 小人的脚最靠上能站到哪里（头不能顶到菜单栏）

    var VW = 300, VH = 110;    // 外壳给的画面大小（世界单位）
    var INS = { top: 0, bottom: 0, left: 0, right: 0 };   // 菜单栏、程序坞、刘海各占多少（世界单位）
    var LW = 300, LH = 110;    // 场地的大小
    var F = { x0: 0, x1: 300, y0: 110, y1: 110 };   // 脚能踩到的范围
    var SK = 1;                // 场地小的时候（手机）跑慢一点
    var now = 0;               // 游戏时间（秒）
    var booted = false;
    var serial = 0;            // 给表情、灰尘这些小东西编号

    function clock() { return host.now ? host.now() : now; }
    // 现在是几月几号几点：外壳可以给一个 date()（毫秒，测试时用来拨钟）；不给就是电脑上的时间
    function wall() { var v = host.date ? +host.date() : NaN; return v === v ? v : Date.now(); }
    // 钟：别的地方都读这里（每一步最多看两次表）。h m 几点几分、hm 'HH:MM'、wd 星期几（0 = 星期天）、day 'YYYY-M-D'、
    // md 'MM-DD'、ymd 'YYYY-MM-DD'、phase 'day' | 'dusk' | 'night'（草地该用哪套颜色）、night 是不是该睡觉的钟点、ms 毫秒
    var clk = { ms: 0, h: 12, m: 0, hm: '12:00', wd: 0, day: '', md: '', ymd: '', phase: 'day', night: false }, clkAt = -9;
    function readClock() {
      var d = new Date(wall()), h = d.getHours(), m = d.getMinutes(), mo = d.getMonth() + 1, dd = d.getDate();
      clk.ms = d.getTime(); clk.h = h; clk.m = m; clk.wd = d.getDay();
      clk.hm = pad2(h) + ':' + pad2(m);
      clk.day = d.getFullYear() + '-' + mo + '-' + dd;
      clk.md = pad2(mo) + '-' + pad2(dd); clk.ymd = d.getFullYear() + '-' + clk.md;
      clk.phase = (h >= 19 || h < 5) ? 'night' : ((h >= 17 || h < 7) ? 'dusk' : 'day');
      clk.night = nightAt(h);
      clkAt = now;
    }
    function today() { if (now - clkAt > 0.5 || clkAt < 0) readClock(); return clk.day; }
    function dayPhase() { if (now - clkAt > 0.5 || clkAt < 0) readClock(); return clk.phase; }
    // 对齐到像素格子。图的位置不取整（那是外壳的事），只用在两处：
    // 贴在别人身上的东西（手里、嘴里的球）的相对位置；"可以点的范围"（看到哪里就点得到哪里）
    function qz(v) { return Math.round(v * R) / R; }

    // ------------------------------------------------------------
    //  角色
    // ------------------------------------------------------------
    // 每个角色自己的那张图（img）和重画的节奏；骨架上嘴、手、头顶的位置也记在这里
    function makeVis(phase) {
      return {
        im: { w: 0, h: 0, data: null, scale: 1, ox: 0, oy: 0, key: null, ver: 0 },
        ph: phase, acc: 0, seen: 0, sig: -1, cls: -1, left: false, R: 0, hot: 0, dist: 0, lx: 0, ly: 0,
        bx0: 0, by0: 0, bx1: 0, by1: 0, px: 1, top: 0, mx: 0, my: 0, hand: false, holds: false, hx: 0, hy: 0, seat: false, sx: 0, sy: 0,
        ry0: 0, ry1: 0, s8: null, s32: null, p32: null, n: 0, ch: 0, bad: 0, an: {}, den: false,
      };
    }
    // 戏里用到的、每个角色身上都有的几样：ov 搭在身上的小反应、o 它写的那一层、att 安在谁身上、mood 心情、expr 表情、
    // lookT 看哪儿、rx 递给骨架的别的输入、ract 骨架自己演的小动作、held 手里 / 嘴里的小东西、clip 只画一部分
    function scriptFields(a) {
      a.ov = null; a.o = null; a.att = null; a.mood = null; a.expr = null; a.lookT = null; a.rx = null; a.ract = null; a.ractAt = 0; a.ractDone = false;
      a.held = null; a.clip = null; a.lk = null; a.camAt = rand(6, 14); a.camUntil = 0; a.solo1 = ''; a.solo2 = '';
      a.rub = 0; a.rubAt = 0; a.rubbing = false; a.flyAt = -9; a.hovT = 0; a.hovSaid = false; a.clickAt = -9; a.zoneAt = 0;
      return a;
    }
    function makeDog(kind) {
      var m = DOGS && DOGS.METRICS && DOGS.METRICS[kind];
      return scriptFields({
        kind: kind, name: kind, K: KIND[kind], half: m && m.half > 0 ? +m.half : KIND[kind].half,
        rig: (DOGS && DOGS.create) ? makeRig('dogs.js create ' + kind, function () { return DOGS.create(kind, kind === 'gold' ? 'gold' : 'dax_' + (CFG.dachshund || 'red')); }) : null,
        vis: makeVis(kind === 'gold' ? 0 : 0.66), ri: {},
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sp: 0, face: 1, lift: 0,
        st: 'idle', pose: 'stand', t: 0, dur: 0, wag: 0.3, energy: 1,
        tx: 0, ty: 0, spd: 0, react: 0, hopAt: 0, sideAt: 0, way: null,
        pant: false, happy: 0, hype: 0, bark: 0, look: 0,
        box: null, bpx: 1, top: 0, mx: kind === 'gold' ? 15 : 16, zAt: 0, dustAt: 0, lastSp: 0,
        land: 0, rSp: 0, rFace: 1, rLook: 0, near: false, la: null,
        scene: null, cmd: null, hidden: false, carried: false,
      });
    }
    var gold = makeDog('gold');
    var dax = makeDog('dax');
    var dogs = [gold, dax];
    function other(d) { return d === dax ? gold : dax; }
    var person = scriptFields({
      isPerson: true, name: 'person', kind: 'man', mx: P_REACH, K: null, energy: 1, pose: 'stand', wag: 0, pant: false, happy: 0, bark: 0, look: 0, half: P_HALF, x: 0, y: 0, z: 0, vz: 0, lift: 0, face: 1, st: 'idle', t: 0, dur: 0, anim: 0, tx: 0, ty: 0, next: 4,
      msgAt: 0, waveCd: 0, hoverT: 0, box: null, bpx: 1, top: 0, zAt: 0, giveTo: null, spr: null, sprAt: 0, act: null, patSpr: null, item: null,
      scene: null, cmd: null, hidden: false, carried: false, moving: false, spd: 0, la: null,
      rig: personRig, vis: makeVis(0.33), ri: { frame: 'p_idle' },
    });
    var actors = [gold, person, dax];
    var ball = { x: 0, y: 0, z: BALL_R, vx: 0, vy: 0, vz: 0, st: 'hand', holder: null, other: null, rot: 0, sq: 0, box: null, bpx: 1, freeT: 0, vis: true, tugEnd: 0, owner: null, fly: null };
    var play = { phase: 'rest', rounds: 0, nextAt: 9, throwAt: 0, fetcher: null, lastPlay: 0, faked: false, want: 0 };
    var pointer = { x: -999, y: -999, inside: false, down: false, drag: false, hist: [], grab: null, gx: 0, gy: 0, prop: null };
    var emotes = [], parts = [], items = [];
    var bfly = { on: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, t: 0, until: 0, nextAt: rand(25, 60), color: 0, land: 0 };
    var home = { st: 'out', t: 0, q: [], auto: false, inAt: 0, wasNight: false };     // out 在外面 | going 正在回岛 | in 在岛里 | leaving 正在出来
    function islandOn() { var I = host.island; return !!(I && (!I.visible || I.visible())); }
    var lastTouch = 0;
    var stats = { day: '', fetch: 0, pets: 0 };
    var nextSceneAt = 14, sceneCount = {};
    var VIEW = { w: 300, h: 110 };      // 整个画面多大（给戏里看的）
    var entered = false, enterAt = 0, preHidden = false;     // 刚打开时的"出场"

    function loadStats() {
      try { var s = JSON.parse((host.storage && host.storage.get('qiuqiu-stats')) || 'null'); if (s && s.day === today()) stats = s; } catch (e) {}
      if (stats.day !== today()) stats = { day: today(), fetch: 0, pets: 0 };
    }
    function saveStats() { try { if (host.storage) host.storage.set('qiuqiu-stats', JSON.stringify(stats)); } catch (e) {} }
    function bump(k) { if (stats.day !== today()) stats = { day: today(), fetch: 0, pets: 0 }; stats[k]++; saveStats(); }

    // ------------------------------------------------------------
    //  版面
    // ------------------------------------------------------------
    function relayout() {
      LW = Math.max(150, VW);
      LH = Math.max(70, VH);
      F.x0 = Math.ceil(INS.left); F.x1 = LW - Math.ceil(INS.right);
      F.y1 = LH - Math.ceil(INS.bottom);
      F.y0 = opt.roam ? Math.min(F.y1, Math.ceil(INS.top) + 34) : F.y1;
      SK = clamp(Math.min(LW, 400) / 400, 0.55, 1);
      PY0 = clamp(Math.ceil(INS.top) + P_H + 6, F.y0, F.y1);
      VIEW.w = LW; VIEW.h = LH; API.SK = SK; API.roam = opt.roam;
      if (!booted) boot();
      actors.forEach(function (a) { a.x = clamp(a.x, F.x0 + a.half + 1, F.x1 - a.half - 1); a.y = clamp(a.y, a.isPerson ? PY0 : F.y0, F.y1); });
      ball.x = clamp(ball.x, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = clamp(ball.y, F.y0, F.y1);
    }
    function boot() {
      booted = true;
      readClock();
      loadStats();
      loadWorld();
      for (var i = 0; i < world.decals.length; i++) { var dc = world.decals[i]; decals.push({ id: dc.id || ('decal:' + (++decalSerial)), spr: dc.spr, x: dc.x, y: dc.y, overlay: !!dc.overlay, until: dc.until, flip: !!dc.flip }); }
      var cx = (F.x0 + F.x1) / 2, cy = F.y0 + (F.y1 - F.y0) * 0.62;
      person.x = Math.round(cx + rand(-10, 10)); person.y = Math.round(cy); person.face = 1;
      gold.x = person.x - 44; gold.y = Math.round(cy + (opt.roam ? -4 : 0)); gold.face = 1;
      dax.x = person.x + 34; dax.y = Math.round(cy + (opt.roam ? 6 : 0)); dax.face = -1;
      setPose(gold, 'sit', 5); setPose(dax, 'stand', 2);
      ball.x = person.x; ball.y = person.y;
      person.msgAt = range(CFG.messageMinutes, 40) * 60 * rand(0.2, 0.6);
      // 刚打开：有岛的话，过半秒从岛里一个一个跳出来（这半秒先不露面）；没有岛就过一会儿转过来挥挥手
      enterAt = host.island ? 0.5 : 1.6;
      if (wantEntrance()) { actors.forEach(function (a) { a.hidden = true; }); home.st = 'in'; preHidden = true; }
      careBoot();
    }
    function wantEntrance() { return !!host.island && opt.roam && CFG.entrance !== false; }
    function enter() {
      if (preHidden && home.st !== 'in') return;          // 这半秒里她已经把它们叫出来了
      if (wantEntrance()) {
        actors.forEach(function (a) { a.hidden = true; });
        home.st = 'in'; comeOut();
        return;
      }
      if (preHidden) { actors.forEach(function (a) { a.hidden = false; }); home.st = 'out'; }
      if (person.st === 'idle' && play.phase === 'rest') personWave();
    }
    function spd(d, k) { return d.K[k] * SK; }
    function islandPt() {
      var I = host.island, cx = LW / 2;
      if (I && I.center) cx = I.center();
      return { x: clamp(cx, F.x0 + 30, F.x1 - 30), y: F.y0 };
    }

    // ------------------------------------------------------------
    //  表情、粒子、说话、震动
    // ------------------------------------------------------------
    function emote(type, ent, dx, life) {
      emotes.push({ id: ++serial, type: type, ent: ent, dx: dx || 0, t: 0, life: life || 1.1, ph: emotes.length });
    }
    function emoteAt(type, x, y, life) { emote(type, { x: x, top: y }, 0, life); }
    function puff(x, y, big) { parts.push({ id: ++serial, k: 'puff', x: x, y: y, t: 0, life: big ? 0.42 : 0.3, vx: rand(-6, 6), vy: -6 }); }
    function bits(x, y, n, colors, spread, up) {
      for (var i = 0; i < n; i++) {
        parts.push({ id: ++serial, k: 'px', x: x + rand(-2, 2), y: y, vx: rand(-spread, spread), vy: -rand(up * 0.5, up), g: 220, t: 0, life: rand(0.35, 0.7), c: pick(colors) });
      }
    }
    function haptic(k) { if (host.haptic) { try { host.haptic(k); } catch (e) {} } }
    // 在草地上打滚带起来的草屑是什么颜色：新的草地会告诉我们这个时段的颜色，没有就用旧草地的
    function grassBits() {
      var L = G.PET_LAWN, p = (L && L.palette) ? L.palette(dayPhase()) : null;
      return (p && p.bits && p.bits.length) ? p.bits : ['#9ad584', '#77b363'];
    }
    var bubble = null;         // 小人正在说的话：{ text, until, id }（气泡本身由外壳画）
    function say(text) {
      bubble = { text: text, until: now + Math.max(4.5, Math.min(9, text.length * 0.35 + 3)), id: ++serial };
    }

    function nightAt(h) {
      var n = CFG.nightSleep;
      if (!n || n.length !== 2) return false;
      return n[0] <= n[1] ? (h >= n[0] && h < n[1]) : (h >= n[0] || h < n[1]);
    }
    function isNight() { if (now - clkAt > 0.5 || clkAt < 0) readClock(); return clk.night; }
    // 夜里、而且好一阵子没人理 → 该睡了
    function sleepyTime() { return isNight() && (now - lastTouch) > 150; }

    // ------------------------------------------------------------
    //  移动
    // ------------------------------------------------------------
    function setPose(d, pose, dur) { d.st = 'pose'; d.pose = pose; d.t = 0; d.dur = dur || 2; }
    function walkTo(d, tx, ty, speed, pose) {
      d.st = 'walk'; d.pose = pose || 'stand'; d.t = 0;
      var q = avoid(tx, ty, d);
      d.tx = clamp(q.x, F.x0 + d.half + 2, F.x1 - d.half - 2); d.ty = clamp(q.y, F.y0, F.y1);
      d.spd = speed;
    }
    // 睡着了吗（自己睡的；在戏里跟着剧本睡的不算）
    function awake(d) { return !(d.pose === 'sleep' && (d.st === 'pose' || (d.st === 'scene' && d.scene && d.scene.kind === 'solo'))); }
    function wake(d, quiet) {
      if (awake(d)) return;
      if (d.scene) endScript(d.scene, true, 'wake');
      d.st = 'idle'; d.pose = 'stand'; d.t = 0; d.dur = 0;
      if (!quiet) emote('bang', d);
    }
    // 往 (tx, ty) 跑，返回是否到了
    function drive(e, tx, ty, maxSpd, dt) {
      var acc = e.K.accel * SK;
      tx = clamp(tx, F.x0 + e.half + 1, F.x1 - e.half - 1); ty = clamp(ty, F.y0, F.y1);
      var dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy), sp = hyp(e.vx, e.vy);
      if (d < 1.8 && sp < 45) { e.vx = e.vy = 0; e.x = tx; e.y = ty; return true; }
      var brake = sp * sp / (2 * acc);
      var want = d <= brake + 1 ? 0 : maxSpd;
      // 目标正好在脚下（比如屏幕变小后两个都被挤到边上）时 d 是 0：只刹车，不能除以 0
      var inv = d > 1e-6 ? 1 / d : 0;
      var wx = dx * inv * want, wy = dy * inv * want * 0.8;
      var ax = wx - e.vx, ay = wy - e.vy, al = hyp(ax, ay), step = acc * dt;
      if (al > step) { ax *= step / al; ay *= step / al; }
      e.vx += ax; e.vy += ay;
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < F.x0 + e.half + 1) { e.x = F.x0 + e.half + 1; e.vx = 0; }
      if (e.x > F.x1 - e.half - 1) { e.x = F.x1 - e.half - 1; e.vx = 0; }
      if (e.y < F.y0) { e.y = F.y0; e.vy = 0; }
      if (e.y > F.y1) { e.y = F.y1; e.vy = 0; }
      if (Math.abs(e.vx) > 5) e.face = e.vx > 0 ? 1 : -1;
      return false;
    }
    function coast(e, dt) {
      var sp = hyp(e.vx, e.vy);
      if (sp < 0.01) { e.vx = e.vy = 0; return; }
      var step = e.K.accel * SK * dt, k = Math.max(0, sp - step) / sp;
      e.vx *= k; e.vy *= k;
      e.x = clamp(e.x + e.vx * dt, F.x0 + e.half + 1, F.x1 - e.half - 1);
      e.y = clamp(e.y + e.vy * dt, F.y0, F.y1);
    }
    function faceTo(e, x) { if (Math.abs(x - e.x) > 2) e.face = x > e.x ? 1 : -1; }
    function hop(d, power) { if (d.z === 0) { d.vz = power; d.z = 0.01; } }
    function mouthX(d) { return d.x + d.face * d.mx; }
    function randPt(far, from) {
      for (var i = 0; i < 12; i++) {
        var x = rand(F.x0 + 24, F.x1 - 24), y = rand(F.y0, F.y1);
        if (!from || hyp(x - from.x, y - from.y) > far) return { x: x, y: y };
      }
      return { x: rand(F.x0 + 24, F.x1 - 24), y: rand(F.y0, F.y1) };
    }
    function ry(v) { return opt.roam ? v : 0; }   // 只有满屏幕跑的时候才有"前后"的偏移

    // 小人把东西丢出去的那一下，手在哪里（旧画面 p_release 里手的位置）
    function handPos(sprName, face) {
      if (PM) { var k = P_H / 26; return { x: person.x + face * 9.5 * k, z: 17 * k }; }      // 新画法：按身高放大
      var s = SPR[sprName], w = s ? s.w : 22, hh = s ? s.h : 28, h = (s && s.hand) || [19, 10];
      var x0 = Math.round(person.x - w / 2), ax = h[0] + 1;
      return { x: face < 0 ? x0 + (w - 1 - ax) : x0 + ax, z: hh - (h[1] + 1) };
    }

    // ------------------------------------------------------------
    //  身上的位置（锚点）：骨架画出来时会告诉我们嘴、背、手、怀里……在哪；没给的按老样子估一个
    //  都是 [往前多远（已经按朝向翻好）, 离地多高]，世界单位
    // ------------------------------------------------------------
    var ANCHORS = ['mouth', 'nose', 'back', 'seat', 'head', 'hand', 'hand2', 'grip', 'arms', 'lap', 'chest', 'tailTip', 'headTop', 'chin', 'forepaw', 'tie'];
    var anTmp = [0, 0];
    function anchorOf(b, name) {
      var q = b.vis.an[name];
      if (q && q.ok) return q;
      var up = Math.max(4, b.y - 1 - b.z - b.lift - (b.top || b.y - 12)), f = b.face;
      if (b.isPerson) {
        if (name === 'hand' || name === 'hand2' || name === 'grip') {
          if (b.vis.hand) { anTmp[0] = b.vis.hx; anTmp[1] = b.vis.hy; } else { anTmp[0] = f * P_REACH * 0.6; anTmp[1] = P_H * 0.45; }
        }
        else if (name === 'arms' || name === 'chest') { anTmp[0] = f * 3; anTmp[1] = P_H * 0.55; }
        else if (name === 'tie') { anTmp[0] = f * 1.5; anTmp[1] = P_H * 0.6; }
        else if (name === 'lap') { anTmp[0] = f * 5; anTmp[1] = P_H * 0.3; }
        else if (name === 'mouth') { anTmp[0] = f * 2; anTmp[1] = P_H * 0.78; }
        else { anTmp[0] = 0; anTmp[1] = P_H; }
      } else {
        if (name === 'seat' || name === 'back') { anTmp[0] = -f * 4; anTmp[1] = b.kind === 'gold' ? 8 : 5; }
        else if (name === 'mouth' || name === 'nose' || name === 'chin') { anTmp[0] = f * b.mx; anTmp[1] = b.mouthY !== undefined ? b.y - b.z - b.lift - b.mouthY : up * 0.6; }
        else if (name === 'tailTip') { anTmp[0] = -f * b.half; anTmp[1] = up * 0.7; }
        else if (name === 'forepaw') { anTmp[0] = f * b.half * 0.6; anTmp[1] = 2; }
        else { anTmp[0] = f * b.mx * 0.7; anTmp[1] = up; }
      }
      return anTmp;
    }
    // 安在别人身上的角色：每一步都挪到那个位置上（人家走到哪它跟到哪）
    function placeAttached(a) {
      var t = a.att, b = t.to;
      if (!a.scene || b.hidden || a.carried || b.carried || b === a) { a.att = null; a.lift = 0; return; }
      var q = anchorOf(b, t.anchor);
      a.x = clamp(b.x + q[0] + t.dx * b.face, F.x0 + 1, F.x1 - 1);
      a.y = clamp(b.y + ry(t.behind ? -0.5 : 0.5), F.y0, F.y1);
      a.z = 0; a.vz = 0; a.vx = a.vy = 0; a.sp = 0;
      a.lift = Math.max(0, q[1] + b.z + b.lift + t.dz);
      if (t.face) a.face = b.face * t.face;
    }
    // 小人的手现在在哪：{ x, y（脚下）, z（离地多高）}
    function handNow(which) {
      var q = anchorOf(person, which || 'hand');
      return { x: person.x + q[0], y: person.y, z: q[1] + person.z };
    }

    // ============================================================
    //  她那一头：鼠标在哪、多久没动静、屏幕是不是刚亮（外壳用 sense() 告诉我们；没说过的就当"人在、鼠标不知道在哪"）
    // ============================================================
    // 鼠标：x y 在哪、known 知不知道、speed 多快（世界单位/秒）、still 停了几秒、d 离最近的角色多远、near 最近的是谁
    var cur = { x: -999, y: -999, known: false, speed: 0, still: 0, d: 1e9, near: null, lx: 0, ly: 0, lt: -1e9, fresh: false, moved: -1e9, nearT: 0, driftT: 0, driftAt: -1e9, gone: 0 };
    // 她：idle 几秒没动静；active 不到 1 分钟；present 不到 5 分钟；away 走开了；engaged 正在和它们玩；busy 在忙别的（在、但没在玩）；
    // typing 在打字（有动静、鼠标却 5 秒没动）
    var her = { idle: 0, active: true, present: true, away: false, engaged: false, busy: false, typing: false, told: false, base: 0, at: 0, top: 0,
                backAt: -1e9, retDay: '', battery: null, frontApp: null, asleep: false, dock: null, statusItem: null };
    var rubs = { dir: 0, len: 0, revs: [], shakeAt: -1e9 };
    var notice = { armed: true, at: -1e9 };
    var evLog = [];            // 最近出过哪些事（给测试看）

    function setCursor(x, y) {
      if (x !== x || y !== y) return;
      if (!cur.known) { cur.lx = x; cur.ly = y; cur.lt = now; cur.moved = now; }
      else if (hyp(x - cur.x, y - cur.y) > 0.5) cur.fresh = true;
      cur.x = x; cur.y = y; cur.known = true; cur.gone = 0;
      pointer.x = x; pointer.y = y; pointer.inside = true;
    }
    // 她动了一下（键盘、鼠标、点了哪里）
    function herInput() { her.base = 0; her.at = now; }
    // 鼠标在某个角色身上的哪一段：head / mid / rump（小人：head / tie / mid / legs）；狗的鼻尖 nose、伸出来的爪子 paw、尾巴 tail
    function zoneOf(a, x, y) {
      var gy = a.y - 1 - a.z - a.lift, q;
      if (a.isPerson) {
        q = anchorOf(a, 'tie');
        if (Math.abs(x - (a.x + q[0])) <= 3 && y <= gy - q[1] + 4 && y >= gy - q[1] - 5) return 'tie';
        var up = (gy - y) / P_H;
        return up > 0.72 ? 'head' : (up > 0.32 ? 'mid' : 'legs');
      }
      q = anchorOf(a, 'nose');
      if (hyp(x - (a.x + q[0]), y - (gy - q[1])) <= 4) return 'nose';
      if (a.pose === 'paw' || a.pose === 'highfive') { q = anchorOf(a, 'forepaw'); if (hyp(x - (a.x + q[0]), y - (gy - q[1] - 6)) <= 6) return 'paw'; }
      var k = (x - a.x) * a.face / Math.max(1, a.half);
      return k > 0.3 ? 'head' : (k < -0.75 ? 'tail' : (k < -0.3 ? 'rump' : 'mid'));
    }
    function headPt(a) { return a.isPerson ? [a.x, a.y - a.z - P_H * 0.85] : [a.x + a.face * a.mx * 0.8, (a.top || a.y - 12) + 4]; }
    function actorAt(x, y, pad) {
      for (var i = actors.length - 1; i >= 0; i--) { var a = actors[i]; if (!a.hidden && inBox(a.box, x, y, pad)) return a; }
      return null;
    }
    // 每一步看一眼鼠标：多快、停了多久、是不是在谁身上来回蹭、是不是嗖地从谁头顶飞过去
    function updateCursor(dt) {
      var i, a;
      her.idle = her.told ? her.base + (now - her.at) : 0;
      her.active = her.idle < 60; her.present = her.idle < 300;
      if (!her.present) { if (!her.away) { her.away = true; her.top = 0; } if (her.idle > her.top) her.top = her.idle; }
      else if (her.away && her.idle < 10) { her.away = false; var gone = her.top; her.top = 0; cameBack(gone, false); }
      her.engaged = now - lastTouch < 60 || cur.nearT >= 2;
      her.busy = her.active && !her.engaged;
      her.typing = her.idle < 5 && cur.known && cur.still > 5;
      if (!cur.known) { cur.speed = 0; cur.d = 1e9; cur.near = null; cur.nearT = 0; return; }
      if (cur.fresh) {
        cur.fresh = false;
        var dx = cur.x - cur.lx, dy = cur.y - cur.ly, d = hyp(dx, dy), gap = now - cur.lt;
        cur.speed = gap > 0 && gap < 0.4 ? d / gap : 0;
        if (cur.speed > 5) cur.moved = now;
        if (!pointer.down && gap < 0.4) {
          if (cur.speed >= 500) flyby(cur.lx, cur.ly, cur.x, cur.y);
          if (cur.speed >= 150) sweep(cur.lx, cur.ly, cur.x, cur.y);
          stroke(dx, cur.x, cur.y);
        }
        cur.lx = cur.x; cur.ly = cur.y; cur.lt = now;
      } else if (now - cur.lt > 0.15) cur.speed = 0;
      cur.still = now - cur.moved;
      // 慢慢地挪（10-60 世界单位/秒，一秒以上）
      cur.driftT = (cur.speed >= 10 && cur.speed <= 60) ? cur.driftT + dt : (cur.speed > 60 ? 0 : Math.max(0, cur.driftT - dt));
      if (cur.driftT >= 1 && now - cur.driftAt > 6 && !pointer.down) { cur.driftAt = now; cur.driftT = 0; raise('drift', { x: cur.x, y: cur.y, speed: cur.speed }); }
      // 离谁最近；停在谁身上一会儿（hover）
      var best = null, bd = 1e9;
      for (i = 0; i < actors.length; i++) {
        a = actors[i];
        if (a.hidden) { a.hovT = 0; continue; }
        var dd = hyp(cur.x - a.x, cur.y - (a.y - a.z - (a.isPerson ? P_H * 0.5 : 8)));
        if (dd < bd) { bd = dd; best = a; }
        if (a.rubbing && now - a.rubAt > 0.7) { a.rubbing = false; a.rub = 0; }
        if (!pointer.down && inBox(a.box, cur.x, cur.y, 2)) {
          a.hovT += dt;
          if (a.hovT >= 0.4 && !a.hovSaid) { a.hovSaid = true; raise('hover', { who: a, x: cur.x, y: cur.y, zone: zoneOf(a, cur.x, cur.y) }); }
        } else { a.hovT = 0; a.hovSaid = false; }
      }
      cur.d = bd; cur.near = best;
      cur.nearT = (bd < 150 && cur.speed < 60) ? cur.nearT + dt : 0;
      // 停在谁旁边不动了：它会发现（notice）
      if (cur.still < 0.15) { if (now - notice.at > 2) notice.armed = true; }
      else if (notice.armed && cur.still >= 0.6 && best && bd < 60 && !pointer.down && !pointer.grab) {
        notice.armed = false; notice.at = now;
        raise('notice', { who: best, dist: bd, x: cur.x, y: cur.y });
      }
      // 按住谁不放（不挪）：press
      var g = pointer.grab;
      if (g && !g.moved && !g.pressed && now - g.t0 >= (g.a.isPerson ? 0.8 : 0.5)) { g.pressed = true; raise('press', { who: g.a, x: g.x, y: g.y, zone: zoneOf(g.a, g.x, g.y) }); }
    }
    // 鼠标左右来回：每掉一次头记一笔。在谁身上连着蹭 = 摸它（rub）；在哪儿又快又大地甩 = shake
    function stroke(dx, x, y) {
      var s = rubs, dir = dx > 0.3 ? 1 : (dx < -0.3 ? -1 : 0);
      if (!dir) return;
      if (dir === s.dir) { s.len += Math.abs(dx); return; }
      if (s.dir && s.len >= 6) {
        s.revs.push({ t: now, len: s.len, x: x - dx, y: y });
        if (s.revs.length > 6) s.revs.shift();
        var n = s.revs.length, r3 = n >= 3 ? s.revs[n - 3] : null;
        if (r3 && now - r3.t <= 1.2) {
          var a = actorAt(x - dx, y, 4);
          if (a && inBox(a.box, s.revs[n - 2].x, s.revs[n - 2].y, 4) && inBox(a.box, r3.x, r3.y, 4)) {
            a.rub = 2 / Math.max(0.1, now - r3.t); a.rubAt = now;
            if (!a.rubbing) { a.rubbing = true; raise('rub', { who: a, power: a.rub, zone: zoneOf(a, x - dx, y), x: x - dx, y: y }); }
          }
        }
        var r4 = n >= 4 ? s.revs[n - 4] : null;
        if (r4 && now - r4.t <= 0.7 && now - s.shakeAt > 3) {
          var sum = 0, big = true;
          for (var i = n - 4; i < n; i++) { sum += s.revs[i].len; if (s.revs[i].len < 20) big = false; }
          if (big && sum / Math.max(0.05, now - r4.t) >= 300) { s.shakeAt = now; raise('shake', { x: x, y: y }); }
        }
      }
      s.dir = dir; s.len = Math.abs(dx);
    }
    // 线段 (x0, y0)-(x1, y1) 离点 (px, py) 最近有多远
    function segDist(x0, y0, x1, y1, px, py) {
      var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, k = L2 > 0 ? clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1) : 0;
      return hyp(x0 + dx * k - px, y0 + dy * k - py);
    }
    // 鼠标很快地从 (x0, y0) 划到 (x1, y1)：有没有擦着谁的头顶过去
    function flyby(x0, y0, x1, y1) {
      for (var i = 0; i < actors.length; i++) {
        var a = actors[i];
        if (a.hidden || a.carried || now - a.flyAt < 2) continue;
        var h = headPt(a);
        if (segDist(x0, y0, x1, y1, h[0], h[1]) <= 14) { a.flyAt = now; raise('flyby', { who: a, vx: x1 - x0, vy: y1 - y0, speed: cur.speed }); }
      }
    }
    // 鼠标很快地扫过一样能点的道具（吹蜡烛那种）
    function sweep(x0, y0, x1, y1) {
      for (var i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.dead || !p.hot || !p.box || now - p.sweepAt < 1) continue;
        var b = p.box, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        if (segDist(x0, y0, x1, y1, cx, cy) <= Math.max(3, (b[2] - b[0]) / 2)) { p.sweepAt = now; raise('sweep', { prop: p, kind: p.kind, speed: cur.speed }); }
      }
    }
    // 她回来了。gone = 走开了多久（秒）。tier：1 = 5-20 分钟，2 = 20 分钟到 3 小时，3 = 3 小时以上，或者今天头一回
    function cameBack(gone, woke) {
      if (!(gone >= 300)) return;
      var first = her.retDay !== clk.day;
      her.retDay = clk.day; her.backAt = now;
      raise('return', { away: gone, tier: (gone >= 3 * 3600 || first) ? 3 : (gone >= 1200 ? 2 : 1), woke: !!woke, first: first });
    }
    // 屏幕刚亮 / 电脑刚醒（gap = 睡了多久，秒；不知道就是 0）
    function wokeUp(gap) {
      her.asleep = false;
      var gone = Math.max(gap || 0, her.away ? her.top : 0);
      careResume(gap || 0);
      raise('wake', { gap: gap || 0 });
      her.base = 0; her.at = now; her.away = false; her.top = 0;
      cameBack(gone, true);
    }
    function setBattery(b) {
      var was = her.battery;
      if (!b || typeof b.level !== 'number') { her.battery = null; return; }
      b = { level: clamp(+b.level, 0, 1), charging: !!b.charging };
      her.battery = b;
      if (!was) return;
      if (b.charging !== was.charging) raise('battery', { kind: b.charging ? 'plug' : 'unplug', level: b.level });
      else if (!b.charging && b.level < 0.2 && was.level >= 0.2) raise('battery', { kind: 'low', level: b.level });
      else if (b.charging && b.level >= 0.995 && was.level < 0.995) raise('battery', { kind: 'full', level: b.level });
    }
    // 外壳告诉引擎外面的事（SPEC 8.4 / 8.8）：每个字段都可以不给，不给的保持上一次的值
    function sense(o) {
      if (!o) return;
      if (!booted) relayout();
      if (o.cursor !== undefined) {
        if (o.cursor && o.cursor.length >= 2 && isFinite(o.cursor[0]) && isFinite(o.cursor[1])) setCursor(+o.cursor[0], +o.cursor[1]);
        else { cur.known = false; if (!pointer.down) pointer.inside = false; }
      }
      if (typeof o.idle === 'number' && o.idle >= 0) { her.told = true; her.base = o.idle; her.at = now; }
      if (typeof o.asleep === 'boolean') her.asleep = o.asleep;
      if (o.woke === true) wokeUp(0);
      if (o.battery !== undefined) setBattery(o.battery);
      if (o.frontApp !== undefined) her.frontApp = o.frontApp || null;
      if (o.dock !== undefined) her.dock = (o.dock && isFinite(o.dock.x) && isFinite(o.dock.w)) ? { x: +o.dock.x, y: +o.dock.y, w: +o.dock.w, h: +o.dock.h } : null;
      if (o.statusItem !== undefined) her.statusItem = isFinite(o.statusItem) && o.statusItem !== null ? +o.statusItem : null;
      if (o.menu === true) raise('menu', {});
    }

    // ============================================================
    //  钟和日子：几点了、是不是换了一天、今天是不是什么日子（每秒看两次）
    // ============================================================
    var seen = { m: -1, h: -1, phase: '', day: '' };
    function clockEvents() {
      readClock();
      if (clk.day !== seen.day) { var was = seen.day; seen.day = clk.day; if (was) { newDay(); raise('newday', { day: clk.day }); } }
      if (clk.m !== seen.m || clk.h !== seen.h) {
        var first = seen.m < 0;
        seen.m = clk.m; seen.h = clk.h;
        if (!first) { raise('minute', { h: clk.h, m: clk.m, hm: clk.hm }); if (clk.m === 0) raise('hour', { h: clk.h, hm: clk.hm }); }
      }
      if (clk.phase !== seen.phase) { var w2 = seen.phase; seen.phase = clk.phase; if (w2) raise('dayphase', { phase: clk.phase }); }
      // 今天的日子（见面倒数、设定里写的生日纪念日）：等它们在外面、她也在的时候才说，一天只说一回
      if (world.dateDay !== clk.day && home.st === 'out' && her.present && entered && now - her.backAt > 20) {
        world.dateDay = clk.day; worldDirty = true;
        if (CFG.reunion) { var n = daysTo(CFG.reunion); if (n !== null && n >= 0) raise('date', { kind: 'reunion', days: n }); }
        var ds = datesToday();
        for (var i = 0; i < ds.length; i++) raise('date', { kind: ds[i].kind || 'note', entry: ds[i], line: ds[i].line || '', days: 0 });
      }
      if (worldDirty && now - worldAt > 20) saveWorld();
    }
    // 离某一天还有几天（'YYYY-MM-DD'；当天是 0，过了是负数；写错了是 null）
    function daysTo(s) {
      var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || ''));
      if (!m) return null;
      var t = new Date(+m[1], +m[2] - 1, +m[3]).getTime(), d = new Date(wall()), t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return Math.round((t - t0) / 86400000);
    }
    function datesToday() {
      var out = [], ds = CFG.dates;
      if (!ds || !ds.length) return out;
      for (var i = 0; i < ds.length; i++) { var on = ds[i] && String(ds[i].on || ''); if (on && (on === clk.md || on === clk.ymd)) out.push(ds[i]); }
      return out;
    }
    // 记性：存在外壳那里的一小份（键是 qiuqiu-world）—— 每一段戏今天演了几次、戏自己想记住的东西、草地上的小印子
    var world = { v: 1, first: '', day: '', days: 0, plays: {}, mem: {}, dateDay: '', decals: [] }, worldDirty = false, worldAt = 0;
    function loadWorld() {
      try { var s = JSON.parse((host.storage && host.storage.get('qiuqiu-world')) || 'null'); if (s && s.v === 1) world = s; } catch (e) {}
      if (!world.plays || typeof world.plays !== 'object') world.plays = {};
      if (!world.mem || typeof world.mem !== 'object') world.mem = {};
      if (!world.decals || !world.decals.length) world.decals = [];
      if (!world.first) { world.first = clk.day; world.days = 0; worldDirty = true; }
      if (world.day !== clk.day) newDay();
    }
    function saveWorld() {
      worldDirty = false; worldAt = now;
      try { if (host.storage) host.storage.set('qiuqiu-world', JSON.stringify(world)); } catch (e) {}
    }
    function newDay() {
      if (world.day) world.days = (world.days || 0) + 1;
      world.day = clk.day; world.plays = {}; worldDirty = true;
      // 存着的小印子过期了就不画了
      for (var i = world.decals.length - 1; i >= 0; i--) { var dc = world.decals[i]; if (dc.until && dc.until < clk.ms) world.decals.splice(i, 1); }
    }
    // ============================================================
    //  戏：scenes/*.js 里登记的一段一段小剧本（怎么写，见文件开头"怎么写一场戏"）
    //  四种：scene 几个角色一起演 · solo 一个角色自己的小动作 · react 出了什么事才演 · care 喂饭、拉粑粑那一套
    //  每一段是一个 generator：yield 秒数 = 等这么久；yield 函数 = 等它返回 true；yield [几样] = 都好了；光写 yield = 等下一步
    // ============================================================
    var KIND_LIMIT = { scene: 70, solo: 20, react: 30, care: 110 };      // 每种最长演多少秒（剧本可以自己另定 timeout）
    var TOKEN = { man: 1, dax: 1, gold: 1, dog: 1, other: 1, who: 1 };
    var DEFS = [], DEFN = {}, ON = {}, SOLO = { person: [], gold: [], dax: [] };
    var scripts = [];          // 正在演的
    var CUR = null;            // 现在正往下走的是哪一段（剧本里调的那些函数靠它知道"是谁在调"）
    var recent = [];           // 最近挑过的几段 scene（新的在后）：{ name, family, cat }
    var bags = {};             // 抽签袋：每一类一个，这一轮演过的先不演；这一类有空的都演过一遍了再重来
    var pend = [], pendAt = 0; // 出了事、可演员一时没空：先记着，过一会儿再试
    var LIVELY = clamp(+CFG.liveliness || 1, 0.5, 1.5);    // 戏排得多密（设定里的 liveliness：0.5 安静一点 … 1.5 热闹一点）

    function castOf(c) {
      if (typeof c === 'string') c = c.split(/[\s,]+/).filter(function (s) { return s; });
      if (!c || !c.length) throw new Error('cast is empty');
      var out = [];
      for (var i = 0; i < c.length; i++) {
        var t = String(c[i]);
        if (t === 'person') t = 'man';
        if (!TOKEN[t]) throw new Error('unknown cast "' + t + '"');
        out.push(t);
      }
      return out;
    }
    function addDef(r) {
      var name = r && typeof r.name === 'string' ? r.name : '';
      if (!name) throw new Error('a scene has no name');
      if (DEFN[name]) throw new Error('"' + name + '" is registered twice');
      if (typeof r.run !== 'function') throw new Error(name + ': run must be a function*');
      var kind = r.kind || 'scene';
      if (!KIND_LIMIT[kind]) throw new Error(name + ': unknown kind "' + kind + '"');
      var cast = castOf(r.cast);
      if (kind === 'solo' && cast.length !== 1) throw new Error(name + ': a solo has exactly one character');
      var on = r.on ? [].concat(r.on).map(String) : (r.at ? ['minute'] : []);
      if (kind === 'react' && !on.length) throw new Error(name + ': a react needs on (the event it answers)');
      var d = {
        name: name, zh: r.zh || name, kind: kind, cast: cast, src: r, run: r.run,
        end: typeof r.end === 'function' ? r.end : null, when: typeof r.when === 'function' ? r.when : null,
        weight: r.weight === undefined ? 2 : r.weight, cool: +r.cool || 0, cap: +r.cap || 0,
        chance: r.chance === undefined ? 1 : +r.chance, keep: +r.keep || 0, timeout: +r.timeout > 0 ? +r.timeout : KIND_LIMIT[kind],
        on: on, at: r.at ? [].concat(r.at).map(String) : null, tag: r.tag || '', mood: r.mood || '', family: r.family || '',
        cat: r.cat || (kind === 'scene' ? (cast.indexOf('man') >= 0 ? 'B' : 'A') : kind), hours: r.hours || null,
        overlay: kind === 'react' && !!r.overlay, aware: r.aware === undefined ? kind === 'solo' : !!r.aware, role: r.care || '', fromDay: +r.fromDay || 0,
        anytime: !!r.anytime || r.tag === 'fetch', n: 0, last: -1e9, errs: 0, off: false, pack: r.pack || '',
      };
      DEFS.push(d); DEFN[name] = d;
      for (var i = 0; i < on.length; i++) (ON[on[i]] = ON[on[i]] || []).push(d);
      if (kind === 'solo') {
        var t = cast[0];
        if (t === 'man') SOLO.person.push(d);
        else if (t === 'dax' || t === 'gold') SOLO[t].push(d);
        else if (t === 'dog') { SOLO.dax.push(d); SOLO.gold.push(d); }
        else throw new Error(name + ': a solo is for man, dax, gold or dog');
      }
    }
    // 外壳在造引擎之前，已经把 scenes/ 下面的文件都读进来了：每个文件往 PET_SCENES 里放自己的戏。
    // 写错了的那一段跳过（告诉外壳一声），别的照常
    function loadPacks() {
      var list = G.PET_SCENES;
      if (!list || typeof list.length !== 'number') return;
      for (var i = 0; i < list.length; i++) {
        try { addDef(list[i]); } catch (e) { sceneFail('scene pack', e); }
      }
    }

    // 把"谁来演"换成具体的角色。b = { dog, who }：事件里带来的，或者导演替它挑的
    function bindCast(def, b) {
      var out = [], dog = b.dog || null, i, a;
      for (i = 0; i < def.cast.length; i++) {
        var t = def.cast[i];
        if (t === 'man') a = person; else if (t === 'dax') a = dax; else if (t === 'gold') a = gold;
        else if (t === 'who') a = b.who || null;
        else if (t === 'dog') { if (!dog && b.who && !b.who.isPerson) dog = b.who; a = dog; }
        else a = dog ? other(dog) : null;
        if (!a || out.indexOf(a) >= 0) return null;
        out.push(a);
      }
      b.dog = dog;
      return out;
    }
    // 这个角色现在腾不腾得出来演这一段
    function freeFor(a, def) {
      if (a.hidden || a.carried) return false;
      if (def.overlay) return true;                          // 只加表情、眼神的小反应：不占人
      var sc = a.scene;
      if (sc) {
        if (sc.pending || now < sc.commitTo) return false;
        // 自己的小动作随时可以让给别的戏；她亲手引起的反应（tag 'hers'）连正在演的戏也可以打断（喂饭那一套除外）
        if (sc.kind === 'solo') { if (def.kind === 'solo') return false; }
        else if (!(def.tag === 'hers' && sc.kind !== 'care' && def.kind !== 'scene')) return false;
      }
      if (a.isPerson) return (a.st === 'idle' || a.st === 'front' || a.st === 'act') && (ball.st === 'hand' || ball.st === 'pocket');
      return a.st === 'idle' || a.st === 'pose' || a.st === 'walk' || a.st === 'zoom' || a.st === 'spin' || a.st === 'bfly' || a.st === 'scene' || a.st === 'eat';
    }
    function allFree(cast, def) { for (var i = 0; i < cast.length; i++) if (!freeFor(cast[i], def)) return false; return true; }
    // 这一段的演员都有空吗 → 具体是哪几个（没空就是 null）。写的是"哪只狗都行"又没指定时，两只都试一下
    function castFor(def, b) {
      var cast = bindCast(def, b), i;
      if (cast && allFree(cast, def)) return cast;
      if (!b.who && def.cast.indexOf('dog') >= 0) {
        var keep = b.dog, first = keep || (Math.random() < 0.5 ? dax : gold);
        for (i = 0; i < 2; i++) {
          b.dog = i ? other(first) : first;
          cast = bindCast(def, b);
          if (cast && allFree(cast, def)) return cast;
        }
        b.dog = keep;
      }
      return null;
    }

    // 探路用的 S：导演问 when / weight 的时候给它们用（这时候没有哪一段戏正在演）
    var Q = null;
    function setQ(b, ev) { Q.dog = b.dog || null; Q.other = Q.dog ? other(Q.dog) : null; Q.who = b.who || null; Q.me = b.who || b.dog || null; Q.ev = ev || null; }
    function inHours(list, h) {
      if (!list || !list.length) return false;
      if (typeof list[0] === 'number') list = [list];
      for (var i = 0; i < list.length; i++) { var r = list[i]; if (r && r.length === 2 && (r[0] <= r[1] ? (h >= r[0] && h < r[1]) : (h >= r[0] || h < r[1]))) return true; }
      return false;
    }
    // 这一段现在能不能演（不管演员有没有空）：隔够久了吗、今天演够了吗、合不合时宜、它自己的 when 点头了吗
    function canPlay(def, ev) {
      if (def.off) return false;
      if (def.cool && now - def.last < def.cool) return false;
      if (def.cap && (world.plays[def.name] || 0) >= def.cap) return false;
      if (def.fromDay && CFG.discovery !== false && (world.days || 0) < def.fromDay) return false;
      if (def.hours && !inHours(def.hours, clk.h)) return false;
      var t = def.tag;
      if (t !== 'hers' && def.kind !== 'care') {
        if (t === 'seek' && (CFG.cursorPlay === false || !cur.known || !her.engaged || her.typing || cur.d > 200)) return false;
        if (t === 'cursor' && (CFG.cursorPlay === false || !cur.known)) return false;
        if (def.kind === 'scene' && !ev) {
          if (her.away && (t === 'lively' || t === 'seek' || (her.idle > 1200 && def.mood !== 'sleepy'))) return false;
          if (CFG.quietHours && t !== 'calm' && inHours(CFG.quietHours, clk.h)) return false;
        }
      }
      if (def.when) {
        try { if (!def.when.call(def.src, Q, ev || null)) return false; }
        catch (e) { sceneFail('scene ' + def.name + ' when', e); def.off = true; return false; }
      }
      return true;
    }
    // 一天里不同的时候，热闹的 / 好笑的 / 温柔的 / 犯困的戏各自多演还是少演一点（R5 4.3）
    var TOD = { lively: [1.5, 1, 0.6, 1, 0.6, 0.2], funny: [1.2, 1, 0.8, 1, 0.8, 0.5], tender: [0.8, 1, 1, 1.2, 1.6, 1.2], sleepy: [0.3, 0.6, 1.8, 0.8, 1.2, 2] };
    function todBand() {
      var h = clk.h, n = CFG.nightSleep;
      if (n && n.length === 2 && ((n[0] + 23) % 24) === h) return 5;                 // 睡前最后一个钟头
      return h >= 7 && h < 10 ? 0 : (h >= 10 && h < 13 ? 1 : (h >= 13 && h < 16 ? 2 : (h >= 16 && h < 19 ? 3 : 4)));
    }
    function weightOf(def) {
      var w = def.weight;
      if (typeof w === 'function') { try { w = +w.call(def.src, Q) || 0; } catch (e) { sceneFail('scene ' + def.name + ' weight', e); def.off = true; return 0; } }
      if (!(w > 0)) return 0;
      var band = todBand();
      if (def.tag === 'lively') w *= TOD.lively[band] * (her.busy ? 0.6 : 1);
      var m = def.mood;
      if (m) { var row = m === 'tender' ? TOD.tender : (m === 'sleepy' ? TOD.sleepy : (m === 'funny' || m === 'playful' || m === 'mischievous' ? TOD.funny : null)); if (row) w *= row[band]; }
      return w;
    }
    var pk = [], pw = [], pb = [];      // 挑戏时用的草稿
    function draw(n) {
      var tot = 0, i;
      for (i = 0; i < n; i++) tot += pw[i];
      if (!(tot > 0)) return -1;
      var r = Math.random() * tot;
      for (i = 0; i < n; i++) { r -= pw[i]; if (r <= 0 && pw[i] > 0) return i; }
      for (i = n - 1; i >= 0; i--) if (pw[i] > 0) return i;
      return -1;
    }

    function owns(a) { return !!(CUR && a && a.scene === CUR); }
    function touches(a) { return !!(CUR && a && (a.scene === CUR || a.ov === CUR)); }      // 归这段戏管，或者这段小反应正搭在它身上
    function mainScript() {
      for (var i = 0; i < scripts.length; i++) { var sc = scripts[i]; if (!sc.dead && sc.kind !== 'solo' && !sc.overlay) return sc; }
      return null;
    }
    function sceneRunning() {
      for (var i = 0; i < scripts.length; i++) { var sc = scripts[i]; if (!sc.dead && sc.kind === 'scene') return sc; }
      return null;
    }
    function takeActor(a, sc) {
      a.scene = sc; a.cmd = null;
      if (a.isPerson) { a.st = 'idle'; a.spr = null; a.sprAt = now; a.act = null; a.t = 0; }
      else { wake(a, true); a.st = 'scene'; a.pose = 'stand'; a.wag = sc.kind === 'solo' ? 0.3 : 0.4; a.pant = false; a.t = 0; }
    }
    function releaseActor(a, sc) {
      a.scene = null; a.cmd = null; a.lift = 0; a.att = null; a.mood = null; a.expr = null; a.lookT = null; a.rx = null; a.ract = null; a.clip = null; a.held = null;
      if (a.isPerson) { a.spr = null; a.item = null; if (a.st === 'idle') { a.t = 0; a.act = null; } }
      else if (a.st === 'scene') { a.st = 'idle'; a.pose = 'stand'; a.t = 0; a.pant = false; a.wag = 0.3; a.happy = 0; }
      if (sc.hid && sc.hid.indexOf(a) >= 0 && a.hidden && home.st === 'out') { a.hidden = false; a.z = 0; puff(a.x, a.y - 10, true); }
    }
    function startScript(def, cast, b, ev) {
      var i, a;
      for (i = 0; i < cast.length; i++) {
        a = cast[i];
        if (def.overlay) { if (a.ov) endScript(a.ov, true, 'taken'); }
        else if (a.scene) endScript(a.scene, true, 'taken');
      }
      var sc = { def: def, name: def.name, kind: def.kind, overlay: def.overlay, actors: cast.slice(), it: null, wait: null, t0: now, until: now + def.timeout,
                 commitTo: 0, pending: null, dead: false, S: null, hooks: null, seed: ((Math.random() * 4294967296) >>> 0) || 1, hid: null, fetch: null, ev: ev || null };
      for (i = 0; i < cast.length; i++) { a = cast[i]; if (def.overlay) { a.ov = sc; a.o = null; } else takeActor(a, sc); }
      var S = Object.create(API);
      S.name = def.name; S.kind = def.kind; S.cast = sc.actors; S.ev = ev || null; S.me = cast[0];
      S.who = b.who || null; S.dog = b.dog || null;
      if (!S.dog) { for (i = 0; i < cast.length; i++) if (!cast[i].isPerson) { if (S.dog) { S.dog = null; break; } S.dog = cast[i]; } }
      S.other = S.dog ? other(S.dog) : null;
      sc.S = S;
      scripts.push(sc);
      def.n++;
      world.plays[def.name] = (world.plays[def.name] || 0) + 1;
      if (def.cap) worldDirty = true;
      if (def.kind === 'scene') sceneCount[def.name] = (sceneCount[def.name] || 0) + 1;
      var prev = CUR;
      CUR = sc;
      try { sc.it = def.run.call(def.src, S, ev || null); } catch (e) { CUR = prev; scriptError(sc, e); return null; }
      CUR = prev;
      if (!sc.it || typeof sc.it.next !== 'function') { endScript(sc, false); return sc; }       // 不是 generator：一下子就演完了
      stepScript(sc, 0);
      return sc;
    }
    // 一段戏结束（演完了，或者 cancelled = 被打断了）：先让它自己收尾，再把舞台收拾干净 ——
    // 角色放回去、它留下的道具拿走、球回到小人手里
    function endScript(sc, cancelled, why) {
      if (sc.dead) return;
      sc.dead = true;
      var def = sc.def, i, a, prev = CUR;
      if (def.end) {
        CUR = sc;
        try { def.end.call(def.src, sc.S, !!cancelled, why || ''); } catch (e) { sceneFail('scene ' + sc.name + ' end', e); }
        CUR = prev;
      }
      for (i = 0; i < sc.actors.length; i++) {
        a = sc.actors[i];
        if (sc.overlay) { if (a.ov === sc) { a.ov = null; a.o = null; } }
        else if (a.scene === sc) releaseActor(a, sc);
      }
      dropProps(sc, !!cancelled);
      for (i = items.length - 1; i >= 0; i--) if (items[i].sc === sc) items.splice(i, 1);
      if (ball.owner === sc) ballHome();
      def.last = now;
      if (sc.kind === 'scene') nextSceneAt = now + (cancelled ? rand(5, 9) : rand(6, 15)) / LIVELY;
      else if (sc.kind === 'solo' && sc.actors[0] === person) person.next = Math.max(person.next, now + rand(1.5, 4) / LIVELY);
      else if (sc.kind === 'care') careEnded(sc, !!cancelled, why || '');
      if (sc.fetch && !cancelled && home.st === 'out' && play.phase === 'rest' && ball.st === 'hand' && !person.carried && !person.hidden) {
        var f = sc.fetch; sc.fetch = null;
        startSession(f.n, f.target);
        play.throwAt = now + 0.05; play.faked = true;
      }
    }
    function scriptError(sc, e) {
      sceneFail('scene ' + sc.name, e);
      if (++sc.def.errs >= 3) sc.def.off = true;          // 老是出错的这一段，以后不演了
      endScript(sc, true, 'error');
    }
    // 让一段戏让路。hard = 马上停；不是 hard 的话，它要是正演到"不能打断"的一小段（commit），就等这一小段演完
    function cancelScript(sc, hard, why) {
      if (sc.dead) return true;
      if (!hard && now < sc.commitTo) { if (!sc.pending) sc.pending = why || 'cancel'; return false; }
      endScript(sc, true, why || 'cancel');
      return true;
    }
    // 让某个角色（who = null 就是所有角色）身上的戏都让路；返回 true = 都停了
    function cancelFor(who, hard, why) {
      var all = true;
      for (var i = scripts.length - 1; i >= 0; i--) {
        var sc = scripts[i];
        if (!sc || sc.dead) continue;
        if (who && sc.actors.indexOf(who) < 0) continue;
        if (!cancelScript(sc, hard, why)) all = false;
      }
      return all;
    }
    // 她动手了 / 要丢球了 / 要回岛了：正在演的都让路（喂饭那一套另外管：见"照料"）
    function endScene(hard, why) {
      for (var i = scripts.length - 1; i >= 0; i--) {
        var sc = scripts[i];
        if (!sc || sc.dead || (sc.kind === 'care' && !hard)) continue;
        cancelScript(sc, !!hard, why || 'input');
      }
    }
    function waitOf(v) {
      if (typeof v === 'function') return v;
      if (typeof v === 'number') { if (v > 0) { var t = now + v; return function () { return now >= t; }; } }
      else if (v && typeof v.length === 'number') return all.apply(null, v);
      var t0 = now;
      return function () { return now > t0; };              // 什么都没给：等到下一步
    }
    function stepScript(sc, dt) {
      if (sc.dead) return;
      if (now > sc.until) { endScript(sc, true, 'timeout'); return; }
      if (sc.pending && now >= sc.commitTo) { endScript(sc, true, sc.pending); return; }
      // 往她鼠标那儿去的戏（seek）：她把鼠标甩开了（太快、太远、不见了）就不追了
      if (sc.def.tag === 'seek' && now - sc.t0 > 0.3 && (!cur.known || cur.speed > 250 || cur.d > 200) && now >= sc.commitTo) { endScript(sc, true, 'cursor'); return; }
      var prev = CUR, r, guard, i, h;
      CUR = sc;
      try {
        if (sc.hooks) for (i = sc.hooks.length - 1; i >= 0; i--) { h = sc.hooks[i]; if (now >= h.until) sc.hooks.splice(i, 1); else h.fn(now - h.t0, dt); }
        for (guard = 0; guard < 30 && !sc.dead; guard++) {
          if (sc.wait) { if (!sc.wait()) break; sc.wait = null; }
          r = sc.it.next();
          if (sc.dead) break;
          if (r.done) { CUR = prev; endScript(sc, false); return; }
          sc.wait = waitOf(r.value);
        }
      } catch (e) { CUR = prev; scriptError(sc, e); return; }
      CUR = prev;
    }
    function runScripts(dt) {
      var i, n = scripts.length, dead = false;
      for (i = 0; i < n; i++) { if (scripts[i].dead) dead = true; else stepScript(scripts[i], dt); }
      if (dead || scripts.length !== n) for (i = scripts.length - 1; i >= 0; i--) if (scripts[i].dead) scripts.splice(i, 1);
      if (pend.length && now >= pendAt) { pendAt = now + 0.25; retryPending(); }
    }

    // ------------------------------------------------------------
    //  导演：没事的时候挑一段 scene；角色闲下来给它挑一个 solo；出了事看有没有 react 要演
    // ------------------------------------------------------------
    var calmUntil = 0;          // 刚吃饱的那一阵：不排热闹的戏，小人也不主动丢球
    function stageFree() { return home.st === 'out' && play.phase === 'rest' && !pointer.drag && !(pointer.grab && pointer.grab.moved); }
    function pickScene(only, ev) {
      if (only) {
        var d0 = DEFN[only];
        if (!d0 || home.st !== 'out') return false;
        if (d0.kind !== 'scene' || d0.on.length) return forcePlay(d0, ev);
      }
      if (!stageFree() || sleepyTime() || mainScript()) return false;
      if (!only && careWaiting()) return false;
      var n = 0, i, def, b, cast, w, tired = gold.energy < 0.45, calm = now < calmUntil;
      for (i = 0; i < DEFS.length; i++) {
        def = DEFS[i];
        if (def.kind !== 'scene' || def.on.length) continue;
        if (only ? def.name !== only : (calm && def.tag === 'lively')) continue;
        b = {}; setQ(b, null);
        if (!only && !canPlay(def, null)) continue;
        cast = castFor(def, b);
        if (!cast) continue;
        setQ(b, null);
        w = only ? 1 : weightOf(def) * (tired && def.tag === 'lively' ? 0.3 : 1);
        if (!(w > 0)) continue;
        pk[n] = def; pw[n] = w; pb[n] = { b: b, cast: cast }; n++;
      }
      if (!n) return false;
      if (!only) shuffleRules(n);
      i = draw(n);
      if (i < 0) return false;
      def = pk[i];
      bagPut(def);
      recent.push({ name: def.name, family: def.family, cat: def.cat }); if (recent.length > 6) recent.shift();
      return !!startScript(def, pb[i].cast, pb[i].b, null);
    }
    // 不重样：抽签袋（这一类里这一轮演过的先不演）、一家子的戏（family）三段里不连着来、同一类不连演三段
    function bagPut(def) { var bg = bags[def.cat] || (bags[def.cat] = {}); bg[def.name] = 1; }
    function shuffleRules(n) {
      var i, k, cats = {};
      for (i = 0; i < n; i++) { k = pk[i].cat; if (!cats[k]) cats[k] = { all: 0, used: 0 }; cats[k].all++; if (bags[k] && bags[k][pk[i].name]) cats[k].used++; }
      for (k in cats) if (cats[k].used >= cats[k].all) bags[k] = {};        // 这一类能演的都演过了：重新开一轮
      var base = pw.slice(0, n);
      for (i = 0; i < n; i++) if (bags[pk[i].cat] && bags[pk[i].cat][pk[i].name]) pw[i] = 0;
      var afterBag = pw.slice(0, n), r1 = recent[recent.length - 1], r2 = recent[recent.length - 2], left = 0;
      for (i = 0; i < n; i++) {
        var f = pk[i].family;
        if ((f && ((r1 && r1.family === f) || (r2 && r2.family === f))) || (r1 && r2 && r1.cat === pk[i].cat && r2.cat === pk[i].cat) || (r1 && r1.name === pk[i].name)) pw[i] = 0;
        if (pw[i] > 0) left++;
      }
      if (left) return;
      for (i = 0; i < n; i++) { pw[i] = afterBag[i]; if (pw[i] > 0) left++; }       // 只能放宽一点：一家子 / 同一类的规矩先不管
      if (left) return;
      for (i = 0; i < n; i++) pw[i] = (n > 1 && r1 && r1.name === pk[i].name) ? 0 : base[i];      // 再不行：只要别和上一段一样
    }
    // 测试 / 看连环画用：不管轮没轮到，指名演一段（演员得有空）
    function forcePlay(def, ev) {
      ev = ev || {};
      if (!ev.name) ev.name = def.on[0] || 'test';
      if (!ev.t) ev.t = now;
      var b = { who: ev.who || null, dog: ev.dog || null };
      if (!b.who && def.cast.indexOf('who') >= 0) b.who = dax;
      var cast = castFor(def, b);
      if (!cast && def.kind === 'solo') {             // 指名演一个 solo：它正在做的别的小动作先停
        var c0 = bindCast(def, b);
        if (c0 && c0[0].scene && c0[0].scene.kind === 'solo') { cancelScript(c0[0].scene, true, 'test'); cast = castFor(def, b); }
      }
      return cast ? !!startScript(def, cast, b, ev) : false;
    }
    // 角色闲下来了：给它挑一个自己的小动作。没有登记小动作的话返回 false，引擎用自己原来那一套
    function pickSolo(a) {
      var list = SOLO[a.name], n = 0, i, def, w, b = { who: a, dog: a.isPerson ? null : a };
      if (!list.length || home.st !== 'out' || a.hidden || a.carried) return false;
      setQ(b, null);
      var calm = now < calmUntil;
      for (i = 0; i < list.length; i++) {
        def = list[i];
        if (def.name === a.solo1 || (calm && def.tag === 'lively') || !canPlay(def, null)) continue;
        w = weightOf(def);
        if (!(w > 0)) continue;
        if (def.name === a.solo2) w *= 0.35;
        pk[n] = def; pw[n] = w; n++;
      }
      i = draw(n);
      if (i < 0) return false;
      a.solo2 = a.solo1; a.solo1 = pk[i].name;
      return !!startScript(pk[i], [a], b, null);
    }
    // 出了一件事：name 是事件名，ev 里是细节（who = 这件事落在谁身上）。有登记在这件事上的 react 就挑来演。
    // 返回演起来的那一段（没有就是 null）
    function raise(name, ev) {
      ev = ev || {};
      ev.name = name; ev.t = now;
      evLog.push(name); if (evLog.length > 80) evLog.shift();
      var list = ON[name];
      return list ? dispatch(list, ev, false) : null;
    }
    function dispatch(list, ev, again) {
      var n = 0, i, def, b, cast, w, first = null;
      for (i = 0; i < list.length; i++) {
        def = list[i];
        if (def.at && def.at.indexOf(ev.hm) < 0) continue;
        b = { who: ev.who || null, dog: ev.dog || null };
        setQ(b, ev);
        if (!canPlay(def, ev)) continue;
        if (!again && def.chance < 1 && Math.random() >= def.chance) continue;
        var okStage = def.overlay || ((def.anytime || play.phase === 'rest' || def.tag === 'hers') && home.st === 'out');
        cast = okStage ? castFor(def, b) : null;
        if (!cast) { if (def.keep > 0 && !again && pend.length < 12) pend.push({ def: def, ev: ev, until: now + def.keep }); continue; }
        if (def.overlay) { var o = startScript(def, cast, b, ev); if (!first) first = o; continue; }      // 小反应：能演的都演
        setQ(b, ev);
        w = weightOf(def);
        if (!(w > 0)) continue;
        pk[n] = def; pw[n] = w; pb[n] = { b: b, cast: cast }; n++;
      }
      i = draw(n);
      if (i >= 0) { var sc = startScript(pk[i], pb[i].cast, pb[i].b, ev); if (sc) first = sc; }
      return first;
    }
    var one = [null];
    function retryPending() {
      for (var i = pend.length - 1; i >= 0; i--) {
        var p = pend[i];
        if (now > p.until || p.def.off) { pend.splice(i, 1); continue; }
        one[0] = p.def;
        if (dispatch(one, p.ev, true)) pend.splice(i, 1);
      }
    }
    // ============================================================
    //  S：剧本拿到手的那一套"舞台指令"。scenes/*.js 只用这里的东西，不碰引擎里面
    //  （每个函数是干什么的、怎么用，见文件开头"怎么写一场戏"；改了这里记得改那里）
    // ============================================================
    var API = {};
    var YES = function () { return true; };
    // —— 等 ——
    function after(sec) { var t = now + sec; return function () { return now >= t; }; }
    function all() {
      var fs = [];
      for (var i = 0; i < arguments.length; i++) fs.push(waitOf(arguments[i]));
      return function () { for (var j = 0; j < fs.length; j++) if (!fs[j]()) return false; return true; };
    }
    function any() {
      var fs = [];
      for (var i = 0; i < arguments.length; i++) fs.push(waitOf(arguments[i]));
      return function () { for (var j = 0; j < fs.length; j++) if (fs[j]()) return true; return false; };
    }
    API.all = all; API.any = any; API.wait = after;
    API.until = function (fn, max) { var t = now + (max > 0 ? max : 30); return function () { return now >= t || !!fn(); }; };
    // 这 sec 秒里每一步都调一次 fn(过了几秒, 这一步多长)；不给 sec = 一直调到这段戏结束。返回"等这 sec 秒"
    API.each = function (sec, fn) {
      if (typeof sec === 'function') { fn = sec; sec = 1e9; }
      if (!CUR || typeof fn !== 'function') return YES;
      (CUR.hooks = CUR.hooks || []).push({ fn: fn, t0: now, until: now + sec });
      return after(sec);
    };
    API.t = function () { return CUR ? now - CUR.t0 : 0; };
    API.now = function () { return now; };
    // —— 随机（每一段戏有自己的种子）——
    function srand() {
      var sc = CUR;
      if (!sc) return Math.random();
      var a = (sc.seed = (sc.seed + 0x6D2B79F5) >>> 0), t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    API.rand = function (a, b) { return a + srand() * (b - a); };
    API.randInt = function (a, b) { return Math.floor(a + srand() * (b - a + 1)); };
    API.pick = function (arr) { return arr && arr.length ? arr[(srand() * arr.length) | 0] : undefined; };
    API.chance = function (p) { return srand() < p; };
    // —— 走位 ——
    // 速度可以写数字（世界单位/秒），也可以写名字：狗 walk trot run back sniff；小人 stroll brisk hurry（也认 walk trot run）
    function gait(a, v) {
      if (typeof v === 'number') return v;
      if (a.isPerson) return v === 'hurry' || v === 'run' ? 62 : (v === 'brisk' || v === 'trot' ? 40 : 24);
      if (v === 'sniff') return (a.kind === 'gold' ? 12 : 14) * SK;
      return (a.K[v] || a.K.trot) * SK;
    }
    function go(a, x, y, speed, pose, maxSec) {
      if (x && typeof x === 'object') { maxSec = pose; pose = speed; speed = y; y = x.y; x = x.x; }
      if (!owns(a) || !isFinite(x) || !isFinite(y)) return YES;
      var p = avoid(+x, +y, a);
      a.cmd = { k: 'go', x: p.x, y: p.y, spd: gait(a, speed === undefined || speed === null ? (a.isPerson ? 26 : 'trot') : speed), done: false, t: now,
                pose: alt(a, pose) || (a.isPerson ? null : 'stand') };
      if (!a.isPerson) a.t = 0;
      var c = a.cmd, lim = maxSec > 0 ? maxSec : 8;
      return function () { return c.done || a.cmd !== c || now - c.t > lim; };
    }
    function follow(a, target, back, dy, speed) { if (owns(a) && target) a.cmd = { k: 'follow', target: target, back: back || 0, dy: dy || 0, spd: gait(a, speed === undefined ? 'trot' : speed), pose: null }; }
    function hold(a, pose) {
      if (!owns(a)) return;
      a.cmd = null;
      pose = alt(a, pose);
      if (a.isPerson) { a.spr = pose || null; a.sprAt = now; }
      else { pose = pose || 'stand'; if (pose !== a.pose) a.t = 0; a.pose = pose; }
    }
    // 狗狗之间的戏：主角要是正挤在小人身边，先小跑到旁边的空地上再演
    function stage(a) {
      if (person.hidden || !owns(a)) return YES;
      var dx = a.x - person.x, dy = a.y - person.y;
      if (Math.abs(dx) > 44 || Math.abs(dy) > 24) return YES;
      var s = dx >= 0 ? 1 : -1, far = API.rand(56, 84);
      var tx = person.x + s * far;
      if (tx < F.x0 + 44 || tx > F.x1 - 44) tx = person.x - s * far;
      return go(a, tx, clamp(person.y + ry(API.rand(-8, 16)), F.y0, F.y1), spd(a, 'trot') * 1.2);
    }
    API.go = go; API.follow = follow; API.hold = hold; API.pose = hold; API.frame = hold; API.stage = stage;
    // 每一步都问 fn 要一个 { x, y }，往那儿去（追会动的东西：蝴蝶、鼠标底下、被拎着的那一个……）；fn 返回 null = 原地站着
    API.track = function (a, fn, speed, pose) { if (owns(a) && typeof fn === 'function') a.cmd = { k: 'track', fn: fn, spd: gait(a, speed === undefined ? 'trot' : speed), pose: alt(a, pose) || null }; };
    API.stop = function (a) { if (owns(a)) a.cmd = null; };
    API.spd = function (a, k) { return gait(a, k); };
    API.faceTo = function (a, t) {
      if (!owns(a) || t === undefined || t === null) return;
      if (typeof t === 'number') faceTo(a, t);
      else if (t === 'cursor') { if (cur.known) faceTo(a, cur.x); }
      else if (t === 'left' || t === 'right') a.face = t === 'left' ? -1 : 1;
      else if (isFinite(t.x)) faceTo(a, t.x);
    };
    API.turn = function (a) { if (owns(a)) a.face = -a.face; };
    API.hop = function (a, power) { if (owns(a)) hop(a, power || 110); };
    // 不迈步地挪过去（被拖着、蹭过去）：dx, dy 世界单位，dur 秒
    API.slide = function (a, dx, dy, dur) {
      if (!owns(a)) return YES;
      var x0 = a.x, y0 = a.y; dur = dur > 0 ? dur : 0.3;
      a.cmd = null;
      return API.each(dur, function (t) {
        var k = clamp(t / dur, 0, 1);
        a.x = clamp(x0 + dx * k, F.x0 + a.half + 1, F.x1 - a.half - 1); a.y = clamp(y0 + (dy || 0) * k, a.isPerson ? PY0 : F.y0, F.y1); a.vx = a.vy = 0;
      });
    };
    // 绕着一个点转圈：rx, ry 半径，laps 几圈，speed 速度。返回"转完了"
    API.orbit = function (a, c, rx, ryy, laps, speed) {
      if (!owns(a) || !c) return YES;
      var sp = gait(a, speed === undefined ? 'trot' : speed), r0 = Math.max(4, rx || 20), r1 = ry(ryy === undefined ? r0 * 0.4 : ryy);
      var L = 2 * Math.PI * Math.sqrt((r0 * r0 + r1 * r1) / 2), dur = Math.max(0.5, (laps || 1) * L / Math.max(1, sp)), ang0 = Math.atan2((a.y - c.y) / Math.max(1, r1 || 1), (a.x - c.x) / r0), t0 = now;
      API.track(a, function () {
        var k = (now - t0) / dur, ang = ang0 + k * (laps || 1) * 2 * Math.PI * (a.orbitDir || 1);
        return { x: c.x + Math.cos(ang) * r0, y: c.y + Math.sin(ang) * r1 };
      }, sp * 1.15);
      return after(dur);
    };
    // 把 a 安到 b 身上的某个位置（背上 seat、怀里 arms、嘴边 mouth……），之后 b 走到哪 a 跟到哪；detach 放下来
    // dx：再往前挪多少；dz：再往上抬多少；behind：画在 b 后面；face：1 和 b 朝同一边（默认），-1 朝反方向，0 不管
    API.attach = function (a, b, anchor, dx, dz, behind, face) {
      if (!owns(a) || !b || a === b) return;
      a.cmd = null; a.att = { to: b, anchor: anchor || (b.isPerson ? 'arms' : 'seat'), dx: dx || 0, dz: dz || 0, behind: !!behind, face: face === undefined ? 1 : face };
      a.vx = a.vy = 0; a.z = 0; a.vz = 0;
      placeAttached(a);
    };
    API.detach = function (a, power) {
      if (!owns(a) || !a.att) return;
      var lift = a.lift;
      a.att = null; a.lift = 0;
      if (power !== 0) { a.z = Math.max(0.01, lift); hop(a, power || 60); a.z = Math.max(0.01, lift); a.vz = Math.max(a.vz, 20); }
    };
    // 一个角色自己钻进岛里 / 从岛里出来（别的角色不受影响）。要写成 yield* S.enterIsland(a)
    API.enterIsland = function* (a) {
      if (!owns(a) || !opt.roam || !islandOn()) return false;
      var ip = islandPt(), sc = CUR;
      yield go(a, ip.x + (a === dax ? 14 : (a === gold ? -18 : 0)), ip.y, a.isPerson ? 62 : spd(a, 'run') * 0.9, null, 9);
      if (a.scene !== sc) return false;
      hop(a, 190);
      yield 0.22;
      if (a.scene !== sc) return false;
      a.hidden = true; a.z = 0; a.vz = 0; a.vx = a.vy = 0;
      puff(a.x, a.y - 20, true); emoteAt('spark', a.x, a.y - 30, 0.5);
      (sc.hid = sc.hid || []).push(a);
      return true;
    };
    API.leaveIsland = function* (a) {
      if (!owns(a) || !a.hidden) return false;
      var ip = islandPt();
      a.hidden = false; a.x = clamp(ip.x + (a === dax ? 16 : (a === gold ? -20 : 0)), F.x0 + a.half + 2, F.x1 - a.half - 2);
      a.y = a.isPerson ? Math.max(ip.y, PY0) : ip.y; a.z = 0.01; a.vz = 120;
      puff(a.x, a.y - 16, true);
      yield function () { return a.z === 0; };
      return true;
    };
    // —— 姿势、表情、眼神 ——
    function setOf(arr) { var o = {}; if (arr && arr.length) for (var i = 0; i < arr.length; i++) o[arr[i]] = 1; return o; }
    var HAS = {
      pose: (DOGS && DOGS.POSES) ? setOf(DOGS.POSES) : POSE_ID, dact: setOf(DOGS && DOGS.ACTS), mood: setOf(DOGS && DOGS.MOODS),
      frame: (personRig && PERSON.FRAMES) ? setOf(PERSON.FRAMES) : PCLASS, pact: setOf(personRig && PERSON.ACTS), face: setOf(personRig && PERSON.FACES),
    };
    // 画的人认不认得这个名字（姿势 / 画面 / 小动作 / 表情 / 心情）。不认得的名字照样可以用：画出来是站着 / p_idle
    function known(a, name) {
      if (typeof name !== 'string') return !!name;
      return a.isPerson ? !!(HAS.frame[name] || HAS.pact[name] || HAS.face[name]) : !!(HAS.pose[name] || HAS.dact[name] || HAS.mood[name]);
    }
    // 给了几个名字（['squat', 'sit']）：用第一个认得的；都不认得就用最后一个
    function alt(a, v) {
      if (!v || typeof v === 'string' || !Array.isArray(v)) return v;
      for (var i = 0; i < v.length; i++) if (known(a, v[i])) return v[i];
      return v[v.length - 1];
    }
    API.has = function (a, name) { return !!a && known(a, name); };
    API.hasFx = function (name) { return !!sd(name); };
    // 骨架自己会演的一小段动作（伸懒腰、甩毛、打哈欠……；名字在 PET_DOGS.ACTS / PET_PERSON.ACTS 里）：
    // 骨架说演完了（actDone）或者过了 sec 秒算完；画的人还没做这个动作的话，马上就算完
    API.act = function (a, name, sec) {
      if (!owns(a)) return YES;
      name = alt(a, name);
      var can = a.isPerson ? HAS.pact[name] : HAS.dact[name];
      if (!can) { a.ract = null; return YES; }
      var AT = a.isPerson ? (PERSON && PERSON.ACT_TIME) : (DOGS && DOGS.ACT_TIME), at = AT && AT[name];
      var dflt = at ? (typeof at === 'number' ? at : (a.kind === 'gold' ? at[0] : at[1])) * 1.4 + 0.5 : 4;
      var T = now + (sec > 0 ? sec : dflt);
      if (a.ract === name) a.ractRestart = true;          // 同一个动作再来一遍：先让骨架松开一步
      a.ract = name; a.ractAt = now; a.ractDone = false; a.vis.hot = Math.max(a.vis.hot, now + 0.3);
      return function () { return a.ract !== name || a.ractDone || now >= T; };
    };
    function layer(a) { return a.ov === CUR && a.scene !== CUR ? (a.o || (a.o = {})) : a; }       // 小反应写的东西另放一层，它一走就没了
    API.face = function (a, name) { if (a && a.isPerson && touches(a)) layer(a).expr = alt(a, name) || null; };
    API.mood = function (a, name) { if (a && !a.isPerson && touches(a)) layer(a).mood = alt(a, name) || null; };
    // 看哪儿：一个角色 / 道具 / 'ball' / 'cursor'（她的鼠标）/ 'camera'（看她）/ { x, y, z } / null（引擎自己看着办）
    API.look = function (a, t) { if (a && touches(a)) layer(a).lookT = t === undefined ? null : t; };
    // 直接给骨架递别的输入（画的人新加的：tilt、eyes、gusto、pawAt……）；S.rig(a, null) 全部收回
    API.rig = function (a, o) {
      if (!a || !touches(a)) return;
      var L = layer(a);
      if (!o) { L.rx = null; return; }
      L.rx = L.rx || {};
      for (var k in o) L.rx[k] = o[k];
      a.vis.hot = Math.max(a.vis.hot, now + 0.3);
    };
    // 手里 / 嘴里拿一样小东西（图的名字，比如 'bone'）：S.item(谁, 名字[, 'hand2'])；S.item(谁, null) 放下；
    // 老写法 S.item('bone') = 小人右手
    API.item = function (a, name, where) {
      if (typeof a === 'string' || a === null || a === undefined) { name = a; a = person; }
      if (!owns(a)) return;
      if (a.isPerson && where !== 'hand2') a.item = name || null;
      else a.held = name ? { spr: name, anchor: where || (a.isPerson ? 'hand2' : 'mouth') } : null;
    };
    // 只画角色的一部分：rect = [x, y, w, h]（世界单位，屏幕上的一块），null = 整个画
    API.clip = function (a, rect) { if (owns(a)) a.clip = rect && rect.length === 4 ? rect.slice() : null; };
    // —— 表情符号、碎屑、丢东西、说话 ——
    API.emote = function (type, ent, dx, life) {
      if (!ent) return;
      if (ent.top === undefined && !ent.isProp) emoteAt(type, ent.x, ent.y, life); else emote(type, ent, dx, life);
    };
    API.emoteAt = function (type, x, y, life) { emoteAt(type, x, y, life); };
    API.puff = function (x, y, big) { puff(x, y, big); };
    var COLORS = {
      dirt: ['#8a6a4a', '#6f5238', '#a98a62'], water: ['#b2e5ff', '#67adeb'], kibble: ['#a86239', '#d18e54', '#edbc7b'],
      spark: ['#ffd342', '#fff08c', '#ffffff'], white: ['#ffffff', '#f7f5e9'], heart: ['#ff5c85', '#ff99aa'], fur: ['#e6a94e', '#fad378', '#b86230'],
    };
    API.COLORS = COLORS;
    API.bits = function (x, y, n, colors, spread, up) { bits(x, y, n || 4, typeof colors === 'string' ? (COLORS[colors] || [colors]) : (colors || COLORS.dirt), spread || 26, up || 60); };
    API.grass = function () { return grassBits(); };
    API.haptic = function (k) { haptic(k); };
    // 丢一样小东西（图的名字）从 from 到 to，dur 秒，中途抛高 peak。from / to：角色（狗 = 嘴边，小人 = 手上）、道具、{ x, y, z }、'cursor'
    function toss(spr, from, to, dur, peak, a6) {
      var f;
      if (typeof from === 'number') { f = { x: from, y: person.y, z: to }; to = dur; dur = peak; peak = a6; }       // 老写法：toss(图, 手的 x, 手的高度, 给谁, 秒, 抛多高)
      else f = pointOf(from);
      if (!to || !f) return YES;
      var it = { id: ++serial, spr: spr, x0: f.x, y0: f.y, z0: f.z || 0, to: to, t: 0, dur: dur > 0 ? dur : 0.4, peak: peak || 0, sc: CUR, pop: null };
      items.push(it);
      return function () { return it.t >= it.dur; };
    }
    API.toss = toss;
    // 一个表情符号飞过去（飞到了"啵"地再冒一下）
    API.emoteTo = function (type, from, to, dur) {
      var f = pointOf(from);
      if (!f || !to) return YES;
      var it = { id: ++serial, spr: 'fx_' + type, x0: f.x, y0: f.y, z0: (f.z || 0) + 4, to: to, t: 0, dur: dur > 0 ? dur : 0.8, peak: 10, sc: null, pop: type };
      items.push(it);
      return function () { return it.t >= it.dur; };
    };
    // 一个东西现在在哪：{ x, y（脚下 / 地上的那一点）, z（离地多高）}
    function pointOf(v) {
      if (!v) return null;
      if (v === 'cursor') { if (!cur.known) return null; var gy = clamp(cur.y + 20, F.y0, F.y1); return { x: cur.x, y: gy, z: gy - cur.y }; }
      if (v === 'ball') return { x: ball.x, y: ball.y, z: ball.z };
      if (v === person) { var h = handNow(); return { x: h.x, y: person.y, z: h.z }; }
      if (v.isProp) return { x: v.x, y: v.y, z: v.z + 3 };
      if (v.K && v.mouthX !== undefined) return { x: v.mouthX, y: v.y, z: v.y - v.mouthY };
      if (!isFinite(v.x) || !isFinite(v.y)) return null;
      return { x: +v.x, y: +v.y, z: +v.z || 0 };
    }
    API.point = pointOf;
    var LANG = CFG.lang === 'hant' || CFG.lang === 'en' ? CFG.lang : 'hans';
    API.lang = LANG;
    API.T = function (hant, hans, en) { return LANG === 'hant' ? hant : (LANG === 'en' ? en : hans); };
    function lineOf(key) {
      var L = CFG.lines, v = L && typeof L === 'object' ? L[key] : null;
      if (!v && CFG.care && CFG.care.lines && typeof CFG.care.lines === 'object') v = CFG.care.lines[key];
      if (v && typeof v !== 'string' && v.length) v = v[(Math.random() * v.length) | 0];
      return v ? String(v) : '';
    }
    // 小人说一句：先找设定里 lines[key]（一句或者几句里挑一句）；没有的话，设定里写了 lines: true（照料那一套：care.lines: true）
    // 才说戏里自带的 builtin = [繁体, 简体, English]。返回 true = 说了；false = 没说（这时候戏里改用一个表情符号）
    API.say = function (key, builtin) {
      if (person.hidden) return false;
      var t = lineOf(key);
      if (!t && builtin && (CFG.lines === true || (CUR && CUR.kind === 'care' && CFG.care && CFG.care.lines === true))) {
        t = typeof builtin === 'string' ? builtin : (LANG === 'hant' ? builtin[0] : (LANG === 'en' ? builtin[2] : builtin[1]));
      }
      if (!t) return false;
      say(String(t));
      return true;
    };
    API.sayText = function (text) { if (person.hidden || !text) return false; say(String(text)); return true; };
    // —— 地方 ——
    API.ry = ry; API.pr = pr;
    API.randPt = function (far, from) { var p = randPt(far, from); return avoid(p.x, p.y, null); };
    API.island = function () { if (!host.island) return null; var p = islandPt(), I = host.island, rim = null; try { rim = I.rim ? I.rim() : null; } catch (e) { rim = null; } return { x: p.x, y: p.y, on: islandOn() && opt.roam, rim: rim }; };
    API.pulse = function (kind) { var I = host.island; if (I && I.pulse) { try { I.pulse(kind); } catch (e) {} } };
    API.edge = function (side) { return side === 'left' ? F.x0 : (side === 'right' ? F.x1 : (side === 'top' ? F.y0 : F.y1)); };
    API.corner = function (name, m) {
      m = m === undefined ? 24 : m;
      return { x: /l/.test(name) ? F.x0 + m : F.x1 - m, y: /t/.test(name) ? F.y0 + Math.min(m, (F.y1 - F.y0) / 2) : F.y1 - Math.min(6, (F.y1 - F.y0) / 2) };
    };
    API.dock = function () { return her.dock ? { x: her.dock.x, y: her.dock.y, w: her.dock.w, h: her.dock.h } : null; };
    API.statusItem = function () { return her.statusItem; };
    API.dist = function (a, b) { return hyp(a.x - b.x, a.y - b.y); };
    API.near = function (a, b, r) { return hyp(a.x - b.x, a.y - b.y) < r; };
    API.side = function (a, b) { return a.x < b.x ? -1 : 1; };
    function front(a) { return a.isPerson ? P_HALF : (a.mx || a.half || 0); }
    // a 站到 b 旁边（a 现在在哪一侧就站哪一侧），两个鼻尖之间留 gap
    API.beside = function (a, b, gap, dy) {
      var s = a.x < b.x ? -1 : 1, x = b.x + s * (front(b) + front(a) + (gap || 0));
      if (x < F.x0 + a.half + 2 || x > F.x1 - a.half - 2) x = b.x - s * (front(b) + front(a) + (gap || 0));
      return { x: x, y: b.y + ry(dy || 0) };
    };
    API.inFront = function (b, dist, dy) { return { x: b.x + b.face * dist, y: b.y + ry(dy || 0) }; };
    API.behind = function (b, dist, dy) { return { x: b.x - b.face * dist, y: b.y + ry(dy || 0) }; };
    // 狗站到小人手边（他一伸手正好摸到头）
    API.atHand = function (d, dy) { return { x: person.x + (d.x < person.x ? -1 : 1) * (d.mx + pr(12)), y: person.y + ry(dy === undefined ? 1 : dy) }; };
    // 小人站到狗旁边、够得着它：dist = 离狗的中心多远（按旧的手长写，手长了会自己多让出一点）
    API.manAt = function (d, dist, dy) { return { x: d.x + (person.x < d.x ? -1 : 1) * pr(dist), y: d.y + ry(dy || 0) }; };
    // 小人把东西丢出去的那一下，手在哪：{ x, y, z }
    API.handPos = function (face) { var h = handPos('p_release', face || person.face); return { x: h.x, y: person.y, z: h.z }; };
    API.hand = function (which) { return handNow(which); };
    API.anchor = function (a, name) { var q = anchorOf(a, name); return { x: a.x + q[0], y: a.y, z: q[1] + a.z + a.lift }; };
    API.clear = function (x, y, r) { return !obstacleNear(x, y, r || 14); };
    // —— 她、时间 ——
    // 她鼠标正下方 n 个世界单位的地上（夹在场地里）；鼠标不知道在哪就是 null
    API.below = function (n) { return cur.known ? { x: clamp(cur.x, F.x0 + 8, F.x1 - 8), y: clamp(cur.y + (n === undefined ? 20 : n), F.y0, F.y1) } : null; };
    // 走到她鼠标跟前该站的地方（停在鼠标下面 16-30 之间、旁边，不压在鼠标底下）
    API.toCursor = function (a, gap) {
      if (!cur.known) return null;
      var s = a && a.x > cur.x ? 1 : -1, g = (gap === undefined ? 4 : gap) + (a ? (a.isPerson ? P_HALF : a.half * 0.7) : 0) + 14;
      var x = clamp(cur.x + s * g, F.x0 + 20, F.x1 - 20);
      if (Math.abs(x - cur.x) < g * 0.8) x = clamp(cur.x - s * g, F.x0 + 20, F.x1 - 20);
      return { x: x, y: clamp(cur.y + 23, F.y0, F.y1) };
    };
    API.cursorNear = function (a, r) { return cur.known && hyp(cur.x - a.x, cur.y - (a.y - a.z - (a.isPerson ? P_H * 0.5 : 8))) < r; };
    // 鼠标在 pt 附近 r 以内停了几秒（在动、或者不在附近就是 0）
    API.dwell = function (pt, r) { return cur.known && pt && hyp(cur.x - pt.x, cur.y - (pt.y - (pt.z || 0))) < (r || 8) ? cur.still : 0; };
    API.rubbing = function (a) { return a && a.rubbing ? a.rub : 0; };
    API.quietFor = function () { return now - Math.max(lastTouch, play.lastPlay); };      // 多久没人理它们、也没玩球了（秒）
    API.asleep = function (a) { return !!a && !a.isPerson && a.pose === 'sleep'; };
    API.daysTo = daysTo;
    API.reunion = function () { return CFG.reunion ? daysTo(CFG.reunion) : null; };
    API.dates = function () { return datesToday(); };
    API.night = function () { return isNight(); };
    // —— 记性 ——
    API.mem = {
      get: function (k) { return world.mem[k]; },
      set: function (k, v) { if (v === undefined) delete world.mem[k]; else world.mem[k] = v; worldDirty = true; },
    };
    API.count = function (name) { return world.plays[name || (CUR && CUR.name)] || 0; };      // 这一段今天演了几次（正在演的这次也算）
    API.last = function (name) { var d = DEFN[name]; return d && d.last > -1e8 ? now - d.last : Infinity; };   // 上一次演完到现在几秒（这次开机还没演过 = Infinity）
    API.playing = function (name) { for (var i = 0; i < scripts.length; i++) if (!scripts[i].dead && scripts[i].name === name) return true; return false; };
    API.day = function () { return world.days || 0; };       // 第几天（第一次打开那天是 0）
    // —— 和导演打交道 ——
    // 接下来 sec 秒别打断我（她丢球、点小人都先等这一小段演完；把角色拎起来、回岛不等）。最好不超过 1.5 秒
    API.commit = function (sec) { if (CUR && !CUR.pending) CUR.commitTo = now + clamp(+sec || 0, 0, 6); };
    API.interrupted = function () { return !!(CUR && CUR.pending); };                       // 有人在等我让路了（赶紧收尾）
    // 把别的一段戏接进来演：yield* S.run('treat')
    API.run = function* (name) { var d = DEFN[name]; if (d && CUR) { var it = d.run.call(d.src, CUR.S, CUR.ev); if (it && typeof it.next === 'function') yield* it; } };
    API.raise = function (name, ev) { return !!raise(String(name), ev || {}); };
    // 这段戏正常演完以后，小人接着丢 n 个球（target = { x, y } 往哪儿丢；不给就随便丢）
    API.fetch = function (n, target) { if (CUR) CUR.fetch = { n: Math.max(1, n | 0), target: target || null }; };
    // 中途再拉一个有空的角色进来 / 放一个走
    API.join = function (a) {
      var sc = CUR;
      if (!sc || sc.overlay || !a) return false;
      if (a.scene === sc) return true;
      if (!freeFor(a, sc.def)) return false;
      if (a.scene) endScript(a.scene, true, 'taken');
      takeActor(a, sc); sc.actors.push(a);
      return true;
    };
    API.leave = function (a) {
      var sc = CUR, i = sc ? sc.actors.indexOf(a) : -1;
      if (i < 0 || sc.overlay || sc.actors.length < 2) return;
      sc.actors.splice(i, 1); releaseActor(a, sc);
    };
    API.free = function (a) { return !!a && freeFor(a, { kind: 'react', tag: '', overlay: false }); };
    API.shoo = function () {               // 蝴蝶被扑了一下，赶紧飞开
      if (!bfly.on) return;
      bfly.vx += (Math.random() < 0.5 ? -1 : 1) * 50; bfly.vy -= 40; bfly.tx = rand(F.x0 + 20, F.x1 - 20); bfly.ty = rand(Math.max(12, F.y0 - 40), F.y1 - 30);
    };
    API.log = function (msg) { if (host.log) { try { host.log('scene ' + (CUR ? CUR.name : '') + ': ' + msg); } catch (e) {} } };
    function bindApi() {
      API.man = person; API.dax = dax; API.gold = gold; API.dogs = dogs; API.field = F; API.cursor = cur; API.her = her; API.time = clk;
      API.cfg = CFG; API.bfly = bfly; API.prop = PROP; API.ball = BALL; API.care = CARE;
      API.view = VIEW; API.SK = SK; API.roam = opt.roam;
      Q = Object.create(API);
      Q.name = ''; Q.kind = ''; Q.cast = []; Q.dog = Q.other = Q.who = Q.me = Q.ev = null;
    }
    // ============================================================
    //  道具：地上放着的东西（饭碗、便便、树枝、小花……）。图来自 fx.js 的 "种类_状态"（比如 bowl_full），没有就用 "种类"，
    //  再没有就不画（不出错）。和角色一起按前后排；可以有影子；可以让她点（鼠标停在上面一会儿才算）；可以被叼着、拿在手里
    // ============================================================
    var props = [], propSerial = 0;
    function hotOf(h) {
      if (!h) return null;
      if (h === true) return { w: 0, h: 0, dwell: 0.25 };
      return { w: +h.w || 0, h: +h.h || 0, dwell: h.dwell === undefined ? 0.25 : Math.max(0, +h.dwell) };
    }
    function propSpawn(kind, state, x, y, o) {
      o = o || {};
      var p = {
        id: ++propSerial, isProp: true, kind: String(kind), state: state === undefined || state === null ? '' : String(state),
        x: clamp(+x || 0, F.x0 + 2, F.x1 - 2), y: clamp(+y || 0, F.y0, F.y1), z: +o.z || 0, vx: 0, vy: 0, vz: 0,
        face: o.face < 0 ? -1 : 1, a: o.a === undefined ? 1 : clamp(+o.a, 0, 1), born: now, cap: +o.cap > 0 ? +o.cap : 0,
        hot: hotOf(o.hot), hotT: 0, live: false, box: null, sweepAt: -9, obstacle: +o.obstacle || 0, shadow: o.shadow === undefined ? true : o.shadow,
        holder: null, owner: o.keep ? null : CUR, dead: false, data: o.data || {}, spr: o.sprite || null, click: o.click || null,
        top: 0, clip: null, amount: o.amount === undefined ? 1 : +o.amount, front: !!o.front, care: !!o.care,
      };
      if (!(p.y === p.y)) p.y = F.y1;
      props.push(p);
      return p;
    }
    function propRemove(p, poof) {
      if (!p || p.dead) return;
      p.dead = true; p.live = false;
      if (poof) { var g = propGround(p); puff(g.x, g.y, false); }
      var i = props.indexOf(p);
      if (i >= 0) props.splice(i, 1);
    }
    // 道具现在落在地上的哪一点（被拿着的时候是拿着它的那个角色脚下）
    function propGround(p) { var h = p.holder; return h ? { x: h.who.x, y: h.who.y } : { x: p.x, y: p.y }; }
    // 一段戏结束：它放的道具收走（说了 keep 的除外，那些由导演管：到时间自己没）
    function dropProps(sc, cancelled) {
      for (var i = props.length - 1; i >= 0; i--) {
        var p = props[i];
        if (p.owner === sc) propRemove(p, cancelled);
        else if (p.holder && sc.actors.indexOf(p.holder.who) >= 0) PROP.drop(p);      // 留下来的道具还叼在嘴里：放到地上
      }
    }
    function clearProps(poof, onlyCare) {
      for (var i = props.length - 1; i >= 0; i--) if (!onlyCare || props[i].care) propRemove(props[i], poof);
    }
    function updateProps(dt) {
      for (var i = props.length - 1; i >= 0; i--) {
        var p = props[i];
        if (p.dead) { props.splice(i, 1); continue; }
        if (p.cap && now - p.born > p.cap) { propRemove(p, true); continue; }
        if (p.holder) { var w = p.holder.who; if (w.hidden) { p.holder = null; propRemove(p, false); continue; } }
        else if (p.vz || p.z > 0 || p.vx || p.vy) {       // 掉下来 / 滚一滚
          p.vz -= GRAV * dt; p.z += p.vz * dt;
          if (p.z <= 0) { p.z = 0; p.vz = Math.abs(p.vz) > 60 ? -p.vz * 0.35 : 0; p.vx *= 0.6; p.vy *= 0.6; }
          p.x = clamp(p.x + p.vx * dt, F.x0 + 2, F.x1 - 2); p.y = clamp(p.y + p.vy * dt, F.y0, F.y1);
          if (p.z === 0) { var k = Math.exp(-4 * dt); p.vx *= k; p.vy *= k; if (Math.abs(p.vx) + Math.abs(p.vy) < 2) p.vx = p.vy = 0; }
        }
        // 能点的道具：鼠标在上面停够了才"亮"（才进 hot），走开就灭
        if (p.hot && p.box && cur.known) {
          var inside = inBox(p.box, cur.x, cur.y, 0);
          if (inside && cur.speed < 30) p.hotT += dt; else if (!inside) p.hotT = 0;
          p.live = inside && p.hotT >= p.hot.dwell;
        } else { p.hotT = 0; p.live = false; }
      }
    }
    // 道具的图：种类_状态 → 种类 → 没有
    function propArt(p) {
      var n = p.spr || (p.state ? p.kind + '_' + p.state : p.kind);
      return sd(n) || (p.state ? sd(p.kind) : null);
    }
    // 图上"拿着的那一点"（fx.js 给 grip 就用它，像素；没给就是图的正中间），世界单位，相对图的左上角
    function gripOf(d) {
      var im = d.im, s = im.scale || 1, g = im.grip;
      if (g && g.length === 2) return [(g[0] + 0.5) / s, (g[1] + 0.5) / s];
      return [(d.l + d.r) / 2, (d.t + d.b) / 2];
    }
    function inProp(p, x, y, pad) { return !!(p && p.box && inBox(p.box, x, y, pad || 0)); }
    function propAt(x, y) {
      for (var i = props.length - 1; i >= 0; i--) { var p = props[i]; if (!p.dead && p.live && inProp(p, x, y, 1)) return p; }
      return null;
    }
    function propClicked(p, x, y) {
      if (p.click && DEFN[p.click]) { if (forcePlay(DEFN[p.click], { name: 'click', prop: p, kind: p.kind, x: x, y: y })) return; }
      raise('click', { prop: p, kind: p.kind, x: x, y: y, who: null });
    }
    // 地上有没有挡路的东西（便便之类，obstacle 半径）在 (x, y) 附近 r 以内
    function obstacleNear(x, y, r) {
      for (var i = 0; i < props.length; i++) { var p = props[i]; if (!p.dead && !p.holder && p.obstacle > 0 && hyp(p.x - x, p.y - y) < r + p.obstacle) return p; }
      return null;
    }
    // 走过去要停的地方：别停在她的鼠标底下（14 以内，SPEC"停在鼠标跟前"那一条），别停在挡路的东西旁边
    function avoid(x, y, a) {
      x = +x; y = +y;
      var half = a ? (a.isPerson ? P_HALF : a.half) : 6, i;
      for (i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.dead || p.holder || !(p.obstacle > 0)) continue;
        var r = p.obstacle + 14, dx = x - p.x, dy = (y - p.y) * 1.6, d = hyp(dx, dy);
        if (d < r) { var s = dx >= 0 ? 1 : -1; x = p.x + s * r; if (x < F.x0 + half + 2 || x > F.x1 - half - 2) x = p.x - s * r; }
      }
      if (cur.known && cur.still > 0.4 && a) {
        var h = a.isPerson ? P_H : 14, top = y - h - 14, bot = y + 14;
        if (cur.y > top && cur.y < bot && Math.abs(x - cur.x) < half + 14) {
          var s2 = (a.x >= cur.x) ? 1 : -1, nx = cur.x + s2 * (half + 15);
          if (nx < F.x0 + half + 2 || nx > F.x1 - half - 2) nx = cur.x - s2 * (half + 15);
          x = nx;
        }
      }
      return { x: clamp(x, F.x0 + half + 1, F.x1 - half - 1), y: clamp(y, F.y0, F.y1) };
    }
    // 她放下的角色正好落在挡路的东西上：往旁边挪一点
    function pushOut(a) {
      for (var i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.dead || p.holder || !(p.obstacle > 0)) continue;
        if (Math.abs(a.x - p.x) < p.obstacle + 2 && Math.abs(a.y - p.y) < p.obstacle) { var s = a.x >= p.x ? 1 : -1; a.x = clamp(p.x + s * (p.obstacle + 12), F.x0 + a.half + 1, F.x1 - a.half - 1); }
      }
    }
    // 剧本里用的：S.prop.spawn / set / move / carry / drop / remove / find / all / hot
    var PROP = {
      spawn: function (kind, state, x, y, o) {
        if (x && typeof x === 'object') { o = y; y = x.y; x = x.x; }
        return propSpawn(kind, state, x, y, o);
      },
      set: function (p, state) { if (p && !p.dead) p.state = state === undefined || state === null ? '' : String(state); },
      move: function (p, x, y, z) { if (!p || p.dead) return; if (x && typeof x === 'object') { z = x.z; y = x.y; x = x.x; } p.holder = null; p.x = clamp(+x, F.x0 + 2, F.x1 - 2); p.y = clamp(+y, F.y0, F.y1); p.z = +z || 0; p.vx = p.vy = p.vz = 0; },
      // 叼着 / 拿着：who 的 anchor（'hand' 'hand2' 'mouth' 'arms' 'back' 'head'……；不给：小人 hand、狗 mouth）
      carry: function (p, who, anchor) { if (p && !p.dead && who) { p.holder = { who: who, anchor: anchor || (who.isPerson ? 'hand' : 'mouth') }; p.vx = p.vy = p.vz = 0; p.live = false; } },
      // 放到地上：不给位置就放在拿着它的那一点正下方
      drop: function (p, x, y) {
        if (!p || p.dead) return;
        var h = p.holder;
        if (x === undefined && h) { var q = anchorOf(h.who, h.anchor); x = h.who.x + q[0]; y = h.who.y + ry(1); }
        else if (x && typeof x === 'object') { y = x.y; x = x.x; }
        p.holder = null;
        if (x !== undefined) { p.x = clamp(+x, F.x0 + 2, F.x1 - 2); p.y = clamp(+y, F.y0, F.y1); }
        p.z = 0; p.vz = 0;
      },
      // 扔出去 / 掉下来：给它一个速度（世界单位/秒），落地会弹一下、滚一点
      fling: function (p, vx, vy, vz) { if (!p || p.dead) return; if (p.holder) { var g = PROP.where(p); p.holder = null; p.x = g.x; p.y = g.y; p.z = g.z; } p.vx = +vx || 0; p.vy = +vy || 0; p.vz = +vz || 0; if (p.z <= 0) p.z = 0.01; },
      remove: function (p, poof) { propRemove(p, poof !== false); },
      // 这一个道具现在在哪：{ x, y（地上那一点）, z }
      where: function (p) { if (!p) return null; var h = p.holder; if (h) { var q = anchorOf(h.who, h.anchor); return { x: h.who.x + q[0], y: h.who.y, z: q[1] + h.who.z + h.who.lift }; } return { x: p.x, y: p.y, z: p.z }; },
      find: function (kind) { for (var i = 0; i < props.length; i++) if (!props[i].dead && props[i].kind === kind) return props[i]; return null; },
      all: function (kind) { return props.filter(function (p) { return !p.dead && (!kind || p.kind === kind); }); },
      // 让不让她点：false / null = 不让；true 或 { w, h, dwell } = 让（鼠标停在上面 dwell 秒以后才算数）
      hot: function (p, h) { if (p && !p.dead) { p.hot = hotOf(h); if (!p.hot) p.live = false; } },
      // 这段戏演完以后它还留着（导演管，到 cap 秒自己没）；keep(p, false) = 跟着这段戏一起收走
      keep: function (p, on) { if (p && !p.dead) p.owner = on === false ? CUR : null; },
      alive: function (p) { return !!p && !p.dead; },
    };

    // ------------------------------------------------------------
    //  草地上的小印子（decal）：外壳画在草地那一层（她的窗口后面）。草地关着的时候只画 overlay: true 的
    // ------------------------------------------------------------
    var decals = [], decalSerial = 0;
    function decalAdd(spr, x, y, o) {
      o = o || {};
      var d = { id: 'decal:' + (++decalSerial), spr: String(spr), x: +x, y: +y, overlay: !!o.overlay, until: o.days > 0 ? clk.ms + o.days * 86400000 : 0, flip: !!o.flip };
      decals.push(d);
      if (d.until) { world.decals.push({ spr: d.spr, x: d.x, y: d.y, overlay: d.overlay, until: d.until, flip: d.flip, id: d.id }); if (world.decals.length > 25) world.decals.shift(); worldDirty = true; }
      if (decals.length > 40) decals.shift();
      return d.id;
    }
    function decalRemove(id) {
      for (var i = decals.length - 1; i >= 0; i--) if (decals[i].id === id) decals.splice(i, 1);
      for (i = world.decals.length - 1; i >= 0; i--) if (world.decals[i].id === id) { world.decals.splice(i, 1); worldDirty = true; }
    }
    API.decal = function (spr, x, y, o) { if (x && typeof x === 'object') { o = y; y = x.y; x = x.x; } return decalAdd(spr, x, y, o); };
    API.decalRemove = decalRemove;

    // ------------------------------------------------------------
    //  球：剧本里用的。pocket 收进口袋（两只手都要用的时候；不画、不能抓）· home 回到他手里 ·
    //  give(狗) 叼在狗嘴里 · take() 从狗嘴里拿回他手里 · lay(x, y) 放在地上（她可以抓）· toss(去哪, 秒, 多高) 扔过去
    //  这段戏结束时球一定回到他手里（她正拖着、正在玩丢球的时候除外）
    // ------------------------------------------------------------
    function ballHome() {
      if (ball.st === 'drag' || ball.st === 'free' || ball.st === 'tug' || ball.st === 'handing' || (ball.st === 'mouth' && !ball.owner)) { ball.owner = null; return; }
      ball.st = 'hand'; ball.holder = null; ball.other = null; ball.vx = ball.vy = ball.vz = 0; ball.owner = null; ball.fly = null;
    }
    function ballMine() { return !!CUR && (ball.owner === CUR || ball.st === 'hand' || ball.st === 'pocket') && play.phase === 'rest'; }
    var BALL = {
      where: function () { return { st: ball.st, x: ball.x, y: ball.y, z: ball.z, holder: ball.holder }; },
      inHand: function () { return ball.st === 'hand'; },
      pocket: function () { if (!ballMine() || (ball.st !== 'hand' && ball.st !== 'pocket')) return false; ball.st = 'pocket'; ball.owner = CUR; return true; },
      home: function () { if (CUR && ball.owner === CUR) ballHome(); return ball.st === 'hand'; },
      give: function (d) { if (!ballMine() || !d || d.isPerson || !owns(d)) return false; ball.st = 'mouth'; ball.holder = d; ball.other = null; ball.owner = CUR; ball.fly = null; return true; },
      take: function () { if (!CUR || ball.owner !== CUR) return false; ballHome(); return true; },
      lay: function (x, y) {
        if (!ballMine()) return false;
        if (x && typeof x === 'object') { y = x.y; x = x.x; }
        ball.st = 'rest'; ball.holder = null; ball.owner = CUR; ball.fly = null;
        ball.x = clamp(+x, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = clamp(+y, F.y0, F.y1); ball.z = BALL_R; ball.vx = ball.vy = ball.vz = 0;
        return true;
      },
      // 扔过去：to = 角色（狗 = 嘴里，小人 = 手里）/ { x, y } 地上一点。返回"到了"
      toss: function (to, dur, peak) {
        if (!ballMine() || !to) return YES;
        var f = ball.st === 'hand' || ball.st === 'pocket' ? handNow() : (ball.st === 'mouth' && ball.holder ? pointOf(ball.holder) : { x: ball.x, y: ball.y, z: ball.z });
        ball.st = 'script'; ball.holder = null; ball.owner = CUR;
        var fl = ball.fly = { x0: f.x, y0: f.y, z0: Math.max(BALL_R, f.z), to: to, t: 0, dur: dur > 0 ? dur : 0.6, peak: peak === undefined ? 14 : peak };
        return function () { return ball.fly !== fl || fl.t >= fl.dur; };
      },
    };
    // 剧本扔的球：沿着弧线飞，到了就落进嘴里 / 手里 / 地上
    function updateBallFly(dt) {
      var fl = ball.fly;
      if (!fl || ball.st !== 'script') { ball.fly = null; return; }
      fl.t += dt;
      var k = clamp(fl.t / fl.dur, 0, 1), to = pointOf(fl.to) || { x: ball.x, y: ball.y, z: BALL_R };
      ball.x = fl.x0 + (to.x - fl.x0) * k; ball.y = fl.y0 + (to.y - fl.y0) * k;
      ball.z = Math.max(BALL_R, fl.z0 + ((to.z || BALL_R) - fl.z0) * k + Math.sin(Math.PI * k) * fl.peak);
      ball.rot += dt * 6;
      if (k >= 1) {
        ball.fly = null;
        if (fl.to === person) { ball.st = 'hand'; ball.holder = null; }
        else if (fl.to.K && !fl.to.hidden) { ball.st = 'mouth'; ball.holder = fl.to; }
        else { ball.st = 'rest'; ball.z = BALL_R; }
      }
    }

    // ------------------------------------------------------------
    //  狗狗自己的日常：闲下来就从登记过的 solo 里挑一个小动作（scenes/classic.js 里是最早那一套）；
    //  一个 solo 都没有登记（没装戏包）的时候，用下面引擎自己原来那一套
    // ------------------------------------------------------------
    function think(d) {
      d.pant = false; d.wag = 0.3; d.happy = 0; d.look = 0;
      if (sleepyTime()) { setPose(d, 'sleep', rand(20, 40)); return; }
      if (careThink(d)) return;                                         // 饭还没吃完：回碗边去
      if (d.kind === 'gold' && d.energy < 0.45) { setPose(d, 'lie', rand(8, 14)); d.pant = true; return; }
      if (SOLO[d.name].length) { if (!pickSolo(d)) setPose(d, 'stand', rand(1.2, 3)); return; }
      var r = Math.random();
      var idleFor = now - Math.max(lastTouch, play.lastPlay);
      if (d.kind === 'dax') {
        if (r < 0.20) walkTo(d, person.x + rand(-90, 90) * SK, person.y + ry(rand(-30, 30)), rand(26, 60) * SK);
        else if (r < 0.30) { var p = randPt(0); walkTo(d, p.x, p.y, spd(d, 'trot')); }
        else if (r < 0.38) { faceTo(d, person.x); setPose(d, 'bow', rand(1.4, 2.6)); d.wag = 1; }
        else if (r < 0.47) { faceTo(d, person.x); setPose(d, 'sit', rand(3, 6)); d.wag = 0.5; }
        else if (r < 0.54) {   // 满场疯跑
          d.st = 'zoom'; d.t = 0; d.pose = 'stand';
          var a = randPt(80 * SK, d), b = randPt(80 * SK, a);
          d.way = [a, b, a, { x: d.x, y: d.y }];
        }
        else if (r < 0.58) { d.st = 'spin'; d.t = 0; d.pose = 'stand'; d.wag = 0.9; }      // 追自己的尾巴
        else if (r < 0.65) { setPose(d, 'scratch', rand(1.6, 2.6)); }
        else if (r < 0.74) { p = randPt(0); walkTo(d, d.x + clamp(p.x - d.x, -60, 60), d.y + clamp(p.y - d.y, -40, 40), 14 * SK, 'sniff'); }
        else if (r < 0.80) { setPose(d, 'dig', rand(1.8, 2.8)); d.wag = 0.9; }
        else if (r < 0.85) { setPose(d, 'roll', rand(1.8, 3)); }
        else if (r < 0.93 && bfly.on) { d.st = 'bfly'; d.t = 0; d.pose = 'stand'; d.wag = 0.9; emote('bang', d, 0, 0.6); }
        else if (r < 0.96 && idleFor > 40) setPose(d, 'lie', rand(6, 14));
        else if (idleFor > 180 && r < 0.99) setPose(d, 'sleep', rand(25, 60));
        else setPose(d, 'stand', rand(1.2, 3));
      } else {
        if (d.energy < 0.45) { setPose(d, 'lie', rand(8, 14)); d.pant = true; return; }
        if (r < 0.18) { faceTo(d, person.x); setPose(d, 'sit', rand(5, 10)); d.wag = 0.5; }
        else if (r < 0.34) setPose(d, 'lie', rand(8, 18));
        else if (r < 0.52) walkTo(d, person.x + pick([-1, 1]) * rand(28, 60), person.y + ry(rand(-14, 14)), spd(d, 'walk') * 1.3);
        else if (r < 0.60) { p = randPt(0); walkTo(d, p.x, p.y, spd(d, 'walk') * 1.3); }
        else if (r < 0.66) setPose(d, 'scratch', rand(1.8, 2.8));
        else if (r < 0.75) { p = randPt(0); walkTo(d, d.x + clamp(p.x - d.x, -50, 50), d.y + clamp(p.y - d.y, -30, 30), 12 * SK, 'sniff'); }
        else if (r < 0.80) setPose(d, 'roll', rand(2, 3.2));
        else if (r < 0.86 && bfly.on) { d.look = 0.6; faceTo(d, bfly.x); setPose(d, 'sit', rand(3, 5)); d.wag = 0.6; }
        else if (idleFor > 120 && r < 0.95) setPose(d, 'sleep', rand(30, 80));
        else { setPose(d, 'stand', rand(2, 4)); d.wag = 0.5; }
      }
    }

    // 站在小人 / 另一只狗的正后方会被挡住（看起来像骑在人家头上）：返回挡住它的那个
    function blocker(d) {
      if (!person.hidden && !person.carried && Math.abs(d.x - person.x) < d.half * 0.7 + P_HALF - 1 && d.y <= person.y && d.y > person.y - (P_H - 1)) return person;
      var o = other(d);
      if (!o.hidden && !o.carried && (!o.scene || o.scene.kind === 'solo') && !o.att && o.z === 0 && Math.abs(d.x - o.x) < o.half * 0.75 &&
          (d.y < o.y || (d.y === o.y && d === dax)) && d.y > o.y - 13) return o;
      return null;
    }
    function sidestep(d, b) {
      var s = d.x >= b.x ? 1 : -1, gap = (b.isPerson ? P_HALF + 1 : b.half) + d.half + rand(6, 14);
      var tx = b.x + s * gap;
      if (tx < F.x0 + d.half + 4 || tx > F.x1 - d.half - 4) tx = b.x - s * gap;
      walkTo(d, tx, b.y + ry(rand(1, 7)), spd(d, 'trot'));
    }

    function grab(d) {
      var o = other(d);
      ball.vx = ball.vy = ball.vz = 0;
      haptic('light');
      // 另一只也到了嘴边 → 拔河
      if (o.st === 'chase' && hyp(o.x - d.x, o.y - d.y) < 30 && Math.random() < 0.6 && d.z < 2) {
        ball.st = 'tug'; ball.holder = d; ball.other = o; ball.tugEnd = now + rand(1.3, 2.1);
        ball.x = mouthX(d); ball.y = d.y; ball.z = BALL_R + 2;
        d.st = 'tug'; d.t = 0; d.pose = 'tug'; d.wag = 0.9;
        o.st = 'tugGo'; o.t = 0; o.pose = 'stand'; o.wag = 0.9;
        play.phase = 'back'; play.fetcher = d;
        emote('bang', o, 0, 0.6);
        return;
      }
      if (d.z > 3 && !person.scene && (person.st === 'idle' || person.st === 'follow')) { personAct({ f: ['p_cheer', 'p_cheer2'], fps: 6 }, 0.8); emote('spark', d); }
      if (d.z > 3) raise('catch', { who: d, z: d.z });
      carry(d);
    }
    function carry(d) {
      ball.st = 'mouth'; ball.holder = d; ball.other = null;
      play.phase = 'back'; play.fetcher = d;
      d.st = 'return'; d.t = 0; d.pose = 'stand'; d.wag = 0.9;
      if (d.kind === 'gold') d.energy = Math.max(0, d.energy - 0.2);
      dogs.forEach(function (o) {
        if (o !== d && (o.st === 'chase' || o.st === 'alert' || o.st === 'tug' || o.st === 'tugGo')) { o.st = 'follow'; o.t = 0; o.pose = 'stand'; }
      });
      if (person.st === 'walk') personIdle();
    }
    // 球刚被丢出去：醒着的狗都去追
    function onBallFree() {
      ball.freeT = 0; ball.owner = null; ball.fly = null;
      endScene(false, 'ball');
      dogs.forEach(function (d) {
        if (!awake(d) || d.hidden || d.carried) return;
        if (d.kind === 'gold' && d.energy < 0.3) {   // 金毛累了，趴着看
          if (!(d.st === 'pose' && d.pose === 'lie')) setPose(d, 'lie', 12);
          d.pant = true; d.wag = 0.6;
          return;
        }
        d.st = 'alert'; d.t = 0; d.pose = 'alert'; d.wag = 0.9; d.pant = false; d.happy = 0;
        d.react = d.kind === 'dax' ? rand(0.04, 0.16) : rand(0.22, 0.5);
      });
      if (awake(dax) && !dax.hidden) emote('bang', dax, 0, 0.7);
    }
    function landing() {
      var disc = ball.vz * ball.vz + 2 * GRAV * Math.max(0, ball.z - BALL_R);
      var t = (ball.vz + Math.sqrt(disc)) / GRAV;
      return { x: clamp(ball.x + ball.vx * t * 1.12, F.x0 + BALL_R + 2, F.x1 - BALL_R - 2), y: clamp(ball.y + ball.vy * t * 1.12, F.y0, F.y1) };
    }

    function updateDog(d, dt) {
      var K = d.K;
      d.t += dt;
      if (d.hype > 0) { d.hype -= dt; if (d.hype <= 0) { d.happy = 0; } }
      if (d.bark > 0) d.bark -= dt;
      if (d.land > 0) d.land = Math.max(0, d.land - dt * 4);
      // 跳
      if (d.z > 0) {
        d.vz -= GRAV * 1.5 * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; d.vz = 0; d.land = 1; if (!d.hidden) puff(d.x, d.y, false); }
      }
      // 金毛体力
      if (d.kind === 'gold' && d.st !== 'chase') {
        d.energy = Math.min(1, d.energy + dt * (d.pose === 'lie' || d.pose === 'sleep' ? 0.03 : 0.012));
      }
      if (d.hidden) { d.vx = d.vy = 0; d.sp = 0; d.pose = 'sleep'; return; }

      if (d.carried) {
        d.vx = d.vy = 0;
      } else if (d.att) {
        d.vx = d.vy = 0;                    // 安在别人身上：位置由 placeAttached 管
        if (d.pose === 'sleep' && now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * 8, 1.8); d.zAt = now + 1.7; }
      } else if (d.scene) {
        var c = d.cmd;
        if (c && c.k === 'go') { d.pose = c.pose; if (drive(d, c.x, c.y, c.spd, dt)) c.done = true; }
        else if (c && c.k === 'follow') {
          d.pose = c.pose || 'stand';
          drive(d, c.target.x - (c.target.face || 0) * c.back, c.target.y + c.dy, c.spd, dt);
        }
        else if (c && c.k === 'track') { var tp = trackPt(d, c); d.pose = c.pose || 'stand'; if (tp) drive(d, tp.x, tp.y, c.spd, dt); else coast(d, dt); }
        else coast(d, dt);
        if (d.pose === 'sleep' && now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * 8, 1.8); d.zAt = now + 1.7; }
        if (d.pose === 'dig' && Math.random() < dt * 14) bits(d.x + d.face * 10, d.y - 1, 1, ['#8a6a4a', '#6f5238', '#a98a62'], 26, 60);
        if (d.pose === 'roll' && opt.grass && Math.random() < dt * 6) bits(d.x + rand(-8, 8), d.y - 2, 1, grassBits(), 18, 40);
        // 自己找事做的时候：站到小人 / 另一只狗的正后方被挡住了，就先不演了，挪到旁边去
        if (d.scene && d.scene.kind === 'solo' && !d.cmd && d.pose !== 'sleep' && d.t > 0.5 && d.z === 0 && now > d.sideAt && now >= d.scene.commitTo) {
          var blk0 = blocker(d);
          if (blk0) { d.sideAt = now + 2.5; endScript(d.scene, true, 'blocked'); sidestep(d, blk0); }
        }
      } else switch (d.st) {
        case 'idle':
          coast(d, dt);
          think(d);
          break;

        case 'pose':
          coast(d, dt);
          if (d.pose === 'sleep') {
            if (now > d.zAt) { emote(Math.random() < 0.5 ? 'z' : 'zs', d, d.face * 8, 1.8); d.zAt = now + 1.7; }
            if (d.t > d.dur) { if (sleepyTime()) d.t = 0; else think(d); }
          } else {
            if (d.pose === 'dig' && Math.random() < dt * 14) bits(d.x + d.face * 10, d.y - 1, 1, ['#8a6a4a', '#6f5238', '#a98a62'], 26, 60);
            if (d.pose === 'roll' && opt.grass && Math.random() < dt * 6) bits(d.x + rand(-8, 8), d.y - 2, 1, grassBits(), 18, 40);
            var blk = (d.t > 0.5 && d.z === 0 && now > d.sideAt) ? blocker(d) : null;
            if (blk) { d.sideAt = now + 2.5; sidestep(d, blk); break; }
            if (d.t > d.dur) think(d);
          }
          break;

        case 'walk':
          if (drive(d, d.tx, d.ty, d.spd, dt) || d.t > 14) think(d);
          break;

        case 'zoom':
          d.pant = true;
          if (!d.way || !d.way.length || d.t > 12) { think(d); break; }
          if (drive(d, d.way[0].x, d.way[0].y, spd(d, 'run'), dt)) d.way.shift();
          break;

        case 'spin':
          coast(d, dt);
          d.face = (Math.floor(d.t * 9) % 2) ? 1 : -1;
          if (d.t > 1.3) { setPose(d, 'sit', rand(1.5, 3)); d.wag = 0.8; emote('q', d, 0, 0.8); }
          break;

        case 'bfly': {   // 追蝴蝶
          if (!bfly.on || d.t > 9) { setPose(d, 'sit', rand(1.5, 3)); d.pant = true; break; }
          var by = opt.roam ? clamp(bfly.y + 16, F.y0, F.y1) : d.y;
          drive(d, bfly.x - sgn(bfly.x - d.x) * 6, by, spd(d, 'run') * 0.8, dt);
          d.look = 0.8;
          if (hyp(bfly.x - d.x, (bfly.y + 16) - d.y) < 20 && d.z === 0 && now > d.hopAt) {
            hop(d, 150); d.hopAt = now + rand(0.7, 1.2); d.bark = 0.25;
            bfly.vx += sgn(bfly.x - d.x || 1) * 50; bfly.vy -= 40; bfly.tx = rand(F.x0 + 20, F.x1 - 20); bfly.ty = rand(Math.max(12, F.y0 - 40), F.y1 - 30);
          }
          break;
        }

        case 'alert':
          coast(d, dt);
          faceTo(d, ball.x);
          d.look = clamp(ball.z / 40, 0, 1);
          if (d.t >= d.react) { d.st = 'chase'; d.t = 0; d.pose = 'stand'; }
          break;

        case 'chase': {
          if (ball.st !== 'free') { d.st = (ball.st === 'mouth' || ball.st === 'tug') ? 'follow' : 'wait'; d.t = 0; break; }
          var tgt = ball.z > 14 ? landing() : { x: ball.x + ball.vx * 0.12, y: ball.y + ball.vy * 0.12 };
          var dir = tgt.x > d.x + 0.5 ? 1 : (tgt.x < d.x - 0.5 ? -1 : d.face);
          var there = drive(d, tgt.x - dir * (d.mx - 2), tgt.y, spd(d, 'run'), dt);
          // 从正上方 / 正下方跑过来时身体不会自己转向：到了球边上要把头转向球，不然永远叼不到
          if (there || hyp(d.vx, d.vy) < 24 * SK) { if (Math.abs(ball.x - d.x) > 1) d.face = ball.x > d.x ? 1 : -1; }
          d.stall = (there && ball.z <= BALL_R + 1) ? (d.stall || 0) + dt : 0;
          if (d.stall > 0.5 && hyp(d.x - ball.x, d.y - ball.y) < d.mx + 14) { d.stall = 0; grab(d); break; }
          d.look = clamp(ball.z / 36, 0, 1); d.pant = true;
          // 小腊肠会跳起来接
          if (d.kind === 'dax' && d.z === 0 && ball.vz < 0 && ball.z > 12 && ball.z < 30 && hyp(mouthX(d) - ball.x, d.y - ball.y) < 18) hop(d, 165);
          if (hyp(mouthX(d) - ball.x, d.y - ball.y) < K.grab && ball.z <= d.z + K.reach) grab(d);
          break;
        }

        case 'tugGo': {   // 跑到球的另一边去抢
          var h = ball.holder;
          if (ball.st !== 'tug' || !h) { d.st = 'follow'; d.t = 0; break; }
          var gx = ball.x + h.face * (d.mx - 1);
          if (drive(d, gx, h.y, spd(d, 'run'), dt) || d.t > 0.9) { d.x = clamp(gx, F.x0 + d.half, F.x1 - d.half); d.y = h.y; d.vx = d.vy = 0; d.face = -h.face; d.st = 'tug'; d.pose = 'tug'; d.t = 0; }
          break;
        }
        case 'tug':
          d.vx = d.vy = 0;
          if (ball.st !== 'tug') { d.st = 'wait'; d.t = 0; d.pose = 'stand'; break; }
          if (now >= ball.tugEnd && ball.holder === d) {
            var o = ball.other, win = (o && o.st === 'tug' && Math.random() < 0.4) ? o : d, lose = win === d ? o : d;
            if (lose) { emote('sweat', lose, 0, 0.8); }
            emote('spark', win, win.face * 10, 0.6);
            carry(win);
          }
          break;

        case 'return': {
          if (ball.st !== 'mouth' || ball.holder !== d) { d.st = 'wait'; d.t = 0; break; }
          var side = sgn(d.x - person.x);
          if (drive(d, person.x + side * (d.mx + pr(9)), person.y + ry(1), spd(d, 'back'), dt) || d.t > 12) { d.face = -side; handover(d); }
          break;
        }

        case 'follow': {
          var f = play.fetcher;
          if (!f || (ball.st !== 'mouth' && ball.st !== 'tug')) { d.st = 'wait'; d.t = 0; break; }
          drive(d, f.x - f.face * (f.half + d.half * 0.6), f.y + ry(d === dax ? 5 : -4), d.kind === 'dax' ? spd(d, 'run') : spd(d, 'trot') * 1.5, dt);
          if (d.kind === 'dax' && d.z === 0 && Math.random() < dt * 1.6) hop(d, 105);
          break;
        }

        case 'fooled': {  // 被假动作骗了
          if (d.t < 0.55) drive(d, d.tx, d.ty, spd(d, 'run'), dt);
          else { coast(d, dt); if (!d.qd) { d.qd = true; emote('q', d, 0, 1.0); faceTo(d, person.x); d.pose = 'sit'; } }
          if (d.t > 1.7) { d.qd = false; d.st = 'wait'; d.t = 0; d.pose = 'stand'; }
          break;
        }

        case 'wait': {   // 围在小人旁边等他丢
          if (play.phase === 'rest' && d.t > 2.2) { think(d); break; }
          var sd2 = d === dax ? person.face : -person.face;
          if (drive(d, person.x + sd2 * (d === dax ? 30 : 42), person.y + ry(d === dax ? 5 : -3), spd(d, 'trot') * 1.4, dt)) {
            faceTo(d, person.x);
            d.pose = d.kind === 'dax' ? ((Math.floor(d.t * 0.7) % 2) ? 'bow' : 'stand') : ((Math.floor(d.t * 0.4) % 3 === 2) ? 'bow' : 'sit');
            if (d.kind === 'dax' && Math.random() < dt * 0.9) hop(d, 95);
            d.look = 0.5;
          } else d.pose = 'stand';
          d.wag = 1;
          break;
        }

        case 'beg': {   // 球被她拿在手里晃
          if (ball.st !== 'drag') { d.st = 'wait'; d.t = 0; break; }
          if (hyp(ball.x - d.x, ball.y - d.y) > d.mx + 8) drive(d, ball.x - sgn(ball.x - d.x) * (d.mx - 4), ball.y, spd(d, 'run') * 0.9, dt);
          else { coast(d, dt); faceTo(d, ball.x); }
          d.pose = 'stand'; d.wag = 1; d.look = clamp((ball.z + (d.y - ball.y)) / 30, 0, 1);
          if (d.z === 0 && now > d.hopAt && hyp(ball.x - d.x, ball.y - d.y) < 36 && d.kind === 'dax') {
            hop(d, rand(120, 170)); d.hopAt = now + rand(0.5, 1.3);
          }
          break;
        }

        case 'come': {  // 被叫过去
          if (drive(d, d.tx, d.ty, spd(d, d.kind === 'dax' ? 'run' : 'trot') * (d.kind === 'dax' ? 0.9 : 1.6), dt) || d.t > 6) { setPose(d, 'sit', rand(2, 4)); d.wag = 1; emote('heart', d); }
          break;
        }

        case 'home': {  // 回岛
          var ip = islandPt(), tx = ip.x + (d === dax ? 14 : -18);
          if (d.t < d.react) { coast(d, dt); break; }
          if (!d.hq && (drive(d, tx, ip.y, spd(d, 'run') * 0.9, dt) || d.t > 9)) { d.hq = true; d.vx = d.vy = 0; hop(d, 190); d.t = 0; }
          else if (d.hq && (d.t > 0.22)) { d.hq = false; d.hidden = true; d.z = 0; d.vz = 0; puff(d.x, d.y - 20, true); emoteAt('spark', d.x, d.y - 30, 0.5); }
          break;
        }
      }

      // 鼠标靠近：看过来、摇尾巴；小腊肠会蹦一下
      d.near = false;
      var sc0 = d.scene;
      if (pointer.inside && !pointer.drag && !pointer.grab && !d.carried && awake(d) && d.pose !== 'lie' && d.pose !== 'roll' &&
          (sc0 ? (sc0.kind === 'solo' && sc0.def.aware && !d.cmd && !d.att && now >= sc0.commitTo) : (d.st === 'pose' || d.st === 'idle'))) {
        var px = pointer.x, near = hyp(px - d.x, (pointer.y - (d.y - 12)) * 1.2) < 46;
        d.near = near;
        if (near) {
          faceTo(d, px); d.wag = Math.max(d.wag, 0.8); d.look = clamp((d.y - 14 - pointer.y) / 30, -0.6, 1);
          if (d.kind === 'dax' && d.z === 0 && now > d.hopAt && Math.abs(px - d.x) < 24) { hop(d, 110); d.hopAt = now + rand(1.4, 3); }
        }
      }

      d.sp = (d.st === 'tug' || d.att) ? 0 : hyp(d.vx, d.vy);
      // 路上有挡路的小东西（便便之类）：离它 10 个单位的时候轻轻跳过去
      if (d.sp > 8 && d.z === 0 && !d.att && props.length) {
        for (var k2 = 0; k2 < props.length; k2++) {
          var ob = props[k2];
          if (ob.dead || ob.holder || !(ob.obstacle > 0)) continue;
          var ax = ob.x - (d.x + d.face * d.half * 0.5), ay = ob.y - d.y;
          if (Math.abs(ay) < 8 && ax * sgn(d.vx || d.face) > 0 && Math.abs(ax) < 10 + d.sp * 0.05 && now > d.hopAt) { hop(d, 80); d.hopAt = now + 0.6; break; }
        }
      }
      // 跑起来脚下扬起的灰
      if (d.z === 0 && d.sp > 95 * SK && now > d.dustAt) { puff(d.x - d.face * d.half * 0.6, d.y, false); d.dustAt = now + 0.13; }
      if (d.lastSp - d.sp > 70 * SK && d.z === 0) puff(d.x + d.face * 6, d.y, true);     // 急刹车
      d.lastSp = d.sp;
    }

    // ------------------------------------------------------------
    //  眼神：每个角色看哪儿。剧本说了就听剧本的（S.look）；没说就引擎自己挑：
    //  球在飞 / 在她手里 → 球；在戏里 → 一起演的那一个；她的鼠标停在旁边 → 鼠标；隔一阵 → 看看她（camera）
    //  目标换了不会一下子跳过去：眼神朝新目标慢慢转（每秒追上大约八成）
    // ------------------------------------------------------------
    var lookTmp = { x: 0, y: 0 };
    // 一个目标（角色 / 道具 / 'ball' / 'cursor' / 'camera' / { x, y, z }）在屏幕上的哪一点；不知道就是 null
    function lookPt(a, t) {
      if (!t) return null;
      if (t === 'ball') { lookTmp.x = ball.x; lookTmp.y = ball.y - ball.z; return lookTmp; }
      if (t === 'cursor') { if (!cur.known) return null; lookTmp.x = cur.x; lookTmp.y = cur.y; return lookTmp; }
      if (t === 'camera') { lookTmp.x = a.x + a.face * 0.01; lookTmp.y = a.y - a.z - (a.isPerson ? P_H * 0.8 : 14) - 0.01; lookTmp.cam = true; return lookTmp; }
      if (t.isProp) { var w = PROP.where(t); lookTmp.x = w.x; lookTmp.y = w.y - w.z - 2; return lookTmp; }
      if (t === person) { lookTmp.x = t.x; lookTmp.y = t.y - t.z - P_H * 0.8; return lookTmp; }
      if (t.K) { lookTmp.x = t.x + t.face * (t.mx || 10) * 0.7; lookTmp.y = (t.top || t.y - 12) + 4; return lookTmp; }
      if (isFinite(t.x) && isFinite(t.y)) { lookTmp.x = +t.x; lookTmp.y = +t.y - (+t.z || 0); return lookTmp; }
      return null;
    }
    function defaultLook(a) {
      var sc = a.scene;
      if (sc && sc.kind !== 'solo') {        // 在戏里：看一起演的那一个（离得最近的）
        var best = null, bd = 1e9;
        for (var i = 0; i < sc.actors.length; i++) { var o = sc.actors[i]; if (o === a || o.hidden) continue; var d = hyp(o.x - a.x, o.y - a.y); if (d < bd) { bd = d; best = o; } }
        if (best && bd < 160) return best;
      }
      if (cur.known && !pointer.drag && cur.still > 0.4 && hyp(cur.x - a.x, cur.y - (a.y - 14)) < 70) return 'cursor';
      if (!a.isPerson) return null;
      if (a.camUntil > now) return 'camera';
      if (now > a.camAt && !a.moving) { a.camUntil = now + rand(1, 2); a.camAt = now + rand(8, 18); }
      return null;
    }
    // 把目标点变成骨架要的 [往旁边多远, 多高]（相对脚下），朝着上一回的值慢慢转过去
    function smoothLook(a, pt, dt) {
      if (!pt) { a.lk = null; return null; }
      var tx = pt.x - a.x, ty = a.y - pt.y;
      if (pt.cam) { tx = 0; ty = a.isPerson ? P_H * 0.8 : 14; pt.cam = false; }
      var L = a.lk;
      if (!L || dt <= 0) { L = a.lk = [tx, ty]; return L; }
      var k = 1 - Math.exp(-dt * 8);
      L[0] += (tx - L[0]) * k; L[1] += (ty - L[1]) * k;
      return L;
    }
    // 剧本 / 小反应写给骨架的东西：先看搭在身上的小反应那一层，再看自己
    function layerOf(a, k) { var o = a.ov && a.o; return o && o[k] !== undefined && o[k] !== null ? o[k] : a[k]; }
    function giveExtra(a, I) {
      var keys = a.rkeys, k;
      if (keys) for (k in keys) I[k] = undefined;
      var r1 = a.rx, r2 = a.ov && a.o ? a.o.rx : null;
      if (!r1 && !r2) { a.rkeys = null; return; }
      keys = a.rkeys = {};
      if (r1) for (k in r1) { I[k] = r1[k]; keys[k] = 1; }
      if (r2) for (k in r2) { I[k] = r2[k]; keys[k] = 1; }
    }
    function giveAct(a, I) {
      if (a.ractRestart) { I.act = null; a.ractRestart = false; return; }
      I.act = a.ract && !a.ractDone ? a.ract : null;
    }

    // 告诉狗的骨架"现在是什么状态"（每一步都要给，骨架自己会平滑过渡）
    function rigInput(d, dt) {
      var I = d.ri, pose = d.pose === 'sniffwalk' ? 'sniff' : d.pose;
      I.pose = d.carried ? 'air' : pose;
      I.speed = d.sp;
      I.air = (d.z > 1.5 || d.carried) ? 1 : 0;
      I.wag = d.carried ? 0.1 : d.wag;
      I.pant = d.pant || d.sp > 110 * SK;
      I.carry = (ball.st === 'mouth' || ball.st === 'tug') && ball.holder === d;
      I.look = d.look;
      I.happy = d.happy > 0;
      I.shake = d.st === 'tug' ? 1 : 0;
      I.bark = d.bark > 0;
      // 第三版新加的几样（旧的画法用不到）
      I.vx = d.vx; I.vy = d.vy; I.vz = d.z > 0 ? d.vz : 0;
      I.accel = dt > 0 ? (d.sp - d.rSp) / dt : 0;
      I.landing = d.land;
      I.turn = d.face !== d.rFace;
      I.sleepy = sleepyTime() ? 1 : clamp((now - Math.max(lastTouch, play.lastPlay) - 40) / 140, 0, 0.7);
      // 心情：剧本说了就听剧本的；不然 刚被摸 → happy，犯困 → sleepy
      var md = layerOf(d, 'mood');
      I.mood = md || (d.happy > 0 ? 'happy' : (I.sleepy > 0.6 && d.st !== 'chase' ? 'sleepy' : null));
      // 眼睛盯着什么：剧本说的；球、蝴蝶、凑过来的鼠标；戏里一起演的那个；偶尔看看她
      var t = layerOf(d, 'lookT'), pt = null;
      if (d.hidden) pt = null;
      else if (t) pt = lookPt(d, t);
      else if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'script' || d.st === 'wait' || d.st === 'beg') pt = lookPt(d, 'ball');
      else if (bfly.on && (d.st === 'bfly' || (d.st === 'pose' && d.look > 0.5))) { lookTmp.x = bfly.x; lookTmp.y = bfly.y; pt = lookTmp; }
      else if (d.near) pt = lookPt(d, 'cursor');
      else if (d.st !== 'chase' && d.st !== 'return' && d.st !== 'zoom' && d.pose !== 'sleep') pt = lookPt(d, defaultLook(d));
      I.lookAt = smoothLook(d, pt, dt);
      d.la = I.lookAt;
      giveAct(d, I);
      giveExtra(d, I);
      d.rSp = d.sp; d.rFace = d.face;
      if (Math.abs(d.look - d.rLook) > 0.02) { d.rLook = d.look; d.vis.hot = now + 0.5; }     // 头在转：这阵子画勤一点
      return I;
    }

    // ------------------------------------------------------------
    //  小人
    // ------------------------------------------------------------
    function personIdle() { person.st = 'idle'; person.t = 0; person.act = null; }
    function personFront(dur) { person.st = 'front'; person.t = 0; person.dur = dur; }
    function personAct(spr, dur) { person.st = 'act'; person.t = 0; person.dur = dur; person.act = spr; }
    function personWave(text) {
      person.st = 'wave'; person.t = 0; person.waveCd = now + 25;
      if (text) say(text);
    }
    // 小人闲着：隔一阵挑一个自己的小动作（solo：走两步、转过来、整理领带、看手表……都在 scenes/ 里）；也有时候就只是站着。
    // 一个 solo 都没登记的时候用下面原来那一套
    function personThink() {
      var r = Math.random();
      person.next = now + rand(5, 11) / LIVELY;
      if (CFG.messages && CFG.messages.length && now >= person.msgAt) {
        person.msgAt = now + range(CFG.messageMinutes, 40) * 60;
        personWave(String(pick(CFG.messages)));
        return;
      }
      if (SOLO.person.length) { if (r >= 0.44) pickSolo(person); return; }
      if (r < 0.20) {
        var p = randPt(30 * SK, person);
        person.st = 'walk'; person.t = 0;
        person.tx = clamp(person.x + clamp(p.x - person.x, -110 * SK, 110 * SK), F.x0 + (F.x1 - F.x0) * 0.12, F.x0 + (F.x1 - F.x0) * 0.88);
        person.ty = clamp(person.y + clamp(p.y - person.y, -60, 60), F.y0, F.y1);
      }
      else if (r < 0.32) personFront(rand(2.2, 4));
      else if (r < 0.42) personAct({ f: ['p_tie_a', 'p_tie_b'], fps: 3 }, 1.7);      // 整理领带
      else if (r < 0.50) personAct('p_watch', 1.5);                                   // 看手表
      else if (r < 0.56) personAct({ f: ['p_cheer', 'p_cheer2'], fps: 2 }, 1.2);     // 伸个懒腰
    }
    function throwDir() { return person.x < (F.x0 + F.x1) / 2 ? 1 : -1; }

    function startSession(n, target) {
      endScene(false, 'fetch');
      if (ball.st === 'pocket') ballHome();
      play.rounds = n; play.phase = 'ready'; play.throwAt = now + rand(0.9, 1.6); play.faked = false; play.target = target || null;
      if (person.st !== 'idle') personIdle();
      person.face = target ? sgn(target.x - person.x) : throwDir();
      wake(dax, true);
      if (gold.energy > 0.3) wake(gold, true);
      dogs.forEach(function (d) {
        if (!awake(d) || d.hidden || d.carried) return;
        if (d.kind === 'gold' && d.energy < 0.3) return;
        d.st = 'wait'; d.t = 0; d.pose = 'stand';
      });
    }
    function personThrow() {
      // 偶尔做个假动作逗小腊肠
      if (!play.faked && !play.target && Math.random() < 0.16 && awake(dax) && !dax.hidden && dax.st === 'wait') {
        play.faked = true;
        person.st = 'fake'; person.t = 0; person.face = throwDir();
        return;
      }
      person.st = 'windup'; person.t = 0;
      person.face = play.target ? sgn(play.target.x - person.x) : throwDir();
    }
    function doLaunch() {
      var dir = person.face, h = handPos('p_release', dir);
      var tx, ty;
      if (play.target) { tx = play.target.x; ty = play.target.y; play.target = null; }
      else if (opt.roam) {
        var best = null;
        for (var i = 0; i < 10; i++) {
          var p = randPt(0), dd = hyp(p.x - person.x, p.y - person.y);
          if (sgn(p.x - person.x) === dir && dd > 50 * SK && dd < 230 * SK) { best = p; break; }
        }
        if (!best) best = { x: clamp(person.x + dir * 90 * SK, F.x0 + 20, F.x1 - 20), y: clamp(person.y + rand(-30, 30), F.y0, F.y1) };
        tx = best.x; ty = best.y;
      } else {
        var room = (dir > 0 ? F.x1 - person.x : person.x - F.x0) - 24;
        tx = person.x + dir * Math.max(40, room * rand(0.32, 0.74)); ty = person.y;
      }
      var dist = hyp(tx - h.x, ty - person.y);
      var tMax = Math.sqrt(8 * Math.max(30, Math.min(LH - 34, 120)) / GRAV);
      var T = clamp(dist / (170 * SK) + rand(0.35, 0.55), 0.55, tMax);
      ball.st = 'free'; ball.holder = null;
      ball.x = clamp(h.x, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = person.y; ball.z = h.z;
      ball.vx = (tx - ball.x) / T / 1.12; ball.vy = (ty - ball.y) / T / 1.12;
      ball.vz = GRAV * T / 2 - (ball.z - BALL_R) / T;
      play.phase = 'fly'; play.rounds = Math.max(0, play.rounds - 1);
      play.lastPlay = now;
      haptic('light');
      onBallFree();
    }
    // 狗把球叼回来了
    function handover(d) {
      person.face = sgn(d.x - person.x);
      person.st = 'pat'; person.t = 0; person.giveTo = d;
      person.patSpr = (d.kind === 'dax' && Math.random() < 0.55) ? { f: ['p_crouch', 'p_crouch2'], fps: 6 } : 'p_pat';
      d.st = 'wait'; d.t = 0; d.pose = 'sit'; d.wag = 1; d.happy = 1; d.hype = 1.2;
      emote('heart', d, d.face * 6);
      ball.st = 'handing'; ball.holder = null;
      ball.x = mouthX(d); ball.y = d.y; ball.z = BALL_R;
      play.lastPlay = now;
      bump('fetch');
      if (play.rounds > 0 && !sleepyTime()) { play.phase = 'ready'; play.throwAt = now + rand(1.5, 2.9); }
      else { play.phase = 'rest'; play.nextAt = now + range(CFG.autoPlaySeconds, 60); person.next = now + rand(3, 6); nextSceneAt = Math.max(nextSceneAt, now + rand(4, 8)); }
    }

    function movePerson(tx, ty, speed, dt) {
      var p = person;
      if (PY0 > F.y0 && ty < PY0) ty = PY0;
      var dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      if (d < 1.4) { p.moving = false; return true; }
      var st = Math.min(d, speed * SK * dt);
      p.x = clamp(p.x + dx / d * st, F.x0 + P_HALF + 1, F.x1 - P_HALF - 1); p.y = clamp(p.y + dy / d * st * (Math.abs(dy) > Math.abs(dx) ? 0.85 : 1), PY0, F.y1);
      if (Math.abs(dx) > 1.5) p.face = sgn(dx);
      p.anim += dt * (speed > 40 ? 9 : 6.5);
      p.moving = true; p.spd = speed;
      return false;
    }
    function updatePerson(dt) {
      var p = person;
      p.t += dt;
      p.moving = false;
      if (p.z > 0) { p.vz -= GRAV * 1.5 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; puff(p.x, p.y, false); } }
      if (ball.st === 'handing' && (p.st !== 'pat' || p.hidden || p.carried)) { ball.st = 'hand'; ball.holder = null; p.giveTo = null; }
      if (p.hidden || p.carried) return;
      if (p.att) return;                      // 安在别人身上（位置由 placeAttached 管）
      if (p.scene) {
        var c = p.cmd;
        if (c && c.k === 'go') { if (movePerson(c.x, c.y, c.spd, dt)) c.done = true; }
        else if (c && c.k === 'follow') movePerson(c.target.x - (c.target.face || 0) * c.back, c.target.y + c.dy, c.spd, dt);
        else if (c && c.k === 'track') { var tp = trackPt(p, c); if (tp) movePerson(tp.x, tp.y, c.spd, dt); }
        if (p.scene.kind === 'solo') hoverWave(p, dt);
        return;
      }
      switch (p.st) {
        case 'idle':
          if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'mouth' || ball.st === 'tug') {
            var bx = (ball.st === 'mouth' || ball.st === 'tug') && ball.holder ? ball.holder.x : ball.x;
            if (Math.abs(bx - p.x) > 6) p.face = bx > p.x ? 1 : -1;
          }
          if (sleepyTime() && play.phase === 'rest' && home.st === 'out') {
            // 夜深了：有岛就回岛里睡（天亮自己出来）；没有岛就原地睡
            if (islandOn() && opt.roam) { home.auto = true; home.inAt = now; goHome(); } else { p.st = 'sleep'; p.t = 0; }
            break;
          }
          if (play.phase === 'rest' && now >= p.next) personThink();
          break;
        case 'walk':
          if (play.phase !== 'rest') { personIdle(); break; }
          if (movePerson(p.tx, p.ty, 24, dt) || p.t > 12) personIdle();
          break;
        case 'windup':
          if (p.t >= 0.4) { p.st = 'release'; p.t = 0; doLaunch(); }
          break;
        case 'release':
          if (p.t >= 0.15) { p.st = 'follow'; p.t = 0; }
          break;
        case 'follow':
          if (p.t >= 0.34) personIdle();
          break;
        case 'fake':     // 假动作：挥了手，球还在手里
          if (p.t >= 0.4 && !p.fk) {
            p.fk = true;
            if (awake(dax) && !dax.hidden && !dax.carried) {
              dax.st = 'fooled'; dax.t = 0; dax.pose = 'stand'; dax.qd = false;
              dax.tx = dax.x + p.face * 70 * SK; dax.ty = dax.y;
            }
          }
          if (p.t >= 1.9) { p.fk = false; personAct({ f: ['p_cheer', 'p_cheer2'], fps: 7 }, 0.7); play.throwAt = now + 1.3; }
          break;
        case 'pat':
          if (p.t >= 0.85) {
            if (ball.st === 'handing') { ball.st = 'hand'; ball.holder = null; }
            p.giveTo = null;
            personIdle();
            if (play.phase === 'ready') p.face = throwDir();
          }
          break;
        case 'act':
          if (p.t >= p.dur) personIdle();
          break;
        case 'front':
          if (p.t >= p.dur || play.phase !== 'rest') personIdle();
          break;
        case 'wave':
          if (p.t >= 2.0) { if (play.phase === 'rest') personFront(1.2); else personIdle(); }
          break;
        case 'sleep':
          if (now > p.zAt) { emote('z', p, 6, 1.8); p.zAt = now + 2.1; }
          if (!sleepyTime()) personIdle();
          break;
        case 'come':
          if (movePerson(p.tx, p.ty, 46, dt) || p.t > 8) personWave();
          break;
        case 'home': {
          var ip = islandPt();
          if (p.t < 0.1) break;
          if (!p.hq && (movePerson(ip.x, ip.y, 62, dt) || p.t > 12)) { p.hq = true; p.vz = 190; p.z = 0.01; p.t = 0; }
          else if (p.hq && p.t > 0.22) { p.hq = false; p.hidden = true; p.z = 0; p.vz = 0; puff(p.x, p.y - 20, true); emoteAt('spark', p.x, p.y - 30, 0.5); }
          break;
        }
      }
      hoverWave(p, dt);
    }
    // 鼠标停在他身上一会儿：转过来挥挥手（他正在做自己的小动作也一样，先放下）
    function hoverWave(p, dt) {
      if (pointer.inside && !pointer.drag && !pointer.grab && p.box && (p.st === 'idle' || p.st === 'front') && play.phase === 'rest') {
        var over = pointer.x > p.box[0] - 3 && pointer.x < p.box[2] + 3 && pointer.y > p.box[1] - 3 && pointer.y < p.box[3] + 2;
        p.hoverT = over ? p.hoverT + dt : 0;
        if (p.hoverT > 0.45 && now > p.waveCd) {
          p.hoverT = 0;
          if (p.scene && !cancelScript(p.scene, false, 'hover')) return;
          personWave();
        }
      } else p.hoverT = 0;
    }
    // track 要去的那一点（fn 出错就停下）
    function trackPt(a, c) {
      var p = null;
      try { p = c.fn(a); } catch (e) { sceneFail('scene ' + (a.scene ? a.scene.name : '') + ' track', e); a.cmd = null; return null; }
      return p && isFinite(p.x) && isFinite(p.y) ? p : null;
    }
    function frameOf(spec, t) {
      if (!spec) return null;
      if (typeof spec === 'string') return spec;
      return spec.f[Math.floor(t * (spec.fps || 4)) % spec.f.length];
    }
    // 小人现在该是哪个画面（旧画法直接画这一张；新画法把它当作"要摆成的姿势"）
    function personSprite() {
      var p = person, breath = Math.floor(now / 0.85) % 2, blink = (now % 4.3) < 0.14;
      if (p.carried) return (Math.floor(now * 6) % 2) ? 'p_cheer' : 'p_cheer2';
      if (p.moving) return (p.scene && p.cmd && p.cmd.pose) ? p.cmd.pose : 'p_walk' + (Math.floor(p.anim) % 4);
      if (p.scene) {
        var f = frameOf(p.spr, now);
        if (f) return f;
        return (ball.st === 'hand' && !p.item) ? (breath ? 'p_hold2' : 'p_hold') : (blink ? 'p_blink' : (breath ? 'p_idle2' : 'p_idle'));
      }
      switch (p.st) {
        case 'windup': return 'p_windup';
        case 'release': return 'p_release';
        case 'follow': return 'p_follow';
        case 'fake': return p.t < 0.4 ? 'p_windup' : (p.t < 0.6 ? 'p_release' : (breath ? 'p_hold2' : 'p_hold'));
        case 'pat': return frameOf(p.patSpr || 'p_pat', p.t);
        case 'act': return frameOf(p.act, p.t) || 'p_idle';
        case 'front': return blink ? 'p_front_blink' : (breath ? 'p_front2' : 'p_front');
        case 'wave': return (Math.floor(p.t * 5) % 2) ? 'p_wave_a' : 'p_wave_b';
        case 'sleep': return 'p_front_blink';
        default:
          if (ball.st === 'hand') return breath ? 'p_hold2' : 'p_hold';
          return blink ? 'p_blink' : (breath ? 'p_idle2' : 'p_idle');
      }
    }
    function personFace() {
      var p = person;
      return (p.st === 'front' || p.st === 'wave' || p.st === 'sleep') && !p.scene && !p.carried ? 1 : p.face;
    }
    // 告诉小人的骨架"现在是什么状态"
    function personInput() {
      var p = person, I = p.ri;
      I.frame = p.hidden ? 'p_sit' : personSprite();          // 在岛里：坐在两只睡着的狗狗中间守着
      I.moving = p.moving && !p.hidden;
      I.speed = I.moving ? p.spd * SK : 0;
      I.t = p.scene ? now - p.sprAt : p.t;
      I.carried = p.carried;
      I.air = p.z > 1.5 ? 1 : 0;
      I.holding = p.hidden ? null : (p.item ? p.item : (ball.st === 'hand' ? 'ball' : (p.held ? p.held.spr : null)));
      // 表情：剧本说了就听剧本的；不给就让骨架按画面自己挑（摸狗时温柔地笑、准备丢的时候专注……）
      I.face = layerOf(p, 'expr') || (p.st === 'sleep' ? 'sleepy' : null);
      // 眼睛看哪里（相对脚下：往旁边多远、多高）：剧本说的；球在外面就跟着球；正在摸的那只狗；凑过来的鼠标；戏里一起演的
      var t = layerOf(p, 'lookT'), g = p.giveTo, pt = null;
      if (p.hidden) pt = null;
      else if (t) pt = lookPt(p, t);
      else if (ball.st === 'free' || ball.st === 'drag' || ball.st === 'mouth' || ball.st === 'tug' || ball.st === 'script') pt = lookPt(p, 'ball');
      else if (g && g.mouthX !== undefined) { lookTmp.x = g.mouthX; lookTmp.y = g.mouthY; pt = lookTmp; }
      else if (pointer.inside && !p.scene && hyp(pointer.x - p.x, pointer.y - (p.y - P_H * 0.6)) < 70) { lookTmp.x = pointer.x; lookTmp.y = pointer.y; pt = lookTmp; }
      else if (!p.moving) pt = lookPt(p, defaultLook(p));
      I.look = smoothLook(p, pt, 1 / 60);
      p.la = I.look;
      giveAct(p, I);
      giveExtra(p, I);
      return I;
    }

    // ------------------------------------------------------------
    //  小球
    // ------------------------------------------------------------
    function updateBall(dt) {
      if (ball.sq > 0) ball.sq -= dt;
      if (ball.st !== 'free') return;
      ball.freeT += dt;
      ball.vz -= GRAV * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.z += ball.vz * dt;
      if (ball.x < F.x0 + BALL_R) { ball.x = F.x0 + BALL_R; ball.vx = Math.abs(ball.vx) * 0.6; }
      if (ball.x > F.x1 - BALL_R) { ball.x = F.x1 - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.6; }
      if (ball.y < F.y0) { ball.y = F.y0; ball.vy = Math.abs(ball.vy) * 0.6; }
      if (ball.y > F.y1) { ball.y = F.y1; ball.vy = -Math.abs(ball.vy) * 0.6; }
      if (ball.z <= BALL_R) {
        ball.z = BALL_R;
        if (ball.vz < -45) {
          if (ball.vz < -150) { ball.sq = 0.07; puff(ball.x, ball.y, false); haptic('soft'); }
          ball.vz = -ball.vz * 0.52; ball.vx *= 0.74; ball.vy *= 0.74;
        } else {
          ball.vz = 0;
          var k = Math.exp(-2.4 * dt); ball.vx *= k; ball.vy *= k;
          if (hyp(ball.vx, ball.vy) < 3) {
            if (ball.vx || ball.vy) raise('ballRest', { x: ball.x, y: ball.y, far: hyp(ball.x - person.x, ball.y - person.y) > 200 });
            ball.vx = 0; ball.vy = 0;
          }
        }
        // 地上挡路的东西（便便之类）四周有一圈看不见的边：球碰到就弹开，停不进去
        for (var i = 0; i < props.length; i++) {
          var o = props[i];
          if (o.dead || o.holder || !(o.obstacle > 0)) continue;
          var dx = ball.x - o.x, dy = ball.y - o.y, dd = hyp(dx, dy), rr = Math.max(10, o.obstacle);
          if (dd < rr) {
            var nx = dd > 0.01 ? dx / dd : 1, ny = dd > 0.01 ? dy / dd : 0, vn = ball.vx * nx + ball.vy * ny;
            ball.x = clamp(o.x + nx * rr, F.x0 + BALL_R, F.x1 - BALL_R); ball.y = clamp(o.y + ny * rr, F.y0, F.y1);
            if (vn < 0) { ball.vx = (ball.vx - 2 * vn * nx) * 0.6; ball.vy = (ball.vy - 2 * vn * ny) * 0.6; }
            if (hyp(ball.vx, ball.vy) < 12) { ball.vx = nx * 12; ball.vy = ny * 12; }
          }
        }
      }
      ball.rot += (ball.vx + ball.vy * 0.5) * dt * 0.16;
      // 保险：球落地好一阵子都没狗去捡 → 叫醒小腊肠
      if (ball.freeT > 5 && ball.vx === 0 && ball.vy === 0 && home.st === 'out' && !dogs.some(function (d) { return d.st === 'chase' || d.st === 'alert'; })) {
        raise('ballStuck', { x: ball.x, y: ball.y });
        if (ball.st !== 'free') return;
        wake(dax); if (dax.scene) endScript(dax.scene, true, 'ball');
        if (!dax.carried && !dax.hidden) { dax.st = 'chase'; dax.t = 0; dax.pose = 'stand'; } ball.freeT = 0;
      }
    }

    // ------------------------------------------------------------
    //  蝴蝶（白天偶尔飞来一只；小腊肠爱追）
    // ------------------------------------------------------------
    function updateBfly(dt) {
      var b = bfly;
      if (!b.on) {
        if (now >= b.nextAt && home.st === 'out' && dayPhase() !== 'night' && !isNight()) {
          b.on = true; b.color = Math.random() < 0.5 ? 0 : 1; b.until = now + rand(28, 50);
          b.x = Math.random() < 0.5 ? F.x0 - 6 : F.x1 + 6; b.y = rand(Math.max(10, F.y0 - 40), Math.max(20, F.y1 - 30));
          b.tx = rand(F.x0 + 30, F.x1 - 30); b.ty = rand(Math.max(12, F.y0 - 40), Math.max(20, F.y1 - 26)); b.vx = b.vy = 0; b.t = 0;
        }
        return;
      }
      b.t += dt;
      if (now > b.until) { b.tx = b.x < LW / 2 ? F.x0 - 20 : F.x1 + 20; b.ty = b.y - 20; if (b.x < F.x0 - 10 || b.x > F.x1 + 10) { b.on = false; b.nextAt = now + rand(60, 150); return; } }
      else if (hyp(b.tx - b.x, b.ty - b.y) < 6 || Math.random() < dt * 0.35) {
        b.tx = rand(F.x0 + 20, F.x1 - 20); b.ty = rand(Math.max(12, F.y0 - 44), Math.max(20, F.y1 - 24));
      }
      var dx = b.tx - b.x, dy = b.ty - b.y, d = hyp(dx, dy) || 1;
      b.vx += (dx / d * 26 - b.vx) * Math.min(1, dt * 2.5); b.vy += (dy / d * 20 - b.vy) * Math.min(1, dt * 2.5);
      b.x += (b.vx + Math.sin(b.t * 7) * 9) * dt; b.y += (b.vy + Math.cos(b.t * 9) * 12) * dt;
    }

    // ------------------------------------------------------------
    //  回岛睡觉 / 出来玩
    // ------------------------------------------------------------
    function goHome() {
      if (home.st !== 'out') return;
      endScene(true, 'home');
      clearProps(true, false);
      raise('home', {});
      pointer.drag = false; pointer.grab = null;
      ball.st = 'hand'; ball.holder = null; ball.other = null; ball.vx = ball.vy = ball.vz = 0; ball.owner = null; ball.fly = null;
      play.phase = 'rest'; play.rounds = 0; play.want = 0;
      home.st = 'going'; home.t = 0; home.wasNight = isNight();
      if (!opt.roam || !host.island) {   // 没有岛可回：原地消失
        actors.forEach(function (a) { if (!a.hidden) { puff(a.x, a.y - 10, true); a.hidden = true; } });
        return;
      }
      dogs.forEach(function (d, i) { d.carried = false; d.att = null; d.lift = 0; wake(d, true); d.st = 'home'; d.t = 0; d.hq = false; d.pose = 'stand'; d.react = 0.15 + i * 0.25; d.wag = 0.6; });
      person.carried = false; person.st = 'home'; person.t = 0; person.hq = false; person.spr = null; person.act = null;
    }
    function comeOut() {
      if (home.st !== 'in' && home.st !== 'going') return;
      lastTouch = now;
      var ip = islandPt(), k = 0;
      home.st = 'leaving'; home.t = 0; home.q = [];
      [dax, gold, person].forEach(function (a, i) {
        a.hq = false;
        if (a.hidden) { home.q.push({ a: a, at: now + 0.15 + k * 0.4, x: ip.x + [16, -20, 0][i] }); k++; }
        else if (a.isPerson) personIdle();                                   // 还没进岛就被叫住：原地转身
        else if (!a.carried) { setPose(a, 'stand', rand(0.4, 1.0)); a.wag = 1; }
      });
    }
    function updateHome() {
      if (home.st === 'going') {
        // 保险：回岛的路上不管被什么打断，都继续往岛里走
        play.phase = 'rest'; play.rounds = 0;
        if (ball.st !== 'hand') { ball.st = 'hand'; ball.holder = null; ball.other = null; pointer.drag = false; }
        dogs.forEach(function (d) { if (!d.hidden && !d.carried && d.st !== 'home') { d.st = 'home'; d.t = 0; d.hq = false; d.react = 0; d.pose = 'stand'; } });
        if (!person.hidden && !person.carried && person.st !== 'home') { person.st = 'home'; person.t = 0; person.hq = false; }
        if (actors.every(function (a) { return a.hidden; })) { home.st = 'in'; play.nextAt = now + 30; clearProps(false, false); }
      } else if (home.st === 'leaving') {
        var ip = islandPt();
        for (var i = home.q.length - 1; i >= 0; i--) {
          var q = home.q[i];
          if (now < q.at) continue;
          var a = q.a;
          if (a.scene) endScript(a.scene, true, 'out');
          a.hidden = false; a.x = clamp(q.x, F.x0 + a.half + 2, F.x1 - a.half - 2); a.y = a.isPerson ? Math.max(ip.y, PY0) : ip.y; a.z = 0.01; a.vz = 120; a.cmd = null; a.lift = 0; a.att = null;
          puff(a.x, a.y - 16, true);
          if (a.isPerson) { a.st = 'come'; a.t = 0; a.tx = ip.x + rand(-20, 20); a.ty = clamp(ip.y + (F.y1 - F.y0) * rand(0.4, 0.6), F.y0, F.y1); }
          else { var p = randPt(60 * SK, a); a.st = 'zoom'; a.t = 0; a.pose = 'stand'; a.wag = 1; a.vx = a.vy = 0; a.way = [p, { x: ip.x + (a === dax ? 30 : -40), y: clamp(ip.y + (F.y1 - F.y0) * 0.5, F.y0, F.y1) }]; }
          home.q.splice(i, 1);
        }
        if (!home.q.length) { home.st = 'out'; play.nextAt = now + rand(8, 14); nextSceneAt = now + rand(10, 18); cameOut(); }
      } else if (home.st === 'in') {
        // 天亮了自己出来：不管是夜里自己回去睡的，还是她前一天让它们回去的
        var night = isNight();
        if ((home.wasNight && !night) || (home.auto && !night && now - home.inAt > 5)) { home.auto = false; home.wasNight = night; comeOut(); }
        else home.wasNight = night;
      }
    }

    // ------------------------------------------------------------
    //  总导演
    // ------------------------------------------------------------
    function updatePlay() {
      if (home.st !== 'out') return;
      // 她按了"丢球"，但小人当时正忙（刚从岛里出来、正在摸狗……）：等他一有空就丢
      if (play.want) {
        if (now > play.want) play.want = 0;
        else if (ball.st === 'hand' && !person.hidden && !person.carried && (play.phase === 'rest' || play.phase === 'ready') &&
                 (person.st === 'idle' || person.st === 'front' || person.st === 'wave' || person.st === 'walk' || person.st === 'act' || person.st === 'come')) {
          play.want = 0; clickPerson();
        }
      }
      if (play.phase === 'rest') {
        var busyNow = mainScript();
        if (opt.auto && !busyNow && !sleepyTime() && now >= play.nextAt && ball.st === 'hand' && !person.carried && !person.hidden && !careWaiting() && !her.away && now >= calmUntil &&
            (person.st === 'idle' || person.st === 'front' || person.st === 'walk' || person.st === 'act')) {
          startSession(randInt(2, 4));
        } else if (!busyNow && now >= nextSceneAt) {
          if (!pickScene()) nextSceneAt = now + 3;
        }
      } else if (play.phase === 'ready') {
        if (ball.st === 'pocket' && !person.scene) ballHome();
        if (ball.st === 'hand' && person.st === 'idle' && !person.carried && !person.scene && now >= play.throwAt) personThrow();
      }
    }

    // ------------------------------------------------------------
    //  鼠标 / 手指（坐标都是世界单位）
    // ------------------------------------------------------------
    function inBox(b, x, y, pad) { return b && x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad; }
    function touchAll() {
      lastTouch = now; herInput();
      dogs.forEach(function (d) { if (!d.hidden) wake(d); });
      if (person.st === 'sleep') personIdle();
    }
    // 点了一下谁：先问问有没有哪段戏要接这一下（click；很快连点两下是 dblclick）。返回 true = 有戏接了，原来的反应就不做了
    function clicked(a, x, y) {
      var dbl = now - a.clickAt < 0.4;
      a.clickAt = now;
      var ev = { who: a, x: x, y: y, zone: x === undefined ? 'mid' : zoneOf(a, x, y) };
      var sc = raise(dbl ? 'dblclick' : 'click', ev);
      return !!(sc && !sc.overlay);
    }
    function pet(d, x, y) {
      emote('heart', d, d.face * 6);
      d.wag = 1; d.happy = 1; d.hype = 1.6;
      bump('pets'); haptic('light');
      if (x !== undefined && clicked(d, x, y)) return;
      var solo = d.scene && d.scene.kind === 'solo' && !d.att;
      if (solo && !cancelScript(d.scene, false, 'click')) solo = false;
      if (solo || (!d.scene && (d.st === 'pose' || d.st === 'idle' || d.st === 'walk'))) {
        if (d.kind === 'dax') { if (Math.random() < 0.4) setPose(d, 'roll', 2.2); else { setPose(d, 'stand', 1.6); hop(d, 120); } }
        else setPose(d, Math.random() < 0.3 ? 'roll' : 'sit', 2.4);
        d.wag = 1; d.happy = 1;
      }
    }
    // 点了小人（x, y 不给 = 她按的是"丢球"按钮）
    function clickPerson(x, y) {
      var p = person;
      if (x !== undefined && clicked(p, x, y)) return;
      // 他正在演的戏先让路；正演到不能打断的一小段，就等他一有空再丢
      if (p.scene && !cancelScript(p.scene, false, 'click')) { play.want = now + 9; return; }
      if (ball.st === 'pocket') ballHome();
      if (ball.st === 'hand' && (p.st === 'idle' || p.st === 'front' || p.st === 'wave' || p.st === 'walk' || p.st === 'act' || p.st === 'come')) {
        personIdle();
        if (play.phase === 'rest') startSession(1);
        play.phase = 'ready'; play.throwAt = now + 0.05; play.faked = true;
      } else if (p.st === 'idle' || p.st === 'front') {
        personWave();
      }
    }
    // 点在空地上：有球就往那儿丢，没球就把大家叫过去
    function lawnTap(x, y) {
      var tx = clamp(x, F.x0 + 12, F.x1 - 12), ty = opt.roam ? clamp(y, F.y0, F.y1) : F.y1;
      if (home.st !== 'out') return;
      if (ball.st === 'pocket' && !person.scene) ballHome();
      if (ball.st === 'hand' && !person.carried && (person.st === 'idle' || person.st === 'front' || person.st === 'wave' || person.st === 'walk' || person.st === 'act' || person.scene)) {
        if (hyp(tx - person.x, ty - person.y) < 26) { clickPerson(); return; }
        if (person.scene && !cancelScript(person.scene, false, 'tap')) return;
        startSession(1, { x: tx, y: ty });
        play.throwAt = now + 0.05; play.faked = true;
      } else if (play.phase === 'rest') {
        endScene(false, 'tap');
        emoteAt('note', tx, ty - 10, 0.9);
        dogs.forEach(function (d, i) {
          if (d.hidden || d.carried || (d.scene && !d.scene.dead)) return;
          wake(d, true); d.st = 'come'; d.t = 0; d.pose = 'stand'; d.wag = 1;
          d.tx = clamp(tx + (i ? 16 : -22), F.x0 + d.half + 2, F.x1 - d.half - 2); d.ty = clamp(ty + ry(i ? 4 : -2), F.y0, F.y1);
        });
      }
    }
    function ptDown(x, y) {
      setCursor(x, y); herInput();
      pointer.x = x; pointer.y = y; pointer.down = true; pointer.inside = true; pointer.grab = null; pointer.prop = null;
      var sleepy = sleepyTime();
      touchAll();
      if (ball.vis && ball.box && home.st === 'out' && ball.st !== 'pocket' && inBox(ball.box, x, y, 4)) {
        // 抓住小球
        endScene(false, 'ball');
        if ((ball.st === 'mouth' || ball.st === 'tug') && ball.holder) {
          var h0 = ball.holder;
          if (h0.scene) cancelScript(h0.scene, true, 'ball');
          h0.st = 'beg'; h0.t = 0; if (ball.other) { ball.other.st = 'beg'; ball.other.t = 0; }
        }
        if (person.st === 'windup' || person.st === 'pat' || person.st === 'fake') personIdle();
        ball.st = 'drag'; ball.holder = null; ball.other = null; ball.vx = ball.vy = ball.vz = 0; ball.owner = null; ball.fly = null;
        pointer.drag = true; pointer.hist = [];
        play.phase = 'drag';
        dogs.forEach(function (d) {
          if (d.hidden || d.carried || (d.scene && d.scene.kind === 'care')) return;
          if (d.kind === 'gold' && d.energy < 0.3) return;
          d.st = 'beg'; d.t = 0; d.pose = 'stand';
        });
        raise('grabBall', { x: x, y: y });
        ptMove(x, y);
        return true;
      }
      var hit = null;
      if (!dax.hidden && inBox(dax.box, x, y, 1)) hit = dax;
      else if (!gold.hidden && inBox(gold.box, x, y, 1)) hit = gold;
      else if (!person.hidden && inBox(person.box, x, y, 1)) hit = person;
      if (hit) { pointer.grab = { a: hit, x: x, y: y, moved: false, sleepy: sleepy, t0: now, pressed: false }; return true; }
      var hp = propAt(x, y);              // 地上可以点的小东西（饭碗、便便……）：鼠标在上面停过一会儿才点得到
      if (hp) { pointer.prop = hp; return true; }
      if (CFG.lawnTap) lawnTap(x, y);     // Mac 上"草地"就是她的桌面和别的 App，点那里不归我们管
      return false;
    }
    function ptMove(x, y) {
      setCursor(x, y);
      pointer.x = x; pointer.y = y; pointer.inside = true;
      var g = pointer.grab;
      if (g) {
        if (!g.moved && hyp(x - g.x, y - g.y) > 5) {   // 拎起来
          g.moved = true;
          var a = g.a;
          cancelFor(a, true, 'carried');          // 它身上的戏马上停（不等）
          if ((ball.st === 'mouth' || ball.st === 'tug') && (ball.holder === a || ball.other === a)) { ball.st = 'free'; ball.holder = null; ball.other = null; ball.z = 10; ball.vz = 40; onBallFree(); }
          a.carried = true; a.z = 0; a.vz = 0; a.vx = 0; a.vy = 0; a.lift = 0; a.att = null;
          if (a.isPerson) { if (a.st === 'windup' || a.st === 'fake' || a.st === 'pat') personIdle(); }
          else { a.st = 'carried'; a.pose = 'stand'; emote('q', a, 0, 0.7); }
          haptic('light');
          raise('pickup', { who: a });
        }
        if (g.moved) {
          var c = g.a;
          c.x = clamp(x, F.x0 + c.half + 1, F.x1 - c.half - 1);
          if (opt.roam) { c.y = clamp(y + (c.isPerson ? P_GRAB : 8), c.isPerson ? PY0 : F.y0, F.y1); c.z = 5; }
          else { c.y = F.y1; c.z = clamp(F.y1 - y - (c.isPerson ? P_GRAB : 8), 0, LH); }
        }
        return true;
      }
      if (pointer.prop) return true;
      if (!pointer.drag) return false;
      ball.x = clamp(x, F.x0 + BALL_R, F.x1 - BALL_R);
      if (opt.roam) { ball.z = 12; ball.y = clamp(y + ball.z, F.y0, F.y1 + 10); if (ball.y > F.y1) { ball.z = Math.max(BALL_R, 12 - (ball.y - F.y1)); ball.y = F.y1; } }
      else { ball.y = F.y1; ball.z = clamp(F.y1 - y, BALL_R, LH + 30); }
      var t = clock();
      pointer.hist.push([t, x, y]);
      while (pointer.hist.length > 2 && t - pointer.hist[0][0] > 0.11) pointer.hist.shift();
      return true;
    }
    // 她放下了拎着的角色：放在谁身上（金毛背上、小人怀里）就是 dropOn，不然是 drop
    function dropped(a) {
      pushOut(a);
      var tgt = null, best = 15;
      for (var k = 0; k < actors.length; k++) {
        var o = actors[k];
        if (o === a || o.hidden || o.carried) continue;
        if (a.isPerson && !o.isPerson && o.kind === 'dax') continue;          // 小人坐不到小腊肠背上
        var an = o.isPerson ? 'arms' : 'seat', q = anchorOf(o, an), d = Math.abs(a.x - (o.x + q[0]));
        if (d < best && Math.abs(a.y - o.y) < 16) { best = d; tgt = { o: o, an: an }; }
      }
      if (tgt) raise('dropOn', { who: a, target: tgt.o, anchor: tgt.an });
      else raise('drop', { who: a, x: a.x, y: a.y });
    }
    function ptUp() {
      pointer.down = false;
      var g = pointer.grab;
      pointer.grab = null;
      if (g) {
        var a = g.a;
        if (g.moved) {     // 放下
          a.carried = false; a.vz = 0;
          if (a.z <= 0) a.z = 0.01;
          // 拎到灵动岛上放下 = 送它们回岛睡觉
          var I = host.island;
          if (I && I.hit && opt.roam && home.st === 'out' && I.hit(pointer.x, pointer.y)) {
            if (a.isPerson) personIdle(); else { a.st = 'idle'; a.pose = 'stand'; a.t = 0; }
            raise('dropIsland', { who: a });
            home.auto = false; goHome(); home.inAt = now;
            return true;
          }
          if (home.st === 'going') { a.st = 'home'; a.t = 0; a.hq = false; a.react = 0.2; if (!a.isPerson) a.pose = 'stand'; }
          else if (a.isPerson) { personIdle(); }
          else { a.st = 'pose'; a.pose = 'sit'; a.t = 0; a.dur = 1.6; a.wag = 0.9; }
          if (home.st === 'out') dropped(a);
        } else if (g.pressed) { /* 按住不放的那一下已经算过了（press） */ }
        else if (a.isPerson) { if (g.sleepy) personWave(); else clickPerson(g.x, g.y); }
        else pet(a, g.x, g.y);
        return true;
      }
      var cp = pointer.prop;
      if (cp) { pointer.prop = null; if (!cp.dead && inProp(cp, pointer.x, pointer.y, 3)) propClicked(cp, pointer.x, pointer.y); return true; }
      if (!pointer.drag) return false;
      pointer.drag = false;
      var h = pointer.hist, vx = 0, vy = 0;
      if (h.length >= 2) {
        var p0 = h[0], p1 = h[h.length - 1], dtt = Math.max(0.016, p1[0] - p0[0]);
        vx = (p1[1] - p0[1]) / dtt; vy = (p1[2] - p0[2]) / dtt;
      }
      ball.st = 'free';
      if (opt.roam) {
        var sp = hyp(vx, vy);
        ball.vx = clamp(vx * 0.85, -520, 520); ball.vy = clamp(vy * 0.85, -420, 420);
        ball.vz = clamp(30 + sp * 0.32, 0, 250);
      } else {
        ball.vx = clamp(vx * 0.9, -560, 560); ball.vy = 0;
        ball.vz = clamp(-vy * 0.9, -400, Math.sqrt(2 * GRAV * (LH * 1.1)));
      }
      play.phase = 'fly'; play.lastPlay = now;
      if (opt.auto) play.rounds = Math.max(play.rounds, 1);   // 她丢完，小人也回丢一个
      haptic('light');
      onBallFree();
      raise('throw', { by: 'her', vx: ball.vx, vy: ball.vy });
      return true;
    }
    function ptHover(x, y) { setCursor(x, y); }
    function ptLeave() { pointer.inside = false; if (CFG.lawnTap) cur.known = false; }
    function dragging() { return !!(pointer.drag || (pointer.grab && pointer.grab.moved)); }

    // ------------------------------------------------------------
    //  图：旧的手画图（sprites.js）和新的小道具（fx.js），按名字取
    // ------------------------------------------------------------
    var FXS = null;            // 新小道具的图（按现在的 R 做出来的）
    var SD = {};               // 名字 → { im, l, t, r, b }：图，和"按哪个框来摆"（世界单位，相对图的左上角）
    var shCache = {}, pxCache = {}, puffN = 0;
    var fxBall = !!(FXM && FXM.ball), fxShadow = !!(FXM && FXM.shadow), fxPx = !!(FXM && FXM.px);     // 新画法的这几样还能不能用
    function loadArt() {
      FXS = null;
      if (FXM && FXM.build) { try { FXS = FXM.build(CFG, R) || null; } catch (e) { artFail('fx.js build', e); } }
      SD = {}; shCache = {}; pxCache = {}; seqN = {};
      puffN = 0;
      while (sd('puff' + puffN)) puffN++;      // 灰尘有几帧就用几帧（旧图 3 帧，新图多一帧）
    }
    // 表情用哪张图。新画法给有的表情多画了几帧，有就用上（旧图没有，还是原来那一张）：
    //   名字_pop0 / _pop1 / _pop2   刚冒出来时"啵"的一下（小 → 涨大一圈 → 缩回来）
    //   名字0 / 名字1 / ……          从头到尾轮着放一遍（小星星：刚亮 → 最亮 → 快灭）
    var seqN = {};
    function emoteArt(e) {
      var base = 'fx_' + e.type, d = e.t < 0.21 ? sd(base + '_pop' + Math.floor(e.t / 0.07)) : null;
      if (d) return d;
      var n = seqN[base];
      if (n === undefined) { n = 0; while (sd(base + n)) n++; seqN[base] = n; }
      return n ? sd(base + Math.min(n - 1, Math.floor(e.t / e.life * n))) : sd(base);
    }
    // 旧图按整张来摆（和第二版一个像素不差）；新图四周留多少空白不一定，按"真正有像素"的范围来摆
    function boxed(im, tight) {
      var s = im.scale || 1, bb = tight ? im.bb : null;
      return bb ? { im: im, l: bb[0] / s, t: bb[1] / s, r: (bb[2] + 1) / s, b: (bb[3] + 1) / s }
                : { im: im, l: 0, t: 0, r: im.w / s, b: im.h / s };
    }
    function sd(name) {
      var d = SD[name];
      if (d !== undefined) return d;
      if (FXS && FXS[name]) d = boxed(FXS[name], true);
      else if (SPR[name]) d = boxed(SPR[name], false);
      else d = null;
      SD[name] = d;
      return d;
    }
    // 影子：{ im, cx, cy }，(cx, cy) 是图里对着"脚下那一点"的位置
    function shadowOf(w, al) {
      var key = w + '/' + al, s = shCache[key];
      if (s !== undefined) return s;
      if (fxShadow) {
        try {
          var im = FXM.shadow(w, al, R), k = im.scale || 1;
          s = { im: im, cx: im.ox / k, cy: im.oy / k + 0.5 };
        } catch (e) { artFail('fx.js shadow', e); fxShadow = false; s = undefined; }
      }
      if (!s) {
        // 旧画法：三行，中间一行最宽
        var W = w * 2, d = new Uint8ClampedArray(W * 3 * 4), a8 = Math.round(al * 255);
        for (var j = 0; j < 3; j++) {
          var x0 = j === 1 ? 0 : 2, x1 = j === 1 ? W : W - 2;
          for (var i = x0; i < x1; i++) { var o = (j * W + i) * 4; d[o] = 20; d[o + 1] = 24; d[o + 2] = 40; d[o + 3] = a8; }
        }
        s = { im: { w: W, h: 3, data: d, scale: 1, ox: w, oy: 1.5, key: 'sh_' + w + '_' + a8 + '@1', ver: 1 }, cx: w, cy: 2 };
      }
      shCache[key] = s;
      return s;
    }
    // 飞溅的小碎屑：一个世界单位见方的色块
    function pxOf(color) {
      var s = pxCache[color];
      if (s !== undefined) return s;
      if (fxPx) { try { s = boxed(FXM.px(color, R), true); } catch (e) { artFail('fx.js px', e); fxPx = false; s = undefined; } }
      if (!s) {
        var c = rgbOf(color), d = new Uint8ClampedArray(4);
        d[0] = c[0]; d[1] = c[1]; d[2] = c[2]; d[3] = 255;
        s = boxed({ w: 1, h: 1, data: d, scale: 1, ox: 0.5, oy: 0.5, key: 'px_' + color + '@1', ver: 1 }, false);
      }
      pxCache[color] = s;
      return s;
    }

    // ------------------------------------------------------------
    //  角色的图：把骨架画成像素是最费力气的事，所以不是每一帧都重画——
    //  看得出变化了才画，其余时候接着用上一张，只挪位置
    // ------------------------------------------------------------
    function qual() { return clamp(quality, 0.2, 1) * (opt.soft ? 0.56 : 1); }
    // 两张图在 [i0, i1) 这些像素上是不是一模一样
    function samePixels(v, src, i0, i1) {
      var dst = v.im.data, i;
      if (v.s8 !== src) { v.s8 = src; v.s32 = (src.byteOffset % 4 === 0) ? new Uint32Array(src.buffer, src.byteOffset, src.length >> 2) : null; }
      if (!v.p32) v.p32 = new Uint32Array(dst.buffer, dst.byteOffset, dst.length >> 2);
      var a = v.s32, b = v.p32;
      if (a) { for (i = i0; i < i1; i++) if (a[i] !== b[i]) return false; return true; }
      for (i = i0 * 4; i < i1 * 4; i++) if (src[i] !== dst[i]) return false;
      return true;
    }
    // 把骨架刚画好的那一帧收下来：像素抄进角色自己的图里（没变就不动 ver），顺便记下嘴、手、头顶的位置
    function adopt(a, o) {
      var v = a.vis, im = v.im, s = o.scale || 1, w = o.w, h = o.h, n = w * h * 4, fresh = false;
      if (!im.data || im.data.length !== n || im.w !== w || im.h !== h || im.scale !== s) {
        im.data = new Uint8ClampedArray(n); im.w = w; im.h = h; im.scale = s;
        v.p32 = null; fresh = true;
      }
      im.ox = o.ox; im.oy = o.oy;
      var b = o.box || [0, 0, w - 1, h - 1];
      // 只比"上一帧或这一帧有像素"的那几行
      var y0 = Math.max(0, Math.min(v.ry0, b[1]) - 2), y1 = Math.min(h - 1, Math.max(v.ry1, b[3]) + 2);
      if (fresh || !samePixels(v, o.data, y0 * w, (y1 + 1) * w)) { im.data.set(o.data); im.ver++; v.ch++; }
      v.ry0 = b[1]; v.ry1 = b[3];
      v.bx0 = b[0] / s; v.by0 = b[1] / s; v.bx1 = b[2] / s; v.by1 = b[3] / s; v.px = 1 / s;
      v.top = o.top || 0;
      if (o.mouth) { v.mx = o.mouth[0]; v.my = o.mouth[1]; }
      v.hand = !!o.hand; v.holds = !!o.hand && o.holds !== false;
      if (o.hand) { v.hx = o.hand[0]; v.hy = o.hand[1]; }
      v.seat = !!o.seat;
      if (o.seat) { v.sx = o.seat[0]; v.sy = o.seat[1]; }
      // 别的位置（背上、怀里、头顶……）：有就记下来，戏里 attach / anchor / 拿东西要用
      for (var i = 0; i < ANCHORS.length; i++) {
        var nm = ANCHORS[i], p = o[nm], q = v.an[nm];
        if (p && p.length === 2 && isFinite(p[0]) && isFinite(p[1])) { if (!q) q = v.an[nm] = [0, 0]; q[0] = +p[0]; q[1] = +p[1]; q.ok = true; }
        else if (q) q.ok = false;
      }
      if (!a.isPerson && o.headX !== undefined && !(v.an.head && v.an.head.ok)) { var hq = v.an.head || (v.an.head = [0, 0]); hq[0] = o.headX; hq[1] = o.headY; hq.ok = isFinite(o.headX) && isFinite(o.headY); }
      // 骨架自己的小动作演完了（它在演完后的下一张图里说一声 actDone）
      if (a.ract && o.actDone && (o.actDone === true || o.actDone === a.ract) && now - a.ractAt > 0.1) a.ractDone = true;
    }
    // 该不该重画这个角色。下面任何一条成立就画，否则接着用上一张（位置照样每帧都挪）：
    //   · 出了大动静：换了姿势 / 画面 / 心情、起跳、落地、叼到球、转身
    //   · 在地上走出了半个世界单位（跑着的狗每一帧都重画，踩在地上的脚才不会打滑）
    //   · 在原地做动作，离上次画过了 1/rigFps 秒
    //   · 只是呼吸、轻轻摇尾巴，离上次画过了大约 1/6 秒
    // sx：这张图的原点（脚下）会画在横向的哪里。把它落在像素格子里的零头告诉骨架，
    // 骨架就能按整格子来画：踩在地上的脚不会跟着身体在两个像素之间来回跳（旧的画法不理会这个）
    function shoot(a, left, RR, sig, cls, active, sx) {
      var v = a.vis, q = qual(), per = 1 / ((active ? RIG_FPS : CALM_FPS) * q);
      var el = now - v.seen;
      v.seen = now;
      v.acc += el > 0 ? (el > 1 ? 1 : el) : 0;
      var must = v.im.ver === 0 || sig !== v.sig || left !== v.left || RR !== v.R;
      var moved = v.dist >= Math.min(STRIDE, 1 / RR) / q;
      if (!must && !moved && v.acc < per - 1e-6) return v;
      if (must) {
        v.acc = v.ph * per;                                                      // 三个角色的节拍互相错开
        if (cls !== v.cls || left !== v.left) v.hot = Math.max(v.hot, now + 0.6);   // 换了姿势，正在过渡：这阵子画勤一点
      }
      else if (moved) v.acc = 0;
      else v.acc = Math.min(v.acc - per, per * 0.5);
      v.dist = 0;
      v.sig = sig; v.cls = cls; v.left = left; v.R = RR;
      v.n++;
      try { adopt(a, a.rig.render(left, RR, sx * RR - Math.floor(sx * RR))); v.bad = 0; }
      catch (e) {      // 画不出来：先接着用上一张；连着三次都不行，这个角色就不用新画法了
        artFail((a.isPerson ? 'person.js' : 'dogs.js ' + a.name) + ' render', e);
        if (++v.bad >= 3) a.rig = null;
      }
      return v;
    }
    // 这一步在地上走了多远（被拎着、躲在岛里的不算）
    function travelled(a) {
      var v = a.vis;
      if (!a.carried && !a.hidden) v.dist += hyp(a.x - v.lx, a.y - v.ly);
      v.lx = a.x; v.ly = a.y;
    }
    // "出了大动静"的记号：姿势、心情、小动作、跳起来、叼着球……任何一样变了，这张图就得重画
    function dogSig(d) {
      var I = d.ri;
      return I.pose + '|' + (I.mood || '') + '|' + (I.act || '') + '|' + ((I.air ? 1 : 0) + (I.carry ? 2 : 0) + (I.happy ? 4 : 0) + (I.bark ? 8 : 0) + (I.pant ? 16 : 0) + (I.shake ? 32 : 0));
    }
    function dogActive(d) {
      var I = d.ri;
      return d.sp > 1 || d.z > 0 || d.carried || !!I.pant || !!I.bark || !!I.shake || d.wag > 0.55 || now < d.vis.hot || (!!d.ract && !d.ractDone) || !!d.att ||
             d.st === 'spin' || d.pose === 'scratch' || d.pose === 'dig' || d.pose === 'roll' || d.pose === 'lick';
    }
    function personSig() {
      var I = person.ri;
      return I.frame + (I.holding === 'ball' ? 1 : (I.holding ? 2 : 0)) + (I.carried ? 'c' : '') + (I.air ? 'a' : '') + '|' + (I.face || '') + '|' + (I.act || '') + '|' + (I.holding || '');
    }
    function personActive() {
      var p = person;
      return p.moving || p.carried || p.z > 0 || now < p.vis.hot || (!!p.ract && !p.ractDone) || !!p.att || !!PMOVES[PCLASS[p.ri.frame]];
    }

    // ------------------------------------------------------------
    //  这一帧该画什么：一张从后到前排好的清单（位置是世界单位，不取整；对齐像素是外壳的事）
    // ------------------------------------------------------------
    function put(list, id, im, x, y, flip, clip) {
      var it = { id: id, img: im, x: x, y: y, flip: !!flip, a: 1 };
      if (clip) it.clip = clip;
      list.push(it);
    }
    function putShadow(list, id, x, y, w, al) {
      var s = shadowOf(Math.max(2, Math.round(w)), al);
      put(list, id, s.im, x - s.cx, y - s.cy, false);
    }
    // 画小球，球心在 (cx, cy)。
    // 贴在别人身上（手里 / 嘴里）时多给 (px, py) = 那张图的左上角，这时 (cx, cy) 是球心相对它的位置，对齐到像素格子：
    // 这样不管外壳怎么取整，球和手 / 嘴之间都不会差出一个像素来回抖
    function putBall(list, cx, cy, px, py) {
      var im = null, x, y, s;
      if (fxBall) { try { im = FXM.ball(ball.rot * Math.PI / 2, ball.sq > 0 ? clamp(ball.sq / 0.07, 0, 1) : 0, R); } catch (e) { artFail('fx.js ball', e); fxBall = false; im = null; } }
      if (im) {
        s = im.scale || 1;
        x = cx - im.ox / s; y = cy - im.oy / s;
        if (px !== undefined) { x = px + qz(x); y = py + qz(y); }
        cx = qz(x) + im.ox / s; cy = qz(y) + im.oy / s;
        ball.box = [cx - BALL_R, cy - BALL_R, cx + BALL_R - 1 / s, cy + BALL_R - 1 / s]; ball.bpx = 1 / s;
      } else {
        im = ball.sq > 0 ? SPR.ball_sq : SPR['ball' + (((Math.floor(ball.rot) % 4) + 4) % 4)];
        if (!im) return;
        x = cx - im.w / 2; y = cy - im.h / 2 + (ball.sq > 0 ? 2 : 0);
        if (px !== undefined) { x = px + qz(x); y = py + qz(y); }
        ball.box = [qz(x), qz(y), qz(x) + im.w - 1, qz(y) + im.h - 1]; ball.bpx = 1;
      }
      put(list, 'ball', im, x, y, false);
      ball.vis = true;
    }
    function ballLoose() { return ball.st === 'free' || ball.st === 'drag' || ball.st === 'handing' || ball.st === 'rest' || ball.st === 'script'; }
    // 画小人；返回 true = 球画在他手里了
    function putPerson(list, a) {
      var face = personFace(), x, y, hx = 0, hy = 0, has = false, half = 0;      // (hx, hy)：手心相对这张图左上角的位置
      var v = a.rig ? shoot(a, face < 0, R, personSig(), PCLASS[a.ri.frame] || 0, personActive(), a.x) : null;
      if (v && v.im.data) {
        var gy = a.y - 1 - a.z - a.lift, im = v.im, s = im.scale;
        x = a.x - im.ox / s; y = gy - im.oy / s;
        put(list, 'person', im, x, y, false, a.clip);
        a.box = [qz(x) + v.bx0, qz(y) + v.by0, qz(x) + v.bx1, qz(y) + v.by1]; a.bpx = v.px;
        a.top = gy - v.top;
        a.ix = x; a.iy = y; a.iox = im.ox / s; a.ioy = im.oy / s;
        if (v.holds) { has = true; hx = im.ox / s + v.hx; hy = im.oy / s - v.hy; }
      } else {
        var sp = SPR[personSprite()];
        if (!sp) return false;
        x = a.x - sp.w / 2; y = a.y - a.z - a.lift - sp.h;
        put(list, 'person', sp, x, y, face < 0, a.clip);
        var bb = sp.bb, bx0 = face < 0 ? sp.w - 1 - bb[2] : bb[0], bx1 = face < 0 ? sp.w - 1 - bb[0] : bb[2];
        a.box = [qz(x) + bx0, qz(y) + bb[1], qz(x) + bx1, qz(y) + bb[3]]; a.bpx = 1;
        a.top = a.box[1];
        a.ix = x; a.iy = y; a.iox = sp.w / 2; a.ioy = sp.h;
        if (sp.hand) {       // 旧图里手的位置记的是"哪一个像素"：球心在那个像素的正中
          var ax = sp.hand[0] + 1, ay = sp.hand[1] + 1;
          has = true; half = 0.5;        // （手里拿的零食，旧版是按那个像素的左上角摆的，差半个像素）
          hx = (face < 0 ? sp.w - 1 - ax : ax) + 0.5; hy = ay + 0.5;
        }
      }
      var drawn = false;
      if (has && a.item) {
        var it = sd(a.item);
        if (it) put(list, 'held', it.im, x + qz(hx - half - (it.l + it.r) / 2), y + qz(hy - half - (it.t + it.b) / 2), false);
      } else if (has && ball.st === 'hand') {
        putBall(list, hx, hy, x, y);
        ball.x = x + hx; ball.y = a.y; ball.z = Math.max(BALL_R, a.y - (y + hy));
        drawn = true;
      }
      putHeld(list, a);
      return drawn;
    }
    // 画一只狗；返回 true = 球画在它嘴里了
    function putDog(list, d) {
      if (!d.rig) return false;
      var sig = dogSig(d), v = shoot(d, d.face < 0, R, sig, sig, dogActive(d), d.x), im = v.im, s = im.scale;
      if (!im.data) return false;
      var gy = d.y - 1 - d.z - d.lift, x = d.x - im.ox / s, y = gy - im.oy / s;
      put(list, d.name, im, x, y, false, d.clip);
      d.box = [qz(x) + v.bx0, qz(y) + v.by0, qz(x) + v.bx1, qz(y) + v.by1]; d.bpx = v.px;
      d.top = gy - v.top;
      d.mx = Math.abs(v.mx);
      d.mouthX = d.x + v.mx; d.mouthY = gy - v.my;
      d.ix = x; d.iy = y; d.iox = im.ox / s; d.ioy = im.oy / s;
      var drawn = false;
      if ((ball.st === 'mouth' || ball.st === 'tug') && ball.holder === d) {
        var jx = ball.st === 'tug' ? (Math.sin(now * 46) > 0 ? 0.6 : -0.6) : 0;
        putBall(list, im.ox / s + v.mx + jx, im.oy / s - v.my, x, y);
        ball.x = d.mouthX; ball.y = d.y; ball.z = Math.max(BALL_R, d.y - d.mouthY);
        drawn = true;
      }
      putHeld(list, d);
      return drawn;
    }
    // 拿在手里 / 叼在嘴里的东西：画在这个角色的那个锚点上（用图上"拿着的那一点" grip 对准），紧跟在它后面画
    function putAt(list, id, a, anchor, art, flip) {
      if (!art || a.ix === undefined) return null;
      var q = anchorOf(a, anchor), g = gripOf(art), x, y;
      x = a.ix + qz(a.iox + q[0] - (flip ? art.im.w / (art.im.scale || 1) - g[0] : g[0]));
      y = a.iy + qz(a.ioy - q[1] - g[1]);
      put(list, id, art.im, x, y, !!flip, a.clip);
      return [x, y];
    }
    function putHeld(list, a) {
      if (a.held) putAt(list, (a.isPerson ? 'held2' : 'held:' + a.name), a, a.held.anchor, sd(a.held.spr), false);
      for (var i = 0; i < props.length; i++) {
        var p = props[i];
        if (p.dead || !p.holder || p.holder.who !== a) continue;
        var art = propArt(p);
        if (!art) { p.box = null; continue; }
        var at = putAt(list, 'prop:' + p.id, a, p.holder.anchor, art, p.face < 0);
        if (at) { p.top = at[1] + art.t; p.x = a.x; p.y = a.y; p.box = null; }
      }
    }
    // 地上的道具：图的底边中间对着它站的那一点
    function putProp(list, p) {
      var art = propArt(p);
      if (!art) { p.box = null; p.top = p.y - p.z - 4; return; }
      var x = p.x - (art.l + art.r) / 2, y = p.y - p.z - art.b;
      put(list, 'prop:' + p.id, art.im, x, y, p.face < 0, p.clip);
      if (p.a < 1) list[list.length - 1].a = p.a;
      p.top = y + art.t;
      var cx = p.x, cy = y + (art.t + art.b) / 2;
      if (p.hot && p.hot.w > 0) p.box = [qz(cx - p.hot.w / 2), qz(cy - p.hot.h / 2), qz(cx - p.hot.w / 2) + p.hot.w, qz(cy - p.hot.h / 2) + p.hot.h];
      else p.box = [qz(x + art.l), qz(y + art.t), qz(x + art.r), qz(y + art.b)];
    }
    function depthOf(e) {
      if (e.isProp) return e.y + (e.front ? 1000 : -0.005);
      return e.y + e.lift * 0.01 + (e === dax ? 0.02 : e === person ? 0.01 : 0) + (e.att ? (e.att.behind ? -0.03 : 0.03) : 0);
    }
    function byDepth(p, q) { return depthOf(p) - depthOf(q); }
    function addHot(hot, b, pad, px) {
      if (b) hot.push([b[0] - pad, b[1] - pad, b[2] - b[0] + px + pad * 2, b[3] - b[1] + px + pad * 2]);
    }
    var order = [];
    function compose() {
      if (!booted) relayout();
      var list = [], i, a, shade = opt.grass ? 0.2 : 0.16;

      // 贴着地面的：灰尘
      for (i = 0; i < parts.length; i++) {
        var pp = parts[i];
        if (pp.k !== 'puff' || !puffN) continue;
        var ps = sd('puff' + Math.min(puffN - 1, Math.floor(pp.t / pp.life * puffN)));
        put(list, 'puff:' + pp.id, ps.im, pp.x - (ps.l + ps.r) / 2, pp.y - ps.b, false);
      }
      // 影子
      if (opt.roam || opt.grass) {
        for (i = 0; i < actors.length; i++) {
          a = actors[i];
          if (a.hidden) continue;
          putShadow(list, 'shadow:' + a.name, a.x, a.y, a.isPerson ? a.half * 0.75 : a.half * 0.8, shade * (a.z > 8 || a.lift ? 0.6 : 1));
        }
        if (ballLoose()) putShadow(list, 'shadow:ball', ball.x, ball.y, clamp(4 - ball.z / 30, 2, 4), shade);
        for (i = 0; i < props.length; i++) {
          var sp0 = props[i];
          if (sp0.dead || sp0.holder || !sp0.shadow) continue;
          var sa = propArt(sp0), sw = typeof sp0.shadow === 'number' ? sp0.shadow : (sa ? (sa.r - sa.l) * 0.45 : 0);
          if (sw >= 1) putShadow(list, 'shadow:prop:' + sp0.id, sp0.x, sp0.y, sw, shade * (sp0.z > 6 ? 0.6 : 1));
        }
      }

      // 角色和地上的道具：谁站得靠下（离我们近）谁后画；球按它落在谁的前后插进去
      order.length = 0;
      for (i = 0; i < actors.length; i++) if (!actors[i].hidden) order.push(actors[i]);
      for (i = 0; i < props.length; i++) if (!props[i].dead && !props[i].holder) order.push(props[i]);
      order.sort(byDepth);
      var ballDrawn = false;
      ball.vis = false;
      for (i = 0; i < order.length; i++) {
        a = order[i];
        if (!ballDrawn && ballLoose() && ball.y <= a.y - 0.5) { putBall(list, ball.x, ball.y - ball.z); ballDrawn = true; }
        if (a.isProp) putProp(list, a);
        else if (a.isPerson ? putPerson(list, a) : putDog(list, a)) ballDrawn = true;
      }
      if (!ballDrawn && ballLoose()) { putBall(list, ball.x, ball.y - ball.z); ballDrawn = true; }
      if ((ball.st === 'hand' || ball.st === 'pocket') && !ballDrawn) ball.box = null;
      if (ball.st === 'pocket') ball.vis = false;

      // 丢出去的零食、飞过去的表情
      for (i = 0; i < items.length; i++) {
        var itm = items[i], k = clamp(itm.t / itm.dur, 0, 1), si = sd(itm.spr);
        if (!si) continue;
        var to = pointOf(itm.to), sx = itm.x0, sy = itm.y0 - itm.z0;
        var ex = to ? to.x : sx, ey = to ? to.y - to.z : sy;
        put(list, 'item:' + itm.id, si.im, sx + (ex - sx) * k - (si.l + si.r) / 2, sy + (ey - sy) * k - Math.sin(Math.PI * k) * itm.peak - (si.t + si.b) / 2, false);
      }
      // 飞溅的小碎屑
      for (i = 0; i < parts.length; i++) {
        pp = parts[i];
        if (pp.k !== 'px') continue;
        var pd = pxOf(pp.c);
        put(list, 'px:' + pp.id, pd.im, pp.x - pd.l, pp.y - pd.t, false);
      }
      // 蝴蝶
      if (bfly.on) {       // 扇翅膀：旧图两帧 a b；新图多一帧"往下压"的 c，按 a b c b 轮
        var bn = bfly.color ? 'bfly2_' : 'bfly_';
        var bs = sd(bn + 'c') ? sd(bn + 'abcb'.charAt(Math.floor(now * 14) % 4)) : sd(bn + ((Math.floor(now * 9) % 2) ? 'a' : 'b'));
        if (bs) put(list, 'bfly', bs.im, bfly.x - (bs.l + bs.r) / 2, bfly.y - (bs.t + bs.b) / 2, false);
      }
      // 表情
      for (i = 0; i < emotes.length; i++) {
        var e = emotes[i], es = emoteArt(e);
        if (!es || e.ent.hidden || e.ent.dead) continue;
        var kk = e.t / e.life;
        if (kk > 0.8 && Math.floor(e.t * 16) % 2) continue;   // 快消失时闪一闪
        var zz = e.type === 'z' || e.type === 'zs';
        var ex2 = e.ent.x + e.dx - (es.l + es.r) / 2 + (zz ? e.t * 4 : Math.sin(e.t * 5 + e.ph) * 1.2);
        var ey2 = (e.ent.top || 0) - es.b - 2 - e.t * 9;
        put(list, 'emote:' + e.id, es.im, ex2, Math.max(-es.t, ey2), false);
      }

      // 哪些地方是"可以点的"（其余地方鼠标直接穿过去）：球、金毛、小人、小腊肠；然后是鼠标在上面停够了的道具
      var hot = [];
      if (ball.vis && home.st === 'out') addHot(hot, ball.box, 4, ball.bpx);
      for (i = 0; i < actors.length; i++) if (!actors[i].hidden) addHot(hot, actors[i].box, 1, actors[i].bpx);
      for (i = 0; i < props.length; i++) if (props[i].live && !props[i].dead && home.st === 'out') addHot(hot, props[i].box, 1, 1 / R);

      // 草地上的小印子
      var dl = [];
      for (i = 0; i < decals.length; i++) {
        var dc = decals[i], da = sd(dc.spr);
        if (!da) continue;
        dl.push({ id: dc.id, img: da.im, x: dc.x - (da.l + da.r) / 2, y: dc.y - da.b, overlay: dc.overlay, flip: dc.flip });
      }

      if (bubble && (now > bubble.until || person.hidden)) bubble = null;
      return {
        items: list, hot: hot, drag: dragging(),
        bubble: bubble ? { text: bubble.text, x: person.x, y: person.top, id: bubble.id } : null,
        decals: dl,
      };
    }

    // 在岛里睡觉的时候，岛上那一小格里画什么（坐标相对那一格的左上角，世界单位）
    var DEN_W = 124, DEN_H = 28;
    function den(RR) {
      if (!booted) relayout();
      RR = RR ? resOf(RR) : R;
      var list = [], w = DEN_W, h = DEN_H;
      var slots = [[gold, w * 0.22], [person, w * 0.5], [dax, w * 0.78]];
      for (var i = 0; i < slots.length; i++) {
        var a = slots[i][0], cx = slots[i][1];
        if (!a.hidden) continue;
        if (a.rig) {
          var sig = a.isPerson ? personSig() : dogSig(a), v = shoot(a, !a.isPerson && cx > w / 2, RR, sig, a.isPerson ? PCLASS[a.ri.frame] || 0 : sig, false, cx), im = v.im;
          if (im.data) put(list, 'den:' + a.name, im, cx - im.ox / im.scale, h - im.oy / im.scale, false);
        }
        if (a.isPerson && !(a.rig && a.vis.im.data)) {
          var s = SPR.p_sit || SPR.p_front_blink;      // 坐在两只睡着的狗狗中间守着
          if (s) put(list, 'den:person', s, cx - s.w / 2, h - s.h + 1, false);
        }
      }
      if ((home.st === 'in' || home.st === 'going') && Math.floor(now * 0.8) % 2) {
        var z = sd('fx_zs');
        if (z) put(list, 'den:z', z.im, w * 0.62 - z.l, 1 - z.t, false);
      }
      return { w: w, h: h, items: list };
    }

    // ------------------------------------------------------------
    //  主循环
    // ------------------------------------------------------------
    // 往前走 dt 秒。一小步最多 1/60 秒（外壳一帧隔得久，这里自己拆成几小步）；隔了太久（电脑刚睡醒）就不追了
    var lastWall = 0, clockAt = -9, placeAt = 0;
    function step(dt) {
      if (!(dt > 0)) return;
      // 墙上的钟两步之间跳了 90 秒以上（机器睡过、屏幕锁过、App 没在跑）：当作刚醒
      var w = wall();
      if (lastWall && (w - lastWall > 90000 || w < lastWall - 1000)) { var gap = w > lastWall ? (w - lastWall) / 1000 : 0; lastWall = w; if (booted) wokeUp(gap); }
      lastWall = w;
      if (dt > 0.25) dt = 0.25;
      var n = Math.ceil(dt * 60 - 1e-6);
      for (var i = 0; i < n; i++) tick(dt / n);
    }
    function tick(dt) {
      if (!booted) relayout();
      now += dt;
      if (now - clockAt >= 0.5) { clockAt = now; clockEvents(); }
      if (!entered && now >= enterAt) { entered = true; enter(); }
      updateCursor(dt);
      updateHome();
      careTick(dt);
      updatePlay();
      runScripts(dt);
      updatePerson(dt);
      updateDog(gold, dt);
      updateDog(dax, dt);
      for (var i = 0; i < actors.length; i++) if (actors[i].att) placeAttached(actors[i]);
      updateBall(dt);
      if (ball.st === 'script') updateBallFly(dt);
      updateBfly(dt);
      updateProps(dt);
      if (now >= placeAt) { placeAt = now + 0.25; placeEvents(); }
      for (i = 0; i < dogs.length; i++) feed(dogs[i], rigInput(dogs[i], dt), dt);
      feed(person, personInput(), dt);
      for (i = 0; i < actors.length; i++) travelled(actors[i]);
      for (i = emotes.length - 1; i >= 0; i--) { emotes[i].t += dt; if (emotes[i].t >= emotes[i].life) emotes.splice(i, 1); }
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.t += dt;
        if (p.k === 'px') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.t >= p.life) parts.splice(i, 1);
      }
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.t += dt;
        if (it.t >= it.dur) {
          if (it.pop) { var q = pointOf(it.to); if (q) emoteAt(it.pop, q.x, q.y - q.z, 0.9); }
          items.splice(i, 1);
        }
      }
    }
    // 走到了屏幕边上 / 岛下面：告诉戏（edge / island），同一个角色同一个地方隔 8 秒才再说一次
    function placeEvents() {
      if (home.st !== 'out') return;
      var ip = host.island && islandOn() && opt.roam ? islandPt() : null;
      for (var i = 0; i < actors.length; i++) {
        var a = actors[i];
        if (a.hidden || a.carried) { a.zone = ''; continue; }
        var z = '';
        if (a.x <= F.x0 + a.half + 3) z = 'left'; else if (a.x >= F.x1 - a.half - 3) z = 'right';
        else if (ip && Math.abs(a.x - ip.x) < 24 && a.y - F.y0 < 12) z = 'island';
        else if (her.dock && opt.roam && a.y >= F.y1 - 2 && a.x > her.dock.x && a.x < her.dock.x + her.dock.w) z = 'dock';
        if (z && z !== a.zone && now - a.zoneAt > 8) { a.zoneAt = now; raise(z === 'island' ? 'island' : (z === 'dock' ? 'dock' : 'edge'), { who: a, side: z }); }
        a.zone = z;
      }
    }
    function feed(a, I, dt) {
      if (!a.rig) return;
      try { a.rig.update(dt, I); }
      catch (e) { artFail((a.isPerson ? 'person.js' : 'dogs.js ' + a.name) + ' update', e); if (++a.vis.bad >= 3) a.rig = null; }
    }
    // 现在有多"忙"：0 = 什么都不动，2 = 正在动（外壳据此决定画得多勤）
    function busy() {
      if (!booted) relayout();
      if (!entered) return 2;                                                // 马上要出场了
      if (home.st === 'in' && !pointer.drag && !pointer.grab) return 0;     // 都在岛里睡觉：没什么要画的
      if (pointer.drag || pointer.grab || ball.st === 'free' || ball.st === 'mouth' || ball.st === 'tug' || ball.st === 'script' || emotes.length || parts.length || items.length ||
          mainScript() || home.st === 'going' || home.st === 'leaving') return 2;
      if (person.moving || person.ract || person.att || (person.st !== 'idle' && person.st !== 'front' && person.st !== 'sleep')) return 2;
      if (dogs.some(function (d) { return !d.hidden && (d.sp > 1 || d.z > 0 || d.ract || d.st === 'wait' || d.st === 'spin' || d.wag > 0.55 || ((d.st === 'pose' || d.st === 'scene') && d.t < 0.6) || d.pose === 'scratch' || d.pose === 'dig' || d.pose === 'roll'); })) return 2;
      for (var i = 0; i < props.length; i++) if (props[i].holder || props[i].vz || props[i].vx || props[i].vy) return 2;
      if (bfly.on || pointer.inside) return 1;
      return 0;
    }

    // ============================================================
    //  照料：喂饭、喝水、拉粑粑（needs.js + scenes/care.js）
    // ============================================================
    var CARE = {};
    function careBoot() {}
    function careResume(gap) {}
    function careTick(dt) {}
    function careEnded(sc, cancelled, why) {}
    function careThink(d) { return false; }
    function careWaiting() { return false; }
    function careConfigure(o) {}
    function careFeedNow() {}
    function careStatus() { return null; }
    function careHooks() { return {}; }
    function careOut(first) {}
    // 从岛里出来了（out）；今天头一回出来（first）
    var outDay = '';
    function cameOut() {
      var first = outDay !== clk.day;
      outDay = clk.day;
      raise('out', { first: first });
      careOut(first);
    }

    // ------------------------------------------------------------
    //  对外接口
    // ------------------------------------------------------------
    function configure(o) {
      if (!o) return;
      var re = false;
      if (typeof o.auto === 'boolean') { opt.auto = o.auto; if (!o.auto) play.rounds = 0; }
      if (typeof o.roam === 'boolean' && o.roam !== opt.roam) { opt.roam = o.roam; re = true; endScene(true, 'layout'); clearProps(false, false); API.roam = opt.roam; }
      if (typeof o.grass === 'boolean') opt.grass = o.grass;
      if (typeof o.soft === 'boolean') opt.soft = o.soft;     // 画得吃力的机器：角色少重画几次
      if (o.view && o.view.w > 0 && o.view.h > 0) { VW = +o.view.w; VH = +o.view.h; re = true; }
      if (o.insets) {
        INS = { top: +o.insets.top || 0, bottom: +o.insets.bottom || 0, left: +o.insets.left || 0, right: +o.insets.right || 0 };
        re = true;
      }
      if (o.res !== undefined && resOf(o.res) !== R) { R = resOf(o.res); loadArt(); }
      if (typeof o.feeding === 'boolean' || typeof o.potty === 'boolean' || typeof o.water === 'boolean') careConfigure(o);
      if (re && (booted || o.view)) relayout();
    }
    function command(name) {
      if (!booted) relayout();
      if (name === 'throw') { touchAll(); if (home.st === 'in' || home.st === 'going') comeOut(); play.want = now + 9; }
      else if (name === 'wave') { if (home.st === 'in') comeOut(); else { touchAll(); personWave(); } }
      else if (name === 'home') { home.auto = false; goHome(); home.inAt = now; }
      else if (name === 'out') comeOut();
      else if (name === 'toggleHome') { if (home.st === 'out') { home.auto = false; goHome(); home.inAt = now; } else comeOut(); }
      else if (name === 'love') {
        touchAll();
        if (home.st === 'in') { comeOut(); return; }
        dogs.forEach(function (d) { if (!d.hidden) pet(d); });
        if (!person.scene && (person.st === 'idle' || person.st === 'front')) personWave();
      }
      else if (name === 'gather') {
        if (home.st === 'in') { comeOut(); return; }
        touchAll(); endScene(false, 'gather');
        var ip = islandPt(), gy = clamp(ip.y + 46, F.y0, F.y1);
        if (play.phase === 'rest') {
          dogs.forEach(function (d, i) { if (d.hidden || d.carried || (d.scene && !d.scene.dead)) return; d.st = 'come'; d.t = 0; d.pose = 'stand'; d.wag = 1; d.tx = ip.x + (i ? 26 : -34); d.ty = gy + ry(i ? 4 : -2); });
          if (!person.carried && !person.scene && (person.st === 'idle' || person.st === 'front' || person.st === 'walk' || person.st === 'act')) { person.st = 'come'; person.t = 0; person.tx = ip.x; person.ty = gy; }
        }
      }
      else if (name === 'feed') { touchAll(); careFeedNow(); }
      else if (name === 'tuck') { touchAll(); raise('tuck', {}); }
    }
    // type: down | move | up | hover | leave；返回 true = 这一下落在球或者谁身上了（正在拖 / 拎的过程也算）
    function onPointer(type, x, y) {
      if (!booted) relayout();
      if (type === 'down') return ptDown(x, y);
      if (type === 'move') return ptMove(x, y);
      if (type === 'up') return ptUp();
      if (type === 'hover') ptHover(x, y);
      else if (type === 'leave') ptLeave();
      return false;
    }
    function status() {
      if (!booted) relayout();
      readClock();
      var sc = sceneRunning(), o = { home: home.st, fetch: stats.fetch, pets: stats.pets, night: isNight(), auto: opt.auto, roam: opt.roam,
               scene: sc ? sc.name : '', phase: dayPhase(), drag: dragging() };
      var c = careStatus();
      if (c) o.care = c;
      return o;
    }
    // 剧本出错：告诉外壳一声（同一句只说一次），记下来给测试看
    var sceneErrors = [];
    function sceneFail(what, e) {
      var m = what + ': ' + ((e && e.message) || e);
      if (sceneErrors.indexOf(m) >= 0 || sceneErrors.length >= 40) return;
      sceneErrors.push(m);
      if (host.log) { try { host.log(m); } catch (e2) {} }
    }

    loadArt();
    loadPacks();
    bindApi();
    return {
      configure: configure,
      step: step,
      compose: compose,
      pointer: onPointer,
      command: command,
      sense: sense,
      status: status,
      busy: busy,
      den: den,
      setQuality: function (q) { quality = +q >= 0 ? +q : 1; },
      // 给测试用
      _t: {
        step: step,
        compose: compose,
        state: function () {
          if (!booted) relayout();
          var sc = sceneRunning();
          return {
            now: now, phase: play.phase, rounds: play.rounds, home: home.st, scene: sc ? sc.name : null, scenes: sceneCount,
            ball: { st: ball.st, x: ball.x, y: ball.y, z: ball.z, holder: ball.holder && ball.holder.kind },
            person: { st: person.st, x: person.x, y: person.y, hidden: person.hidden, scene: person.scene ? person.scene.name : null },
            dax: { st: dax.st, pose: dax.pose, x: dax.x, y: dax.y, z: dax.z, sp: dax.sp, hidden: dax.hidden, scene: dax.scene ? dax.scene.name : null },
            gold: { st: gold.st, pose: gold.pose, x: gold.x, y: gold.y, z: gold.z, sp: gold.sp, energy: gold.energy, hidden: gold.hidden, scene: gold.scene ? gold.scene.name : null },
            LW: LW, LH: LH, F: F, R: R, roam: opt.roam, bfly: bfly.on,
            scripts: scripts.filter(function (s) { return !s.dead; }).map(function (s) { return s.name; }),
            props: props.length, cursor: { known: cur.known, x: cur.x, y: cur.y, still: cur.still, speed: cur.speed }, her: { idle: her.idle, away: her.away, engaged: her.engaged },
          };
        },
        boxes: function () { return { ball: ball.vis ? ball.box : null, dax: dax.hidden ? null : dax.box, gold: gold.hidden ? null : gold.box, person: person.hidden ? null : person.box }; },
        set: function (k, v) {
          if (k === 'nextAt') play.nextAt = v; if (k === 'msgAt') person.msgAt = v; if (k === 'energy') gold.energy = v;
          if (k === 'sceneAt') nextSceneAt = v; if (k === 'bfly') bfly.nextAt = v; if (k === 'touch') lastTouch = v;
          if (k === 'rigFps') { RIG_FPS = v; CALM_FPS = v; }      // 测试时可以让骨架每一帧都重画
          if (k === 'world') { world = v; if (!world.plays) world.plays = {}; if (!world.mem) world.mem = {}; if (!world.decals) world.decals = []; }
        },
        // 指名演一段：普通的 scene 照常（演员得有空）；solo / react / care 也行（ev 是假装出了的那件事）
        scene: function (name, ev) { nextSceneAt = 1e9; return pickScene(name, ev); },
        endScene: function () { endScene(true, 'test'); },
        raise: function (name, ev) { return !!raise(name, ev || {}); },
        // 登记了哪些戏：{ name, zh, kind, cast, on, weight, tag, mood, family, cat, pack, n, off }
        list: function () {
          return DEFS.map(function (d) {
            return { name: d.name, zh: d.zh, kind: d.kind, cast: d.cast.join(' '), on: d.on.join(' '), at: d.at ? d.at.join(' ') : '', weight: typeof d.weight === 'function' ? 'fn' : d.weight,
                     cool: d.cool, cap: d.cap, tag: d.tag, mood: d.mood, family: d.family, cat: d.cat, pack: d.pack, n: d.n, off: d.off, overlay: d.overlay };
          });
        },
        events: function () { return evLog.slice(); },
        props: function () { return props.map(function (p) { return { id: p.id, kind: p.kind, state: p.state, x: p.x, y: p.y, z: p.z, held: p.holder ? p.holder.who.name : null, live: p.live, born: p.born, owner: p.owner ? p.owner.name : null }; }); },
        sceneErrors: function () { return sceneErrors.slice(); },
        sense: sense,
        care: careHooks(),
        // 画图的文件出过什么错（没出过就是空的）
        errors: function () { return artErrors.slice(); },
        // 每个角色的骨架一共重画了几次、其中几次像素真的变了
        perf: function () {
          var o = {};
          actors.forEach(function (a) { o[a.name] = { renders: a.vis.n, changed: a.vis.ch }; });
          return o;
        },
      },
    };
  }

  G.PET_ENGINE = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
