'use strict';
// ===================== WebAudio 合成音效 =====================

const SFX = {
  ctx: null,
  muted: false,

  ensure() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  tone({ freq = 440, to = null, dur = 0.1, type = 'square', vol = 0.1, delay = 0 }) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise({ dur = 0.25, vol = 0.2, delay = 0 }) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  },

  shoot()      { this.tone({ freq: 900, to: 200, dur: 0.08, vol: 0.07 }); },
  enemyShoot() { this.tone({ freq: 300, to: 100, dur: 0.1, vol: 0.05 }); },
  hit()        { this.tone({ freq: 1500, to: 900, dur: 0.05, type: 'triangle', vol: 0.05 }); },
  brick()      { this.noise({ dur: 0.08, vol: 0.06 }); },
  explode(big) { this.noise({ dur: big ? 0.5 : 0.3, vol: big ? 0.22 : 0.13 });
                 this.tone({ freq: 120, to: 40, dur: big ? 0.4 : 0.25, vol: 0.1 }); },
  spawn()      { this.tone({ freq: 200, to: 600, dur: 0.25, vol: 0.05 }); },
  powerup()    { [660, 880, 1100].forEach((f, i) => this.tone({ freq: f, dur: 0.09, vol: 0.09, delay: i * 0.08 })); },
  start()      { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.12, vol: 0.09, delay: i * 0.12 })); },
  levelClear() { [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 0.14, vol: 0.09, delay: i * 0.15 })); },
  gameOver()   { [440, 349, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.25, vol: 0.1, delay: i * 0.25 })); },
};
