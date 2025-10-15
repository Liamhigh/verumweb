# Verum Omnis Web API - AI Coding Instructions

## Architecture Overview

This is a **Firebase Functions-based API** for Verum Omnis, a cryptographic evidence verification system. The core principle is **hash-first, stateless verification** using Ed25519 signing.

### Key Components

- **`functions/index.js`**: Main Express app exported as Firebase function `api2`
- **`functions/config.js`**: Environment-based config with asset hash calculations
- **`functions/receipts-kv.js`**: In-memory receipt storage (replaceable with persistent store)
- **`functions/pdf/seal-template.js`**: PDF generation with QR codes and watermarks
- **`firebase.json`**: Routes `/api/**` to the `api2` function, expects `web/` for static hosting

## Critical Patterns

### Hash-Based Verification System
All evidence is referenced by SHA-512 hashes. Receipt generation uses deterministic txids:
```javascript
const txid = crypto.createHash("sha512").update(hash + issuedAt).digest("hex").slice(0, 64);
```

### Ed25519 Signing Pattern
The signing system supports both PKCS8 and JWK formats:
```javascript
// Auto-detects format based on "BEGIN PRIVATE KEY" presence
const key = VOSIGNINGKEY.includes("BEGIN PRIVATE KEY") 
  ? importPKCS8(VOSIGNINGKEY, "EdDSA")
  : importJWK(JSON.parse(VOSIGNINGKEY), "EdDSA");
```

### Triple Consensus for OpenAI
**Unique feature**: OpenAI calls use 3-model consensus with circuit breaker pattern. Responses are compared using Jaccard similarity (≥0.6 threshold) and longest content wins.

### Rate Limiting Strategy
- **Tight limits**: `/v1/chat`, `/v1/anchor`, `/v1/seal` (30 requests/minute)
- **Normal limits**: Other endpoints (300 requests/15 minutes)

## Environment Configuration

Required environment variables:
- `VOSIGNINGKEY`: Ed25519 private key (PKCS8 or JWK format)
- `OPENAIAPIKEY`, `ANTHROPICAPIKEY`, `DEEPSEEKAPIKEY`: Provider APIs
- `ALLOWED_ORIGINS`: Comma-separated CORS origins
- `FUNCTION_REGION`: Firebase region (default: us-central1)

Assets expected in `functions/assets/`:
- `constitution.pdf`, `model_pack.json`: Hashed for verification
- `vo_logo.png`: Used in PDF seals
- `rules/`: Directory auto-scanned for rule files

## Development Workflow

### Local Development
```bash
cd verum-web/verum-web/functions
npm install
# Firebase emulators for local testing
firebase emulators:start --only functions
```

### Deployment
```bash
firebase deploy --only functions
```

## API Conventions

### Error Handling
Always return structured JSON with `ok: false` and `error` field:
```javascript
res.status(400).json({ ok: false, error: "invalid_hash" });
```

### Hash Validation
SHA-512 hashes must match: `/^[a-f0-9]{64,}$/`

### Content-Type Flexibility
`/v1/seal` accepts both JSON and multipart/form-data for file uploads.

## Security Features

- **Helmet** with CSP disabled for cross-origin resources
- **CORS allowlist** with localhost fallbacks for development
- **Circuit breaker** prevents cascade failures on external APIs
- **HTTP keep-alive agents** for connection pooling

## Testing Approach

Use the `/health` endpoint to verify deployment. The API is designed to be **completely stateless** except for optional receipt caching.

## Common Gotchas

1. **Asset missing**: `config.js` gracefully handles missing assets with "missing" hash
2. **Receipt regeneration**: If no cached receipt exists, `/v1/receipt` creates unsigned placeholder
3. **PDF streaming**: `/v1/seal` uses filesystem for temporary PDF files (auto-cleanup)
4. **Function naming**: Firebase function is exported as `api2` (referenced in `firebase.json`)