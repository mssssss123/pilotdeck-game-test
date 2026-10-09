'use strict';
// ===================== 关卡定义 =====================
// 地形图例： . 空地   B 砖墙(可破坏)   S 钢墙   W 水域   T 树林(遮挡)   I 冰面   E 鹰(基地)

const LEVELS = [
  {
    name: '经典要塞',
    map: [
      '.............',
      '.BB.B.B.B.BB.',
      '.BB.B.B.B.BB.',
      '.....BWB.....',
      '.B.B.B.B.B.B.',
      '.B.B.BBB.B.B.',
      '.B.B.....B.B.',
      '...W.B.B.W...',
      '.S.B.B.B.B.S.',
      '.BB.B.B.B.BB.',
      '.....B.B.....',
      '..B..BBB..B..',
      '..B..BEB..B..',
    ],
  },
  {
    name: '双河防线',
    map: [
      '.............',
      '.BB.B.B.B.BB.',
      '.BB.B.B.B.BB.',
      '..B.B.B.B.B..',
      '..B.B.B.B.B..',
      '.....B.B.....',
      '.WW..B.B..WW.',
      '.....B.B.....',
      '..B.B.B.B.B..',
      '..B.B.B.B.B..',
      '.BB.B.B.B.BB.',
      '.....BBB.....',
      '..S..BEB..S..',
    ],
  },
  {
    name: '密林伏击',
    map: [
      '.............',
      '.TT.B.B.B.TT.',
      '.TT.BBSBB.TT.',
      '.....B.B.....',
      '.B.B.B.B.B.B.',
      '.B.B.TWT.B.B.',
      '...B.....B...',
      '.W.B.B.B.B.W.',
      '.B.B.B.B.B.B.',
      '.BB.B.B.B.BB.',
      '...B.....B...',
      '..BB.BBB.BB..',
      '..B..BEB..B..',
    ],
  },
];

// 每关敌人配置：共 20 辆，随关卡提升强度
function enemyComposition(level) {
  const total = 20;
  const armor  = level >= 3 ? Math.min(4, level - 2) : 0;
  const power  = level >= 2 ? Math.min(6, 2 * (level - 1)) : 0;
  const fast   = Math.min(6, 1 + level);
  const normal = Math.max(0, total - armor - power - fast);
  const list = [];
  for (let i = 0; i < normal; i++) list.push('normal');
  for (let i = 0; i < fast; i++) list.push('fast');
  for (let i = 0; i < power; i++) list.push('power');
  for (let i = 0; i < armor; i++) list.push('armor');
  // 打乱出场顺序（前 3 辆固定普通兵，给玩家热身）
  for (let i = list.length - 1; i > 3; i--) {
    const j = 3 + Math.floor(Math.random() * (i - 2));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function levelConfig(level) {
  const def = LEVELS[(level - 1) % LEVELS.length];
  return {
    name: def.name,
    map: def.map,
    enemies: enemyComposition(level),
    maxAlive: Math.min(4 + Math.floor(level / 2), 6),
  };
}

function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, t] of map) { while (n >= v) { s += t; n -= v; } }
  return s;
}
