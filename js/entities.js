'use strict';
// ===================== 实体：坦克 / 炮弹 / 特效 / 道具 =====================

// ---- 碰撞工具 ----
function cellAt(g, gx, gy) {
  if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return T.STEEL; // 场外视为钢墙
  return g.grid[gy][gx];
}

function rectHitsTerrain(g, x, y, w, h, solid) {
  const c0 = Math.floor(x / CELL), c1 = Math.floor((x + w - 0.001) / CELL);
  const r0 = Math.floor(y / CELL), r1 = Math.floor((y + h - 0.001) / CELL);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solid[cellAt(g, c, r)]) return true;
    }
  }
  return false;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function rectHitsAnyTank(g, tank, x, y) {
  for (const t of g.allTanks()) {
    if (t === tank || !t.alive) continue;
    if (rectsOverlap(x, y, 32, 32, t.x, t.y, 32, 32)) return true;
  }
  return false;
}

// ---- 坦克 ----
class Tank {
  constructor(o) {
    this.team = o.team;           // 'player' | 'enemy'
    this.type = o.type;
    this.x = o.x; this.y = o.y;
    this.dir = o.dir;
    this.w = 32; this.h = 32;
    this.speed = o.speed;
    this.hp = o.hp; this.maxHp = o.hp;
    this.bulletSpeed = o.bulletSpeed || 5;
    this.scoreVal = o.scoreVal || 0;
    this.palette = o.palette;
    this.alive = true;
    this.shootCd = 0;
    this.flash = 0;
    this.spawnT = o.spawnT || 0;  // 出生无敌时间（tick）
    this.trackPhase = 0;
    this.aiTimer = 20 + Math.random() * 60;
    this.aiShoot = 30 + Math.random() * 60;
    this.power = 0;               // 仅玩家使用
    this.shield = 0;              // 仅玩家使用
    this.invuln = 0;              // 仅玩家使用
  }

  cx() { return this.x + 16; }
  cy() { return this.y + 16; }

  collides(g, x, y) {
    return rectHitsTerrain(g, x, y, this.w, this.h, SOLID_TANK) || rectHitsAnyTank(g, this, x, y);
  }

  // 转向：转垂直方向时吸附到半格，方便钻缝隙
  setDir(g, d) {
    if (d === this.dir) return;
    if (d % 2 !== this.dir % 2) {
      const nx = d % 2 === 0 ? Math.round(this.x / CELL) * CELL : this.x;
      const ny = d % 2 === 1 ? Math.round(this.y / CELL) * CELL : this.y;
      if (!this.collides(g, nx, ny)) { this.x = nx; this.y = ny; }
    }
    this.dir = d;
  }

  // 沿当前方向移动 dist 像素，被挡住则返回 true
  move(g, dist) {
    let rem = dist;
    while (rem > 0.0001) {
      const step = Math.min(1, rem);
      const nx = this.x + DX[this.dir] * step;
      const ny = this.y + DY[this.dir] * step;
      if (this.collides(g, nx, ny)) return true;
      this.x = nx; this.y = ny;
      this.trackPhase += step;
      rem -= step;
    }
    return false;
  }

  shoot(g) {
    if (this.shootCd > 0 || this.spawnT > 0) return false;
    const maxBullets = this.team === 'player' ? (this.power >= 3 ? 2 : 1) : 1;
    let onField = 0;
    for (const b of g.bullets) if (b.team === this.team) onField++;
    if (onField >= maxBullets) return false;
    const speed = this.team === 'player' ? (this.power >= 1 ? 9 : PLAYER.bulletSpeed) : this.bulletSpeed;
    const power = this.team === 'player' ? this.power : 0;
    const bx = Math.max(4, Math.min(FIELD_W - 4, this.cx() + DX[this.dir] * 18));
    const by = Math.max(4, Math.min(FIELD_H - 4, this.cy() + DY[this.dir] * 18));
    g.bullets.push(new Bullet(bx, by, this.dir, this.team, speed, power));
    this.shootCd = this.team === 'player' ? 15 : 45;
    if (this.team === 'player') SFX.shoot(); else SFX.enemyShoot();
    return true;
  }

  onHit(g, bullet) {
    if (this.spawnT > 0 || this.invuln > 0 || this.shield > 0) return;
    if (this.team === 'player') {
      this.alive = false;
      g.onPlayerDeath();
      return;
    }
    this.hp -= 1;
    this.flash = 8;
    if (this.hp <= 0) {
      this.alive = false;
      g.onEnemyKilled(this);
    } else {
      SFX.hit();
    }
  }

  // ---- 敌人 AI ----
  pickDir(g) {
    this.aiTimer = 30 + Math.random() * 90;
    const r = Math.random();
    const d = r < 0.42 ? DIR.DOWN : r < 0.58 ? DIR.UP : r < 0.79 ? DIR.LEFT : DIR.RIGHT;
    this.setDir(g, d);
  }

  updateAI(g) {
    if (this.spawnT > 0) this.spawnT--;
    if (this.flash > 0) this.flash--;
    if (this.shootCd > 0) this.shootCd--;
    if (g.freezeTimer > 0 || this.spawnT > 0 || !this.alive) return;
    this.aiTimer--;
    if (this.aiTimer <= 0) this.pickDir(g);
    const blocked = this.move(g, this.speed);
    if (blocked) this.pickDir(g);
    this.aiShoot--;
    if (this.aiShoot <= 0) {
      let p = 0.01;
      const pl = g.player;
      if (pl && pl.alive) {
        if (this.dir % 2 === 0 && Math.abs(this.cx() - pl.cx()) < 14) p = 0.07;
        if (this.dir % 2 === 1 && Math.abs(this.cy() - pl.cy()) < 14) p = 0.07;
      }
      const e = g.eagle;
      if (this.dir === DIR.DOWN && Math.abs(this.cx() - (e.tx + 0.5) * TILE) < 22) p = 0.08;
      if (Math.random() < p) {
        this.shoot(g);
        this.aiShoot = 40 + Math.random() * 60;
      } else {
        this.aiShoot = 10;
      }
    }
  }
}

// ---- 炮弹 ----
class Bullet {
  constructor(x, y, dir, team, speed, power) {
    this.x = x; this.y = y;
    this.dir = dir; this.team = team;
    this.speed = speed; this.power = power;
    this.dead = false;
  }

  update(g) {
    const steps = Math.max(1, Math.ceil(this.speed));
    const step = this.speed / steps;
    for (let s = 0; s < steps && !this.dead; s++) {
      this.x += DX[this.dir] * step;
      this.y += DY[this.dir] * step;
      this.collide(g);
    }
  }

  collide(g) {
    const B = 3;
    if (this.x < B || this.y < B || this.x > FIELD_W - B || this.y > FIELD_H - B) {
      return this.hit(g, null);
    }
    const gx = Math.floor(this.x / CELL), gy = Math.floor(this.y / CELL);
    const terrain = cellAt(g, gx, gy);
    if (terrain === T.EAGLE) { this.hit(g, null); g.destroyBase(); return; }
    if (terrain === T.BRICK) {
      g.clearCell(gx, gy);
      if (this.power >= 2) {
        const gx2 = gx + DX[this.dir], gy2 = gy + DY[this.dir];
        if (cellAt(g, gx2, gy2) === T.BRICK) g.clearCell(gx2, gy2);
      }
      return this.hit(g, null);
    }
    if (terrain === T.STEEL) {
      if (this.power >= 2) g.clearCell(gx, gy); else SFX.hit();
      return this.hit(g, null);
    }
    for (const t of g.allTanks()) {
      if (t.team === this.team || !t.alive) continue;
      if (this.x > t.x && this.x < t.x + t.w && this.y > t.y && this.y < t.y + t.h) {
        t.onHit(g, this);
        return this.hit(g, t);
      }
    }
  }

  hit(g, tank) {
    if (this.dead) return;
    this.dead = true;
    if (!tank) g.addFx(new Explosion(this.x, this.y, false));
  }
}

// ---- 特效 ----
class Explosion {
  constructor(x, y, big) {
    this.x = x; this.y = y; this.big = big;
    this.t = 0; this.dur = big ? 30 : 14;
    this.done = false;
  }
  update() { if (++this.t >= this.dur) this.done = true; }
  draw(ctx) {
    const p = this.t / this.dur;
    const R = this.big ? 26 : 12;
    const layer = (rad, col) => {
      if (rad <= 0.5) return;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(this.x, this.y, rad, 0, 7);
      ctx.fill();
    };
    if (p < 0.5) {
      const r = R * (0.3 + 1.4 * p);
      layer(r, '#ff4500');
      layer(r * 0.7, '#ffae00');
      layer(r * 0.4, '#fff6c8');
    } else {
      const q = (p - 0.5) * 2;
      layer(R * (1 - q * 0.5), 'rgba(255,120,0,' + (1 - q).toFixed(2) + ')');
      layer(R * 0.6 * (1 - q), 'rgba(255,220,120,' + (1 - q).toFixed(2) + ')');
    }
  }
}

class SpawnFx {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.dur = 45; this.done = false; }
  update() { if (++this.t >= this.dur) this.done = true; }
  draw(ctx) { drawSpawnStar(ctx, this.x, this.y, this.t); }
}

function drawSpawnStar(ctx, x, y, t) {
  const r = 14 * Math.abs(Math.sin(t * 0.25)) + 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.3);
  ctx.strokeStyle = (t % 10 < 5) ? '#ffffff' : '#ffd24a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

// ---- 道具 ----
class PowerUp {
  constructor(type, x, y) {
    this.type = type; this.x = x; this.y = y;
    this.t = 0; this.ttl = 900;
    this.done = false;
  }
  update() { if (++this.t >= this.ttl) this.done = true; }
  draw(ctx) {
    if (this.t > 480 && ((this.t / 8 | 0) % 2 === 0)) return; // 快消失时闪烁
    ctx.fillStyle = '#141414';
    ctx.fillRect(this.x + 1, this.y + 1, 30, 30);
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 1.5, this.y + 1.5, 29, 29);
    const cx = this.x + 16, cy = this.y + 16;
    switch (this.type) {
      case 'star':
        drawStarShape(ctx, cx, cy, 8, '#ffd23f');
        break;
      case 'helmet':
        ctx.fillStyle = '#7dd7ff';
        ctx.beginPath(); ctx.arc(cx, cy + 2, 8, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx - 10, cy + 2, 20, 3);
        break;
      case 'grenade':
        ctx.fillStyle = '#69c14a';
        ctx.beginPath(); ctx.arc(cx, cy + 2, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#caa53a';
        ctx.fillRect(cx - 2, cy - 9, 4, 5);
        break;
      case 'heart':
        ctx.fillStyle = '#ff5a6e';
        ctx.beginPath(); ctx.arc(cx - 3.5, cy - 2, 4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 3.5, cy - 2, 4, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 7.3, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx + 7.3, cy);
        ctx.closePath(); ctx.fill();
        break;
      case 'timer':
        ctx.strokeStyle = '#7dd7ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 5);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + 4, cy + 2);
        ctx.stroke();
        break;
    }
  }
}

function drawStarShape(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
