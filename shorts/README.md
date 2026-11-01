# 쇼츠 「국시 S급 O/X」 제작 도구

두 가지 형식이 있다.
- `quiz4.html` 4문제형(41초): Q1~Q3은 5초 타이머 뒤 정답·해설 공개, 마지막 문제는 "정답은 댓글에서". 공개되는 문제에 O 정답을 하나 섞어 마지막 문제를 짐작하지 못하게 한다.
- `template.html` 1문제형(15초): 아래 설명.

4문제형 만들기: `quiz4.html`의 `SETS`에 세트를 추가하고
```bash
node render.cjs "$PWD/quiz4.html" set=B "$PWD/framesB" frames   # cues.json도 함께 남긴다
python3 sfx.py framesB/cues.json sfxB.wav
ffmpeg -framerate 30 -i framesB/%04d.png -i sfxB.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart shortsB.mp4
```

15초 세로 영상(1080×1920, 30fps). 문제 0~2초 → 7초 카운트다운 → 댓글 유도(9~12초) → 앱 마무리(12~15초).
정답은 영상에 나오지 않고 고정 댓글로 공개한다.

## 새 편 추가
`template.html`의 `EP`에 한 줄 추가: `"04": { ep: "#04", badge: "…", subj: "과목 · 개념", q: "줄<br>바꿈<br>문제." }`
(문제·배지 내용은 앱 데이터의 S급 개념 O/X 문항과 `ana.rounds`에서 가져온다.)

## 만들기
```bash
cd shorts
npm pack @fontsource/jua@5.3.0 @fontsource/noto-sans-kr@5.3.1
for f in fontsource-*.tgz; do tar xzf $f && mv package pkg-${f%%-5*}; done
python3 sfx.py
node render.cjs "$PWD/template.html" ep=04 "$PWD/frames04" stills   # 장면 확인용 정지 화면 6장
node render.cjs "$PWD/template.html" ep=04 "$PWD/frames04" frames   # 450프레임
ffmpeg -framerate 30 -i frames04/%04d.png -i sfx.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart shorts04.mp4
```
Playwright와 Chromium, ffmpeg(libx264)가 필요하다.
