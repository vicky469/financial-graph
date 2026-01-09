# Parser Tests

## Unit Tests

Most parser tests are unit tests that run quickly without external dependencies:

```bash
# Run all parser tests except LLM integration tests
npm test tests/parser/ -- --testPathIgnorePatterns=llm-enrichment

# Run specific test files
npx jest tests/parser/footnotes.test.ts
npx jest tests/parser/nesting.test.ts
```

## Integration Tests

### LLM Enrichment Tests

The `llm-enrichment.test.ts` file contains integration tests that require Ollama to be running.

**Prerequisites:**

1. Install Ollama: https://ollama.ai
2. Start Ollama server:
   ```bash
   ollama serve
   ```
3. Pull the model:
   ```bash
   ollama pull qwen2:7b
   ```

**Running the tests:**

```bash
# Run LLM integration tests
npx jest tests/parser/llm-enrichment.test.ts

# Run with verbose output
npx jest tests/parser/llm-enrichment.test.ts --verbose
```

**Expected behavior:**
- Tests will make real API calls to Ollama
- Each test may take 1-5 seconds depending on your hardware
- Total test suite should complete in under 30 seconds

**Troubleshooting:**

If tests fail with connection errors:
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

Make sure Ollama is running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

If tests fail with model not found:
```
Error: model 'qwen2:7b' not found
```

Pull the model:
```bash
ollama pull qwen2:7b
```

## Test Coverage

Run all tests with coverage:

```bash
npm test -- --coverage
```

View coverage report:
```bash
open coverage/lcov-report/index.html
```
