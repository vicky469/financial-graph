# Logging Examples

## Backend Examples

### Basic Logging
```typescript
import { logger } from "./logger";

// Application startup
logger.info("Application started", {
  port: 4000,
  environment: process.env.NODE_ENV,
});

// Successful operations
logger.info("Database connected", {
  host: "localhost",
  database: "financial_graph",
});

// Warnings
logger.warn("Slow query detected", {
  query: "SELECT * FROM large_table",
  duration: 5000,
  threshold: 1000,
});

// Errors
logger.error("Database connection failed", {
  error: error.message,
  host: "localhost",
  retryAttempt: 3,
});
```

### SEC Data Ingestion (Current Implementation)

```typescript
// Start of ingestion
logger.info("Starting SEC metadata ingestion", {
  years: [2023, 2024],
  quarters: [1, 2, 3, 4],
});

// Per-file processing
logger.info("Parsed SEC quarterly index", {
  year: 2024,
  quarter: 1,
  entriesFound: 15000,
});

// Data quality issues
logger.error("Skipping malformed line (expected ≥5 columns)", {
  line: "ACME Corp  10-K",
  columnCount: 2,
  sourceQuarter: "2024-Q1",
});

// Missing files
logger.warn("Missing raw SEC index file", {
  bodyPath: "/data/sec/2024-Q1.body",
  year: 2024,
  quarter: 1,
});

// Deduplication stats
logger.info("Deduplicated entries", {
  beforeDedup: 60000,
  afterDedup: 58500,
  duplicatesRemoved: 1500,
});

// Final output
logger.info("Successfully wrote SEC metadata CSV", {
  outputFile: "/output/registrant_metadata_2024.csv",
  rowCount: 58500,
  yearsLabel: "2024",
});
```

### API Request Logging

```typescript
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (res.statusCode >= 400) {
      logger.warn("API request failed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });
    } else {
      logger.info("API request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      });
    }
  });

  next();
});
```

### Error Handling

```typescript
try {
  await processSecFiling(cik, accessionNumber);
  logger.info("SEC filing processed", {
    cik,
    accessionNumber,
  });
} catch (error) {
  logger.error("Failed to process SEC filing", {
    cik,
    accessionNumber,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw error;
}
```

## Frontend Examples

### Component Lifecycle

```typescript
import { logger } from "./utils/logger";

function FinancialGraph({ companyId }: Props) {
  useEffect(() => {
    logger.debug("FinancialGraph mounted", {
      companyId,
      timestamp: Date.now(),
    });

    return () => {
      logger.debug("FinancialGraph unmounted", { companyId });
    };
  }, [companyId]);

  // Component code...
}
```

### User Actions

```typescript
const handleNodeClick = (nodeId: string) => {
  logger.info("Graph node clicked", {
    nodeId,
    nodeType: "company",
    graphId: currentGraph.id,
  });

  // Handle click...
};

const handleExport = async (format: "csv" | "json") => {
  logger.info("Export initiated", {
    format,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  });

  try {
    await exportGraph(graph, format);
    logger.info("Export completed", { format });
  } catch (error) {
    logger.error("Export failed", {
      format,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
```

### API Calls

```typescript
async function fetchCompanyData(cik: string) {
  logger.debug("Fetching company data", { cik });

  try {
    const response = await fetch(`/api/companies/${cik}`);

    if (!response.ok) {
      logger.warn("API request failed", {
        endpoint: `/api/companies/${cik}`,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    logger.info("Company data fetched", {
      cik,
      dataSize: JSON.stringify(data).length,
    });

    return data;
  } catch (error) {
    logger.error("Failed to fetch company data", {
      cik,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

### Performance Monitoring

```typescript
const GraphRenderer = ({ data }: Props) => {
  const renderStart = performance.now();

  useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;

    if (renderTime > 1000) {
      logger.warn("Slow graph render", {
        renderTime,
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
      });
    } else {
      logger.debug("Graph rendered", {
        renderTime,
        nodeCount: data.nodes.length,
      });
    }
  }, [data]);

  // Render graph...
};
```

### Form Validation

```typescript
const handleSubmit = (formData: FormData) => {
  logger.debug("Form submission started", {
    form: "companySearch",
    fields: Object.keys(formData),
  });

  const errors = validateForm(formData);

  if (errors.length > 0) {
    logger.warn("Form validation failed", {
      form: "companySearch",
      errors: errors.map((e) => e.field),
      errorCount: errors.length,
    });
    return;
  }

  logger.info("Form submitted successfully", {
    form: "companySearch",
    searchTerm: formData.query,
  });

  // Submit form...
};
```

### Error Boundaries

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("React error boundary caught error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    // Error UI...
  }
}
```

### State Management

```typescript
const [nodes, setNodes] = useState<Node[]>([]);

const addNode = (node: Node) => {
  logger.info("Node added to graph", {
    nodeId: node.id,
    nodeType: node.type,
    totalNodes: nodes.length + 1,
  });

  setNodes([...nodes, node]);
};

const removeNode = (nodeId: string) => {
  logger.info("Node removed from graph", {
    nodeId,
    remainingNodes: nodes.length - 1,
  });

  setNodes(nodes.filter((n) => n.id !== nodeId));
};
```

## Advanced Patterns

### Contextual Logger

```typescript
// Create a logger with fixed context
function createContextLogger(context: LogMetadata) {
  return {
    debug: (msg: string, meta?: LogMetadata) =>
      logger.debug(msg, { ...context, ...meta }),
    info: (msg: string, meta?: LogMetadata) =>
      logger.info(msg, { ...context, ...meta }),
    warn: (msg: string, meta?: LogMetadata) =>
      logger.warn(msg, { ...context, ...meta }),
    error: (msg: string, meta?: LogMetadata) =>
      logger.error(msg, { ...context, ...meta }),
  };
}

// Usage
const userLogger = createContextLogger({ userId: "123", sessionId: "abc" });
userLogger.info("Action performed", { action: "purchase" });
// Logs: { userId: "123", sessionId: "abc", action: "purchase" }
```

### Debug Groups

```typescript
const DEBUG_GROUPS = {
  graph: import.meta.env.DEBUG_GRAPH === "true",
  api: import.meta.env.DEBUG_API === "true",
  rendering: import.meta.env.DEBUG_RENDERING === "true",
};

function debugLog(group: keyof typeof DEBUG_GROUPS, message: string, meta?: LogMetadata) {
  if (DEBUG_GROUPS[group]) {
    logger.debug(`[${group}] ${message}`, meta);
  }
}

// Usage
debugLog("graph", "Layout calculation started", { nodeCount: 100 });
```

### Performance Tracking

```typescript
async function withLogging<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  logger.debug(`${operation} started`);

  try {
    const result = await fn();
    const duration = performance.now() - start;

    logger.info(`${operation} completed`, { duration });
    return result;
  } catch (error) {
    const duration = performance.now() - start;

    logger.error(`${operation} failed`, {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Usage
const data = await withLogging(
  "Fetch company graph",
  () => fetchCompanyGraph("123")
);
```
