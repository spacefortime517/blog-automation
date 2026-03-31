#!/bin/bash
# ============================================================
# PICKUP2 Blog Automation — VPS Setup Script
# Tested on: Ubuntu 24.04 LTS (Hetzner CX22)
# ============================================================
#
# Usage:
#   1. Create Hetzner CX22 (Ubuntu 24.04, Nuremberg/Falkenstein)
#   2. SSH in: ssh root@<your-ip>
#   3. Upload this project: scp -r BlogAutomation root@<ip>:/opt/blog-automation
#   4. Run: bash /opt/blog-automation/setup-vps.sh
#   5. Edit .env: nano /opt/blog-automation/.env
#   6. Activate cron: crontab /opt/blog-automation/cron-schedule.crontab
#
# ============================================================

set -euo pipefail

APP_DIR="/opt/blog-automation"
APP_USER="blogbot"
NODE_VERSION="22"

echo "=== PICKUP2 Blog Automation VPS Setup ==="
echo ""

# ---- 1. System updates ----
echo "[1/7] Updating system packages..."
apt update && apt upgrade -y

# ---- 2. Install system dependencies ----
echo "[2/7] Installing system dependencies..."
apt install -y \
  curl \
  git \
  xvfb \
  fonts-liberation \
  libasound2t64 \
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
  libvulkan1

# ---- 3. Install Node.js ----
echo "[3/7] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
fi
echo "Node.js $(node --version) installed"

# ---- 4. Create app user ----
echo "[4/7] Creating application user '${APP_USER}'..."
if ! id "$APP_USER" &> /dev/null; then
  useradd -r -m -s /bin/bash "$APP_USER"
  echo "User '${APP_USER}' created"
else
  echo "User '${APP_USER}' already exists"
fi

# ---- 5. Set up application ----
echo "[5/7] Setting up application..."
if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: $APP_DIR not found. Upload the project first:"
  echo "  scp -r BlogAutomation root@<your-ip>:${APP_DIR}"
  exit 1
fi

cd "$APP_DIR"
npm install --production
npx playwright install chromium

# Create required directories
mkdir -p "$APP_DIR/logs" "$APP_DIR/data"

# ---- 6. Set permissions ----
echo "[6/7] Setting file permissions..."
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod +x "$APP_DIR/cron-schedule.sh"

# ---- 7. Set timezone ----
echo "[7/7] Setting timezone to CET (Europe/Berlin)..."
timedatectl set-timezone Europe/Berlin

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Create your .env file:"
echo "     cp ${APP_DIR}/.env.example ${APP_DIR}/.env"
echo "     nano ${APP_DIR}/.env"
echo ""
echo "  2. Test the pipeline (dry run):"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && node src/index.js --dry-run'"
echo ""
echo "  3. Test social posting separately:"
echo "     sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && xvfb-run node src/post-social.js linkedin'"
echo ""
echo "  4. Install the cron schedule:"
echo "     crontab -u ${APP_USER} ${APP_DIR}/cron-schedule.crontab"
echo ""
echo "  5. Verify cron is installed:"
echo "     crontab -u ${APP_USER} -l"
echo ""
echo "  6. Monitor logs:"
echo "     tail -f ${APP_DIR}/logs/blog-\$(date +%Y%m%d).log"
echo ""
