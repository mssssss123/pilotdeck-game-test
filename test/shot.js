'use strict';
// 视觉验证脚本：用 Playwright 缓存里的 Chrome for Testing + CDP 实时跑游戏并截图。
// 运行：node test/shot.js [输出png路径]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1224/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const out = process.argv[2] || '/tmp/tank-live.png';
const seconds = +(process.env.SHOT_SECONDS || 9);
const url = 'file://' + path.join(__dirname, '..', 'index.html') + '?demo';
const PORT = 9333;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=640,540', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try {
        const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
        target = await r.json();
      } catch (e) { /* chrome 未就绪 */ }
    }
    if (!target) throw new Error('无法连接 Chrome 调试端口');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let msgId = 0;
    const pending = new Map();
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    const send = (method, params = {}) => new Promise(res => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');

    const key = (code, down) => send('Runtime.evaluate', {
      expression: `window.dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}',{code:${JSON.stringify(code)}}))`,
    });
    const evalJs = expression => send('Runtime.evaluate', { expression, returnByValue: true });

    // 模拟操作：向上射击 -> 向右移动射击
    await sleep(4000);
    await key('ArrowUp', true);
    await key('Space', true);
    await sleep(3000);
    await key('ArrowUp', false);
    await key('Space', false);
    await key('ArrowRight', true);
    await sleep(1500);
    await key('Space', true);
    await sleep(seconds > 9 ? seconds * 1000 - 8500 : 1500);

    const state = await evalJs('JSON.stringify({state: game.state, tick: game.tick, enemies: game.enemies.length, bullets: game.bullets.length, score: game.score, fx: game.fx.length})');
    console.log('运行状态:', state.result.result.value, state.exceptionDetails ? JSON.stringify(state.exceptionDetails.exception) : '');

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('截图已保存:', out);
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
