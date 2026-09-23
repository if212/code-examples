// raster.cjs - rasterize d2 SVGs in headless Chromium through Node Playwright. The SVG is shown through
// <img src="data:..."> exactly as a README or doc page embeds it, so embedded fonts, icons and label masks
// render as readers see them. Text is antialiased in grayscale (no LCD colour fringes).
// d2raster.py drives this file; call it directly only when python3 is missing.
//
// usage: node raster.cjs IN.svg OUT.png [--scale 2] [--width PX] [--dark]
//        node raster.cjs IN.svg OUT.pdf            (or: IN.svg --pdf OUT.pdf) vector PDF, page = the SVG's size
//        node raster.cjs --jobs JOBS.json          [{"in","out","scale","width","dark"}, ...] in one browser
//        node raster.cjs IN.svg --measure OUT.json getBBox() of every <text> (d2lint calibration)
//        node raster.cjs --probe                   which Playwright and Chromium would be used (doctor.sh)
//   --scale N   device pixel ratio (alias --dpr; default 2)
//   --width PX  CSS width the SVG is displayed at (default: its own width)
//   --dark      prefers-color-scheme: dark, on a dark page
//   --quiet     print nothing on success
// Finds Playwright via $D2CHECK_PLAYWRIGHT (a module dir; nothing else is tried then), require(), NODE_PATH,
// ~/.local/share/d2-diagram/node (doctor.sh --install), <node prefix>/lib/node_modules, then `npm root -g`;
// browsers via PLAYWRIGHT_BROWSERS_PATH (or /opt/pw-browsers), else any Chrome/Chromium binary (CHROME_PATH,
// PATH, Playwright caches, macOS apps).
// exit codes (shared by every script of the skill):
//   0 ok | 1 a render failed | 3 environment: no playwright module or no Chromium (run doctor.sh) | 64 usage
// examples:
//   node raster.cjs flow.svg flow.png --scale 2
//   node raster.cjs flow.svg flow.pdf
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');

// a shell word, quoted when needed: printed commands stay copy-pasteable under a path with spaces
const shq = (s) => (/^[A-Za-z0-9_.\/=:,+@%-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'");
const DOCTOR = 'sh ' + shq(path.join(__dirname, 'doctor.sh'));
// grayscale antialiasing: LCD subpixel text leaves colour fringes in the PNGs people ship and read
const LAUNCH_ARGS = ['--disable-lcd-text'];

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
}

function usage(code) {
  const lines = fs.readFileSync(__filename, 'utf8').split('\n');
  const text = lines.slice(0, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n');
  (code ? process.stderr : process.stdout).write(text + '\n');
  process.exit(code);
}

// the folder doctor.sh --install puts a user-space Playwright in (no sudo, no global npm)
const USER_NODE = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'd2-diagram', 'node', 'node_modules');

// -> {mod, dir} of the first Playwright found, or null. D2CHECK_PLAYWRIGHT=<module dir> pins one install.
function findPlaywright() {
  const load = (p) => { try { return { mod: require(p), dir: path.dirname(require.resolve(path.join(p, 'package.json'))) }; } catch (e) { return null; } };
  if (process.env.D2CHECK_PLAYWRIGHT) return load(path.resolve(process.env.D2CHECK_PLAYWRIGHT));
  const names = ['playwright', 'playwright-core', 'playwright-chromium'];
  for (const n of names) {
    try { return { mod: require(n), dir: path.dirname(require.resolve(n + '/package.json')) }; } catch (e) { /* next */ }
  }
  const roots = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  roots.push(USER_NODE, path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules'),
    path.join(path.dirname(process.execPath), 'node_modules'),
    '/opt/node22/lib/node_modules', '/usr/local/lib/node_modules', '/usr/lib/node_modules',
    '/opt/homebrew/lib/node_modules', path.join(os.homedir(), '.npm-global', 'lib', 'node_modules'));
  for (const r of roots) for (const n of names) { const f = load(path.join(r, n)); if (f) return f; }
  try {  // slowest: ask npm
    const g = cp.execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).toString().trim();
    for (const n of names) { const f = load(path.join(g, n)); if (f) return f; }
  } catch (e) { /* no npm */ }
  return null;
}

function chromeCandidates() {
  const c = [process.env.CHROME_PATH, process.env.D2CHECK_CHROME].filter(Boolean);
  const pwb = process.env.PLAYWRIGHT_BROWSERS_PATH;  // when set it is authoritative; else the usual caches
  const roots = pwb !== undefined ? [pwb] : ['/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')];
  // Playwright's layouts before 1.57 (chrome-linux, chrome-mac) and after (Chrome for Testing builds)
  const cft = 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const rels = ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux-arm64/chrome', 'chrome-linux/headless_shell',
    'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-linux-arm64/chrome-headless-shell',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac/headless_shell', 'chrome-mac-arm64/' + cft,
    'chrome-mac-x64/' + cft, 'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe'];
  for (const r of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(r).filter(d => /^chromium/.test(d)).sort().reverse(); } catch (e) { continue; }
    for (const d of dirs) for (const rel of rels) { const p = path.join(r, d, rel); if (fs.existsSync(p)) c.push(p); }
  }
  for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { c.push(cp.execSync('command -v ' + n, { stdio: ['ignore', 'pipe', 'ignore'], shell: '/bin/sh' }).toString().trim()); } catch (e) { /* absent */ }
  }
  c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  return [...new Set(c.filter(p => p && fs.existsSync(p)))];
}

// -> {browser, how} or {browser: null, errs}
async function tryLaunch(pw) {
  const errs = [];
  try { return { browser: await pw.chromium.launch({ args: LAUNCH_ARGS }), how: 'playwright-managed' }; } catch (e) { errs.push('playwright-managed: ' + String(e.message).split('\n')[0]); }
  for (const exe of chromeCandidates()) {
    try { return { browser: await pw.chromium.launch({ executablePath: exe, args: LAUNCH_ARGS }), how: exe }; } catch (e) { errs.push(exe + ': ' + String(e.message).split('\n')[0]); }
  }
  return { browser: null, errs };
}

async function launch(pw) {
  const r = await tryLaunch(pw);
  if (r.browser) return r.browser;
  console.error('raster.cjs: no Chromium could be launched - install one with: npx playwright install chromium ' +
    '(or set CHROME_PATH to a Chrome/Chromium binary); check with: ' + DOCTOR + '\n  ' + r.errs.join('\n  '));
  process.exit(3);
}

// --probe (doctor.sh): which Playwright and which Chromium this machine would use
async function probe() {
  const found = findPlaywright();
  let version = '';
  if (found) { try { version = ' ' + require(path.join(found.dir, 'package.json')).version; } catch (e) { /* unknown */ } }
  console.log('playwright: ' + (found ? found.dir + version : 'none'));
  if (!found) process.exit(3);
  const r = await tryLaunch(found.mod);
  if (!r.browser) {
    console.log('chromium: none - ' + (r.errs[0] || 'no candidate').slice(0, 300));
    process.exit(3);
  }
  console.log('chromium: ok ' + r.how + ' ' + r.browser.version());
  await r.browser.close();
  process.exit(0);
}

function svgSize(src) {
  const m = src.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!m) throw new Error('no viewBox (is this an SVG from d2?)');
  return [+m[3], +m[4]];
}

let quiet = false;
function say(s) { if (!quiet) console.log(s); }

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
    await page.waitForFunction(() => { const i = document.getElementById('d'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 60000 });  // a 6000px canvas takes ~20s on a busy machine
    await page.evaluate(() => document.getElementById('d').decode()).catch(() => {});
    await page.waitForTimeout(50);
    await page.screenshot({ path: job.out, clip: { x: 0, y: 0, width: cssW, height: cssH } });
    say('wrote ' + job.out + ' (' + cssW + 'x' + cssH + ' css px @' + scale + 'x = ' + Math.round(cssW * scale) + 'x' + Math.round(cssH * scale) + ' px)');
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
    say('wrote ' + job.out + ' (vector PDF, ' + W + 'x' + H + ' px page)');
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
    say('wrote ' + job.measure + ' (' + boxes.length + ' text boxes)');
  } finally { await page.close(); }
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);
  if (args.includes('--probe')) return probe();
  quiet = args.includes('--quiet');
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
  const bad = (msg) => { console.error('raster.cjs: ' + msg + ' (run with --help for the usage)'); process.exit(64); };
  let jobs;
  if (opt('--jobs')) {
    try { jobs = JSON.parse(fs.readFileSync(opt('--jobs'), 'utf8')); } catch (e) { bad('cannot read --jobs ' + opt('--jobs') + ': ' + e.message); }
  } else {
    const pos = [];
    const known = ['--scale', '--dpr', '--width', '--pdf', '--measure', '--dark', '--quiet'];
    for (let i = 0; i < args.length; i++) {
      if (['--scale', '--dpr', '--width', '--pdf', '--measure'].includes(args[i])) { i++; continue; }
      if (args[i].startsWith('--') && !known.includes(args[i])) bad('unknown option ' + args[i]);
      if (!args[i].startsWith('--')) pos.push(args[i]);
    }
    const [inp, out] = pos;
    if (!inp || !(out || opt('--pdf') || opt('--measure'))) bad('give IN.svg and OUT.png, OUT.pdf or --measure OUT.json');
    if (!fs.existsSync(inp)) { console.error('raster.cjs: no such file: ' + inp); process.exit(1); }
    const scale = Number(opt('--scale', opt('--dpr', 2)));
    if (!(scale > 0 && scale <= 8)) bad('--scale wants a pixel ratio in (0, 8], e.g. 2');
    jobs = [];
    if (out) jobs.push({ in: inp, out, scale, width: opt('--width') ? Number(opt('--width')) : 0, dark: args.includes('--dark') });
    if (opt('--pdf')) jobs.push({ in: inp, out: opt('--pdf') });
    if (opt('--measure')) jobs.push({ in: inp, measure: opt('--measure') });
  }
  const found = findPlaywright();
  const pw = found && found.mod;
  if (!pw) {
    console.error('raster.cjs: playwright module not found - install it with: npm i -g playwright && npx playwright install chromium ' +
      '(or set NODE_PATH to the node_modules that holds it); check with: ' + DOCTOR);
    process.exit(3);
  }
  const browser = await launch(pw);
  let failed = 0;
  try {
    for (const job of jobs) {
      try {
        if (job.measure) await measure(browser, job);
        else if (/\.pdf$/i.test(job.out)) await pdf(browser, job);
        else await png(browser, job);
        if (job.out && fs.existsSync(job.out)) fs.chmodSync(job.out, 0o644);
      } catch (e) { failed++; console.error('raster.cjs: ' + (job.out || job.measure) + ': ' + String(e.message).split('\n')[0]); }
    }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
})();
