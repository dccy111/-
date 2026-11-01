# 째깍(2~8초, 마지막 3번은 높게)과 9초 '띵'을 만든다: python3 sfx.py → sfx.wav
import numpy as np, wave
sr = 44100; a = np.zeros(int(sr * 15.0))
def tone(t0, freqs, dur, amp, decay):
    n = int(sr * dur); tt = np.arange(n) / sr
    s = sum(np.sin(2 * np.pi * f * tt) for f in freqs) / len(freqs)
    i = int(sr * t0); a[i:i + n] += amp * s * np.exp(-tt * decay) * np.minimum(1, tt / 0.002)
for t in range(2, 9):
    urgent = t >= 6
    tone(t, [2000 if urgent else 1400], 0.06, 0.55 if urgent else 0.4, 90)
    tone(t + 0.004, [900], 0.03, 0.2, 140)
tone(9.0, [880, 1320, 1760], 1.2, 0.6, 3.5)
with wave.open("sfx.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(a, -1, 1) * 32767 * 0.9).astype("<i2").tobytes())
