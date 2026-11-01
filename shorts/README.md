# 쇼츠 「국시 S급 O/X」 제작 도구

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
node render.cjs "$PWD/template.html" 04 "$PWD/frames04" stills   # 장면 확인용 정지 화면 6장
node render.cjs "$PWD/template.html" 04 "$PWD/frames04" frames   # 450프레임
ffmpeg -framerate 30 -i frames04/%04d.png -i sfx.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart shorts04.mp4
```
Playwright와 Chromium, ffmpeg(libx264)가 필요하다.
