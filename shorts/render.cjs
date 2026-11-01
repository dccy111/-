// 사용: node render.cjs <template.html> <쿼리(예: ep=02, set=A)> <outdir> [stills|frames|t1,t2,...]
const { chromium } = require('playwright');
const [,, tpl, query, out, mode = 'stills'] = process.argv; const ep = query.includes('=') ? query : 'ep=' + query;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + tpl + '?' + ep); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const fams = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight));
  console.log('fonts loaded:', [...new Set(fams)].join(', ') || 'none');
  const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
  const cues = await p.evaluate(() => window.CUES ? { len: LEN, ...CUES } : null); if (cues) fs.writeFileSync(out + '/cues.json', JSON.stringify(cues));
  const times = mode === 'stills' ? [0.15, 1.5, 4.2, 7.3, 10.5, 13.8] : /^[\d.,]+$/.test(mode) ? mode.split(',').map(Number) : Array.from({ length: Math.round((await p.evaluate(() => LEN)) * 30) }, (_, i) => i / 30);
  for (const [i, t] of times.entries()) {
    await p.evaluate((t) => setTime(t), t);
    await p.screenshot({ path: `${out}/${mode !== 'frames' ? 's' + t.toFixed(1) : String(i).padStart(4, '0')}.png` });
  }
  console.log(ep, mode, times.length, 'images', 'errors', errs.length ? errs : 'none'); await b.close();
})();
