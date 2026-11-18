// ============================================================
//  球球 · 可以自己改的设定
//  改完之后重新运行一次  bash install.sh  就会生效。
//  看不懂也没关系：把这个文件交给 Claude Code，说"帮我改成……"就行。
// ============================================================
var PET_CONFIG = {

  // —— 穿西装的小人 ——（颜色用 #RRGGBB）
  person: {
    hair:  '#2b2530',   // 头发
    skin:  '#f3c9a5',   // 肤色
    suit:  '#3a4c7a',   // 西装
    shirt: '#f6f4ef',   // 衬衫
    tie:   '#d0353f',   // 领带
    shoes: '#2a2024',   // 皮鞋
  },

  // —— 小腊肠的毛色 ——  'red' 红棕 | 'blacktan' 黑棕 | 'cream' 奶油
  dachshund: 'red',

  // —— 小人偶尔会说的话（可以留空）——
  // 每行一句，小人会隔一阵子转过来挥挥手，随机说其中一句。
  // 例：messages: ['休息一下吧', '记得喝水', '我在呢'],
  messages: [],

  // 每隔多少分钟说一句（最短, 最长）
  messageMinutes: [25, 60],

  // —— 小人自动丢球 ——  每隔多少秒玩一轮（最短, 最长）
  autoPlaySeconds: [35, 90],

  // —— 夜里睡觉 ——  [几点开始, 几点结束]，这段时间它们会回岛里睡觉，不自动丢球。
  // 点一下灵动岛它们还是会出来陪玩。不想要就写 null。
  nightSleep: [0, 7],

  // —— 灵动岛上显示两地的时间（可以留空）——
  // 例：clock: [{ label: '台北', tz: 'Asia/Taipei' }, { label: '他那边', tz: 'America/Los_Angeles' }],
  clock: null,

  // —— 灵动岛上显示"还有几天见面"（可以留空）——  例：reunion: '2027-02-14',
  reunion: null,

  // —— 小人在小剧场里说的话（可以留空；空着他就不说话，用表情代替）——
  // 每一项是一句或者几句（几句就随便挑一句）。例：lines: { morning: ['早安'], night: ['晚安，好梦'], welcome: ['你回来啦'] },
  // 写 lines: true 的话，他会说戏里自带的那几句（繁体 / 简体 / 英文，跟着系统语言）。
  lines: {},

  // —— 特别的日子（可以留空）——  on 写 'MM-DD'（每年）或 'YYYY-MM-DD'（那一天）；kind: 'birthday' | 'anniversary' | 'gift' | 'note'
  // 例：dates: [{ on: '05-20', kind: 'anniversary', line: '纪念日快乐' }],
  dates: [],

  // —— 它们有多闹 ——  0.5 安静一点 … 1 默认 … 1.5 热闹一点
  liveliness: 1,
  // 这几个钟点里只演安静的小戏（比如上班时间）。例：quietHours: [[9, 12], [14, 18]],
  quietHours: [],
  // 鼠标停在它们旁边时，它们会凑过来、跟着鼠标玩。不想要就写 false
  cursorPlay: true,
  // 新的小剧场头几个星期每天放出几段（每天都有没见过的）。写 false = 第一天就全部都有
  discovery: true,
  // 睡过的地方第二天开小花这一类"留在草地上的小印子"。不想要就写 false
  lawnMemories: true,

  // —— 喂饭和拉粑粑（小人自己会照顾两只狗）——
  care: {
    feeding: true,               // 小人到点自己喂饭（菜单里的开关会盖过这里）
    potty: true,                 // 狗狗会拉粑粑，小人会收拾（同上）
    water: true,                 // 吃完饭喝水，玩累了也喝
    meals: ['08:00', '18:30'],   // 几点开饭（本地时间，最多三顿；可以改成她家狗狗真的吃饭的时间）
    biscuitTime: '15:30',        // 每天一块饼干；不要就写 null
    lucky: true,                 // 很少很少会出现一次"狗屎运"
    lines: null,                 // null 小人不说话；true 说自带的几句；也可以自己写 { meal: '开饭啦', thanks: '谢谢你' }
    goldSide: 'auto',            // 金毛习惯在哪一边上厕所：'left' | 'right' | 'auto'
  },
};
