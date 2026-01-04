# Unified Logging System

A streamlined logging experience shared between frontend and backend using TypeScript.

## Features

- **Unified Interface**: Same logger API across frontend and backend
- **Type-Safe**: Full TypeScript support with shared types
- **Environment-Specific**:
  - Backend: File rotation with 14-day retention via Winston
  - Frontend: Console logging + optional remote aggregation
- **Structured Logging**: JSON-formatted logs with metadata
- **Log Levels**: debug, info, warn, error
- **Automatic Cleanup**: Old logs are automatically deleted (14-day retention)
- **Batch Processing**: Frontend logs are batched before sending to backend

## Architecture

```
shared/logger/
├── types.ts           # Shared types and interfaces
├── BrowserLogger.ts   # Frontend browser logger
└── index.ts           # Exports

backend/src/logger.ts         # Unified backend logger (Winston wrapper)
frontend/src/utils/logger.ts  # Frontend logger instance

backend/src/routes/logs.ts    # Log aggregation endpoint
```

## Usage

### Backend (Node.js)

```typescript
import { logger } from "./logger";

// Simple logging
logger.info("User logged in", { userId: "123" });
logger.error("Failed to process payment", {
  orderId: "456",
  error: "Insufficient funds"
});

// Debug logging (only shows if LOG_LEVEL=debug)
logger.debug("Processing request", { requestId: "789" });

// Warning
logger.warn("API rate limit approaching", {
  usage: 95,
  limit: 100
});
```

### Frontend (React/Browser)

```typescript
import { logger } from "./utils/logger";

function MyComponent() {
  const handleClick = () => {
    logger.info("Button clicked", {
      component: "MyComponent",
      action: "submit"
    });
  };

  useEffect(() => {
    logger.debug("Component mounted", { name: "MyComponent" });
  }, []);

  return <button onClick={handleClick}>Submit</button>;
}
```

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", {
    operation: "riskyOperation",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
```

## Configuration

### Backend (.env)

```bash
LOG_LEVEL=info  # Options: debug, info, warn, error
```

Logs are written to:
- `backend/output/logs/backend/combined-YYYY-MM-DD.log` - All logs
- `backend/output/logs/backend/error-YYYY-MM-DD.log` - Errors only

**Retention**: 14 days, 20MB max per file, automatic compression

### Frontend (.env)

```bash
VITE_LOG_LEVEL=info  # Options: debug, info, warn, error
VITE_ENABLE_REMOTE_LOGGING=false  # Send logs to backend
VITE_LOG_ENDPOINT=http://localhost:3000/api/logs
```

When `VITE_ENABLE_REMOTE_LOGGING=true`:
- Logs are batched (max 50 entries)
- Sent every 10 seconds
- Automatically flushed on page unload
- Stored in `backend/output/logs/frontend/frontend-YYYY-MM-DD.log`

## Log Format

All logs are JSON-formatted:

```json
{
  "timestamp": "2026-01-03T10:30:00.000Z",
  "level": "info",
  "message": "User action completed",
  "metadata": {
    "userId": "123",
    "action": "purchase",
    "amount": 99.99
  },
  "source": "frontend",
  "sessionId": "1704276600000-abc123"
}
```

## Best Practices

### 1. Use Structured Metadata

**Good:**
```typescript
logger.info("User registered", {
  userId: user.id,
  email: user.email,
  source: "google-oauth"
});
```

**Bad:**
```typescript
logger.info(`User ${user.id} registered via ${source}`);
```

### 2. Appropriate Log Levels

- **debug**: Detailed info for debugging (disabled in production)
- **info**: General informational messages
- **warn**: Warning messages that aren't errors
- **error**: Error events that need attention

### 3. Don't Log Sensitive Data

**Never log:**
- Passwords
- API keys
- Personal identifiable information (PII)
- Credit card numbers
- Session tokens

### 4. Include Context

```typescript
logger.error("Payment processing failed", {
  orderId: "123",
  amount: 50.00,
  paymentMethod: "credit_card",
  errorCode: "INSUFFICIENT_FUNDS",
  // Include enough context to debug the issue
});
```

## Monitoring & Analysis

### View Backend Logs

```bash
# View combined logs for today
cat backend/output/logs/backend/combined-$(date +%Y-%m-%d).log | jq

# View error logs
cat backend/output/logs/backend/error-$(date +%Y-%m-%d).log | jq

# Search for specific errors
grep "payment" backend/output/logs/backend/*.log | jq
```

### View Frontend Logs

```bash
# View frontend logs
cat backend/output/logs/frontend/frontend-$(date +%Y-%m-%d).log | jq

# Filter by user session
cat backend/output/logs/frontend/*.log | jq 'select(.sessionId == "session-id")'
```

### Console Debugging (Frontend)

When running in development mode, access the logger via console:

```javascript
// In browser console
__logger.debug("Test message", { test: true });
__logger.setConfig({ level: "debug" }); // Change log level
__logger.flushNow(); // Manually flush logs
```

## API

### ILogger Interface

```typescript
interface ILogger {
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
}
```

### BrowserLogger Additional Methods

```typescript
logger.setConfig({ level: "debug", enableRemote: true });
logger.flushNow(); // Manually flush queued logs
logger.destroy(); // Clean up and flush before unmounting
```

## Log Aggregation Endpoint

**POST** `/api/logs`

**Request:**
```json
{
  "logs": [
    {
      "timestamp": "2026-01-03T10:30:00.000Z",
      "level": "error",
      "message": "API call failed",
      "metadata": { "endpoint": "/api/users" },
      "source": "frontend",
      "sessionId": "session-123"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "received": 1
}
```

## Troubleshooting

### Logs not appearing in backend files

1. Check directory permissions for `backend/output/sec/logs/`
2. Verify `LOG_LEVEL` environment variable
3. Check winston transport errors in console

### Frontend logs not reaching backend

1. Verify `VITE_ENABLE_REMOTE_LOGGING=true`
2. Check `VITE_LOG_ENDPOINT` URL is correct
3. Ensure backend server is running
4. Check CORS configuration
5. Check network tab for failed requests

### Log files too large

Adjust retention in `backend/src/logger.ts`:

```typescript
maxSize: "20m",  // Increase/decrease max file size
maxFiles: "14d", // Adjust retention period
```
