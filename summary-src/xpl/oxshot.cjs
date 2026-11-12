const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(800);
  await p.evaluate((ids) => { S.notice = S.notice || {}; S.notice.n2611 = 1; S.wrongs = {}; ids.forEach((id, i) => { const it = IT.get(id); const sk = SK.get(it.sid); S.wrongs[id] = { t: Date.now() - i, s: sk.subj, u: sk.unit, o: null }; }); nav('wrongs'); }, process.argv.slice(4));
  await p.waitForTimeout(400);
  const n = await p.locator('summary').count(); for (let i = 0; i < n; i++) { try { await p.locator('summary').nth(i).click({ timeout: 500 }); } catch (e) {} }
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[3], fullPage: true }); console.log('xpl', await p.locator('[data-testid=xpl]').count(), errs); await b.close();
})();
