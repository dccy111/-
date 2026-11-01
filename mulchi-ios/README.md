# 물치 레벨업 iOS 앱 (Capacitor)

`www/`의 웹앱(mulchi-web)을 Capacitor 8로 감싼 iOS 프로젝트입니다.

- 번들 ID: `kr.mulchilevelup.app`
- 앱 이름: 물치 레벨업
- iPhone 전용, 세로 고정, iOS 15 이상
- 플러그인: `@capacitor/app`(로그인 복귀 URL 처리), `@capacitor/browser`(인앱 로그인 창)
- URL 스킴 `kr.mulchilevelup.app://` 등록됨 (Supabase 로그인 복귀용)

## Mac에서 빌드

준비물: Xcode 16 이상, Node 22 이상, Apple Developer Program 계정

```bash
cd mulchi-ios
npm install          # Swift 패키지가 node_modules 안의 플러그인을 참조하므로 반드시 먼저
npm run sync         # www/ → ios/App/App/public 복사 + 플러그인 반영
npm run open         # Xcode 열기
```

Xcode에서:

1. `App` 타깃 → Signing & Capabilities → Team 선택
2. 시뮬레이터나 실기기로 실행해 확인
3. 기기를 `Any iOS Device (arm64)`로 두고 Product → Archive → Distribute App → App Store Connect

## 웹앱을 고쳤을 때

`www/`를 새 버전으로 바꾼 뒤 `npm run sync`. 올릴 때마다 Xcode에서 Build 번호(`CURRENT_PROJECT_VERSION`)를 1씩 올립니다.

## 출시 전 확인

- Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs에 `kr.mulchilevelup.app://auth-callback` 추가 (이메일 로그인 링크가 앱으로 돌아오게)
- App Store Connect: 개인정보처리방침 URL(`privacy.html`을 올린 주소), 6.9/6.5인치 스크린샷, 연령 등급, 앱 개인정보(계정·학습 기록 수집 여부)
- 앱 안 계정 삭제(가이드라인 5.1.1(v)): 이미 있음 — 성장 탭 › 계정 › 계정 삭제
- 심사 노트에 테스트용 아이디/비밀번호 기재
- 수출 규정 질문은 `ITSAppUsesNonExemptEncryption = NO`로 미리 답해 둠
