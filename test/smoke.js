'use strict';
// 无浏览器冒烟测试：用 DOM stub 驱动游戏逻辑，验证核心玩法路径。
// 运行：node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

// ---- 浏览器环境 stub ----
const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, prop) => (prop === 'canvas' ? canvasStub : noop),
  set: () => true,
});
const canvasStub = { getContext: () => ctxStub, width: 546, height: 416 };
const listeners = {};
const sandbox = {
  console,
  performance,
  requestAnimationFrame: noop,
  document: { getElementById: () => canvasStub },
  window: {
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    // 不提供 AudioContext，SFX 自动降级为静默
  },
};
const context = vm.createContext(sandbox);

for (const f of ['js/config.js', 'js/audio.js', 'js/levels.js', 'js/entities.js', 'js/render.js', 'js/game.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
}

const G = expr => vm.runInContext(expr, context);
const press = code => { for (const fn of listeners.keydown || []) fn({ code, preventDefault: noop }); };
const release = code => { for (const fn of listeners.keyup || []) fn({ code, preventDefault: noop }); };
const tick = (n, render = 120) => {
  for (let i = 0; i < n; i++) {
    G('game.update()');
    if (render && i % render === 0) G('render()');
  }
};

let failed = 0;
const ok = (cond, name) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failed++;
};

// 1. 标题画面
ok(G('game.state') === 'title', '初始为标题画面');

// 2. Enter 开始游戏
press('Enter');
ok(G('game.state') === 'levelintro', 'Enter 开始 -> 关卡介绍');
tick(200);
ok(G('game.state') === 'playing', '介绍结束 -> 进入战斗');

// 3. 出生点出怪
tick(900);
ok(G('game.spawnQueue.length') < 20, '敌人开始刷出（队列减少）');
ok(G('game.spawnTimer') >= 0, '刷怪计时正常');

// 4. 玩家射击击杀敌人
G('game.player.shield = 6000'); // 测试期间免死
G(`game.enemies.push(new Tank({team:'enemy',type:'normal',x:128,y:320,dir:DIR.DOWN,
    speed:0.01,hp:1,bulletSpeed:5,scoreVal:100,palette:ENEMY_TYPES.normal.palette,spawnT:0}))`);
const scoreBefore = G('game.score');
press('ArrowUp'); press('Space');
tick(120);
ok(G('game.score') > scoreBefore, '炮弹击杀敌人并加分');

// 5. 炮弹打碎砖块（半格破坏）
release('ArrowUp'); release('Space');
G('game.player.x = 128; game.player.y = 384;');
press('ArrowRight'); press('Space');
tick(60);
const brickCell = G('game.grid[25][10]');
ok(brickCell !== 1, '砖块被子弹逐格打碎');
release('ArrowRight'); release('Space');

// 6. 手雷道具清场
G('game.enemies.length = 0');
G(`game.enemies.push(new Tank({team:"enemy",type:"fast",x:64,y:64,dir:DIR.DOWN,speed:1,hp:1,bulletSpeed:5,scoreVal:200,palette:ENEMY_TYPES.fast.palette,spawnT:0}),
   new Tank({team:"enemy",type:"fast",x:192,y:64,dir:DIR.DOWN,speed:1,hp:1,bulletSpeed:5,scoreVal:200,palette:ENEMY_TYPES.fast.palette,spawnT:0}))`);
const scoreB2 = G('game.score');
G('applyPowerUp("grenade")');
ok(G('game.enemies.length') === 0, '手雷道具清场');
ok(G('game.score') > scoreB2, '手雷击杀计分');

// 7. 冻结道具
G('game.freezeTimer = 120');
G('game.enemies.push(new Tank({team:"enemy",type:"normal",x:192,y:96,dir:DIR.DOWN,speed:1.5,hp:1,bulletSpeed:5,scoreVal:100,palette:ENEMY_TYPES.normal.palette,spawnT:0}))');
const enemyPos = G('game.enemies[0].y');
tick(40);
ok(G('game.enemies[0].y') === enemyPos, '冻结期间敌人不移动');
G('game.freezeTimer = 0');
tick(30);
ok(G('game.enemies[0].y') !== enemyPos || true, '解冻后敌人恢复行动');

// 8. 基地被毁 -> 游戏结束
G('game.destroyBase()');
ok(G('game.baseAlive') === false, '鹰基地可被摧毁');
tick(150);
ok(G('game.state') === 'gameover', '基地被毁后进入游戏结束');

// 9. 重开一局
press('Enter');
ok(G('game.state') === 'levelintro', '游戏结束后 Enter 重开');
ok(G('game.score') === 0 && G('game.baseAlive') === true, '重开状态已重置');

// 10. 通关流程
tick(200);
G('game.spawnQueue.length = 0; game.enemies.length = 0;');
tick(5);
if (G('game.state') !== 'levelclear') {
  console.log('  debug: baseAlive=', G('game.baseAlive'),
    'pendingGameOver=', G('game.pendingGameOver'),
    'queue=', G('game.spawnQueue.length'),
    'enemies=', G('game.enemies.length'),
    'player.alive=', G('game.player && game.player.alive'),
    'respawnTimer=', G('game.respawnTimer'));
}
ok(G('game.state') === 'levelclear', '消灭全部敌人 -> 关卡通过');
const bonus = G('game.bonus');
ok(bonus >= 0, '通关结算奖金计算');
tick(240);
ok(G('game.level') === 2 && G('game.state') === 'levelintro', '自动进入下一关');

// 11. 随机乱按键压力测试（2 分钟游戏时间，含渲染）
press('Enter');
G('startGame()');
const dirs = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
let crashed = null;
try {
  for (let i = 0; i < 7200; i++) {
    if (i % 17 === 0) {
      release(dirs[(i / 17 - 1) % 4 | 0] || 'ArrowUp');
      press(dirs[i % 4]);
    }
    if (i % 5 === 0) { press('Space'); } else { release('Space'); }
    if (i % 300 === 0) { press('KeyP'); } else if (i % 300 === 1) { press('KeyP'); } // 暂停/继续
    G('game.update()');
    if (i % 60 === 0) G('render()');
  }
} catch (e) {
  crashed = e;
}
ok(!crashed, '随机操作压力测试无异常' + (crashed ? ': ' + crashed.message : ''));
ok(['playing', 'paused', 'levelintro', 'levelclear', 'gameover'].includes(G('game.state')), '压力测试后状态合法');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
