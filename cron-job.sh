#!/bin/bash
# Cron job runner — loads environment and runs the appropriate command
set -e

# Load environment variables
set -a
source /etc/environment
set +a

cd /app
LOG="/app/logs/blog-$(date +%Y%m%d).log"

case "$1" in
  publish)
    echo "=== Blog publish started at $(date) ===" >> "$LOG"
    node src/index.js >> "$LOG" 2>&1
    echo "=== Blog publish finished at $(date) ===" >> "$LOG"
    ;;
  linkedin)
    echo "=== LinkedIn post at $(date) ===" >> "$LOG"
    node src/post-social.js linkedin >> "$LOG" 2>&1
    ;;
  x)
    echo "=== X/Twitter post at $(date) ===" >> "$LOG"
    xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" node src/post-social.js x >> "$LOG" 2>&1
    ;;
  facebook)
    echo "=== Facebook post at $(date) ===" >> "$LOG"
    node src/post-social.js facebook >> "$LOG" 2>&1
    ;;
  *)
    echo "Usage: $0 {publish|linkedin|x|facebook}"
    exit 1
    ;;
esac
