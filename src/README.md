# DeployGuard Dashboard — 프론트엔드 스타터

## 🚀 5분 안에 UI 띄우기 (백엔드 없이)

```bash
# 1. 압축 풀기
unzip deployguard-dashboard.zip
cd deployguard-dashboard

# 2. 의존성 설치
npm install

# 3. .env 확인 (기본값: VITE_USE_MOCK=true)
cat .env

# 4. 실행
npm run dev
# → http://localhost:3000
```

> `.env`의 `VITE_USE_MOCK=true`가 설정되어 있으면
> 백엔드 없이 실제 데이터처럼 보이는 mock 데이터로 동작합니다.

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VITE_API_BASE_URL` | 백엔드 API 주소 | `http://localhost:8000/api/v1` |
| `VITE_USE_MOCK` | mock 모드 여부 | `true` |

## 파일 구조

```
src/
├── api/
│   ├── client.ts      ← Axios 인스턴스
│   ├── hooks.ts       ← React Query 훅 (mock 스위치 내장)
│   └── mock.ts        ← 더미 데이터 (실제 공격 시나리오 재현)
├── components/graph/
│   └── AttackGraph.tsx  ← Cytoscape.js 그래프
├── pages/
│   ├── OverviewPage.tsx        ← 보안 현황 + 차트
│   ├── AttackGraphPage.tsx     ← 공격 경로 시각화
│   ├── RecommendationsPage.tsx ← Set Cover 권고사항
│   └── EvidencePage.tsx        ← eBPF/CloudTrail 증거
├── store/index.ts     ← Zustand 전역 상태
└── types/index.ts     ← 모든 타입 정의
```

## mock 데이터 시나리오

아래 실제 공격 경로가 mock에 구현되어 있습니다:

```
[CRITICAL] api-server-7c4b2 → api-sa → api-role → prod-secrets-bucket
           eBPF 증거 3건 포함 (IMDS 접근 → SA 토큰 탈취 → S3 다운로드)

[CRITICAL] api-server-7c4b2 → api-sa → secret-reader → db-credentials
           CloudTrail 증거 1건 포함

[CRITICAL] log-collector-priv → node → api-server → api-sa → S3
           컨테이너 탈출(escapes_to) 경로

[HIGH]     frontend-6d8f9 → default SA → db-credentials
```

## 다음 구현 순서

1. `shadcn/ui` 추가 → `npx shadcn@latest init`
2. Blast Radius 슬라이드 패널 (노드 클릭 시)
3. Least Privilege 페이지 (권한 과도 사용 현황)
4. WebSocket 실시간 알림
5. `VITE_USE_MOCK=false`로 전환 후 실제 백엔드 연결
