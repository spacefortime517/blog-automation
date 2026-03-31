FROM node:22-slim

# Install Chromium dependencies + Xvfb + cron
RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    xvfb \
    xauth \
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
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Install Playwright Chromium
RUN npx playwright install chromium

# Copy source
COPY . .

# Create directories
RUN mkdir -p /app/logs /app/data

# Set timezone (default, overridable via TZ env)
ENV TZ=Europe/Berlin

ENTRYPOINT ["/app/entrypoint.sh"]
