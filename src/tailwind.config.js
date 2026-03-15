/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── 디자인 시스템 색상 (이미지 기준) ──
        bg: {
          base:  '#0d0d0d',   // 최하단 배경
          panel: '#111111',   // 사이드바
          card:  '#181818',   // 카드
          input: '#1f1f1f',   // 인풋, hover
          muted: '#252525',   // 구분선 근처
        },
        border: {
          DEFAULT: '#2a2a2a',
          subtle:  '#222222',
          strong:  '#3a3a3a',
        },
        txt: {
          primary:   '#f0f0f0',
          secondary: '#888888',
          muted:     '#555555',
          dim:       '#3a3a3a',
        },
        status: {
          active:     '#4ade80',   // 초록
          elevated:   '#fbbf24',   // 노랑
          critical:   '#f87171',   // 빨강
          resolved:   '#555555',   // 회색
          quarantine: '#fb923c',   // 주황
        },
      },
      fontFamily: {
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Barlow', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        widest2: '0.2em',
        widest3: '0.3em',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};
