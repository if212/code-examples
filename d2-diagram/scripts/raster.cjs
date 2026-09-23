// raster.cjs - rasterize d2 SVGs in headless Chromium through Node Playwright. The SVG is shown through
// <img src="data:..."> exactly as a README or doc page embeds it, so embedded fonts, icons and label masks
// render as readers see them.
//
// usage: node raster.cjs IN.svg OUT.png [--scale 2] [--width PX] [--dark]
//        node raster.cjs IN.svg OUT.pdf            (or: --pdf OUT.pdf) vector PDF, page = the SVG's size
//        node raster.cjs --jobs JOBS.json          [{"in","out","scale","width","dark"}, ...] in one browser
//        node raster.cjs IN.svg --measure OUT.json getBBox() of every <text> (d2lint calibration)
//   --scale N   device pixel ratio (alias --dpr; default 2)
//   --width PX  CSS width the SVG is displayed at (default: its own width)
//   --dark      prefers-color-scheme: dark, on a dark page
// Finds Playwright via require(), NODE_PATH, <node prefix>/lib/node_modules, /opt/node22/lib/node_modules,
// then `npm root -g`; browsers via PLAYWRIGHT_BROWSERS_PATH (or /opt/pw-browsers), else any Chrome/Chromium
// binary (CHROME_PATH, PATH, Playwright caches, macOS apps).
// exit: 0 ok | 10 playwright module not found | 11 no Chromium could be launched | 12 render error
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
}

function findPlaywright() {
  const names = ['playwright', 'playwright-core', 'playwright-chromium'];
  for (const n of names) { try { return require(n); } catch (e) { /* next */ } }
  const roots = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  roots.push(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules'),
    path.join(path.dirname(process.execPath), 'node_modules'),
    '/opt/node22/lib/node_modules', '/usr/local/lib/node_modules', '/usr/lib/node_modules',
    '/opt/homebrew/lib/node_modules', path.join(os.homedir(), '.npm-global', 'lib', 'node_modules'));
  for (const r of roots) for (const n of names) { try { return require(path.join(r, n)); } catch (e) { /* next */ } }
  try {  // slowest: ask npm
    const g = cp.execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).toString().trim();
    for (const n of names) { try { return require(path.join(g, n)); } catch (e) { /* next */ } }
  } catch (e) { /* no npm */ }
  return null;
}

function chromeCandidates() {
  const c = [process.env.CHROME_PATH, process.env.D2CHECK_CHROME].filter(Boolean);
  const pwb = process.env.PLAYWRIGHT_BROWSERS_PATH;  // when set it is authoritative; else the usual caches
  const roots = pwb !== undefined ? [pwb] : ['/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')];
  const rels = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe'];
  for (const r of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(r).filter(d => /^chromium/.test(d)).sort().reverse(); } catch (e) { continue; }
    for (const d of dirs) for (const rel of rels) { const p = path.join(r, d, rel); if (fs.existsSync(p)) c.push(p); }
  }
  for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { c.push(cp.execSync('command -v ' + n, { stdio: ['ignore', 'pipe', 'ignore'], shell: '/bin/sh' }).toString().trim()); } catch (e) { /* absent */ }
  }
  c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  return [...new Set(c.filter(p => p && fs.existsSync(p)))];
}

async function launch(pw) {
  const errs = [];
  try { return await pw.chromium.launch(); } catch (e) { errs.push('bundled: ' + String(e.message).split('\n')[0]); }
  for (const exe of chromeCandidates()) {
    try { return await pw.chromium.launch({ executablePath: exe }); } catch (e) { errs.push(exe + ': ' + String(e.message).split('\n')[0]); }
  }
  console.error('raster.cjs: no Chromium could be launched (npx playwright install chromium, or set CHROME_PATH)\n  ' + errs.join('\n  '));
  process.exit(11);
}

function svgSize(src) {
  const m = src.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!m) throw new Error('no viewBox (is this an SVG from d2?)');
  return [+m[3], +m[4]];
}

async function png(browser, job) {
  const src = fs.readFileSync(job.in, 'utf8');
  const [W, H] = svgSize(src);
  const cssW = Math.max(1, Math.round(job.width || W));
  const cssH = Math.max(1, Math.ceil(H * cssW / W - 0.01));
  const scale = Number(job.scale || 1);
  const ctx = await browser.newContext({ viewport: { width: cssW, height: cssH }, deviceScaleFactor: scale,
    colorScheme: job.dark ? 'dark' : 'light' });
  try {
    const page = await ctx.newPage();
    const uri = 'data:image/svg+xml;base64,' + Buffer.from(src).toString('base64');
    // width set, height auto: the same box a doc page gives <img> (max-width:100%) - fractional heights included
    await page.setContent('<!doctype html><html><body style="margin:0;background:' + (job.dark ? '#0d1117' : '#ffffff') +
      '"><img id="d" alt="" src="' + uri + '" style="display:block;width:' + cssW + 'px;height:auto"></body></html>');
    await page.waitForFunction(() => { const i = document.getElementById('d'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
    await page.evaluate(() => document.getElementById('d').decode()).catch(() => {});
    await page.waitForTimeout(50);
    await page.screenshot({ path: job.out, clip: { x: 0, y: 0, width: cssW, height: cssH } });
    console.log('wrote ' + job.out + ' (' + cssW + 'x' + cssH + ' css px @' + scale + 'x = ' + Math.round(cssW * scale) + 'x' + Math.round(cssH * scale) + ' px)');
  } finally { await ctx.close(); }
}

async function pdf(browser, job) {
  const src = fs.readFileSync(job.in, 'utf8');
  const [W, H] = svgSize(src);
  const page = await browser.newPage();
  try {
    const inline = src.replace(/^<\?xml[^>]*>\s*/, '');
    await page.setContent('<!doctype html><html><head><style>@page{size:' + W + 'px ' + H + 'px;margin:0}html,body{margin:0}' +
      'svg{display:block}</style></head><body>' + inline + '</body></html>');
    await page.waitForTimeout(100);
    await page.pdf({ path: job.out, width: W + 'px', height: H + 'px', printBackground: true, pageRanges: '1' });
    console.log('wrote ' + job.out + ' (vector PDF, ' + W + 'x' + H + ' px page)');
  } finally { await page.close(); }
}

async function measure(browser, job) {
  const page = await browser.newPage();
  try {
    await page.goto('file://' + path.resolve(job.in));
    const boxes = await page.evaluate(() => [...document.querySelectorAll('text')].map(t => {
      const b = t.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, text: t.textContent, cls: t.getAttribute('class') };
    }));
    fs.writeFileSync(job.measure, JSON.stringify(boxes));
    console.log('wrote ' + job.measure + ' (' + boxes.length + ' text boxes)');
  } finally { await page.close(); }
}

(async () => {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
  let jobs;
  if (opt('--jobs')) {
    jobs = JSON.parse(fs.readFileSync(opt('--jobs'), 'utf8'));
  } else {
    const pos = [];
    for (let i = 0; i < args.length; i++) {
      if (['--scale', '--dpr', '--width', '--pdf', '--measure'].includes(args[i])) { i++; continue; }
      if (!args[i].startsWith('--')) pos.push(args[i]);
    }
    const [inp, out] = pos;
    if (!inp || !(out || opt('--pdf') || opt('--measure'))) {
      console.error('usage: node raster.cjs IN.svg OUT.png [--scale 2] [--width PX] [--dark] | IN.svg OUT.pdf | --jobs JOBS.json');
      process.exit(2);
    }
    jobs = [];
    if (out) jobs.push({ in: inp, out, scale: Number(opt('--scale', opt('--dpr', 2))), width: opt('--width') ? Number(opt('--width')) : 0, dark: args.includes('--dark') });
    if (opt('--pdf')) jobs.push({ in: inp, out: opt('--pdf') });
    if (opt('--measure')) jobs.push({ in: inp, measure: opt('--measure') });
  }
  const pw = findPlaywright();
  if (!pw) { console.error('raster.cjs: playwright module not found (npm i -g playwright, or set NODE_PATH)'); process.exit(10); }
  const browser = await launch(pw);
  let failed = 0;
  try {
    for (const job of jobs) {
      try {
        if (job.measure) await measure(browser, job);
        else if (/\.pdf$/i.test(job.out)) await pdf(browser, job);
        else await png(browser, job);
      } catch (e) { failed++; console.error('raster.cjs: ' + (job.out || job.measure) + ': ' + String(e.message).split('\n')[0]); }
    }
  } finally { await browser.close(); }
  process.exit(failed ? 12 : 0);
})();
