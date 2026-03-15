// ============================================================
// src/api/client.ts
// Axios 인스턴스 설정 - 모든 API 호출의 기반
// ============================================================
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// 요청 인터셉터: API Key 자동 주입
apiClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('dg_api_key');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// 응답 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 만료 → 로그인 페이지로
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
