# 해설 데이터 주입: python3 xpl/build.py  (src/u*.py 의 X 사전을 모아 index.html의 <script id="xpl">로 넣는다)
import json, re, glob, importlib.util, sys
F = '/home/user/-/mulchi-web/index.html'
H = open(F, encoding='utf-8').read()
D = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', H, re.S).group(1))
IT = {i['id']: i for s in D['skills'] for i in s['items']}
X = {}; problems = []
for f in sorted(glob.glob('/tmp/claude-0/-home-user--/269b721c-6cdc-5e55-985f-82e3e9864e85/scratchpad/xpl/src/u*.py')):
    sp = importlib.util.spec_from_file_location('m', f); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    for k, v in m.X.items():
        it = IT.get(k)
        if not it: problems.append(f'{f}: no item {k}'); continue
        bad = [o for o in v.get('o', {}) if o not in it.get('ch', [])]
        miss = [o for o in it.get('ch', []) if o not in v.get('o', {})]
        if bad or miss: problems.append(f'{k}: option mismatch bad={bad} miss={miss}')
        for req in ('p', 't', 'g', 'c', 's', 'w', 'o', 'k', 'm', 'st', 'sw'):
            if req not in v: problems.append(f'{k}: missing {req}')
        X[k] = v
# OX 수작업 해설(src/o*.py 의 O 사전): id -> (c, w, fix, m, st[, er])
OX = {}
for f in sorted(glob.glob('/tmp/claude-0/-home-user--/269b721c-6cdc-5e55-985f-82e3e9864e85/scratchpad/xpl/src/o*.py')):
    sp = importlib.util.spec_from_file_location('m', f); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    for k, v in m.O.items():
        it = IT.get(k)
        if not it or it.get('k') != 'ox': problems.append(f'{f}: bad ox {k}'); continue
        c, w, fix, mm, st = v[:5]; d = dict(ox=1, c=c if isinstance(c, list) else [c], w=w, fix=fix, m=mm, st=st)
        if len(v) > 5 and v[5]: d['er'] = v[5]
        OX[k] = d
# 맞는 문장(xt) 자동 연결: 같은 기출(회차·교시·번호)의 선택형 해설 재사용
bykey = {}
for k in X:
    s0 = IT[k]['src']; bykey.setdefault((s0['r'], s0['s'], s0['n']), k)
for s in D['skills']:
    for it in s['items']:
        if it.get('k') != 'ox' or not it.get('src') or it['id'] in OX: continue
        if ':xt' not in it['id']: continue
        ref = bykey.get((it['src']['r'], it['src']['s'], it['src']['n']))
        if not ref: continue
        p = X[ref]; d0 = next(iter(p['o'].items()))
        OX[it['id']] = dict(ox=1, ref=ref, c=p['c'], w=p['w'], fix=f"'{d0[0]}'(으)로 바꾸면 틀려요. {d0[1][0]}", m=p['m'], st=p['st'])
# 수작업 OX에도 같은 기출의 선택형 해설을 연결(표·핵심 포인트 재사용, 오류 의심 표시 상속)
for k, d in OX.items():
    if d.get('ref') or not IT[k].get('src'): continue
    s0 = IT[k]['src']; ref = bykey.get((s0['r'], s0['s'], s0['n']))
    if not ref: continue
    d['ref'] = ref
    if not d.get('er') and X[ref].get('er'): d['er'] = X[ref]['er']
X.update(OX)
if problems: print('\n'.join(problems)); sys.exit(1)
blob = json.dumps(X, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
H = re.sub(r'<script id="xpl" type="application/json">.*?</script>\n', '', H, flags=re.S)
H = H.replace('<script id="data" type="application/json">', f'<script id="xpl" type="application/json">{blob}</script>\n<script id="data" type="application/json">', 1)
open(F, 'w', encoding='utf-8').write(H)
print('xpl items', len(X), 'ox', len(OX), 'bytes', len(blob))
