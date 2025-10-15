# Verum Omnis — Copilot instructions

Short, actionable guidance for AI coding agents working on the Verum Omnis Web API.

## Big picture (one-liner)
This repository implements a hash-first, stateless verification API as a Firebase function (Express app exported as `api2`).

## Key files to read first
- `functions/index.js` — main Express app, routes, consensus logic, circuit breaker, and Firebase export
- `functions/config.js` — env-driven configuration and asset hash calculation
- `functions/pdf/seal-template.js` — PDF generation (QR, watermark, temp file behavior)
- `functions/receipts-kv.js` — in-memory receipt cache (replaceable)
- `functions/openapi.yaml` and `firebase.json` — API surface and hosting rewrite to `api2`

## Important architecture notes
- All evidence is identified by SHA-512 hex strings. Validation regex: `/^[a-f0-9]{64,}$/`.
- Signing uses Ed25519; `VOSIGNINGKEY` may be PKCS8 PEM or a JWK JSON string (`importPKCS8` vs `importJWK`).
- OpenAI calls use a 3-model "triple consensus" with a simple Jaccard-like similarity and a 0.6 threshold; failures trigger a local circuit breaker.
- Rate limits: tight (30/min) for chat/anchor/seal, normal (300/15min) for other endpoints.

## Development & run commands
- Install and work in `functions/`:
```bash
cd verum-web/verum-web/functions
npm ci
```
- Local Firebase emulators (recommended for testing functions):
```bash
# install firebase-tools if needed
npx firebase-tools@latest emulators:start --only functions
```
- Deploy functions:
```bash
firebase deploy --only functions
```

## Common patterns & gotchas (do not change lightly)
- Responses use `{ ok: boolean, error?: string }` JSON structure; preserve this schema.
- `/v1/seal` writes a temp PDF to `/tmp` and streams it back; remove only after response finishes.
- `functions/config.js` computes asset hashes at startup; missing assets fall back to string "missing".
- `functions/receipts-kv.js` is intentionally in-memory for statelessness; persistent stores can be swapped in but be mindful of signatures and regeneration logic in `/v1/receipt`.

## External integrations
- OpenAI (via REST), Anthropic, and DeepSeek APIs — check `index.js` for per-provider differences (OpenAI uses triple consensus, others are proxied).
- Firebase functions runtime settings: region from `FUNCTION_REGION` (default `us-central1`) and exported function name `api2` (referenced in `firebase.json`).

## Safety & testing hints for agents
- When modifying signing or receipt behavior, run a smoke test against `/health`, `/v1/verify`, and `/v1/receipt`.
- Preserve existing error codes and messages when changing endpoints to avoid breaking clients.

If any section is unclear or you want more detail (examples, tests, or emulated run logs), tell me which part to expand.

# Try it (quick smoke checks)

1) Preferred: Firebase emulator (recommended)

```bash
# in functions/
npx firebase-tools@latest emulators:start --only functions
# in another terminal (assuming localhost:5001 for functions emulator)
curl -s http://localhost:5001/$PROJECT/us-central1/api2/health | jq
curl -s http://localhost:5001/$PROJECT/us-central1/api2/v1/verify | jq
```

Note: This repo does not include a `firebase.json` emulators section by default. Run `firebase init emulators` to create local emulator config if you want persistent emulator settings. If you cannot run the emulator, use the alternative below.

2) Alternative (quick JSON inspection)

If you don't run the emulator, you can still inspect computed manifest values locally by running small Node scripts that `import` `functions/config.js` and print values (example):

```js
// quick-inspect.mjs
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = await import(path.join(__dirname, 'functions', 'config.js'));
console.log({ CONSTITUTION_HASH: cfg.CONSTITUTION_HASH, MODELPACK_HASH: cfg.MODELPACK_HASH });
```

Run:
```bash
node --experimental-modules quick-inspect.mjs
```
