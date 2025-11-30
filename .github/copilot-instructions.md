# GitHub Copilot Instructions for Verum Omnis Web API

## Project Overview

**Verum Omnis** is a forensic AI system providing stateless, hash-first verification and analysis services. This repository contains the web API backend built with Firebase Cloud Functions, Express.js, and multiple AI provider integrations.

### Core Purpose
- Provide cryptographically verifiable forensic analysis
- Support evidence anchoring and receipt generation
- Offer AI-powered chat with consensus mechanisms
- Generate sealed PDF verification documents

## Architecture

### Technology Stack
- **Runtime**: Node.js 20 (ES Modules)
- **Framework**: Express.js on Firebase Cloud Functions v2
- **AI Providers**: OpenAI, Anthropic (Claude), DeepSeek
- **Security**: Ed25519 JWT signing, Helmet, CORS, Rate Limiting
- **PDF Generation**: PDFKit with QR code support
- **Logging**: Pino structured logging

### Project Structure
```
verumweb/
├── .github/
│   └── workflows/          # CI/CD workflows
├── verum-web/verum-web/
│   ├── firebase.json       # Firebase hosting config
│   └── functions/
│       ├── index.js        # Main API routes and logic
│       ├── config.js       # Configuration and secrets
│       ├── receipts-kv.js  # In-memory receipt storage
│       ├── openapi.yaml    # API specification
│       ├── package.json    # Dependencies
│       └── pdf/
│           └── seal-template.js  # PDF generation logic
```

## Key API Endpoints

### Verification & Anchoring
- `GET /v1/verify` - Returns signed core manifest with constitution and model pack hashes
- `GET /v1/verify-rules` - Returns signed rules manifest
- `POST /v1/anchor` - Creates signed anchor receipt for SHA-512 hash
- `GET /v1/receipt` - Retrieves signed receipt for a hash

### Document Services
- `POST /v1/seal` - Generates sealed PDF with QR code and watermark

### AI Services
- `POST /v1/chat` - Multi-provider AI chat with consensus mechanism
  - Supports OpenAI (triple consensus with circuit breaker)
  - Supports Anthropic Claude models
  - Supports DeepSeek models

## Development Workflow

### Environment Variables
Required secrets (configured in Firebase):
- `VOSIGNINGKEY` - Ed25519 private key for JWT signing (PKCS8 or JWK format)
- `OPENAIAPIKEY` - OpenAI API key
- `ANTHROPICAPIKEY` - Anthropic API key
- `DEEPSEEKAPIKEY` - DeepSeek API key
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `FUNCTION_REGION` - Firebase region (default: us-central1)

### Local Development
```bash
cd verum-web/verum-web/functions
npm install
# Configure environment variables
firebase emulators:start
```

### Testing
```bash
# Test health endpoint
curl http://localhost:5001/api/health

# Test chat endpoint
curl -X POST http://localhost:5001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"provider":"anthropic"}'
```

## Code Conventions

### Style Guidelines
1. **ES Modules**: Use `import/export` syntax exclusively
2. **Error Handling**: Always wrap route handlers in try-catch
3. **Logging**: Use structured logging with Pino (`log.info`, `log.error`)
4. **Security**: Never log sensitive data (API keys, private keys)
5. **Validation**: Validate all user inputs before processing
6. **Async/Await**: Prefer async/await over promises

### Naming Conventions
- Variables: camelCase (`userMessages`, `receiptData`)
- Constants: UPPER_SNAKE_CASE (`OPENAI_MODELS`, `FAIL_THRESHOLD`)
- Functions: camelCase, descriptive verbs (`signPayload`, `breakerAllowed`)
- Files: kebab-case for multiple words (`seal-template.js`, `receipts-kv.js`)

### Security Best Practices
1. **Rate Limiting**: Different limits per endpoint type
   - Tight: 30 req/min for `/v1/chat`, `/v1/anchor`, `/v1/seal`
   - Normal: 300 req/15min for `/v1/receipt`, `/v1/verify*`
2. **Input Validation**: 
   - Hash format: `/^[a-f0-9]{64,}$/`
   - Message length: max 6000 chars
   - Message count: max 30 messages
3. **CORS**: Strict allow-list from environment
4. **Circuit Breaker**: AI provider failures trigger cooldown

## AI Provider Integration

### OpenAI Triple Consensus
- Uses 3 models concurrently: `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`
- Circuit breaker per model (3 failures → 60s cooldown)
- Consensus algorithm compares outputs (60% similarity threshold)
- Returns winner based on content length if consensus achieved

### Anthropic Claude
- Default model: `claude-sonnet-4-20250514` (Claude Sonnet 4)
- System prompt passed separately from user messages
- Max tokens: 2048
- Temperature: 0.2 (configurable)

### DeepSeek
- Default model: `deepseek-chat`
- OpenAI-compatible API format
- Uses same message structure as OpenAI

### System Prompt
All AI providers use this system prompt:
```
You are the Verum Omnis assistant. Core principles:
1. Be precise, auditable, and stateless - never store PII
2. Provide reproducible steps and hash-based references
3. Never claim legal authority - give transparent reasoning with disclaimers
4. For file analysis: web service does client-side hashing only
5. Heavy forensics require the 3GB on-device app or local WASM tools
6. All evidence handling follows chain-of-custody best practices
7. Be concise but thorough - favor clarity over verbosity
```

## Common Tasks

### Adding a New API Endpoint
1. Add route in `functions/index.js`
2. Implement validation and error handling
3. Add rate limiting if needed
4. Update `openapi.yaml` specification
5. Add to 404 handler's `availableEndpoints` list
6. Test locally before deployment

### Updating AI Models
1. Locate model configuration (e.g., `OPENAI_MODELS` array, Anthropic default)
2. Update model identifier
3. Verify API compatibility
4. Test with sample requests
5. Monitor error rates after deployment

### Modifying Hash/Signature Logic
1. Update in `config.js` for hashing utilities
2. Update signing logic in `index.js` (Ed25519 functions)
3. Ensure backward compatibility with existing receipts
4. Test signature verification

## Integration Points

### Firebase Hosting
- API proxied via `/api/**` rewrites
- Configured in `firebase.json`
- Function name: `api2`

### PDF Generation
- Uses PDFKit with custom watermarking
- QR codes embed verification payload
- Logo and fonts loaded from assets
- Output: A4 size with 56pt margins

### Receipt Storage
- In-memory Map (not persistent across cold starts)
- Can be swapped for Firestore or Cloud Storage
- Keys: SHA-512 hashes
- Values: Signed receipt objects

## Troubleshooting

### Common Issues
1. **Cold Start Timeouts**: Increase `minInstances` in function config
2. **Rate Limit Errors**: Adjust `windowMs` and `max` in rate limit configs
3. **AI Provider Failures**: Check circuit breaker state, verify API keys
4. **CORS Errors**: Verify origin in `ALLOWED_ORIGINS` environment variable
5. **PDF Generation Fails**: Check logo/font paths, verify asset permissions

### Debugging Tips
- Check logs: `firebase functions:log`
- Test locally: `firebase emulators:start`
- Verify secrets: Check Firebase console → Functions → Environment Variables
- Monitor metrics: Firebase console → Functions → Usage tab

## Testing Strategy

### Unit Tests
Currently no test framework configured. When adding:
- Use Jest or Mocha for Node.js testing
- Mock Firebase functions and external APIs
- Test validation logic independently
- Test consensus algorithm edge cases

### Integration Tests
- Test each endpoint with valid/invalid inputs
- Verify signature generation and validation
- Test AI provider failover scenarios
- Verify PDF generation output

### Security Testing
- Test rate limiting effectiveness
- Verify CORS policy enforcement
- Test input validation boundaries
- Check for information disclosure in errors

## Deployment

### Firebase Deployment
```bash
cd verum-web/verum-web
firebase deploy --only functions
```

### Environment Configuration
1. Set secrets via Firebase CLI:
   ```bash
   firebase functions:secrets:set VOSIGNINGKEY
   firebase functions:secrets:set OPENAIAPIKEY
   firebase functions:secrets:set ANTHROPICAPIKEY
   ```
2. Verify in Firebase Console
3. Redeploy functions after secret changes

## Project-Specific Conventions

### Hash Format
- All hashes: SHA-512 in hexadecimal (128 characters minimum)
- Validation regex: `/^[a-f0-9]{64,}$/`
- Used for: Evidence anchoring, receipt lookup, PDF sealing

### Receipt Format
```javascript
{
  ok: true,
  chain: "eth",           // Blockchain identifier
  txid: "...",            // Transaction ID
  hash: "...",            // SHA-512 hash
  manifestHash: "...",    // Model pack hash
  constitutionHash: "...", // Constitution hash
  product: "VO-Web32",    // Product identifier
  issuedAt: "ISO8601",    // Timestamp
  signature: "JWT"        // Ed25519 JWT signature
}
```

### Error Response Format
```javascript
{
  ok: false,
  error: "error_code",
  details: "Optional details"
}
```

## Future Considerations

### Planned Features
- Persistent receipt storage (Firestore)
- Enhanced consensus algorithms
- Additional AI provider support
- WebSocket support for streaming responses
- Batch processing endpoints

### Known Limitations
- In-memory receipt storage (lost on cold start)
- Fixed rate limits (not user-specific)
- No authentication/authorization layer
- Limited to 2048 max tokens for AI responses

## Additional Resources

- Firebase Functions: https://firebase.google.com/docs/functions
- OpenAI API: https://platform.openai.com/docs
- Anthropic API: https://docs.anthropic.com/
- PDFKit: https://pdfkit.org/

---

**Last Updated**: October 2025  
**Maintainer**: Verum Omnis Team  
**License**: Proprietary
