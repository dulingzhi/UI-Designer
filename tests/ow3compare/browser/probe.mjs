// Probe v2: correct flat-color WebGL2 shader; validate pixel-readback DETERMINISM across 2 runs.
import { chromium } from 'playwright-core';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_CACHE = process.env.LOCALAPPDATA + '\\ms-playwright';
const CHROME = join(PLAYWRIGHT_CACHE, 'chromium-1208', 'chrome-win64', 'chrome.exe');
if (!existsSync(CHROME)) { console.error('CHROME NOT FOUND', CHROME); process.exit(2); }

// Correct minimal shader: flat magenta with a diagonal red split (top-right clear). 
const html = `<!doctype html><body>
<canvas id="c" width="64" height="64"></canvas>
<div id="out">PENDING</div>
<script>
(() => {
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const out = document.getElementById('out');
  if (!gl) { out.textContent = 'NO_GL'; done(); return; }
  const renderer = gl.getParameter(gl.RENDERER) + ' | ' + gl.getParameter(gl.VERSION);
  const vsSrc = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
  const fsSrc = 'precision mediump float; void main(){ gl_FragColor = vec4(0.9, 0.1, 0.4, 1.0); }';
  const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ out.textContent='SHADER_ERR '+gl.getShaderInfoLog(s); done(); return null; } return s; };
  const vs = make(gl.VERTEX_SHADER, vsSrc), fs = make(gl.FRAGMENT_SHADER, fsSrc);
  if(!vs||!fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ out.textContent='LINK_ERR '+gl.getProgramInfoLog(prog); done(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const verts = new Float32Array([-1,-1, 3,-1, -1,3]); // fullscreen triangle
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0,0,64,64);
  gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  const px = new Uint8Array(64*64*4);
  gl.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,px);
  out.textContent = JSON.stringify({ renderer, err: gl.getError(), hash: hashHex(px), corner: [px[0],px[1],px[2],px[3]] });
  done();
  function hashHex(u8){ let h=5381; for(let i=0;i<u8.length;i+=4){ h=((h<<5)+h+u8[i])>>>0; } return ('00000000'+h.toString(16)).slice(-8); }
})();
function done(){ window.__probeDone = true; }
</script></body>`;

writeFileSync(join(__dirname, 'probe2.html'), html);

async function runOnce() {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox','--no-sandbox','--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file:///' + join(__dirname, 'probe2.html').replace(/\\/g, '/'));
  await page.waitForFunction(() => window.__probeDone === true, null, { timeout: 15000 });
  const result = await page.evaluate(() => document.getElementById('out').textContent);
  await browser.close();
  return result;
}

let a, b;
try { a = await runOnce(); b = await runOnce(); }
catch (e) { console.error('PROBE_ERROR', e.message); process.exit(1); }
console.log('RUN1', a);
console.log('RUN2', b);
const same = a === b;
console.log('DETERMINISTIC:', same ? 'YES' : 'NO');
process.exit(same ? 0 : 1);