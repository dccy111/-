const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const X = JSON.parse(document.getElementById('xpl').textContent);
    const D = JSON.parse(document.getElementById('data').textContent);
    const IT = {}; D.skills.forEach(s => s.items.forEach(i => IT[i.id] = i));
    let ok = 0, bad = [];
    for (const k in X) {
      try { const h = xplHtml(IT[k], IT[k].k === 'ox' ? !IT[k].a : (IT[k].ch||[])[1], IT[k].k === 'ox' ? true : (IT[k].ch||[]));
        if (!h || h.length < 80 || /undefined|null|\*\*/.test(h.replace(/<[^>]+>/g,''))) bad.push(k + ':' + (h||'').replace(/<[^>]+>/g,' ').slice(0,120)); else ok++; }
      catch (e) { bad.push(k + ' ERR ' + e.message); }
    }
    return { ok, bad: bad.slice(0, 15), nbad: bad.length };
  });
  console.log(JSON.stringify(r, null, 1), errs.slice(0,3)); await b.close();
})();
