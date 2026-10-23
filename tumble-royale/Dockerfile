# Tumble Royale — Node game server + built client on one port.
#   docker build -t tumble-royale . && docker run -p 8080:8080 -v tumble-data:/data tumble-royale
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data CLIENT_DIR=/app/dist/client
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "dist/server/node-main.js"]
