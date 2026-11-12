import sys
F = '/home/user/-/mulchi-web/index.html'
s = open(F, encoding='utf-8').read()
if 'function xplHtml' in s: sys.exit('already')
def rep(a, b):
    global s
    assert a in s, a[:70]; s = s.replace(a, b, 1)
rep('const examPct = (r) => pct(r.ok, r.n);', '''const examPct = (r) => pct(r.ok, r.n);
/* 구조화 해설(출제 의도·단서·오답 분석): <script id="xpl"> */
const XPL = (() => { try { const el = document.getElementById("xpl"); return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; } })();
const hasXpl = (id) => !!XPL[id];
function xplHtml(it, mine, shown) {
  const x = XPL[it.id]; if (!x) return ""; const sk = SK.get(it.sid) || {}; const u = UNIT.get(sk.unit);
  const li = (a) => (a || []).map((t) => `<li>${inl(String(t))}</li>`).join("");
  const opts = Object.keys(x.o || {}).filter((o) => !shown || shown.includes(o));
  const mineX = mine != null && mine !== it.a && x.o && x.o[mine] ? x.o[mine] : null;
  const tb = x.tb && x.tb.length > 1 ? `<div class="xpltb"><table><tr>${x.tb[0].map((h) => `<th>${inl(String(h))}</th>`).join("")}</tr>${x.tb.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inl(String(c))}</td>`).join("")}</tr>`).join("")}</table></div>` : "";
  return `<div class="xpl" data-testid="xpl">
    <div class="xk">핵심 단서</div><ul>${li(x.c)}</ul>
    <div class="xk">왜 정답인가</div><p>${inl(String(x.w))}</p>
    ${mineX ? `<div class="xmine"><b>내가 고른 '${inl(String(mine))}'</b>${inl(String(mineX[0]))}${mineX[1] ? `<span>맞는 상황: ${inl(String(mineX[1]))}</span>` : ""}</div>` : ""}
    <div class="xone"><b>한 줄 기억법</b>${inl(String(x.m))}</div>
    <details class="xmore"><summary>자세히 보기 · 오답 분석과 시험 전략</summary>
      <div class="xk">문제 위치</div><p class="small">${esc(subjName(sk.subj))} → ${esc(u ? u.name : "")} → ${esc(sk.name || "")} → ${inl(String(x.p))}<br>유형: ${esc(x.t)}</p>
      <div class="xk">이 문제에서 평가하는 것</div><p>${inl(String(x.g))}</p>
      <div class="xk">문제를 푸는 사고 과정</div><ol>${li(x.s)}</ol>
      <div class="xk">다른 선택지는 왜 틀렸나</div>${opts.map((o) => { const r = x.o[o]; return `<div class="xopt"><b>${inl(String(o))}</b><p>${inl(String(r[0]))}</p>${r[1] ? `<p><span class="lb">맞는 상황</span>${inl(String(r[1]))}</p>` : ""}${r[2] ? `<p><span class="lb">헷갈리는 이유</span>${inl(String(r[2]))}</p>` : ""}</div>`; }).join("")}
      ${x.tr ? `<div class="xk">문제풀이 주의점</div><p>${inl(String(x.tr))}</p>` : ""}
      ${tb ? `<div class="xk">헷갈리는 개념 비교</div>${tb}` : ""}
      <div class="xk">국가고시 핵심 포인트</div><ul>${li(x.k)}</ul>
      ${x.am || x.un ? `<div class="xk">암기 vs 이해</div>${x.am ? `<p><span class="lb">암기</span>${inl(String(x.am))}</p>` : ""}${x.un ? `<p><span class="lb">이해</span>${inl(String(x.un))}</p>` : ""}` : ""}
      ${x.v && x.v.length ? `<div class="xk">이렇게 변형되어 나올 수 있다</div><ul>${li(x.v)}</ul>` : ""}
      <div class="xk">학습 중요도</div><p><span class="xstar">${"★".repeat(x.st)}${"☆".repeat(5 - x.st)}</span> ${inl(String(x.sw))}</p>
      ${x.er ? `<div class="xerr"><b>문제 검토 필요</b>${inl(String(x.er))}</div>` : ""}
    </details></div>`;
}''')
# 해설 모드 피드백
rep('''<b>${okA ? "정답이에요" : `오답이에요 · 정답 ${ansT}`}</b>${it.e ? `<div class="xe">${inl(String(it.e))}</div>` : ""}</div>''',
    '''<b>${okA ? "정답이에요" : `오답이에요 · 정답 ${ansT}`}</b>${hasXpl(it.id) ? "" : it.e ? `<div class="xe">${inl(String(it.e))}</div>` : ""}</div>${xplHtml(it, a, e.o)}''')
# 시험 결과 틀린 문제
rep('''${w.it.e ? `<div class="small muted">${inl(String(w.it.e))}</div>` : ""}<div>${wrongBtn(w.e, "last", w.i)}</div></div>`).join("")''',
    '''${hasXpl(w.it.id) ? xplHtml(w.it, w.a, w.e.o) : w.it.e ? `<div class="small muted">${inl(String(w.it.e))}</div>` : ""}<div>${wrongBtn(w.e, "last", w.i)}</div></div>`).join("")''')
# 오답노트
rep('''${it.e ? `<div class="small muted">${inl(String(it.e))}</div>` : ""}<div><button class="chip" data-act="wDel"''',
    '''${hasXpl(it.id) ? xplHtml(it, null, w.o) : it.e ? `<div class="small muted">${inl(String(it.e))}</div>` : ""}<div><button class="chip" data-act="wDel"''')
rep('.xwbtn { font-size: 13px;', '''.xpl { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding: 12px 14px; border-radius: 14px; background: var(--sunk); font-size: 14.5px; line-height: 1.65; word-break: keep-all }
.xpl p { margin: 0 } .xpl ul, .xpl ol { margin: 0; padding-left: 20px } .xpl li { margin: 2px 0 }
.xpl .xk { font-size: 12px; font-weight: 900; letter-spacing: .04em; color: var(--accent-dk); margin-top: 6px }
.xpl .xmine { padding: 8px 10px; border-radius: 10px; background: var(--bad-soft); display: flex; flex-direction: column; gap: 2px } .xpl .xmine b { color: var(--bad-dk) } .xpl .xmine span { color: var(--muted); font-size: 13.5px }
.xpl .xone { padding: 8px 10px; border-left: 4px solid var(--accent); background: var(--surface); border-radius: 0 10px 10px 0; font-weight: 700 } .xpl .xone b { display: block; font-size: 11.5px; color: var(--accent-dk) }
.xpl .xmore summary { cursor: pointer; font-weight: 800; color: var(--accent-dk); padding: 6px 0; list-style-position: inside }
.xpl .xmore[open] { display: flex; flex-direction: column; gap: 6px }
.xpl .xopt { padding: 8px 10px; border-radius: 10px; background: var(--surface); display: flex; flex-direction: column; gap: 3px }
.xpl .lb { display: inline-block; font-size: 11.5px; font-weight: 900; color: var(--muted); margin-right: 6px }
.xpl .xpltb { overflow-x: auto } .xpl table { border-collapse: collapse; width: 100%; font-size: 13px; background: var(--surface) } .xpl th, .xpl td { border: 1px solid var(--line); padding: 5px 7px; text-align: left; vertical-align: top } .xpl th { background: var(--accent-soft) }
.xpl .xstar { color: var(--gold-dk); letter-spacing: 1px }
.xpl .xerr { padding: 8px 10px; border-radius: 10px; background: var(--gold-soft); display: flex; flex-direction: column; gap: 2px } .xpl .xerr b { color: var(--gold-ink) }
.xwbtn { font-size: 13px;''')
open(F, 'w', encoding='utf-8').write(s); print('render patched')
