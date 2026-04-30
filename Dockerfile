# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
COPY shared/ ./shared/
RUN npm install
COPY frontend/ ./frontend/
RUN npm run build --workspace frontend

# Stage 2: Final Image
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
COPY shared/ ./shared/
RUN npm install --omit=dev
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# The backend needs to serve the static files. 
# We'll add a small middleware in a wrapper if needed, 
# but let's assume we can modify app.js or use a simple serve script.

EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production
CMD ["node", "backend/src/index.js"]
