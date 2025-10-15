# GitHub Copilot Instructions for Verum Web

## Project Overview

**Verum Web** is a Firebase-hosted web API for the Verum Omnis forensic AI system. It provides stateless, hash-first endpoints for verification, anchoring, receipt management, PDF sealing, and AI chat functionality. The system is designed with security, auditability, and reproducibility as core principles.

### Technology Stack
- **Runtime**: Node.js 20 (ES Modules)
- **Framework**: Express.js with Firebase Functions v2
- **AI Providers**: OpenAI, Anthropic (Claude), DeepSeek
- **Security**: Helmet, CORS with allowlist, rate limiting, Ed25519 signing
- **PDF Generation**: PDFKit
- **Key Dependencies**: jose (JWT), multer (file uploads), pino (logging), undici (HTTP client)

## Project Structure

```
verum-web/verum-web/
├── firebase.json           # Firebase hosting configuration
└── functions/
    ├── index.js           # Main Express API server
    ├── config.js          # Configuration and environment variables
    ├── receipts-kv.js     # Receipt storage (in-memory KV store)
    ├── openapi.yaml       # API documentation
    ├── package.json       # Node.js dependencies
    └── pdf/
        └── seal-template.js # PDF seal generation
```

## Architecture Principles

### 1. Stateless & Hash-First Design
- All operations are stateless and reproducible
- Evidence and data are referenced by SHA-512 hashes
- No PII (Personally Identifiable Information) is stored
- Chain-of-custody principles apply to all evidence handling

### 2. Security Layers
- **CORS**: Allowlist-based origin validation (configurable via `ALLOWED_ORIGINS`)
- **Rate Limiting**: 
  - Tight: 30 requests/minute for `/v1/chat`, `/v1/anchor`, `/v1/seal`
  - Normal: 300 requests/15 minutes for `/v1/receipt`, `/v1/verify`
- **Helmet**: HTTP security headers
- **Ed25519 Signing**: All receipts and verification payloads are cryptographically signed
- **Circuit Breaker**: AI model calls use circuit breakers to prevent cascade failures

### 3. AI Provider Integration
The system supports multiple AI providers with fallback and consensus mechanisms:

#### OpenAI (Triple Consensus)
- Uses 3 models in parallel: `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini` (now includes `gpt-5-mini`)
- Implements consensus algorithm (2-of-3 agreement) for reliability
- Circuit breaker per model (3 failures → 60s cooldown)
- Configurable temperature and custom model override

#### Anthropic (Claude)
- Default model: `claude-3-5-haiku-20241022`
- Supports `claude-sonnet-4` and other Claude models via parameter
- System prompt injection for Verum Omnis context

#### DeepSeek
- Default model: `deepseek-chat`
- Lower-cost alternative for high-volume scenarios

## API Endpoints

### Core Endpoints
1. **GET /v1/verify** - Returns signed core manifest (constitution hash, model pack hash, policy)
2. **GET /v1/verify-rules** - Returns signed rules manifest (9 brains)
3. **POST /v1/anchor** - Issues a signed anchor receipt for a SHA-512 hash
4. **GET /v1/receipt** - Retrieves or regenerates a signed receipt for a hash
5. **POST /v1/seal** - Generates a sealed PDF with hash, receipt, and metadata
6. **POST /v1/chat** - AI chat endpoint with provider selection (openai/anthropic/deepseek)
7. **GET /health** - Health check and endpoint discovery
8. **GET /docs/openapi.yaml** - OpenAPI specification

### Authentication & Authorization
- API keys are environment-based: `VOSIGNINGKEY`, `OPENAIAPIKEY`, `ANTHROPICAPIKEY`, `DEEPSEEKAPIKEY`
- No user authentication required (stateless design)
- Rate limiting serves as primary access control

## Developer Workflows

### Local Development Setup
1. Install dependencies: `npm install` in `functions/` directory
2. Configure environment variables (see `config.js` for required vars)
3. Run locally with Firebase emulator or Node.js directly
4. Test with `curl` or API client (Postman, Insomnia)

### Configuration Management
All configuration is centralized in `config.js`:
- Environment variables are read at startup
- Asset hashes (constitution, model pack, rules) are computed on-demand
- Default values are provided for development

### Adding New AI Providers
1. Add API key to `config.js` exports
2. Implement provider-specific call logic in `index.js` (see `/v1/chat` handler)
3. Add provider to `supportedProviders` array in error response
4. Update system prompt for provider-specific context

### Adding New Models
1. For OpenAI: Add to `OPENAI_MODELS` array in `index.js`
2. For Anthropic/DeepSeek: Update default model or allow client override via `model` parameter
3. Ensure circuit breaker logic is applied consistently

## Code Style & Best Practices

### General Conventions
- **ES Modules**: Use `import/export` syntax (not `require`)
- **Async/Await**: Prefer async/await over promises for readability
- **Error Handling**: Always wrap async operations in try-catch; log with `pino`
- **Validation**: Validate all inputs at the API boundary
- **Immutability**: Avoid mutating shared state; prefer pure functions

### Naming Conventions
- **Functions**: camelCase (e.g., `getEd25519Key`, `signPayload`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `OPENAI_MODELS`, `CONSTITUTION_HASH`)
- **Routes**: kebab-case with version prefix (e.g., `/v1/verify-rules`)

### Error Responses
Standardized JSON error format:
```json
{
  "ok": false,
  "error": "error_code_snake_case",
  "details": "Optional human-readable message"
}
```

### Logging
- Use structured logging with `pino`
- Include endpoint name and error message in error logs
- Avoid logging sensitive data (API keys, PII)

## Integration Points

### Firebase Functions
- Deployed via `firebase deploy --only functions`
- Uses `onRequest` from `firebase-functions/v2/https`
- Region: Configurable via `FUNCTION_REGION` (default: `us-central1`)
- Resources: 512MiB memory, 60s timeout, 1-20 instances

### Asset Management
Assets stored in `functions/assets/`:
- `constitution.pdf` - Core legal/policy document
- `model_pack.json` - Model definitions and metadata
- `vo_logo.png` - Verum Omnis logo for PDF seals
- `rules/` - Rules directory (9 brains, auto-scanned)

### External APIs
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Anthropic**: `https://api.anthropic.com/v1/messages`
- **DeepSeek**: `https://api.deepseek.com/chat/completions`

## Testing Guidelines

### Manual Testing
- Use `/health` endpoint to verify deployment
- Test each AI provider with `/v1/chat` and different `provider` values
- Verify signing with `/v1/verify` and `/v1/verify-rules`
- Test rate limiting with repeated requests

### Key Test Scenarios
1. **Hash Validation**: POST invalid hash to `/v1/anchor` → expect 400
2. **Provider Fallback**: Remove API key → expect proper error message
3. **Circuit Breaker**: Trigger 3+ failures → verify cooldown behavior
4. **Consensus Algorithm**: Call OpenAI triple with varying responses → verify 2-of-3 logic
5. **PDF Sealing**: POST valid hash to `/v1/seal` → verify PDF generation

## Security Considerations

### Do's
- ✅ Always validate input hashes (64+ hex characters)
- ✅ Use Ed25519 signatures for receipts and manifests
- ✅ Apply rate limiting to all public endpoints
- ✅ Sanitize file upload inputs (max 20MB)
- ✅ Use HTTPS for all external API calls

### Don'ts
- ❌ Never log API keys or signing keys
- ❌ Don't store PII in memory or logs
- ❌ Avoid hardcoding secrets (use environment variables)
- ❌ Don't disable security middleware (Helmet, CORS) in production
- ❌ Never bypass rate limiting or circuit breakers

## AI-Specific Guidance

### System Prompt Philosophy
The Verum Omnis assistant follows these core principles (see `systemPrompt` in `/v1/chat`):
1. Precision, auditability, and statelessness
2. Reproducible steps with hash-based references
3. Transparency without claiming legal authority
4. Client-side hashing for privacy
5. Chain-of-custody best practices
6. Concise, thorough, and clear communication

### Model Selection Strategy
- **gpt-5-mini** & **gpt-4o-mini**: Fast, cost-effective for simple queries
- **gpt-4o**: Balanced quality and speed for complex reasoning
- **claude-sonnet-4**: High-quality reasoning for forensic analysis
- **claude-3-5-haiku**: Fast Anthropic alternative
- **deepseek-chat**: Budget-friendly option for high-volume scenarios

### Consensus Algorithm
The OpenAI triple consensus mechanism:
1. Calls 3 models in parallel
2. Normalizes responses (lowercase, strip special chars)
3. Computes Jaccard similarity for each pair (intersection/union)
4. Selects pair with highest similarity (≥60% threshold)
5. Returns longer response from winning pair
6. Falls back to single model if consensus fails

## Troubleshooting

### Common Issues

**"VOSIGNINGKEY not configured"**
- Set `VOSIGNINGKEY` environment variable with Ed25519 private key (PKCS8 or JWK format)

**"all_models_failed"**
- Check OpenAI API key validity
- Verify circuit breakers haven't tripped (wait 60s)
- Check network connectivity to OpenAI API

**"CORS" error**
- Add your origin to `ALLOWED_ORIGINS` environment variable (comma-separated)
- Ensure origin header is sent by client

**Rate limiting (429)**
- Implement exponential backoff on client side
- Reduce request frequency
- Consider caching responses where appropriate

## Contributing Guidelines

When modifying this codebase:
1. **Keep it minimal**: Only change what's necessary
2. **Maintain statelessness**: No session state, no databases
3. **Preserve security**: Don't weaken CORS, rate limiting, or validation
4. **Test thoroughly**: Verify all endpoints still work after changes
5. **Update documentation**: Keep this file and `openapi.yaml` in sync
6. **Follow conventions**: Match existing code style and patterns

## AI Agent Enablement

### Claude Sonnet 4
Claude Sonnet 4 is enabled for all clients via the `/v1/chat` endpoint:
```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4",
  "messages": [...]
}
```

### GPT-5 Mini
GPT-5 mini is enabled for all clients and included in the OpenAI triple consensus rotation:
```json
{
  "provider": "openai",
  "model": "gpt-5-mini",
  "messages": [...]
}
```

Both models are accessible without additional configuration changes beyond ensuring the respective API keys (`ANTHROPICAPIKEY`, `OPENAIAPIKEY`) are set in the environment.

## Quick Reference

### Environment Variables
- `FUNCTION_REGION` - Firebase function region (default: `us-central1`)
- `VOSIGNINGKEY` - Ed25519 private key for signing (PKCS8 or JWK)
- `OPENAIAPIKEY` - OpenAI API key
- `ANTHROPICAPIKEY` - Anthropic API key
- `DEEPSEEKAPIKEY` - DeepSeek API key
- `ALLOWED_ORIGINS` - Comma-separated list of CORS origins

### Key Files to Know
- `index.js` - Main API logic, all routes
- `config.js` - Configuration, hashing, asset loading
- `receipts-kv.js` - Simple in-memory receipt storage
- `pdf/seal-template.js` - PDF generation with QR codes
- `openapi.yaml` - API documentation (keep in sync!)

### Useful Commands
```bash
# Install dependencies
cd verum-web/verum-web/functions && npm install

# Deploy to Firebase
firebase deploy --only functions

# View logs
firebase functions:log

# Test locally (requires Firebase CLI)
firebase emulators:start --only functions
```

---

**Last Updated**: October 2025  
**Maintainer**: Verum Omnis Team  
**License**: See repository root for license information
