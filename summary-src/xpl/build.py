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
if problems: print('\n'.join(problems)); sys.exit(1)
blob = json.dumps(X, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
H = re.sub(r'<script id="xpl" type="application/json">.*?</script>\n', '', H, flags=re.S)
H = H.replace('<script id="data" type="application/json">', f'<script id="xpl" type="application/json">{blob}</script>\n<script id="data" type="application/json">', 1)
open(F, 'w', encoding='utf-8').write(H)
print('xpl items', len(X), 'bytes', len(blob))
