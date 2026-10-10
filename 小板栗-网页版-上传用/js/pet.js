/* =========================================================
   像素陪伴小人 · 16x16 像素网格程序化绘制
   - 32 种形态（姿势/表情/道具），每次打开随机且不与上次重复
   - 陪伴小动物：橘猫 / 柴犬 / 灰猫（随使用天数依次出现）
   - 对外接口：create / randomize / say / cheer / setExtraLines /
             setAnimals / renderTo / focusPose / focusLine
   ========================================================= */
const Pet = (() => {
  const GRID = 16;
  const SCALE = 8; // 主画布 128x128
  const PET_STORE_KEY = 'pixel-calendar:pet';

  /* 调色板 */
  const PAL = {
    line: '#4a3336',
    fur: '#ffeed6',
    furDark: '#ecc9a2',
    earIn: '#ffb3c6',
    eye: '#3d2b2f',
    blush: '#ffb8c9',
    mouth: '#5a3f44',
    feet: '#e8a7bd',
    gold: '#ffcf4d',
    heartPink: '#ff6b95',
    steam: '#b9a6e0',
    tearBlue: '#8fd3ff',
    bookA: '#9cc4ff',
    bookB: '#6fa8f5',
    flagOrange: '#ff9f43',
    notePurple: '#b48cf2',
    zzz: '#a18ec9',
    cupBlue: '#79b9ff',
    cupTea: '#d9a066',
    melonGreen: '#5aa75a',
    melonDark: '#3e7a3e',
    umbrellaRed: '#ff7d7d',
    umbrellaPole: '#d9a066',
    candleBlue: '#79b9ff',
    giftRed: '#ff7d7d',
    camBody: '#5a5a72',
    camLens: '#2b2b3a',
    yarnPink: '#ff8fab',
    yarnDark: '#e06a8a',
    flowerPink: '#ff6b95',
    stemGreen: '#7ec87e',
    cloudPurple: '#c9c2e8',
    iceCreamPink: '#ffb0c8',
    coneBrown: '#d9a066',
    micHead: '#9aa4b2',
    micPole: '#5a5a72',
    bubbleBlue: '#bcd9ff',
    bubbleLight: '#d6e7ff',
    ballRed: '#ff8f8f',
    ballCream: '#fff4e0',
    letterCream: '#fff4dc',
    letterLine: '#d9b98a',
    stampRed: '#ff7d7d',
    weightGray: '#5a5a72',
    weightLight: '#8a8aa2',
    hatStraw: '#e8c27a',
    hatBand: '#ff7d7d',
    hpGray: '#4a4a5e',
  };

  /* 每套衣服颜色循环使用 */
  const BODY_COLORS = [
    '#ff8fab', '#8cc8ff', '#a8e6a3', '#ffd166', '#c9a7ff', '#ffaa7d',
    '#7fd8c8', '#ff9fb0', '#9fc0ff', '#e0c27a', '#b0e0a0', '#ffb0d0',
  ];

  /* 32 种形态 */
  const VARIANTS = [
    /* ---- 原有 12 种 ---- */
    { name: '挥手', eyes: 'happy',   mouth: 'smile', armL: 'down', armR: 'wave', prop: null,     bubble: '嗨！今天也要元气满满～' },
    { name: '眨眼', eyes: 'wink',    mouth: 'smile', armL: 'down', armR: 'hips', prop: null,     bubble: '嘿嘿，被你发现我眨眼啦' },
    { name: '打盹', eyes: 'closed',  mouth: 'flat',  armL: 'none', armR: 'none', prop: 'zzz',    bubble: '呼……呼……（睡得好香）' },
    { name: '闪光', eyes: 'sparkle', mouth: 'open',  armL: 'up',   armR: 'up',   prop: 'stars',  bubble: '哇！你今天也超棒的！' },
    { name: '比心', eyes: 'happy',   mouth: 'smile', armL: 'down', armR: 'hold', prop: 'heart',  bubble: '给你一颗小心心～' },
    { name: '举旗', eyes: 'open',    mouth: 'smile', armL: 'down', armR: 'wave', prop: 'flag',   bubble: '冲冲冲！我会给你加油的！' },
    { name: '喝茶', eyes: 'happy',   mouth: 'smile', armL: 'down', armR: 'hold', prop: 'cup',    bubble: '要不要一起喝杯茶呀？' },
    { name: '蹦跳', eyes: 'happy',   mouth: 'open',  armL: 'up',   armR: 'up',   prop: null,     bubble: '蹦蹦跶跶，开心开心！', bob: true },
    { name: '唱歌', eyes: 'closed',  mouth: 'open',  armL: 'down', armR: 'hips', prop: 'note',   bubble: '啦啦啦～♪' },
    { name: '看书', eyes: 'open',    mouth: 'flat',  armL: 'down', armR: 'hold', prop: 'book',   bubble: '今天也读两页书吧～' },
    { name: '想哭', eyes: 'closed',  mouth: 'flat',  armL: 'down', armR: 'down', prop: 'tears',  bubble: '呜……可以抱一下吗？' },
    { name: '加冕', eyes: 'happy',   mouth: 'smile', armL: 'down', armR: 'hips', prop: 'crown',  bubble: '今天的你，就是主角！' },
    /* ---- 新增 20 种 ---- */
    { name: '吃瓜', eyes: 'happy',   mouth: 'open',  armL: 'hold', armR: 'hold', prop: 'melon',    bubble: '夏天就是要吃西瓜～' },
    { name: '撑伞', eyes: 'open',    mouth: 'flat',  armL: 'down', armR: 'wave', prop: 'umbrella', bubble: '下雨也没关系，我来罩你' },
    { name: '蛋糕', eyes: 'sparkle', mouth: 'open',  armL: 'down', armR: 'hold', prop: 'cake',     bubble: '生日快乐！快许个愿～' },
    { name: '礼物', eyes: 'wink',    mouth: 'smile', armL: 'down', armR: 'hold', prop: 'gift',     bubble: '快拆开看看嘛～' },
    { name: '拍照', eyes: 'open',    mouth: 'smile', armL: 'down', armR: 'wave', prop: 'camera',   bubble: '咔嚓！记录下这一刻' },
    { name: '风筝', eyes: 'happy',   mouth: 'open',  armL: 'down', armR: 'wave', prop: 'kite',     bubble: '看，风筝飞得好高！' },
    { name: '毛线球', eyes: 'sparkle', mouth: 'smile', armL: 'down', armR: 'down', prop: 'yarn',   bubble: '毛线球滚呀滚～' },
    { name: '闻花香', eyes: 'closed', mouth: 'smile', armL: 'down', armR: 'hold', prop: 'flower', bubble: '好香呀……' },
    { name: '看云', eyes: 'open',    mouth: 'flat',  armL: 'hips', armR: 'down', prop: 'cloud',    bubble: '今天的云像棉花糖' },
    { name: '冰淇淋', eyes: 'happy', mouth: 'open',  armL: 'down', armR: 'wave', prop: 'icecream', bubble: '给你也来一口？' },
    { name: '麦克风', eyes: 'closed', mouth: 'open', armL: 'down', armR: 'wave', prop: 'mic',      bubble: '让我为你唱首歌～' },
    { name: '魔法杖', eyes: 'sparkle', mouth: 'open', armL: 'down', armR: 'wave', prop: 'wand',    bubble: '嘛哩嘛哩哄——变快乐！' },
    { name: '举太阳', eyes: 'happy',  mouth: 'smile', armL: 'up',  armR: 'up',   prop: 'sun',      bubble: '把太阳送给你！' },
    { name: '草帽', eyes: 'wink',    mouth: 'smile', armL: 'hips', armR: 'down', prop: 'hat',      bubble: '这顶帽子适合我吗？' },
    { name: '听歌', eyes: 'closed',  mouth: 'smile', armL: 'down', armR: 'down', prop: 'headphone', bubble: '一起听会儿歌吧～' },
    { name: '吹泡泡', eyes: 'happy', mouth: 'open',  armL: 'down', armR: 'down', prop: 'bubbles',  bubble: '泡泡飘呀飘～' },
    { name: '数星星', eyes: 'sparkle', mouth: 'open', armL: 'down', armR: 'wave', prop: 'bigstar', bubble: '今晚的星星好多呀' },
    { name: '玩皮球', eyes: 'happy', mouth: 'open',  armL: 'down', armR: 'down', prop: 'ball',     bubble: '看我踢一脚！' },
    { name: '写小信', eyes: 'open',  mouth: 'flat',  armL: 'down', armR: 'hold', prop: 'letter',   bubble: '给你写了一封小信哦' },
    { name: '举哑铃', eyes: 'open',  mouth: 'open',  armL: 'down', armR: 'wave', prop: 'dumbbell', bubble: '嘿咻嘿咻，锻炼一下！' },
  ];

  /* 专注模式卖萌台词 */
  const FOCUS_LINES = [
    '加油加油！',
    '我在这儿陪着你～',
    '专注的样子最好看！',
    '悄悄说：你超棒的',
    '再坚持一下下！',
    '要不要伸个懒腰？',
    '喝口水也没关系哦',
    '你已经很棒啦',
    '我会安静陪着你的',
    '噗噜噗噜，专注泡泡～',
    '累了就看看我呀',
    '陪你到完成的那一刻！',
  ];

  /* 小动物伙伴：橘猫 / 柴犬 / 灰猫 */
  const ANIMAL_LIST = [
    { kind: 'cat', pal: { fur: '#ffb26b', furD: '#e08d45', earIn: '#ffb3c6', belly: '#fff4e0' } },
    { kind: 'dog', pal: null },
    { kind: 'cat', pal: { fur: '#b9b9cc', furD: '#9898ad', earIn: '#ffb3c6', belly: '#f0f0f8' } },
  ];

  let rootEl = null;
  let teamEl = null;
  let canvas = null;
  let g = null;
  let bubbleEl = null;
  let bubbleTimer = 0;
  let currentIdx = -1;
  let extraLines = [];
  let lastFocusIdx = -1;
  let lastFocusLine = '';
  const animals = [];

  /* ---------- 像素画笔（参数化 ctx 与缩放） ---------- */
  function penFor(c, s) {
    return {
      px(x, y, color, oy = 0) {
        c.fillStyle = color;
        c.fillRect(x * s, (y + oy) * s, s, s);
      },
      rect(x, y, w, h, color, oy = 0) {
        c.fillStyle = color;
        c.fillRect(x * s, (y + oy) * s, w * s, h * s);
      },
    };
  }

  /* ---------- 五官 ---------- */
  function drawEyes(P, kind, oy) {
    switch (kind) {
      case 'closed':
        P.rect(5, 6, 2, 1, PAL.eye, oy);
        P.rect(9, 6, 2, 1, PAL.eye, oy);
        break;
      case 'happy':
        P.px(5, 6, PAL.eye, oy); P.px(6, 5, PAL.eye, oy);
        P.px(9, 5, PAL.eye, oy); P.px(10, 6, PAL.eye, oy);
        break;
      case 'wink':
        P.rect(5, 5, 2, 2, PAL.eye, oy);
        P.rect(9, 6, 2, 1, PAL.eye, oy);
        break;
      case 'sparkle':
        P.rect(5, 5, 2, 2, PAL.gold, oy);
        P.rect(9, 5, 2, 2, PAL.gold, oy);
        break;
      default: /* open */
        P.rect(5, 5, 2, 2, PAL.eye, oy);
        P.rect(9, 5, 2, 2, PAL.eye, oy);
    }
  }

  function drawMouth(P, kind, oy) {
    switch (kind) {
      case 'open':
        P.rect(7, 7, 2, 2, PAL.mouth, oy);
        break;
      case 'flat':
        P.rect(7, 7, 2, 1, PAL.mouth, oy);
        break;
      default: /* smile */
        P.px(6, 7, PAL.mouth, oy); P.px(9, 7, PAL.mouth, oy);
        P.px(7, 8, PAL.mouth, oy); P.px(8, 8, PAL.mouth, oy);
    }
  }

  /* ---------- 手臂 ---------- */
  function drawArm(P, side, pose, oy) {
    const c = PAL.furDark;
    if (pose === 'none') return;
    if (side === 'L') {
      switch (pose) {
        case 'up':
          P.px(4, 10, c, oy); P.px(3, 9, c, oy); P.px(2, 8, c, oy); P.px(2, 7, c, oy);
          break;
        case 'hips':
          P.px(4, 10, c, oy); P.px(3, 11, c, oy); P.px(4, 12, c, oy);
          break;
        case 'hold':
          P.px(4, 12, c, oy);
          break;
        default: /* down */
          P.rect(4, 10, 1, 3, c, oy);
      }
    } else {
      switch (pose) {
        case 'wave':
        case 'up':
          P.px(11, 10, c, oy); P.px(12, 9, c, oy); P.px(13, 8, c, oy); P.px(13, 7, c, oy);
          break;
        case 'hips':
          P.px(11, 10, c, oy); P.px(12, 11, c, oy); P.px(11, 12, c, oy);
          break;
        case 'hold':
          P.px(11, 12, c, oy);
          break;
        default: /* down */
          P.rect(11, 10, 1, 3, c, oy);
      }
    }
  }

  /* ---------- 道具 / 配件 ---------- */
  function drawProp(P, prop, oy) {
    switch (prop) {
      case 'zzz':
        P.px(13, 5, PAL.zzz, 0); P.px(14, 3, PAL.zzz, 0); P.px(15, 1, PAL.zzz, 0);
        break;
      case 'stars':
        P.px(14, 3, PAL.gold, 0); P.px(13, 4, PAL.gold, 0); P.px(14, 4, PAL.gold, 0);
        P.px(15, 4, PAL.gold, 0); P.px(14, 5, PAL.gold, 0);
        P.px(2, 6, PAL.gold, 0); P.px(15, 10, PAL.gold, 0);
        break;
      case 'heart':
        P.px(13, 3, PAL.heartPink, 0); P.px(15, 3, PAL.heartPink, 0);
        P.px(13, 4, PAL.heartPink, 0); P.px(14, 4, PAL.heartPink, 0); P.px(15, 4, PAL.heartPink, 0);
        P.px(14, 5, PAL.heartPink, 0);
        break;
      case 'flag':
        P.rect(13, 7, 1, 5, PAL.line, 0);
        P.rect(14, 6, 2, 2, PAL.flagOrange, 0);
        P.px(14, 8, PAL.flagOrange, 0);
        break;
      case 'cup':
        P.rect(13, 12, 3, 2, PAL.cupBlue, 0);
        P.rect(13, 11, 3, 1, PAL.cupTea, 0);
        P.px(14, 9, PAL.steam, 0); P.px(15, 10, PAL.steam, 0);
        break;
      case 'note':
        P.rect(13, 5, 1, 4, PAL.notePurple, 0);
        P.rect(12, 9, 2, 2, PAL.notePurple, 0);
        P.px(14, 5, PAL.notePurple, 0);
        break;
      case 'book':
        P.rect(12, 11, 2, 2, PAL.bookA, 0);
        P.rect(14, 11, 2, 2, PAL.bookB, 0);
        break;
      case 'tears':
        P.px(4, 7, PAL.tearBlue, oy); P.px(11, 7, PAL.tearBlue, oy);
        break;
      case 'crown':
        P.rect(6, 1, 4, 1, PAL.gold, oy);
        P.px(6, 0, PAL.gold, oy); P.px(9, 0, PAL.gold, oy);
        break;
      /* ---- 新增道具 ---- */
      case 'melon':
        P.px(12, 10, PAL.melonDark, 0);
        P.rect(13, 11, 2, 1, PAL.melonGreen, 0);
        P.rect(12, 12, 4, 1, PAL.melonGreen, 0);
        P.px(13, 12, PAL.melonDark, 0);
        P.rect(13, 13, 2, 1, PAL.melonGreen, 0);
        break;
      case 'umbrella':
        P.px(14, 4, PAL.umbrellaRed, 0);
        P.rect(13, 5, 3, 1, PAL.umbrellaRed, 0);
        P.rect(13, 6, 3, 1, PAL.umbrellaRed, 0);
        P.px(15, 6, '#ffffff', 0);
        P.rect(14, 7, 1, 4, PAL.umbrellaPole, 0);
        break;
      case 'cake':
        P.rect(13, 12, 3, 2, PAL.earIn, 0);
        P.rect(13, 11, 3, 1, '#fff4e0', 0);
        P.px(14, 10, PAL.candleBlue, 0);
        P.px(14, 9, PAL.gold, 0);
        P.px(13, 13, PAL.heartPink, 0); P.px(15, 13, PAL.heartPink, 0);
        break;
      case 'gift':
        P.rect(13, 11, 3, 3, PAL.giftRed, 0);
        P.px(14, 11, PAL.gold, 0); P.px(14, 12, PAL.gold, 0); P.px(14, 13, PAL.gold, 0);
        P.px(13, 10, PAL.gold, 0); P.px(14, 10, PAL.gold, 0); P.px(15, 10, PAL.gold, 0);
        break;
      case 'camera':
        P.px(13, 8, PAL.camBody, 0);
        P.rect(12, 9, 4, 3, PAL.camBody, 0);
        P.rect(13, 10, 2, 1, PAL.camLens, 0);
        P.px(15, 9, '#ffffff', 0);
        break;
      case 'kite':
        P.px(13, 3, PAL.gold, 0);
        P.rect(13, 4, 2, 1, PAL.flagOrange, 0);
        P.px(13, 5, PAL.flagOrange, 0);
        P.px(14, 6, PAL.flagOrange, 0);
        P.px(14, 8, PAL.flagOrange, 0);
        break;
      case 'yarn':
        P.rect(12, 13, 3, 2, PAL.yarnPink, 0);
        P.px(13, 13, PAL.yarnDark, 0);
        P.px(13, 14, PAL.yarnDark, 0);
        P.px(15, 14, PAL.yarnDark, 0);
        break;
      case 'flower':
        P.px(13, 11, PAL.flowerPink, 0);
        P.px(12, 12, PAL.flowerPink, 0); P.px(13, 12, PAL.gold, 0); P.px(14, 12, PAL.flowerPink, 0);
        P.px(13, 13, PAL.stemGreen, 0); P.px(13, 14, PAL.stemGreen, 0);
        break;
      case 'cloud':
        P.rect(13, 0, 2, 1, PAL.cloudPurple, 0);
        P.rect(12, 1, 4, 1, PAL.cloudPurple, 0);
        break;
      case 'icecream':
        P.rect(13, 9, 2, 2, PAL.iceCreamPink, 0);
        P.px(14, 9, '#ffffff', 0);
        P.rect(13, 11, 2, 2, PAL.coneBrown, 0);
        P.px(13, 13, PAL.coneBrown, 0);
        break;
      case 'mic':
        P.rect(13, 5, 3, 2, PAL.micHead, 0);
        P.rect(14, 7, 1, 4, PAL.micPole, 0);
        break;
      case 'wand':
        P.px(14, 4, PAL.notePurple, 0);
        P.px(13, 5, PAL.notePurple, 0); P.px(14, 5, PAL.gold, 0); P.px(15, 5, PAL.notePurple, 0);
        P.px(14, 6, PAL.notePurple, 0);
        P.rect(14, 7, 1, 3, PAL.umbrellaPole, 0);
        break;
      case 'sun':
        P.rect(13, 2, 2, 2, PAL.gold, 0);
        P.px(13, 1, PAL.gold, 0); P.px(15, 2, PAL.gold, 0);
        P.px(12, 2, PAL.gold, 0); P.px(13, 4, PAL.gold, 0);
        break;
      case 'hat':
        P.rect(5, 0, 4, 1, PAL.hatStraw, 0);
        P.rect(4, 1, 8, 1, PAL.hatStraw, 0);
        P.px(5, 1, PAL.hatBand, 0); P.px(10, 1, PAL.hatBand, 0);
        break;
      case 'headphone':
        P.rect(4, 0, 8, 1, PAL.hpGray, 0);
        P.rect(2, 4, 1, 2, PAL.hpGray, 0);
        P.rect(13, 4, 1, 2, PAL.hpGray, 0);
        break;
      case 'bubbles':
        P.px(13, 5, PAL.bubbleBlue, 0);
        P.px(14, 7, PAL.bubbleBlue, 0);
        P.px(15, 4, PAL.bubbleLight, 0);
        P.px(13, 8, PAL.bubbleLight, 0);
        P.px(15, 9, PAL.bubbleBlue, 0);
        break;
      case 'bigstar':
        P.rect(6, 0, 2, 2, PAL.gold, 0);
        P.px(5, 0, PAL.gold, 0); P.px(8, 0, PAL.gold, 0);
        P.px(13, 3, PAL.gold, 0); P.px(15, 5, PAL.gold, 0);
        break;
      case 'ball':
        P.px(13, 12, PAL.ballRed, 0);
        P.rect(12, 13, 3, 1, PAL.ballRed, 0);
        P.rect(12, 14, 3, 1, PAL.ballRed, 0);
        P.px(13, 13, PAL.ballCream, 0);
        break;
      case 'letter':
        P.rect(12, 11, 4, 3, PAL.letterCream, 0);
        P.px(13, 12, PAL.letterLine, 0); P.px(14, 12, PAL.letterLine, 0);
        P.px(15, 11, PAL.stampRed, 0);
        break;
      case 'dumbbell':
        P.rect(13, 5, 1, 3, PAL.weightGray, 0);
        P.rect(15, 5, 1, 3, PAL.weightGray, 0);
        P.rect(14, 6, 1, 1, PAL.weightLight, 0);
        break;
    }
  }

  /* ---------- 整体绘制一个形态 ---------- */
  function drawVariant(c, s, idx) {
    const v = VARIANTS[idx];
    const P = penFor(c, s);
    const oy = v.bob ? -1 : 0;
    const bodyColor = BODY_COLORS[idx % BODY_COLORS.length];

    c.clearRect(0, 0, c.canvas ? c.canvas.width : GRID * s, c.canvas ? c.canvas.height : GRID * s);

    /* 跳跃时的地面影子 */
    if (v.bob) P.rect(5, 15, 6, 1, 'rgba(0,0,0,0.15)', 0);

    /* 尾巴 */
    P.px(11, 14, PAL.furDark, oy);
    P.px(12, 14, PAL.furDark, oy);
    P.px(12, 13, PAL.furDark, oy);

    /* 头部（圆角矩形描边） */
    P.rect(4, 2, 8, 1, PAL.line, oy);
    P.rect(3, 3, 10, 6, PAL.line, oy);
    P.rect(4, 9, 8, 1, PAL.line, oy);
    P.rect(5, 3, 6, 1, PAL.fur, oy);
    P.rect(4, 4, 8, 4, PAL.fur, oy);
    P.rect(5, 8, 6, 1, PAL.fur, oy);

    /* 耳朵 */
    P.px(4, 0, PAL.line, oy);
    P.rect(3, 1, 3, 1, PAL.line, oy);
    P.px(4, 1, PAL.earIn, oy);
    P.px(11, 0, PAL.line, oy);
    P.rect(10, 1, 3, 1, PAL.line, oy);
    P.px(11, 1, PAL.earIn, oy);

    /* 五官 */
    drawEyes(P, v.eyes, oy);
    P.px(4, 7, PAL.blush, oy);
    P.px(11, 7, PAL.blush, oy);
    drawMouth(P, v.mouth, oy);

    /* 身体 */
    P.rect(5, 10, 1, 4, PAL.line, oy);
    P.rect(10, 10, 1, 4, PAL.line, oy);
    P.rect(6, 10, 4, 3, bodyColor, oy);
    P.rect(6, 13, 4, 1, PAL.line, oy);

    /* 手臂 */
    drawArm(P, 'L', v.armL, oy);
    drawArm(P, 'R', v.armR, oy);

    /* 脚 */
    P.rect(5, 14, 2, 1, PAL.feet, oy);
    P.rect(9, 14, 2, 1, PAL.feet, oy);

    /* 道具 / 配件 */
    drawProp(P, v.prop, oy);
  }

  /* =========================================================
     小动物绘制（10x10 网格）
     ========================================================= */
  function drawCat(c, s, pal, fr) {
    const P = penFor(c, s);
    const eye = '#4a3336';
    const { fur, furD, earIn, belly } = pal;
    /* 耳朵 */
    P.px(2, 0, furD); P.px(3, 0, furD); P.px(6, 0, furD); P.px(7, 0, furD);
    /* 头 */
    P.rect(2, 1, 6, 1, fur);
    P.rect(1, 2, 8, 4, fur);
    P.rect(2, 6, 6, 1, fur);
    /* 耳内 */
    P.px(3, 1, earIn); P.px(6, 1, earIn);
    /* 头顶纹 */
    P.px(3, 2, furD); P.px(5, 2, furD);
    /* 眼睛 */
    if (fr.eye) {
      P.rect(2, 3, 1, 1, eye); P.rect(7, 3, 1, 1, eye);
    } else {
      P.rect(2, 3, 1, 2, eye); P.rect(7, 3, 1, 2, eye);
    }
    /* 鼻子 */
    P.px(4, 4, '#ff9fb8');
    /* 腮红 */
    P.px(1, 5, earIn); P.px(8, 5, earIn);
    /* 身体 */
    P.rect(2, 7, 6, 3, fur);
    P.rect(3, 8, 4, 2, belly);
    /* 脚 */
    P.px(3, 9, furD); P.px(6, 9, furD);
    /* 尾巴 */
    if (fr.tail) {
      P.px(8, 6, furD); P.px(9, 5, furD); P.px(9, 4, furD);
    } else {
      P.px(8, 7, furD); P.px(9, 7, furD); P.px(9, 8, furD);
    }
  }

  function drawDog(c, s, fr) {
    const P = penFor(c, s);
    const fur = '#d9a066';
    const furD = '#b97f47';
    const muzzle = '#ffe9c9';
    const eye = '#4a3336';
    /* 垂耳 */
    P.rect(0, 2, 1, 3, furD);
    P.rect(9, 2, 1, 3, furD);
    /* 头 */
    P.rect(2, 1, 6, 1, fur);
    P.rect(1, 2, 8, 4, fur);
    P.rect(2, 6, 6, 1, fur);
    /* 面部 */
    P.rect(2, 3, 6, 3, muzzle);
    /* 眼睛 */
    if (fr.eye) {
      P.rect(2, 3, 1, 1, eye); P.rect(7, 3, 1, 1, eye);
    } else {
      P.rect(2, 3, 1, 2, eye); P.rect(7, 3, 1, 2, eye);
    }
    /* 鼻 */
    P.rect(4, 4, 2, 1, eye);
    /* 舌头 */
    if (fr.tongue) P.px(4, 5, '#ff8f8f');
    /* 身体 */
    P.rect(2, 7, 6, 3, fur);
    P.rect(3, 8, 4, 2, muzzle);
    /* 尾巴 */
    if (fr.tail) {
      P.px(8, 7, furD); P.px(9, 6, furD);
    } else {
      P.px(8, 7, furD); P.px(9, 8, furD);
    }
    /* 脚 */
    P.px(3, 9, furD); P.px(6, 9, furD);
  }

  function renderAnimal(a) {
    const c = a.canvas.getContext('2d');
    const s = a.canvas.width / 10;
    c.clearRect(0, 0, a.canvas.width, a.canvas.height);
    if (a.kind === 'cat') drawCat(c, s, a.pal, a.frame);
    else drawDog(c, s, a.frame);
  }

  function animalLoop(a) {
    a.timer = setTimeout(() => {
      if (!a.canvas.isConnected) return;
      const blink = Math.random() < 0.5;
      a.frame.eye = blink;
      a.frame.tail = Math.random() < 0.5;
      if (a.kind === 'dog') a.frame.tongue = Math.random() < 0.35;
      renderAnimal(a);
      if (blink) {
        setTimeout(() => {
          a.frame.eye = false;
          renderAnimal(a);
        }, 220);
      }
      animalLoop(a);
    }, 1500 + Math.random() * 2600);
  }

  /* ---------- 对外：更新小动物数量（0-3） ---------- */
  function setAnimals(count) {
    if (!teamEl) return;
    count = Math.max(0, Math.min(ANIMAL_LIST.length, count || 0));

    while (animals.length < count) {
      const type = ANIMAL_LIST[animals.length];
      const cv = document.createElement('canvas');
      cv.width = 60;
      cv.height = 60;
      cv.className = 'pet-animal';
      cv.title = type.kind === 'cat' ? '小猫咪' : '小狗';
      const a = {
        kind: type.kind,
        pal: type.pal,
        canvas: cv,
        frame: { eye: false, tail: false, tongue: false },
        timer: 0,
      };
      renderAnimal(a);
      teamEl.appendChild(cv);
      cv.classList.add('appear');
      setTimeout(() => cv.classList.remove('appear'), 520);
      cv.addEventListener('click', () => {
        cv.classList.add('appear');
        setTimeout(() => cv.classList.remove('appear'), 500);
        if (typeof Sound !== 'undefined') Sound.pet();
      });
      animals.push(a);
      animalLoop(a);
    }

    while (animals.length > count) {
      const a = animals.pop();
      clearTimeout(a.timer);
      a.canvas.remove();
    }
  }

  /* ---------- 气泡 ---------- */
  function say(text, duration) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    bubbleEl.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubbleEl.hidden = true; }, duration || 3400);
  }

  /* ---------- 随机 ---------- */
  function randomIndex(avoid) {
    let idx = Math.floor(Math.random() * VARIANTS.length);
    if (VARIANTS.length > 1 && idx === avoid) idx = (idx + 1) % VARIANTS.length;
    return idx;
  }

  function pickNextIndex() {
    let last = -1;
    try {
      const raw = localStorage.getItem(PET_STORE_KEY);
      if (raw !== null) last = parseInt(raw, 10);
    } catch (e) { /* 忽略存储异常 */ }

    const idx = randomIndex(last);
    try { localStorage.setItem(PET_STORE_KEY, String(idx)); } catch (e) { /* 忽略 */ }
    return idx;
  }

  function renderMain() {
    if (!g || !canvas) return;
    drawVariant(g, SCALE, currentIdx);
  }

  function randomize(talk) {
    currentIdx = pickNextIndex();
    renderMain();
    if (talk) {
      let line = VARIANTS[currentIdx].bubble;
      if (extraLines.length > 0 && Math.random() < 0.35) {
        line = extraLines[Math.floor(Math.random() * extraLines.length)];
      }
      say(line);
    }
  }

  /* ---------- 初始化 ---------- */
  function create(root) {
    rootEl = root;

    teamEl = document.createElement('div');
    teamEl.className = 'pet-team';
    root.appendChild(teamEl);

    canvas = document.createElement('canvas');
    canvas.width = GRID * SCALE;
    canvas.height = GRID * SCALE;
    canvas.className = 'pet-canvas';
    teamEl.appendChild(canvas);
    g = canvas.getContext('2d');

    bubbleEl = document.createElement('div');
    bubbleEl.className = 'pet-bubble';
    bubbleEl.hidden = true;
    root.appendChild(bubbleEl);

    canvas.addEventListener('click', () => {
      rootEl.classList.add('pet-pop');
      setTimeout(() => rootEl.classList.remove('pet-pop'), 380);
      randomize(true);
      if (typeof Sound !== 'undefined') Sound.pet();
    });
  }

  return {
    create,
    randomize,
    say,
    cheer() { say('好厉害！全部完成啦～'); },

    /* 额外台词（如“我们已经相伴 N 天”） */
    setExtraLines(lines) { extraLines = Array.isArray(lines) ? lines : []; },

    /* 小动物伙伴 */
    setAnimals,

    /* 渲染任意一个形态到指定 canvas（专注模式 / 其他场景） */
    renderTo(cv, idx) {
      const c = cv.getContext('2d');
      const s = cv.width / GRID;
      drawVariant(c, s, idx);
    },

    /* 专注模式：换一个姿势 / 抽一句卖萌台词 */
    focusPose() {
      lastFocusIdx = randomIndex(lastFocusIdx);
      return lastFocusIdx;
    },
    focusLine() {
      let line = FOCUS_LINES[Math.floor(Math.random() * FOCUS_LINES.length)];
      if (FOCUS_LINES.length > 1 && line === lastFocusLine) {
        line = FOCUS_LINES[(FOCUS_LINES.indexOf(line) + 1) % FOCUS_LINES.length];
      }
      lastFocusLine = line;
      return line;
    },

    get variantName() { return currentIdx >= 0 ? VARIANTS[currentIdx].name : ''; },
    get variantCount() { return VARIANTS.length; },
  };
})();
