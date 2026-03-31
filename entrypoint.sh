#!/bin/bash
set -e

# Load .env into cron environment
if [ -f /app/.env ]; then
  # Export all env vars so cron jobs can access them
  env >> /etc/environment
fi

# Install cron schedule
cat > /etc/cron.d/blog-automation << 'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Tuesday & Thursday: Publish blog at 09:00 CET (1h buffer before LinkedIn)
0 9 * * 2,4 root /app/cron-job.sh publish >> /app/logs/cron.log 2>&1

# Tuesday & Thursday: LinkedIn at 10:00
0 10 * * 2,4 root /app/cron-job.sh linkedin >> /app/logs/cron.log 2>&1

# Tuesday & Thursday: X/Twitter at 12:00
0 12 * * 2,4 root /app/cron-job.sh x >> /app/logs/cron.log 2>&1

# Tuesday & Thursday: Facebook at 15:00
0 15 * * 2,4 root /app/cron-job.sh facebook >> /app/logs/cron.log 2>&1

CRON

chmod 0644 /etc/cron.d/blog-automation

# Start cron daemon
cron

echo "=== Blog Automation Container Started ==="
echo "Timezone: $(date +%Z) ($(cat /etc/timezone 2>/dev/null || echo $TZ))"
echo "Current time: $(date)"
echo "Schedule: Tue & Thu — 09:00 publish, 10:00 LinkedIn, 12:00 X, 15:00 Facebook"
echo ""
echo "Commands:"
echo "  docker exec blog-bot node src/index.js --dry-run       # test pipeline"
echo "  docker exec blog-bot node src/post-social.js linkedin   # test social"
echo "  docker exec blog-bot node src/index.js --post-now       # full run now"
echo "  docker logs -f blog-bot                                 # watch logs"
echo ""

# Follow the log file so docker logs shows output
touch /app/logs/cron.log
exec tail -f /app/logs/cron.log
