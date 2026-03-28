FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Install xvfb for virtual display (browser needs headed mode for captcha)
RUN apt-get update && \
    apt-get install -y xvfb && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install
RUN npx playwright install chromium

COPY . .

EXPOSE 10000

ENV PORT=10000

# xvfb-run creates a virtual display so headed browser works without a real screen
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1920x1080x24", "node", "index.js"]
