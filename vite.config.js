# 나의 성장 기록 앱 — 배포 가이드

## 📁 폴더 구조
```
pwa-app/
├── src/
│   ├── App.jsx        ← 앱 전체 코드
│   └── main.jsx       ← 진입점
├── public/            ← 아이콘 파일 넣는 곳
├── index.html
├── vite.config.js
├── package.json
└── vercel.json
```

---

## 🚀 배포 순서 (Vercel, 무료)

### 1단계 — GitHub에 올리기
1. [github.com](https://github.com) 에서 계정 만들기 (없으면)
2. 새 Repository 만들기 (이름 예: `selfgrowth-app`)
3. 이 폴더 전체를 업로드

   ```bash
   # 터미널에서
   cd pwa-app
   git init
   git add .
   git commit -m "첫 배포"
   git remote add origin https://github.com/아이디/selfgrowth-app.git
   git push -u origin main
   ```

### 2단계 — Vercel 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub 계정으로 로그인
2. "Add New Project" 클릭
3. 방금 만든 Repository 선택
4. 설정 그대로 두고 "Deploy" 클릭
5. 완료! 링크 생성됨 (예: `https://selfgrowth-app.vercel.app`)

### 3단계 — 폰에 설치
**아이폰:**
1. 사파리로 링크 열기
2. 하단 공유 버튼(□↑) 탭
3. "홈 화면에 추가" 탭
4. "추가" 탭 → 완료!

**안드로이드:**
1. 크롬으로 링크 열기
2. 주소창 오른쪽 ⋮ 메뉴
3. "앱 설치" 또는 "홈 화면에 추가"

---

## 🎨 아이콘 파일 준비 (선택)

`public/` 폴더에 아래 파일들 넣으면 앱 아이콘이 예쁘게 보여요:
- `icon-192.png` (192×192px)
- `icon-512.png` (512×512px)
- `apple-touch-icon.png` (180×180px)
- `favicon.ico`

없어도 배포는 되지만 아이콘이 기본 이미지로 보여요.

---

## 🔄 수정 후 업데이트 방법

코드 수정 → GitHub에 push → Vercel이 자동으로 재배포
(약 1~2분 소요, 사용자들에게 자동 업데이트)

---

## 💡 팁
- Vercel 무료 플랜으로 충분히 운영 가능
- 커스텀 도메인도 Vercel에서 무료로 연결 가능
- 데이터는 각 사용자 폰의 localStorage에 저장됨
