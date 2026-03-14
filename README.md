# DeployGuard Dashboard

DeployGuard Dashboard는 DeployGuard 보안 분석 엔진의 결과를 시각화하기
위한 프론트엔드 애플리케이션이다.\
클러스터 위험도, 공격 경로(Attack Path), 런타임 이벤트, 자산 정보, 취약
이미지 정보 등을 한눈에 확인할 수 있도록 설계된 보안 분석 대시보드이다.

이 프로젝트는 DeployGuard Analysis API와 연동하여 동작한다.

------------------------------------------------------------------------

# 기술 스택

프론트엔드 - React 19 - TypeScript - Vite

데이터 통신 - Axios - React Query (@tanstack/react-query) - Orval
(OpenAPI → TypeScript API Client 자동 생성)

UI - Bootstrap 5

그래프 시각화 (예정) - Cytoscape.js

컨테이너 - Docker (multi-stage build) - Nginx (정적 파일 서빙)

------------------------------------------------------------------------

# 프로젝트 구조

    deployguard-dashboard
    │
    ├── src
    │   ├── api
    │   │   ├── client.ts
    │   │   ├── generated
    │   │   └── model
    │   │
    │   ├── components
    │   │   ├── common
    │   │   ├── graph
    │   │   └── layout
    │   │
    │   ├── graph
    │   │   ├── engine
    │   │   ├── filters
    │   │   └── path
    │   │
    │   ├── hooks
    │   ├── pages
    │   │   ├── overview
    │   │   ├── graph
    │   │   ├── recommendations
    │   │   ├── assets
    │   │   ├── runtime
    │   │   └── images
    │   │
    │   ├── router
    │   │   └── router.tsx
    │   │
    │   ├── types
    │   ├── utils
    │   │
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    │
    ├── public
    ├── Dockerfile
    ├── .dockerignore
    ├── orval.config.ts
    ├── package.json
    └── vite.config.ts

------------------------------------------------------------------------

# 주요 기능 영역

DeployGuard Dashboard는 다음 주요 영역으로 구성된다.

## Overview

클러스터 전체 위험도 요약과 주요 보안 지표를 보여준다.

예시:

-   Cluster Risk Score
-   Attack Path 개수
-   Critical Path 개수
-   Runtime Evidence
-   추천 remediation 효과

------------------------------------------------------------------------

## Attack Graph

DeployGuard의 핵심 기능으로, 인프라 내 공격 경로를 그래프로 시각화한다.

주요 기능 (예정):

-   그래프 렌더링
-   공격 경로 하이라이트
-   노드 위험도 히트맵
-   필터링
-   Runtime evidence overlay

------------------------------------------------------------------------

## Recommendations

보안 위험을 줄이기 위한 remediation 제안을 보여준다.

예시:

-   RoleBinding 제거
-   IAM 권한 축소
-   네트워크 정책 적용

각 remediation이 제거할 수 있는 attack path도 함께 표시된다.

------------------------------------------------------------------------

## Assets

클러스터 내 자산 목록을 보여준다.

예:

-   Pod
-   Node
-   IAM Role
-   Container Image

각 자산의 위험도와 연결 관계를 확인할 수 있다.

------------------------------------------------------------------------

## Runtime Events

런타임 보안 이벤트를 표시한다.

예:

-   Suspicious network activity
-   Privilege escalation
-   Unexpected process execution

이 이벤트들은 공격 경로 위험도에 영향을 줄 수 있다.

------------------------------------------------------------------------

## Images

컨테이너 이미지의 취약점을 표시한다.

예:

-   Critical CVE
-   High CVE
-   EPSS 점수
-   이미지 서명 여부

------------------------------------------------------------------------

# 로컬 개발

의존성 설치

    pnpm install

개발 서버 실행

    pnpm dev

브라우저 접속

    http://localhost:5173

------------------------------------------------------------------------

# 환경 변수

DeployGuard Analysis API와 통신하기 위해 다음 환경 변수를 사용한다.

    VITE_API_URL=http://localhost:8080

프로젝트 루트에 `.env` 파일을 생성하여 설정할 수 있다.

------------------------------------------------------------------------

# API Client 자동 생성

DeployGuard Dashboard는 Orval을 사용하여 OpenAPI 스펙으로부터 API
Client를 자동 생성한다.

OpenAPI 주소:

    https://analysis.deployguard.org/openapi.json

API Client 생성:

    pnpm orval

생성 위치

    src/api/generated

타입 정의

    src/api/model

------------------------------------------------------------------------

# Docker

대시보드는 multi-stage Docker build를 사용한다.

이미지 빌드

    docker build -t deployguard-dashboard .

컨테이너 실행

    docker run -d -p 80:80 deployguard-dashboard

Nginx를 통해 정적 파일을 서빙한다.

------------------------------------------------------------------------

# 개발 참고 사항

DeployGuard Dashboard에서 가장 복잡한 컴포넌트는 Attack Graph
시각화이다.

그래프 크기가 매우 커질 수 있기 때문에 다음 기능이 중요하다.

-   그래프 성능 최적화
-   Incremental graph loading
-   Path exploration
-   Risk heatmap

Cytoscape.js를 이용하여 구현할 예정이다.

------------------------------------------------------------------------

# 향후 개선 계획

-   대규모 그래프 성능 개선
-   Attack path 탐색 기능 강화
-   Remediation simulation
-   위험도 시각화 강화
-   Runtime 이벤트 통합

------------------------------------------------------------------------

# 라이선스
MIT
