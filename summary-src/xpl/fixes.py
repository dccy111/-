# 문항 보기 수정(복수정답 소지 제거 등). python3 xpl/fixes.py  — 이미 적용된 건 건너뜀
import json, re
F = '/home/user/-/mulchi-web/index.html'
FIX = {
  # id: (old_ch, new_ch, 이유)
  "c312:xp51_1_26": (["어깨올림근","위등세모근","앞톱니근","작은가슴근"], ["어깨올림근","위등세모근","앞톱니근","어깨세모근"], "작은가슴근도 어깨뼈 내림근이라 복수정답 소지"),
}
s = open(F, encoding='utf-8').read()
for iid, (old, new, why) in FIX.items():
    a = f'"id":"{iid}",'; i = s.find(a); assert i > 0, iid
    seg_end = s.find('}', s.find('"ch":', i)); seg = s[i:seg_end]
    o = '"ch":' + json.dumps(old, ensure_ascii=False, separators=(',', ':')); n = '"ch":' + json.dumps(new, ensure_ascii=False, separators=(',', ':'))
    if n in seg: print('skip', iid); continue
    assert o in seg, (iid, seg[:200]); s = s[:i] + seg.replace(o, n) + s[seg_end:]; print('fixed', iid, '-', why)
open(F, 'w', encoding='utf-8').write(s)
