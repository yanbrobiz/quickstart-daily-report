FROM node:18-slim

# 安裝 Chromium 依賴
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 設定 Puppeteer 使用系統 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 複製專案檔案
COPY package*.json ./
RUN npm install --production

COPY . .

# 執行腳本
CMD ["node", "src/index.js"]
