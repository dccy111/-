# 효과음을 만든다.
#   python3 sfx.py                → 1문제형(15초): 2~8초 째깍, 9초 '띵'
#   python3 sfx.py cues.json out.wav → 4문제형: render.cjs가 남긴 cues.json의 째깍·공개 시점대로
import json, sys, wave
import numpy as np
sr = 44100
def make(length):
    return np.zeros(int(sr * length))
def tone(a, t0, freqs, dur, amp, decay):
    n = int(sr * dur); tt = np.arange(n) / sr
    s = sum(np.sin(2 * np.pi * f * tt) for f in freqs) / len(freqs)
    i = int(sr * t0); a[i:i + n] += (amp * s * np.exp(-tt * decay) * np.minimum(1, tt / 0.002))[: len(a) - i]
def tick(a, t, urgent):
    tone(a, t, [2000 if urgent else 1400], 0.06, 0.55 if urgent else 0.4, 90)
    tone(a, t + 0.004, [900], 0.03, 0.2, 140)
if len(sys.argv) > 1:
    c = json.load(open(sys.argv[1])); out = sys.argv[2] if len(sys.argv) > 2 else "sfx.wav"
    a = make(c["len"])
    for k in c["ticks"]: tick(a, k["t"], k["urgent"])
    for r in c["reveal"]:
        if r["last"]: tone(a, r["t"], [880, 1320, 1760], 1.2, 0.6, 3.5)       # 마지막: '띵'
        else: tone(a, r["t"], [1046], 0.25, 0.5, 9); tone(a, r["t"] + 0.12, [1568], 0.5, 0.5, 6)  # 공개: 올라가는 두 음
else:
    out = "sfx.wav"; a = make(15.0)
    for t in range(2, 9): tick(a, t, t >= 6)
    tone(a, 9.0, [880, 1320, 1760], 1.2, 0.6, 3.5)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(a, -1, 1) * 32767 * 0.9).astype("<i2").tobytes())
print("wrote", out)
