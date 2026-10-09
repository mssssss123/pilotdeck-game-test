'use strict';
// ===================== 全局配置与常量 =====================

const TILE = 32;              // 逻辑格（地形格）
const CELL = 16;              // 碰撞半格（砖块破坏的最小单位）
const COLS = 13;
const ROWS = 13;
const GRID = COLS * 2;        // 26 x 26 半格
const FIELD_W = COLS * TILE;  // 416
const FIELD_H = ROWS * TILE;  // 416
const HUD_W = 100;
const HUD_X = FIELD_W + 20;   // 436（画布绝对坐标）
const CANVAS_W = FIELD_W + 20 + HUD_W + 10; // 546
const CANVAS_H = FIELD_H;
const TICK = 1000 / 60;

const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// 半格地形类型
const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREE: 4, ICE: 5, EAGLE: 6 };
const SOLID_TANK   = { 0: false, 1: true, 2: true, 3: true,  4: false, 5: false, 6: true };
const SOLID_BULLET = { 0: false, 1: true, 2: true, 3: false, 4: false, 5: false, 6: true };

// 敌人类型配置
const ENEMY_TYPES = {
  normal: { speed: 1.5, hp: 1, bulletSpeed: 5, score: 100,
    palette: { body: '#9fa7b0', track: '#565d66', turret: '#c6ccd3' } },
  fast:   { speed: 2.8, hp: 1, bulletSpeed: 5, score: 200,
    palette: { body: '#b8a15c', track: '#6d5e33', turret: '#dcc77e' } },
  power:  { speed: 1.5, hp: 1, bulletSpeed: 8, score: 300,
    palette: { body: '#7fae6b', track: '#41603a', turret: '#a4d68d' } },
  armor:  { speed: 1.2, hp: 4, bulletSpeed: 5, score: 400,
    palette: { body: '#a8714f', track: '#5e3f2b', turret: '#d29a74' } },
};
const ARMOR_TINTS = [null, '#c08a4a', '#c9a13c', '#63a83c']; // 装甲坦克按剩余血量变色

const PLAYER_PALETTE = { body: '#e9c53c', track: '#7a6712', turret: '#ffe887' };
const PLAYER = { speed: 2.0, bulletSpeed: 7, respawnDelay: 100, shieldTime: 180 };
const PLAYER_START = { x: 4 * TILE, y: 12 * TILE };
const SPAWN_POINTS = [
  { x: 0, y: 0 },
  { x: 6 * TILE, y: 0 },
  { x: 12 * TILE, y: 0 },
];

const POWERUP_TYPES = ['star', 'helmet', 'grenade', 'heart', 'timer'];
