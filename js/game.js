'use strict';
// ===================== 游戏主逻辑 =====================

const canvas = document.getElementById('game');
ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---- 输入 ----
const KEYMAP = {
  ArrowUp: DIR.UP, KeyW: DIR.UP,
  ArrowRight: DIR.RIGHT, KeyD: DIR.RIGHT,
  ArrowDown: DIR.DOWN, KeyS: DIR.DOWN,
  ArrowLeft: DIR.LEFT, KeyA: DIR.LEFT,
};
const held = [];
const input = { fire: false };

function heldDir() { return held.length ? held[held.length - 1] : null; }

// ---- 游戏状态 ----
function loadHi() {
  try { return +(localStorage.getItem('tank-battle-hi') || 0); } catch (e) { return 0; }
}
function saveHi(v) {
  try { localStorage.setItem('tank-battle-hi', String(v)); } catch (e) { /* ignore */ }
}

const game = {
  state: 'title',
  tick: 0,
  level: 1,
  levelName: '',
  score: 0,
  lives: 2,
  hiScore: loadHi(),
  grid: [],
  eagle: { tx: 6, ty: 12 },
  baseAlive: true,
  baseTimer: 0,
  player: null,
  enemies: [],
  spawnQueue: [],
  bullets: [],
  fx: [],
  powerups: [],
  freezeTimer: 0,
  spawnTimer: 0,
  maxAlive: 4,
  kills: {},
  killsTotal: 0,
  bonus: 0,
  respawnTimer: 0,
  pendingGameOver: false,
  stateTimer: 0,
  flash: 0,
  introCfg: { enemies: [], name: '' },

  allTanks() {
    const arr = [];
    if (this.player && this.player.alive) arr.push(this.player);
    for (const e of this.enemies) if (e.alive) arr.push(e);
    return arr;
  },

  addFx(f) { this.fx.push(f); },

  clearCell(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return;
    if (this.grid[gy][gx] === T.BRICK) {
      this.grid[gy][gx] = T.EMPTY;
      SFX.brick();
      this.addFx(new Explosion(gx * CELL + 8, gy * CELL + 8, false));
    }
  },

  // ---- 事件 ----
  onEnemyKilled(e) {
    this.addFx(new Explosion(e.cx(), e.cy(), true));
    SFX.explode(false);
    this.score += e.scoreVal;
    this.kills[e.type] = (this.kills[e.type] || 0) + 1;
    if (this.score > this.hiScore) { this.hiScore = this.score; saveHi(this.hiScore); }
    const remaining = this.spawnQueue.length + this.enemies.filter(t => t.alive).length - 1;
    if (remaining === 17 || remaining === 10 || remaining === 3) spawnPowerUp();
  },

  onPlayerDeath() {
    this.addFx(new Explosion(this.player.cx(), this.player.cy(), true));
    SFX.explode(true);
    if (this.lives > 0) {
      this.lives--;
      this.respawnTimer = PLAYER.respawnDelay;
    } else {
      this.pendingGameOver = true;
      this.respawnTimer = PLAYER.respawnDelay;
    }
  },

  destroyBase() {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    this.addFx(new Explosion((this.eagle.tx + 0.5) * TILE, (this.eagle.ty + 0.5) * TILE, true));
    SFX.explode(true);
    this.baseTimer = 90;
  },

  // ---- 主更新 ----
  update() {
    this.tick++;
    if (this.state === 'playing') {
      if (this.flash > 0) this.flash--;
      if (this.freezeTimer > 0) this.freezeTimer--;
      updateSpawner();
      updatePlayer();
      for (const e of this.enemies) e.updateAI(this);
      for (const b of this.bullets) b.update(this);
      cancelOppositeBullets();
      this.bullets = this.bullets.filter(b => !b.dead);
      this.enemies = this.enemies.filter(e => e.alive);
      updatePowerups();
      if (!this.baseAlive) {
        this.baseTimer--;
        if (this.baseTimer <= 0) doGameOver();
      }
      checkLevelClear();
    } else if (this.state === 'levelintro') {
      if (--this.stateTimer <= 0) this.state = 'playing';
    } else if (this.state === 'levelclear') {
      if (--this.stateTimer <= 0) {
        this.level++;
        newLevel();
      }
    }
    if (this.state !== 'title' && this.state !== 'paused') {
      for (const f of this.fx) f.update();
      this.fx = this.fx.filter(f => !f.done);
    }
  },
};

// ---- 关卡搭建 ----
function buildGrid(map) {
  const grid = [];
  for (let r = 0; r < GRID; r++) grid.push(new Array(GRID).fill(T.EMPTY));
  let eagle = null;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = map[ty][tx];
      let t = T.EMPTY;
      if (ch === 'B') t = T.BRICK;
      else if (ch === 'S') t = T.STEEL;
      else if (ch === 'W') t = T.WATER;
      else if (ch === 'T') t = T.TREE;
      else if (ch === 'I') t = T.ICE;
      else if (ch === 'E') { t = T.EAGLE; eagle = { tx, ty }; }
      if (t !== T.EMPTY) {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++)
            grid[ty * 2 + dy][tx * 2 + dx] = t;
      }
    }
  }
  return { grid, eagle };
}

function makePlayer() {
  const p = new Tank({
    team: 'player', type: 'player',
    x: PLAYER_START.x, y: PLAYER_START.y, dir: DIR.UP,
    speed: PLAYER.speed, hp: 1,
    bulletSpeed: PLAYER.bulletSpeed,
    palette: PLAYER_PALETTE,
  });
  p.power = 0;
  p.shield = PLAYER.shieldTime;
  p.invuln = 0;
  return p;
}

function respawnPlayer() {
  const p = game.player;
  p.alive = true;
  p.x = PLAYER_START.x;
  p.y = PLAYER_START.y;
  p.dir = DIR.UP;
  p.shield = PLAYER.shieldTime;
  p.spawnT = 0;
  p.flash = 0;
  game.addFx(new SpawnFx(p.x + 16, p.y + 16));
}

function newLevel() {
  const cfg = levelConfig(game.level);
  const built = buildGrid(cfg.map);
  game.grid = built.grid;
  game.eagle = built.eagle || { tx: 6, ty: 12 };
  game.baseAlive = true;
  game.baseTimer = 0;
  game.levelName = cfg.name;
  game.introCfg = cfg;
  game.enemies = [];
  game.bullets = [];
  game.fx = [];
  game.powerups = [];
  game.spawnQueue = cfg.enemies.slice();
  game.maxAlive = cfg.maxAlive;
  game.spawnTimer = 30;
  game.kills = {};
  game.killsTotal = 0;
  game.bonus = 0;
  game.freezeTimer = 0;
  game.respawnTimer = 0;
  game.pendingGameOver = false;
  if (!game.player) game.player = makePlayer();
  else respawnPlayer();
  game.state = 'levelintro';
  game.stateTimer = 150;
}

function startGame() {
  game.score = 0;
  game.lives = 2;
  game.level = 1;
  game.player = makePlayer();
  newLevel();
  SFX.start();
}

function doGameOver() {
  if (game.state === 'gameover') return;
  game.state = 'gameover';
  if (game.score > game.hiScore) { game.hiScore = game.score; saveHi(game.hiScore); }
  SFX.gameOver();
}

// ---- 出怪 ----
function updateSpawner() {
  if (!game.spawnQueue.length) return;
  if (game.enemies.length >= game.maxAlive) return;
  if (--game.spawnTimer > 0) return;
  for (const pt of SPAWN_POINTS) {
    const blocked = game.allTanks().some(t => rectsOverlap(pt.x, pt.y, 32, 32, t.x, t.y, 32, 32));
    if (blocked) continue;
    const type = game.spawnQueue.shift();
    const cfgE = ENEMY_TYPES[type];
    const e = new Tank({
      team: 'enemy', type, x: pt.x, y: pt.y, dir: DIR.DOWN,
      speed: cfgE.speed * (1 + (game.level - 1) * 0.05),
      hp: cfgE.hp,
      bulletSpeed: cfgE.bulletSpeed,
      scoreVal: cfgE.score,
      palette: cfgE.palette,
      spawnT: 30,
    });
    game.enemies.push(e);
    game.addFx(new SpawnFx(pt.x + 16, pt.y + 16));
    SFX.spawn();
    game.spawnTimer = 110 + Math.random() * 110;
    return;
  }
  game.spawnTimer = 20; // 出生点被占，稍后重试
}

// ---- 玩家 ----
function updatePlayer() {
  const p = game.player;
  if (!p) return;
  if (!p.alive) {
    if (game.respawnTimer > 0 && --game.respawnTimer <= 0) {
      if (game.pendingGameOver) doGameOver();
      else respawnPlayer();
    }
    return;
  }
  if (p.shootCd > 0) p.shootCd--;
  if (p.shield > 0) p.shield--;
  const d = heldDir();
  if (d !== null) {
    p.setDir(game, d);
    p.move(game, p.speed);
  }
  if (input.fire) p.shoot(game);
}

// ---- 道具 ----
function spawnPowerUp() {
  for (let tries = 0; tries < 60; tries++) {
    const tx = (Math.random() * COLS) | 0;
    const ty = (Math.random() * ROWS) | 0;
    let ok = true;
    for (let dy = 0; dy < 2 && ok; dy++) {
      for (let dx = 0; dx < 2 && ok; dx++) {
        const t = cellAt(game, tx * 2 + dx, ty * 2 + dy);
        if (t !== T.EMPTY && t !== T.WATER && t !== T.TREE && t !== T.ICE) ok = false;
      }
    }
    if (!ok) continue;
    if (game.allTanks().some(t => rectsOverlap(tx * TILE, ty * TILE, 32, 32, t.x, t.y, 32, 32))) continue;
    const type = POWERUP_TYPES[(Math.random() * POWERUP_TYPES.length) | 0];
    game.powerups.push(new PowerUp(type, tx * TILE, ty * TILE));
    return;
  }
}

function applyPowerUp(type) {
  SFX.powerup();
  const p = game.player;
  if (type === 'star') {
    p.power = Math.min(3, p.power + 1);
  } else if (type === 'helmet') {
    p.shield = 600;
  } else if (type === 'heart') {
    game.lives = Math.min(5, game.lives + 1);
  } else if (type === 'timer') {
    game.freezeTimer = 480;
  } else if (type === 'grenade') {
    game.flash = 10;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      game.addFx(new Explosion(e.cx(), e.cy(), true));
      game.score += e.scoreVal;
      game.kills[e.type] = (game.kills[e.type] || 0) + 1;
    }
    game.enemies = [];
    SFX.explode(true);
  }
  game.score += 200;
  if (game.score > game.hiScore) { game.hiScore = game.score; saveHi(game.hiScore); }
}

function updatePowerups() {
  for (const pu of game.powerups) {
    pu.update();
    const p = game.player;
    if (!pu.done && p && p.alive && rectsOverlap(p.x, p.y, 32, 32, pu.x, pu.y, 32, 32)) {
      pu.done = true;
      applyPowerUp(pu.type);
    }
  }
  game.powerups = game.powerups.filter(pu => !pu.done);
}

// 敌我炮弹对撞抵消
function cancelOppositeBullets() {
  for (const a of game.bullets) {
    if (a.dead || a.team !== 'player') continue;
    for (const b of game.bullets) {
      if (b.dead || b.team !== 'enemy') continue;
      if (Math.abs(a.x - b.x) < 8 && Math.abs(a.y - b.y) < 8) {
        a.dead = true;
        b.dead = true;
        game.addFx(new Explosion(b.x, b.y, false));
        break;
      }
    }
  }
}

// ---- 通关判定 ----
function checkLevelClear() {
  if (game.state !== 'playing') return;
  if (!game.baseAlive || game.pendingGameOver) return;
  if (game.spawnQueue.length > 0 || game.enemies.length > 0) return;
  if (game.player && !game.player.alive) return;
  let bonus = 0;
  for (const k in game.kills) bonus += (game.kills[k] || 0) * ENEMY_TYPES[k].score;
  game.bonus = bonus;
  game.score += bonus;
  if (game.score > game.hiScore) { game.hiScore = game.score; saveHi(game.hiScore); }
  game.state = 'levelclear';
  game.stateTimer = 220;
  SFX.levelClear();
}

// ---- 键盘事件 ----
window.addEventListener('keydown', e => {
  const c = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
  SFX.ensure();
  if (c in KEYMAP) {
    const d = KEYMAP[c];
    if (!held.includes(d)) held.push(d);
  }
  if (c === 'Space' || c === 'KeyJ') input.fire = true;
  if (c === 'KeyM') SFX.muted = !SFX.muted;
  if (c === 'KeyP' || c === 'Escape') {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  }
  if (c === 'Enter' && (game.state === 'title' || game.state === 'gameover')) startGame();
});

window.addEventListener('keyup', e => {
  const c = e.code;
  if (c in KEYMAP) {
    const d = KEYMAP[c];
    const i = held.indexOf(d);
    if (i >= 0) held.splice(i, 1);
  }
  if (c === 'Space' || c === 'KeyJ') input.fire = false;
});

window.addEventListener('blur', () => {
  held.length = 0;
  input.fire = false;
  if (game.state === 'playing') game.state = 'paused';
});

// ---- 主循环（固定步长 60Hz） ----
let lastTs = performance.now();
let acc = 0;

function frame(ts) {
  requestAnimationFrame(frame);
  acc += Math.min(ts - lastTs, 100);
  lastTs = ts;
  while (acc >= TICK) {
    game.update();
    acc -= TICK;
  }
  render();
}

render();
requestAnimationFrame(frame);

// 供自动化测试/预览用：index.html?demo 自动开一局
try {
  if (typeof location !== 'undefined' && /[?&]demo\b/.test(location.search)) startGame();
} catch (e) { /* ignore */ }
