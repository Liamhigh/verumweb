# Copilot Instructions for Verum Omnis Web

## Project Overview

Verum Omnis is a forensic AI system that provides evidence analysis, blockchain anchoring, and court-ready reporting capabilities. The web component consists of:

- **Firebase Cloud Functions API** (Node.js/Express) - Backend API in `/verum-web/verum-web/functions/`
- **AI Provider Integration** - OpenAI, Anthropic (Claude), and DeepSeek
- **Evidence Processing** - Hash-based evidence integrity with blockchain anchoring
- **PDF Generation** - Court-ready forensic report generation

## Architecture

### Technology Stack
- **Runtime**: Node.js 20 (ES Modules)
- **Framework**: Express.js with Firebase Functions v2
- **AI Providers**: OpenAI GPT-4, Anthropic Claude, DeepSeek
- **Security**: Helmet, CORS, Rate Limiting, Ed25519 signing
- **PDF Generation**: PDFKit with QR codes
- **Logging**: Pino

### Key Components

1. **API Endpoints** (`/verum-web/verum-web/functions/index.js`)
   - `/v1/chat` - Multi-provider AI chat with consensus mechanism
   - `/v1/anchor` - Blockchain evidence anchoring
   - `/v1/receipt` - Receipt retrieval for anchored evidence
   - `/v1/seal` - PDF seal generation with QR codes
   - `/v1/verify` - System verification and manifest hashing
   - `/v1/verify-rules` - Rules manifest verification
   - `/health` - Health check endpoint

2. **Configuration** (`/verum-web/verum-web/functions/config.js`)
   - Environment-based secrets management
   - Asset hashing (constitution, model packs, rules)
   - CORS origin management
   - SHA-512 file hashing utilities

3. **Receipt Management** (`/verum-web/verum-web/functions/receipts-kv.js`)
   - In-memory key-value store for receipts
   - Evidence hash tracking

4. **PDF Generation** (`/verum-web/verum-web/functions/pdf/seal-template.js`)
   - Court-ready sealed PDF generation
   - QR code embedding for verification
   - Metadata and integrity seal inclusion

## Development Workflows

### Local Development
```bash
cd verum-web/verum-web/functions
npm install
npm start  # If dev script exists, otherwise use Firebase emulator
```

### Testing
- The codebase currently has no test infrastructure
- Manual testing via API endpoints is required
- Use the `/health` endpoint to verify deployment

### Deployment
- Firebase Functions deployment (production handled by CI/CD)
- Environment variables required:
  - `VOSIGNINGKEY` - Ed25519 private key (PKCS8 or JWK format)
  - `OPENAIAPIKEY` - OpenAI API key
  - `ANTHROPICAPIKEY` - Anthropic API key
  - `DEEPSEEKAPIKEY` - DeepSeek API key
  - `ALLOWED_ORIGINS` - Comma-separated CORS origins
  - `FUNCTION_REGION` - Firebase region (default: us-central1)

## Project-Specific Conventions

### Code Style
- **ES Modules**: Use `import`/`export` syntax
- **Error Handling**: Try-catch blocks with Pino logging
- **Async/Await**: Preferred over callbacks/promises
- **Security First**: All endpoints have rate limiting, input validation

### Naming Conventions
- **Files**: kebab-case (e.g., `seal-template.js`)
- **Functions**: camelCase (e.g., `signPayload`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `VOSIGNINGKEY`)
- **API Routes**: lowercase with version prefix (e.g., `/v1/chat`)

### API Response Format
```javascript
// Success
{ ok: true, ...data }

// Error
{ ok: false, error: "error_code", message: "optional details" }
```

### AI Provider Pattern
The `/v1/chat` endpoint supports three providers:
1. **OpenAI** - Triple consensus mechanism with circuit breaker
2. **Anthropic** - Single model call (default: Claude Sonnet 4)
3. **DeepSeek** - Single model call

**Default Model Selection**:
- OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini` (consensus)
- Anthropic: `claude-sonnet-4-20250514` (Claude Sonnet 4)
- DeepSeek: `deepseek-chat`

### Circuit Breaker Implementation
- Tracks failures per OpenAI model
- Threshold: 3 failures
- Cooldown: 60 seconds
- Automatically retries with alternative models

### Consensus Mechanism (OpenAI)
- Calls up to 3 models in parallel
- Compares responses using Jaccard similarity (word-level)
- Requires 60% similarity for consensus
- Returns the longer response from the consensus pair

## Integration Points

### Firebase Functions
- Uses `onRequest` from `firebase-functions/v2/https`
- Global options: `us-central1` region, max 20 instances
- Timeout: 60 seconds, Memory: 512MB, Min instances: 1

### AI Provider APIs
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Anthropic**: `https://api.anthropic.com/v1/messages` (API version: 2023-06-01)
- **DeepSeek**: `https://api.deepseek.com/chat/completions`

### Blockchain Integration
- Evidence anchoring uses SHA-512 hashing
- Simulated blockchain transaction IDs (SHA-512 hash of hash + timestamp)
- Ed25519 JWT signing for receipt authenticity

### PDF Generation
- PDFKit for document creation
- QR code generation via `qrcode` library
- Embeds receipt data and verification URLs

## Security Considerations

1. **Input Validation**
   - All hash inputs validated with regex: `/^[a-f0-9]{64,}$/`
   - Message length limits: 6000 characters per message, max 30 messages
   - File upload limits: 20MB

2. **Rate Limiting**
   - Tight limit (30 req/min): `/v1/chat`, `/v1/anchor`, `/v1/seal`
   - Normal limit (300 req/15min): `/v1/receipt`, `/v1/verify`, `/v1/verify-rules`

3. **CORS**
   - Whitelist-based origin validation
   - Fallback to localhost for development

4. **Headers**
   - Helmet.js for security headers
   - `x-powered-by` header disabled
   - CSP disabled for flexibility, cross-origin resource policy enabled

5. **Secret Management**
   - All API keys via environment variables
   - Ed25519 signing key supports PKCS8 or JWK format
   - Never log sensitive data

## Common Tasks

### Adding a New AI Provider
1. Add API key to `config.js` environment variables
2. Implement provider logic in `/v1/chat` endpoint
3. Add to `supportedProviders` array in error response
4. Follow existing pattern: validate API key, format messages, handle errors

### Updating AI Models
- OpenAI models: Update `OPENAI_MODELS` array in `index.js`
- Anthropic default: Update default in line 383
- DeepSeek default: Update default in line 412

### Adding New Endpoints
1. Define route with `app.post()` or `app.get()`
2. Add rate limiting with `rlTight` or `rlNormal`
3. Implement try-catch error handling
4. Log errors with Pino
5. Return standard response format
6. Add to `/health` endpoint's `availableEndpoints` array

### Modifying Evidence Processing
- Hash functions are in `config.js`: `sha512File()`, `sha512Hex()`
- Receipt storage is in-memory only (not persistent)
- For persistent storage, integrate with Firebase Realtime Database or Firestore

## AI Agent Guidelines

### When Making Changes
1. **Preserve Security**: Never weaken rate limits, input validation, or CORS policies
2. **Maintain API Contracts**: Keep response formats consistent
3. **Follow ES Module Syntax**: Use `import`/`export`, not `require()`
4. **Error Handling**: Always wrap endpoints in try-catch with Pino logging
5. **Environment Variables**: Never hardcode secrets

### When Adding Dependencies
1. Check compatibility with Node.js 20 and ES modules
2. Update `package.json` in `/verum-web/verum-web/functions/`
3. Prefer well-maintained packages with active security support
4. Keep dependencies minimal (current count: 9 prod dependencies)

### When Debugging
1. Check Pino logs for error messages
2. Verify environment variables are set
3. Test with `/health` endpoint first
4. Use circuit breaker status for OpenAI issues
5. Validate input formats (especially hashes)

### When Optimizing
1. Keep-alive agents are already configured for HTTP(S)
2. Rate limiting is production-tuned
3. Consensus mechanism is optimized for accuracy over speed
4. Consider edge caching for static endpoints like `/health`

## Related Documentation
- **OpenAPI Spec**: Available at `/docs/openapi.yaml`
- **Android App**: See `.github/workflows/verum_omnis_summary.yaml` for mobile architecture
- **Firebase Config**: `firebase.json` in project root

## Contact & Support
- Product ID: `VO-Web32`
- Policy: Free for private citizens, institutional licensing available
- Verify URL: `https://verumglobal.foundation/verify`
