'use strict';
// ===================== 渲染 =====================

let ctx = null;

const FONT = '"Courier New", monospace';

// ---- 地形 ----
function drawTerrain() {
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const t = game.grid[gy][gx];
      if (!t || t === T.TREE || t === T.EAGLE) continue;
      const x = gx * CELL, y = gy * CELL;
      if (t === T.BRICK) {
        ctx.fillStyle = '#a8431f';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#7c2d10';
        ctx.fillRect(x, y + 7, CELL, 1.5);
        ctx.fillRect(x + ((gy % 2) ? 4 : 12), y, 1.5, 7);
        ctx.fillRect(x + ((gy % 2) ? 12 : 4), y + 8, 1.5, 8);
      } else if (t === T.STEEL) {
        ctx.fillStyle = '#9aa3ad';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#d6dbe1';
        ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        ctx.fillStyle = '#6f7883';
        ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
      } else if (t === T.WATER) {
        const ph = ((game.tick / 20) | 0) % 2;
        ctx.fillStyle = ph ? '#0e3fae' : '#1147c4';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#4d8dff';
        ctx.fillRect(x + 2, y + (ph ? 4 : 11), 5, 1.5);
        ctx.fillRect(x + 9, y + (ph ? 11 : 4), 5, 1.5);
      } else if (t === T.ICE) {
        ctx.fillStyle = '#cfe6ff';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#9fc6ef';
        ctx.fillRect(x + 2, y + 10, 6, 1.5);
        ctx.fillRect(x + 9, y + 3, 5, 1.5);
      }
    }
  }
}

// 树林画在坦克上层，起遮挡作用
function drawTrees() {
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (game.grid[gy][gx] !== T.TREE) continue;
      const x = gx * CELL, y = gy * CELL;
      ctx.fillStyle = '#0c5e12';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = '#138a1c';
      const seed = (gx * 7 + gy * 13) % 3;
      ctx.beginPath();
      ctx.arc(x + 5 + seed, y + 6, 5, 0, 7);
      ctx.arc(x + 11, y + 11 - seed, 5, 0, 7);
      ctx.fill();
    }
  }
}

// ---- 基地（鹰） ----
function drawEagle() {
  const e = game.eagle;
  if (!e) return;
  const x = e.tx * TILE, y = e.ty * TILE;
  if (game.baseAlive) {
    ctx.fillStyle = '#8a6d3b';
    ctx.fillRect(x + 1, y + 1, 30, 30);
    ctx.fillStyle = '#e8e3d5';
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 4);
    ctx.lineTo(x + 27, y + 16);
    ctx.lineTo(x + 16, y + 28);
    ctx.lineTo(x + 5, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5b4a2a';
    ctx.fillRect(x + 14, y + 9, 4, 4);
    ctx.fillRect(x + 10, y + 15, 12, 2);
  } else {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 1, y + 1, 30, 30);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + 25, y + 25);
    ctx.moveTo(x + 25, y + 7); ctx.lineTo(x + 7, y + 25);
    ctx.stroke();
  }
}

// ---- 坦克 ----
function drawTank(t) {
  const bodyWhite = t.flash > 0 && (game.tick % 4 < 2);
  let body = t.palette.body, track = t.palette.track, turret = t.palette.turret;
  if (t.type === 'armor' && t.hp < t.maxHp) body = ARMOR_TINTS[t.maxHp - t.hp] || body;
  if (bodyWhite) { body = turret = track = '#ffffff'; }

  ctx.save();
  ctx.translate(t.x + 16, t.y + 16);
  ctx.rotate(t.dir * Math.PI / 2);
  // 履带
  ctx.fillStyle = track;
  ctx.fillRect(-15, -15, 5, 30);
  ctx.fillRect(10, -15, 5, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const off = (Math.floor(t.trackPhase) % 4 + 4) % 4;
  for (let yy = -15 + off; yy < 15; yy += 4) {
    ctx.fillRect(-15, yy, 5, 1.5);
    ctx.fillRect(10, yy, 5, 1.5);
  }
  // 车身 + 炮塔 + 炮管
  ctx.fillStyle = body;
  ctx.fillRect(-9, -14, 18, 28);
  ctx.fillStyle = turret;
  ctx.beginPath();
  ctx.arc(0, 1, 6.5, 0, 7);
  ctx.fill();
  ctx.fillRect(-2, -19, 4, 12);
  ctx.restore();

  if (t.spawnT > 0) drawSpawnStar(ctx, t.x + 16, t.y + 16, game.tick);
  if (t.shield > 0 && (t.shield > 60 || game.tick % 6 < 3)) {
    ctx.strokeStyle = '#7dd7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(t.x - 2.5, t.y - 2.5, 37, 37);
  }
}

// ---- 炮弹 ----
function drawBullet(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.dir * Math.PI / 2);
  ctx.fillStyle = b.team === 'player' ? '#fff3b0' : '#ffb0a0';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3, 3);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---- HUD ----
function drawMiniTank(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 2, 12, 11);
  ctx.fillRect(x + 5, y, 4, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x, y + 2, 2, 11);
  ctx.fillRect(x + 12, y + 2, 2, 11);
}

function drawHUD() {
  const x = HUD_X;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px ' + FONT;
  let y = 10;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('剩余敌军', x, y);
  y += 15;
  const rem = game.spawnQueue.length + game.enemies.length;
  for (let i = 0; i < rem; i++) {
    drawMiniTank(x + (i % 5) * 15, y + ((i / 5) | 0) * 15, '#c9ccd2');
  }
  y += Math.ceil(rem / 5) * 15 + 10;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('关卡', x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(game.level).padStart(2, '0'), x + 56, y);
  y += 18;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('生命', x, y);
  for (let i = 0; i < Math.min(game.lives, 4); i++) drawMiniTank(x + 40 + i * 15, y - 2, PLAYER_PALETTE.body);
  y += 20;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('得分', x, y);
  y += 15;
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 14px ' + FONT;
  ctx.fillText(String(game.score).padStart(6, '0'), x, y);
  y += 20;

  ctx.fillStyle = '#9aa0a8';
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText('最高分', x, y);
  y += 15;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(String(Math.max(game.hiScore, game.score)).padStart(6, '0'), x, y);
  y += 20;

  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('火力', x, y);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < game.player.power ? '#ffd23f' : '#33363c';
    ctx.fillRect(x + 40 + i * 16, y - 1, 12, 12);
  }

  if (game.freezeTimer > 0) {
    ctx.fillStyle = '#7dd7ff';
    ctx.fillText('冻结 ' + Math.ceil(game.freezeTimer / 60) + 's', x, 340);
  }
  if (SFX.muted) {
    ctx.fillStyle = '#ff5a6e';
    ctx.fillText('静音 (M)', x, 360);
  }
  ctx.fillStyle = '#4c5158';
  ctx.fillText('P 暂停', x, 398);
}

// ---- 全屏覆盖层 ----
function overlayBox() {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
}

function drawCenterText(text, y, color, size) {
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, FIELD_W / 2, y);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function drawLevelIntro() {
  overlayBox();
  drawCenterText('STAGE ' + roman(game.level), 150, '#ffd23f', 26);
  drawCenterText(game.levelName, 185, '#9aa0a8', 14);
  const counts = { normal: 0, fast: 0, power: 0, armor: 0 };
  for (const t of game.introCfg.enemies) counts[t]++;
  const labels = { normal: '普通兵', fast: '快速兵', power: '强力兵', armor: '装甲兵' };
  let y = 230;
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const k of ['normal', 'fast', 'power', 'armor']) {
    if (!counts[k]) continue;
    ctx.fillStyle = ENEMY_TYPES[k].palette.turret;
    ctx.fillText(labels[k] + '  x' + counts[k], FIELD_W / 2, y);
    y += 22;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (((game.tick / 20) | 0) % 2 === 0) drawCenterText('READY', 350, '#fff', 16);
}

function drawLevelClear() {
  overlayBox();
  drawCenterText('STAGE ' + roman(game.level) + ' CLEAR!', 110, '#ffd23f', 24);
  const labels = { normal: '普通兵', fast: '快速兵', power: '强力兵', armor: '装甲兵' };
  let y = 170;
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const k of ['normal', 'fast', 'power', 'armor']) {
    const n = game.kills[k] || 0;
    if (!n) continue;
    ctx.fillStyle = ENEMY_TYPES[k].palette.turret;
    ctx.fillText(labels[k] + '  x' + n + '  +' + n * ENEMY_TYPES[k].score, FIELD_W / 2, y);
    y += 22;
  }
  ctx.fillStyle = '#fff';
  ctx.fillText('关卡通关奖励 +' + game.bonus, FIELD_W / 2, y + 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  drawCenterText('PAUSED', 190, '#fff', 24);
  drawCenterText('按 P 继续', 225, '#9aa0a8', 13);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(40,0,0,0.55)';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  drawCenterText('GAME OVER', 180, '#ff4040', 30);
  if (((game.tick / 25) | 0) % 2 === 0) drawCenterText('按 Enter 重新开始', 230, '#fff', 14);
}

// ---- 标题画面 ----
function drawTitle() {
  ctx.save();
  ctx.translate(10, 0);
  drawCenterText('TANK BATTLE', 100, '#ffd23f', 40);
  drawCenterText('坦 克 大 战', 155, '#e8e8e8', 22);

  const rows = [
    { y: 220, speed: 1.0, type: 'normal' },
    { y: 262, speed: 1.6, type: 'fast' },
    { y: 304, speed: 1.2, type: 'armor' },
    { y: 346, speed: 2.0, type: 'player' },
  ];
  for (const r of rows) {
    const x = ((game.tick * r.speed) % (FIELD_W + 60)) - 50;
    const pal = r.type === 'player' ? PLAYER_PALETTE : ENEMY_TYPES[r.type].palette;
    drawTank({ x, y: r.y, dir: DIR.RIGHT, palette: pal, type: r.type, hp: 1, maxHp: 1, flash: 0, spawnT: 0, shield: 0, trackPhase: game.tick * r.speed });
  }
  if (((game.tick / 30) | 0) % 2 === 0) drawCenterText('PRESS ENTER', 392, '#fff', 16);
  ctx.restore();

  ctx.font = 'bold 12px ' + FONT;
  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('最高分', HUD_X, 60);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(String(game.hiScore).padStart(6, '0'), HUD_X, 78);
}

// ---- 主渲染 ----
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (game.state === 'title') { drawTitle(); return; }

  ctx.save();
  ctx.translate(10, 0);

  drawTerrain();
  for (const e of game.enemies) drawTank(e);
  if (game.player && game.player.alive) drawTank(game.player);
  for (const b of game.bullets) drawBullet(b);
  for (const pu of game.powerups) pu.draw(ctx);
  drawTrees();
  for (const f of game.fx) f.draw(ctx);
  drawEagle();

  if (game.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (game.flash / 10).toFixed(2) + ')';
    ctx.fillRect(-10, 0, CANVAS_W, CANVAS_H);
  }

  if (game.state === 'levelintro') drawLevelIntro();
  else if (game.state === 'levelclear') drawLevelClear();
  else if (game.state === 'paused') drawPaused();
  else if (game.state === 'gameover') drawGameOver();

  ctx.restore();
  drawHUD();
}
