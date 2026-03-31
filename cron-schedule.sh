#!/bin/bash
# Blog Automation Cron Schedule (CET — Europe/Berlin)
#
# Schedule: Tuesday & Thursday
#   09:00 - Publish blog (discover topic, generate, translate, publish)
#   10:00 - Post to LinkedIn
#   12:00 - Post to X/Twitter (uses xvfb for virtual display)
#   15:00 - Post to Facebook
#   17:00 - Post to Instagram
#
# Install: crontab cron-schedule.crontab
# Check:   crontab -l
# Remove:  crontab -r

DIR="/opt/blog-automation"
NODE="$(which node)"
LOG="$DIR/logs/blog-$(date +%Y%m%d).log"

mkdir -p "$DIR/logs"

case "$1" in
  publish)
    echo "=== Blog publish started at $(date) ===" >> "$LOG"
    cd "$DIR" && "$NODE" src/index.js >> "$LOG" 2>&1
    echo "=== Blog publish finished at $(date) ===" >> "$LOG"
    ;;
  linkedin)
    echo "=== LinkedIn post at $(date) ===" >> "$LOG"
    cd "$DIR" && "$NODE" src/post-social.js linkedin >> "$LOG" 2>&1
    ;;
  x)
    echo "=== X/Twitter post at $(date) ===" >> "$LOG"
    cd "$DIR" && xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" "$NODE" src/post-social.js x >> "$LOG" 2>&1
    ;;
  facebook)
    echo "=== Facebook post at $(date) ===" >> "$LOG"
    cd "$DIR" && "$NODE" src/post-social.js facebook >> "$LOG" 2>&1
    ;;
  instagram)
    echo "=== Instagram post at $(date) ===" >> "$LOG"
    cd "$DIR" && "$NODE" src/post-social.js instagram >> "$LOG" 2>&1
    ;;
  *)
    echo "Usage: $0 {publish|linkedin|x|facebook|instagram}"
    exit 1
    ;;
esac
