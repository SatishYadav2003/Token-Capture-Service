FROM node:20-slim

# Install xvfb + chromium system dependencies in one step
RUN apt-get update && \
    apt-get install -y \
    xvfb \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install
RUN npx playwright install chromium

COPY . .

EXPOSE 10000
ENV PORT=10000

# Use shell form so xvfb-run wraps the node process
CMD xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" node index.js
