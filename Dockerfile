# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# dependency install
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# source copy
COPY . .

# vite build
RUN pnpm build


# ---------- Runtime Stage ----------
FROM nginx:1.27-alpine

# nginx 기본 static 경로
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# 포트
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]
