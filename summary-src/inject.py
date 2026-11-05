# 요약집 탭 주입: python3 summary/build/inject.py  (index.html 직접 수정, 다시 실행해도 같은 결과)
import json, re
F = '/home/user/-/mulchi-web/index.html'
H = open(F, encoding='utf-8').read()
import glob, html as _h
D0 = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', H, re.S).group(1))
SK0 = {x['id']: x for x in D0['skills']}
PL = lambda t: _h.escape(re.sub(r'[*=]', '', str(t or '')))
def exams(sids):
    ex = {}
    for sid in sids:
        for it in SK0[sid]['items']:
            m = re.search(r':xf(\d+)_(\d+)_(\d+)$', it['id'])
            if m: ex[m.group(0)] = (int(m.group(1)), it)
    return list(ex.values())
units = {}
for f in sorted(glob.glob('summary/build/specs/u*.json')):
    u = re.search(r'u(\d+)\.json$', f).group(1); sp = json.load(open(f)); n = 0; parts = []
    for p in sp['parts']:
        lst = []
        for c in p['ch']:
            n += 1; ex = exams(c['sids']); rs = sorted({r for r, _ in ex})
            freq = (f"{'·'.join(map(str, rs))}회 {'모두 ' if len(rs) == 4 else ''}출제 · {len(ex)}문항") if ex else "기출 없음 · 기본 개념"
            body = c['body']
            if ex and 'class="exam"' not in body:
                pick = []; seen = set()
                for r, it in sorted(ex, key=lambda x: -x[0]):
                    if any(it['id'].endswith(':' + k) for k in c.get('skip', [])): continue
                    k = PL(it['f']);
                    if k in seen: continue
                    seen.add(k); pick.append(f"<li>{k} → {PL(it['b'])}</li>")
                    if len(pick) == 4: break
                body += f'<div class="exam"><b>시험에서는</b><ul>{"".join(pick)}</ul></div>'
            lst.append({"id": f"u{u}c{n:02d}", "no": n, "title": c['title'], "freq": freq, "r": len(rs), "sids": c['sids'], "body": body})
        parts.append({"name": p['name'], "ch": lst})
    units[u] = {"parts": parts}
blob = json.dumps({"units": units}, ensure_ascii=False).replace('</', '<\\/')
block = f'<script id="sumdata" type="application/json">{blob}</script>\n'
H = re.sub(r'<script id="sumdata" type="application/json">.*?</script>\n', '', H, flags=re.S)
H = H.replace('<script id="data" type="application/json">', block + '<script id="data" type="application/json">', 1)

CSS = r'''
/* ===== 요약집 ===== */
nav.tabs .in { grid-template-columns: repeat(5, 1fr) }
.sumunit { border-top: 1px solid var(--line) } .sumunit:first-child { border-top: 0 }
.sumhead { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 2px 10px; align-items: center; width: 100%; padding: 14px 2px; border: 0; background: none; text-align: left; font: inherit; color: var(--ink); cursor: pointer }
.sumhead .t { font-weight: 800; font-size: 16px } .sumhead .s { grid-column: 1; font-size: 13px; color: var(--muted); font-weight: 600 }
.sumhead .ch { grid-row: 1 / span 2; grid-column: 3; width: 20px; height: 20px; stroke: var(--muted); fill: none; stroke-width: 2.4; transition: transform .15s }
.sumhead[aria-expanded="true"] .ch { transform: rotate(90deg) }
.sumhead .pg { grid-row: 1 / span 2; grid-column: 2; font-size: 12px; font-weight: 800; color: var(--muted) }
.sumlist { padding: 0 2px 14px; display: flex; flex-direction: column; gap: 4px }
.sumpart { font-size: 12px; font-weight: 800; color: var(--accent-dk); letter-spacing: .04em; margin: 10px 0 2px }
.sumch { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px 10px; border: 0; border-radius: 12px; background: var(--sunk); text-align: left; font: inherit; color: var(--ink); cursor: pointer }
.sumch .no { font-size: 12px; font-weight: 800; color: var(--muted) } .sumch .tt { word-break: keep-all; font-weight: 700; font-size: 14.5px; line-height: 1.4 }
.sumch.read .tt { color: var(--muted) } .sumch .rd { width: 16px; height: 16px; stroke: var(--accent); fill: none; stroke-width: 3 }
.sumsoon { font-size: 13px; color: var(--muted); padding: 2px 2px 14px }
.sumcrumb { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; font-size: 12.5px; font-weight: 700; color: var(--muted) }
.sumcrumb button { border: 0; background: none; padding: 0; font: inherit; color: var(--accent-dk); cursor: pointer }
.sumtitle { word-break: keep-all; font-size: 24px; font-weight: 900; margin: 4px 0 2px; text-wrap: balance; line-height: 1.35 }
.sumfreq { font-size: 12.5px; font-weight: 700; color: var(--muted) }
.sumbody { font-family: "Noto Serif KR", "AppleMyungjo", "Nanum Myeongjo", "Batang", serif; font-size: 16.5px; line-height: 1.9; display: flex; flex-direction: column; gap: 16px; word-break: keep-all }
.sumbody p { margin: 0 } .sumbody .lead { font-size: 17.5px }
.sumbody h3 { font-family: var(--f-display); font-size: 17px; font-weight: 900; margin: 8px 0 0 }
.sumbody .tbl { overflow-x: auto; background: var(--surface); border: 2px solid var(--line); border-radius: 14px }
.sumbody table { border-collapse: collapse; width: 100%; min-width: 320px; font-family: var(--f-body); font-size: 13.5px; line-height: 1.55 }
.sumbody th, .sumbody td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top }
.sumbody tr:last-child td { border-bottom: 0 } .sumbody th { background: var(--accent-soft); font-weight: 800 }
.sumbody .remember { border-left: 4px solid var(--accent); padding: 4px 0 4px 14px; font-family: var(--f-body); font-size: 15px; line-height: 1.7 }
.sumbody .remember b { display: block; font-size: 12px; color: var(--accent-dk); letter-spacing: .06em }
.sumbody .exam { background: var(--gold-soft); border-radius: 14px; padding: 12px 14px; font-family: var(--f-body); font-size: 14.5px; line-height: 1.7; display: flex; flex-direction: column; gap: 4px }
.sumbody .exam b { color: var(--gold-ink); font-size: 12px; letter-spacing: .06em } .sumbody .exam ul { margin: 0; padding-left: 18px }
.sumnav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px }
.sumnav .btn { font-size: 14px }
body.sumguard #app { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none }
#sumwm { position: fixed; inset: 0; pointer-events: none; z-index: 24; overflow: hidden; display: none }
body.sumguard #sumwm { display: block }
#sumwm div { position: absolute; inset: -50%; display: flex; flex-wrap: wrap; gap: 64px 72px; transform: rotate(-24deg); align-content: flex-start }
#sumwm span { font-size: 13px; font-weight: 700; color: var(--ink); opacity: .05; white-space: nowrap }
#sumshade { position: fixed; inset: 0; z-index: 60; display: none; place-items: center; text-align: center; padding: 24px; background: var(--bg); color: var(--muted); font-weight: 700 }
body.sumguard.sumaway #sumshade { display: grid }
@media print { body.sumguard #app, body.sumguard nav.tabs { display: none !important } }
'''
H = re.sub(r'\n/\* ===== 요약집 ===== \*/.*?(?=</style>)', '', H, flags=re.S)
H = H.replace('</style>', CSS + '</style>', 1)

JS = r'''
/* ================= 요약집 ================= */
const SUMD = JSON.parse(document.getElementById("sumdata").textContent);
const SUMCH = new Map(); const SUMSEQ = {};
Object.entries(SUMD.units).forEach(([u, x]) => { SUMSEQ[u] = []; x.parts.forEach((p) => p.ch.forEach((c) => { c.unit = Number(u); c.part = p.name; SUMCH.set(c.id, c); SUMSEQ[u].push(c.id); })); });
const SUMUI = { sess: 1, open: {} };
const sumRead = () => S.sumRead || (S.sumRead = {});
const sumUnitName = (u) => (D.units.find((x) => x.id === Number(u)) || {}).name || "";
V.sum = () => {
  const subs = EXAM_SESS[SUMUI.sess]; const rd = sumRead();
  const last = S.sumLast && SUMCH.get(S.sumLast);
  const unitRow = (u) => { const seq = SUMSEQ[u.id] || []; const open = !!SUMUI.open[u.id]; const done = seq.filter((id) => rd[id]).length;
    const body = !open ? "" : !seq.length ? `<div class="sumsoon">이 단원 요약은 작성 중이에요.</div>`
      : `<div class="sumlist">${SUMD.units[u.id].parts.map((p) => `<div class="sumpart">${esc(p.name)}</div>${p.ch.map((c) => `<button class="sumch${rd[c.id] ? " read" : ""}" data-act="sumOpen" data-id="${c.id}"><span class="no">${c.no}장</span><span class="tt">${esc(c.title)}</span>${rd[c.id] ? `<svg class="rd" viewBox="0 0 24 24" aria-label="읽음"><path d="M5 12.5l4.5 4.5L19 7"/></svg>` : c.r >= 4 ? `<span class="badge hot">4회</span>` : `<span class="badge">${c.r}회</span>`}</button>`).join("")}`).join("")}</div>`;
    return `<div class="sumunit"><button class="sumhead" data-act="sumUnit" data-id="${u.id}" aria-expanded="${open}"><span class="t">${esc(u.name)}</span><span class="s">${seq.length ? `${seq.length}장 · ${done}장 읽음` : "작성 중"}</span><span class="pg">${seq.length ? Math.round((done / seq.length) * 100) + "%" : ""}</span><svg class="ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>${body}</div>`; };
  return `${hud()}<div class="stack" style="gap:16px" data-testid="sumview">
    <div class="seg2" role="tablist" aria-label="교시"><button role="tab" data-act="sumSess" data-v="1" aria-pressed="${SUMUI.sess === 1}">1교시</button><button role="tab" data-act="sumSess" data-v="2" aria-pressed="${SUMUI.sess === 2}">2교시</button></div>
    ${last ? `<button class="card li" data-act="sumOpen" data-id="${last.id}" style="border-color:var(--accent-soft)"><span class="t">이어 읽기 · ${esc(last.title)}</span><span class="s">${esc(sumUnitName(last.unit))} · ${last.no}장</span><span class="r">›</span></button>` : ""}
    ${subs.map((sj) => `<div><h2 class="sec" style="margin:0 0 8px">${esc(subjName(sj))}</h2><section class="card" style="padding:0 16px">${D.units.filter((u) => u.subj === sj).map(unitRow).join("")}</section></div>`).join("")}
    <div class="tiny muted">기출 50~53회 출제 횟수를 장마다 표시했어요. 요약집은 회원 전용이며 복사·캡처를 막고 화면에 아이디가 표시돼요.</div>
  </div>`;
};
V.sumread = ({ id }) => {
  const c = SUMCH.get(id); if (!c) return V.sum();
  const seq = SUMSEQ[c.unit]; const i = seq.indexOf(id); const pv = SUMCH.get(seq[i - 1]); const nx = SUMCH.get(seq[i + 1]);
  const sess = Object.entries(EXAM_SESS).find(([, v]) => v.includes(D.units.find((u) => u.id === c.unit).subj))[0];
  return `<div class="stack" style="gap:18px" data-testid="sumread">
    <div><div class="sumcrumb"><button data-act="sumBack">요약집</button><span>›</span><span>${sess}교시</span><span>›</span><button data-act="sumBack" data-u="${c.unit}">${esc(sumUnitName(c.unit))}</button><span>›</span><span>${esc(c.part)}</span></div>
      <h1 class="sumtitle"><span class="muted" style="font-size:15px;display:block">${c.no}장</span>${esc(c.title)}</h1><div class="sumfreq">${esc(c.freq)}</div></div>
    <article class="sumbody">${c.body}</article>
    <button class="btn primary block" data-act="start" data-id="${c.sids[0]}">이 장 문제 풀기</button>
    <div class="sumnav">${pv ? `<button class="btn" data-act="sumOpen" data-id="${pv.id}">‹ ${pv.no}장</button>` : `<span></span>`}${nx ? `<button class="btn" data-act="sumOpen" data-id="${nx.id}">${nx.no}장 ›</button>` : `<button class="btn" data-act="sumBack" data-u="${c.unit}">목차로</button>`}</div>
  </div>`;
};
function sumGuard() {
  const on = route.name === "sumread"; document.body.classList.toggle("sumguard", on); if (!on) document.body.classList.remove("sumaway");
  let wm = document.getElementById("sumwm");
  if (on && !wm) { wm = document.createElement("div"); wm.id = "sumwm"; wm.setAttribute("aria-hidden", "true"); wm.innerHTML = "<div></div>"; document.body.appendChild(wm);
    const sh = document.createElement("div"); sh.id = "sumshade"; sh.innerHTML = "화면을 벗어나 요약집을 가렸어요.<br>눌러서 다시 보기"; sh.addEventListener("click", () => document.body.classList.remove("sumaway")); document.body.appendChild(sh); }
  if (on) { const who = (Cloud.profile && Cloud.profile.username) || "물치 레벨업"; const tag = `${who} · ${today()}`; const box = wm.firstChild; if (box.dataset.tag !== tag) { box.dataset.tag = tag; box.innerHTML = Array.from({ length: 140 }, () => `<span>${esc(tag)}</span>`).join(""); } }
}
["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach((ev) => document.addEventListener(ev, (e) => { if (document.body.classList.contains("sumguard")) e.preventDefault(); }));
document.addEventListener("visibilitychange", () => { if (document.hidden && document.body.classList.contains("sumguard")) document.body.classList.add("sumaway"); });
window.addEventListener("blur", () => { if (document.body.classList.contains("sumguard")) document.body.classList.add("sumaway"); });
'''
H = re.sub(r'\n/\* ================= 요약집 ================= \*/.*?(?=\nV\.exam = \(\) => \{)', '', H, flags=re.S)
H = H.replace('\nV.exam = () => {', JS + '\nV.exam = () => {', 1)

# 탭
old_tabs = 'const tabs = [["home", "학습", I.map], ["exam", "시험", I.paper], ["game", "게임", I.pad], ["stats", "성장", I.chart]];'
if old_tabs in H:
    H = H.replace(old_tabs, 'const tabs = [["home", "학습", I.map], ["sum", "요약집", I.book], ["exam", "시험", I.paper], ["game", "게임", I.pad], ["stats", "성장", I.chart]];')
    H = H.replace('(k === "exam" && route.name === "xres") ||', '(k === "exam" && route.name === "xres") || (k === "sum" && route.name === "sumread") ||', 1)
    H = H.replace('!["game", "stats", "rank", "admin", "admUser", "exam", "xres"].includes(route.name)', '!["game", "stats", "rank", "admin", "admUser", "exam", "xres", "sum", "sumread"].includes(route.name)', 1)
    H = H.replace('  if (live) startTick();\n}', '  sumGuard();\n  if (live) startTick();\n}', 1)
    H = H.replace('({ exam: "시험", game: "게임",', '({ sum: "요약집", exam: "시험", game: "게임",', 1)
# 동작
if 'sumOpen:' not in H:
    H = H.replace('  tab: (d) => { closeModal(); nav(d.k); },', '''  tab: (d) => { closeModal(); nav(d.k); },
  sumSess: (d) => { SUMUI.sess = Number(d.v); render(); },
  sumUnit: (d) => { SUMUI.open[d.id] = !SUMUI.open[d.id]; render(); },
  sumOpen: (d) => { const c = SUMCH.get(d.id); if (!c) return; sumRead()[c.id] = sumRead()[c.id] || Date.now(); S.sumLast = c.id; save(); nav("sumread", { id: c.id }); },
  sumBack: (d) => { if (d.u) { SUMUI.open[d.u] = true; SUMUI.sess = Number(Object.entries(EXAM_SESS).find(([, v]) => v.includes(D.units.find((u) => u.id === Number(d.u)).subj))[0]); } nav("sum"); },''', 1)
# 동기화 병합
if 'o.sumRead' not in H:
    H = H.replace('o.skills = Object.assign({}, R.skills, L.skills);', 'o.skills = Object.assign({}, R.skills, L.skills); o.sumRead = Object.assign({}, R.sumRead, L.sumRead);', 1)
open(F, 'w', encoding='utf-8').write(H)
print('ok', 'sumOpen:' in H, 'sumGuard();' in H, 'o.sumRead' in H, '"요약집", I.book' in H)
