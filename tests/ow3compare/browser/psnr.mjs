// 档2 公平基元 浏览器栅格 PSNR driver
// 用 headless Chromium(SwiftShader) 渲染 openwar3 canvas-2D drawImage 参考 与 产品 WebGL 路径,
// 截图后经 tests/visual-regression/compare.ts 计算 PSNR。
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const chromium = req('playwright-core').chromium;
const CHROME = process.env.DSH_CHROME || 'C:\\Users\\81468\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';

// simple static server for the windowed page (relative three path + file)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
// Serves: psnr.html + assets from `dir`, and the project three.js build under `/threebuild/`.
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
const PROJ = dirname(dirname(dirname(__dirname))); // browser -> ow3compare -> tests -> project root
const THREE_BUILD = realpathSync(join(PROJ, 'node_modules', 'three', 'build'));
function serve(dir, port) {
  return new Promise((res) => {
    const srv = createServer((q, r) => {
      const url = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      let fp;
      if (url.startsWith('/threebuild/')) {
        fp = join(THREE_BUILD, url.slice('/threebuild/'.length));
      } else {
        fp = url === '/' ? join(dir, 'psnr.html') : join(dir, url);
      }
      try {
        const body = readFileSync(fp);
        const ext = fp.slice(fp.lastIndexOf('.')).toLowerCase();
        r.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
        r.end(body);
      } catch {
        r.writeHead(404); r.end('nf ' + fp);
      }
    });
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}

async function main() {
  const [texNum, scaleStr, qualityArg, flagsArg] = process.argv.slice(2);
  const t = texNum === '4' ? 4 : texNum === '3' ? 3 : texNum === '2' ? 2 : 1;
  const scale = scaleStr ? Number(scaleStr) : 1800;
  const refQuality = ['high', 'low', 'medium'].includes(qualityArg) ? qualityArg : undefined;
  const flags = flagsArg || qualityArg || '';
  const rawColorSpace = String(flags).includes('raw') || String(qualityArg).includes('raw');
  const meta = JSON.parse(readFileSync(join(__dirname, `_t${t}.meta.json`), 'utf8'));
  const rgbaBuf = readFileSync(join(__dirname, `_t${t}.rgba`));
  const base64 = rgbaBuf.toString('base64');

  // Full-frame rect: viewport 1440x1080 inner, margin 240 left. x=0..0.8 -> 240..1680, y=0..0.6 -> 0..1080
  const RECT = { x: 240, y: 0, w: 1440, h: 1080 };

  const srv = await serve(__dirname, 8913);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox', '--no-sandbox', '--ignore-gpu-blocklist',
      '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars',
    ],
  });
  try {
    const cfg = {
      target: `tex${t}@scale${scale}${refQuality ? '@q' + refQuality : ''}${rawColorSpace ? '@raw' : ''}`,
      ...meta,
      data: base64,
      rectX: RECT.x, rectY: RECT.y, rectW: RECT.w, rectH: RECT.h,
      refQuality,
      colorSpace: rawColorSpace ? 'raw' : undefined,
    };
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', (m) => console.log('[page:' + m.type() + '] ' + m.text()));
    page.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
    await page.addInitScript((c) => { window.__PSNR = c; }, cfg);
    await page.goto('http://127.0.0.1:8913/psnr.html?' + t, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('out').textContent.includes('READY'), { timeout: 30000 }).catch(async () => {
      const c = await page.evaluate(() => document.getElementById('out').textContent);
      console.log('NO READY. out=' + JSON.stringify(c));
      // also dump console messages
      throw new Error('READY timeout');
    });
    const led = await page.evaluate(() => document.getElementById('out').textContent);
    // screenshot each canvas to PNG dataURL
    const refPng = await page.locator('#ref').screenshot();
    const minePng = await page.locator('#mine').screenshot();
    writeFileSync(join(__dirname, `_psnr_t${t}_ref.png`), refPng);
    writeFileSync(join(__dirname, `_psnr_t${t}_mine.png`), minePng);
    const result = computePsnr(refPng, minePng);
    console.log('PSNR_RESULT ' + JSON.stringify({ target: cfg.target, ...result }));
    console.log('refPng', refPng.length, 'minePng', minePng.length);
  } finally {
    await browser.close();
    srv.close();
  }
}

// In-process PSNR (mirrors tests/visual-regression/compare.ts)
function computePsnr(actualPng, baselinePng) {
  const pixelmatchMod = req('pixelmatch');
  const pixelmatch = typeof pixelmatchMod === 'function' ? pixelmatchMod : pixelmatchMod.default;
  const { PNG } = req('pngjs');
  const a = PNG.sync.read(Buffer.from(actualPng));
  const b = PNG.sync.read(Buffer.from(baselinePng));
  const { width, height } = a;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.05, includeAA: false });
  let sumSq = 0, maxChannelDiff = 0;
  for (let i = 0; i < a.data.length; i += 1) {
    const d = a.data[i] - b.data[i];
    sumSq += d * d;
    const ad = Math.abs(d);
    if (ad > maxChannelDiff) maxChannelDiff = ad;
  }
  const mse = sumSq / a.data.length;
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  return { diffPixels, totalPixels, diffRatio: diffPixels / totalPixels, psnr, maxChannelDiff };
}
main().catch((e) => { console.error(e); process.exit(1); });