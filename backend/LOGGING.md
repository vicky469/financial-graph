# Where to See Logs

Logs are written to **stdout** in JSON format. Here's how to view them:

## 🖥️ Development

### Backend Server
```bash
# Run server and see logs in real-time
npm run dev
```

Output:
```json
{"environment":"development","level":"info","message":"Backend server started","port":4000}
```

### SEC Ingestion Script
```bash
# Run script and see logs
npm run ingest:sec
```

Output:
```json
{"level":"info","message":"Starting SEC metadata ingestion","quarters":[1,2,3,4],"years":[2025]}
{"entriesFound":339766,"level":"info","message":"Parsed SEC quarterly index","quarter":1,"year":2025}
```

## 🎨 Pretty Formatting with jq

Install `jq` for better readability:
```bash
# macOS
brew install jq

# Ubuntu/Debian
apt-get install jq
```

Then pipe logs through jq:
```bash
# Pretty print all logs
npm run dev | jq

# Pretty print SEC ingestion
npm run ingest:sec | jq
```

Output:
```json
{
  "environment": "development",
  "level": "info",
  "message": "Backend server started",
  "port": 4000
}
```

## 🔍 Filtering Logs

### Filter by Log Level
```bash
# Only errors
npm run dev | jq 'select(.level == "error")'

# Warnings and errors
npm run dev | jq 'select(.level == "warn" or .level == "error")'
```

### Search by Message
```bash
# Find all logs mentioning "SEC"
npm run ingest:sec | jq 'select(.message | contains("SEC"))'

# Find parsing logs
npm run ingest:sec | jq 'select(.message | contains("Parsed"))'
```

### Filter by Metadata
```bash
# Only logs for Q1 2025
npm run ingest:sec | jq 'select(.quarter == 1 and .year == 2025)'

# Logs with entry counts > 300k
npm run ingest:sec | jq 'select(.entriesFound > 300000)'
```

## 💾 Saving Logs to File

### Save All Logs
```bash
# Save to file
npm run dev > backend.log 2>&1

# Save and view simultaneously
npm run dev 2>&1 | tee backend.log

# View saved logs
cat backend.log | jq
```

### Save Only Errors
```bash
npm run dev 2>&1 | jq 'select(.level == "error")' > errors.log
```

## 🐳 Production (Docker)

Logs automatically go to Docker's stdout/stderr:

```bash
# View Docker logs
docker logs <container-name>

# Follow logs in real-time
docker logs -f <container-name>

# Last 100 lines with timestamps
docker logs --tail 100 -t <container-name>

# Filter errors
docker logs <container-name> | jq 'select(.level == "error")'
```

## ☁️ Cloud Platforms

### AWS CloudWatch
Logs automatically captured from stdout when using:
- ECS/Fargate
- Lambda (with Node.js runtime)
- Elastic Beanstalk

### Heroku
```bash
heroku logs --tail
```

### Vercel/Railway/Render
All capture stdout automatically in their log viewers

## 🔧 Log Aggregation

Pipe JSON logs to popular services:

### Datadog
```bash
# Logs automatically collected via Datadog Agent
# Reads from stdout/stderr
```

### Splunk
```bash
npm run dev | splunk-forwarder
```

### Elasticsearch
```bash
npm run dev | filebeat -c filebeat.yml
```

## 📊 Monitoring Tips

### Count Logs by Level
```bash
npm run dev 2>&1 | jq -r '.level' | sort | uniq -c
```

### Extract Just Messages
```bash
npm run dev 2>&1 | jq -r '.message'
```

### Create CSV Report
```bash
npm run ingest:sec 2>&1 | jq -r '[.level, .message, .entriesFound] | @csv'
```

## 🎯 Common Use Cases

### Debug SEC Ingestion Issues
```bash
# See all errors during ingestion
npm run ingest:sec 2>&1 | jq 'select(.level == "error")'

# Watch progress in real-time
npm run ingest:sec 2>&1 | jq -r '"\(.message) - Q\(.quarter) \(.year): \(.entriesFound) entries"'
```

### Monitor Server Performance
```bash
# Check all info logs
npm run dev | jq 'select(.level == "info")'

# Save session logs for analysis
npm run dev 2>&1 | tee "logs/session-$(date +%Y%m%d-%H%M%S).log"
```

## 💡 Pro Tips

1. **Use environment variable for log level**:
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

2. **Colorize output** (requires jq):
   ```bash
   npm run dev | jq -C | less -R
   ```

3. **Watch specific field**:
   ```bash
   npm run ingest:sec | jq -r '.entriesFound' | watch
   ```

4. **Create alerts**:
   ```bash
   npm run dev 2>&1 | jq 'select(.level == "error")' | mail -s "Backend Errors" you@example.com
   ```
