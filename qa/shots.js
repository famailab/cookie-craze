/* QA screenshots: node qa/shots.js [outdir] */
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'qa', 'shots');

async function main() {
  const server = spawn('python3', ['-m', 'http.server', '8901'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const errors = [];
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=420,860', '--autoplay-policy=no-user-gesture-required']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGE: ' + e.message));
    await page.goto('http://localhost:8901/index.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUT, '01-title.png') });

    // start game via button
    await page.click('#btn-start');
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT, '02-game.png') });

    // rotate some rows via keyboard to build a match scenario
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await new Promise(r => setTimeout(r, 250)); }
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUT, '03-rotated.png') });

    // pixel FX off
    await page.click('#btn-pixel2');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUT, '04-crisp.png') });
    await page.click('#btn-pixel2'); // back on

    // pause menu
    await page.click('#btn-pause');
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '05-pause.png') });
    await page.click('#btn-resume');
    await new Promise(r => setTimeout(r, 400));

    // help
    await page.click('#btn-help2');
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '06-help.png') });
    await page.click('#btn-help-close');
    await new Promise(r => setTimeout(r, 400));

    // immersive (fullscreen may fail headless; device still renders)
    await page.click('#btn-immersive2');
    await new Promise(r => setTimeout(r, 1600));
    await page.screenshot({ path: path.join(OUT, '07-immersive.png') });

    // dpad rotate on device
    await page.click('.dp.right');
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, '08-immersive-play.png') });

    console.log('console errors:', errors.length ? errors : 'none');
  } finally {
    await browser.close();
    server.kill();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
