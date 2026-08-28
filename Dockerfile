# StudyFlow — one container serving the website (static build) and the API
# (accounts, data sync, AI proxy, Google OAuth callback).
#
# The backend is zero-dependency (Node built-ins only), so the runtime image
# contains no node_modules at all.

# ---- Stage 1: build the website ----
FROM node:24-alpine AS build
WORKDIR /app
COPY website/package.json website/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY website/ ./
# Production settings: no sample-data button, same-origin API (empty apiBase).
ENV VITE_DEVELOPMENT_MODE=false
RUN npm run build

# ---- Stage 2: runtime (backend + static site) ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Backend source (runs directly — Node 24 strips TypeScript, zero deps).
COPY backend/src ./backend/src
# Built website from stage 1.
COPY --from=build /app/dist ./website/dist
# Writable data dir (SQLite + auth secret). Mount a volume/disk here.
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1

# Secrets (AI_API_KEY, AUTH_SECRET) come from the platform environment —
# never bake them into the image.
CMD ["node", "backend/src/index.ts"]
