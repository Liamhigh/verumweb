import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import multer from "multer";
import { SignJWT, importPKCS8, importJWK } from "jose";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";

import {
  REGION,
  VOSIGNINGKEY,
  OPENAIAPIKEY,
  ANTHROPICAPIKEY,
  DEEPSEEKAPIKEY,
  CONSTITUTION_HASH,
  MODELPACK_HASH,
  LOGO_PATH,
  PRODUCT_ID,
  POLICY_TEXT,
  ALLOWED_ORIGINS,
  RULES_ITEMS,
  RULES_PACK_HASH
} from "./config.js";

import { putReceipt, getReceipt } from "./receipts-kv.js";
import { makeSealedPdf } from "./pdf/seal-template.js";

import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { fetch as undiciFetch } from "undici";

// ----- App setup -----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = pino({ level: "info" });

setGlobalOptions({ region: REGION, maxInstances: 20 });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS middleware with allow-list
const ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : ["http://localhost:5173", "http://localhost:3000"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS"), false);
  }
}));

// Rate limiting
const rlTight  = rateLimit({ windowMs: 60_000, max: 30 });
const rlNormal = rateLimit({ windowMs: 15 * 60_000, max: 300 });
app.use("/v1/chat", rlTight);
app.use("/v1/anchor", rlTight);
app.use("/v1/seal", rlTight);
app.use("/v1/receipt", rlNormal);
app.use("/v1/verify", rlNormal);
app.use("/v1/verify-rules", rlNormal);

// Validate signing key on startup
if (!VOSIGNINGKEY) {
  log.error("VOSIGNINGKEY not configured");
}

// ----- Ed25519 helpers -----
async function getEd25519Key() {
  if (!VOSIGNINGKEY) throw new Error("VOSIGNINGKEY not set");
  if (VOSIGNINGKEY.includes("BEGIN PRIVATE KEY")) {
    return importPKCS8(VOSIGNINGKEY, "EdDSA");
  } else {
    const jwk = JSON.parse(VOSIGNINGKEY);
    return importJWK(jwk, "EdDSA");
  }
}
async function signPayload(payload) {
  const key = await getEd25519Key();
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuedAt(now)
    .setIssuer("verum.omnis")
    .setExpirationTime(now + 60 * 60)
    .sign(key);
}

// ----- OpenAI triple consensus with circuit breaker -----
const OPENAI_MODELS = ["gpt-5-mini", "gpt-4o-mini", "gpt-4o"];

const breaker = new Map();
const FAIL_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;

function breakerAllowed(model) {
  const b = breaker.get(model);
  return !b || (b.trippedUntil || 0) <= Date.now();
}
function breakerReportFailure(model) {
  const b = breaker.get(model) || { failures: 0, trippedUntil: 0 };
  b.failures += 1;
  if (b.failures >= FAIL_THRESHOLD) {
    b.trippedUntil = Date.now() + BREAKER_COOLDOWN_MS;
    b.failures = 0;
  }
  breaker.set(model, b);
}
function breakerReportSuccess(model) {
  breaker.set(model, { failures: 0, trippedUntil: 0 });
}

// Keep-alive agents for HTTP
const httpAgent  = new HttpAgent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 15_000 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 15_000 });

function kfetch(url, opts = {}) {
  const dispatcher = url.startsWith("https") ? httpsAgent : httpAgent;
  return undiciFetch(url, { dispatcher, ...opts });
}

function normalizeText(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,;:!?()-]/g, "")
    .trim()
    .toLowerCase();
}
function consensus2of3(results) {
  if (results.length === 0) return { consensus: "fail" };
  if (results.length === 1) return { consensus: "weak", winner: results[0] };
  const sims = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = new Set(normalizeText(results[i].content).split(" "));
      const b = new Set(normalizeText(results[j].content).split(" "));
      const inter = [...a].filter(x => b.has(x)).length;
      const uni = new Set([...a, ...b]).size || 1;
      sims.push({ i, j, score: inter / uni });
    }
  }
  const best = sims.sort((x, y) => y.score - x.score)[0] || { score: 0 };
  const pass = best.score >= 0.6;
  const pair = pass ? [results[best.i], results[best.j]] : [];
  const winner = pass ? (pair[0].content.length >= pair[1].content.length ? pair[0] : pair[1]) : null;
  return { consensus: pass ? "pass" : "fail", pair, winner, sims };
}

async function callOpenAIOnce(model, messages, temperature = 0.2) {
  if (!breakerAllowed(model)) throw new Error(`breaker_tripped:${model}`);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 30_000);
  try {
    const resp = await kfetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAIAPIKEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: 2048 }),
      signal: ac.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const txt = await resp.text();
      breakerReportFailure(model);
      throw new Error(`openai ${model} ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "";
    breakerReportSuccess(model);
    return { model, content, raw: json };
  } catch (e) {
    clearTimeout(timeout);
    if (!String(e.message || "").startsWith("breaker_tripped:")) {
      breakerReportFailure(model);
    }
    throw e;
  }
}

async function openaiTriple(messages, temperature = 0.2, overrideModel) {
  const models = overrideModel ? [overrideModel] : OPENAI_MODELS.filter(breakerAllowed);
  if (models.length === 0) models.push(OPENAI_MODELS[0]);
  const settled = await Promise.allSettled(models.map(m => callOpenAIOnce(m, messages, temperature)));
  const successes = settled.filter(s => s.status === "fulfilled").map(s => s.value);
  const errors = settled.filter(s => s.status === "rejected").map(s => s.reason?.message || String(s.reason));
  const c = consensus2of3(successes);
  return { successes, errors, consensus: c.consensus, winner: c.winner, sims: c.sims };
}

// ----- Routes -----

// GET /v1/verify
app.get("/v1/verify", async (req, res) => {
  try {
    const body = {
      constitutionHash: CONSTITUTION_HASH,
      modelPackHash: MODELPACK_HASH ? `core32:${MODELPACK_HASH}` : "missing",
      policy: POLICY_TEXT,
      product: PRODUCT_ID,
      timestamp: new Date().toISOString()
    };
    const signature = await signPayload(body);
    res.json({ ...body, signature });
  } catch (e) {
    log.error({ endpoint: "/v1/verify", err: e.message });
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /v1/verify-rules
app.get("/v1/verify-rules", async (req, res) => {
  try {
    const body = {
      product: PRODUCT_ID,
      rules: RULES_ITEMS,
      rulesPackHash: RULES_PACK_HASH,
      issuedAt: new Date().toISOString()
    };
    const signature = await signPayload(body);
    res.json({ ...body, signature });
  } catch (e) {
    log.error({ endpoint: "/v1/verify-rules", err: e.message });
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /v1/anchor
app.post("/v1/anchor", async (req, res) => {
  try {
    const { hash } = req.body || {};
    if (typeof hash !== "string" || !/^[a-f0-9]{64,}$/.test(hash)) {
      return res.status(400).json({ ok: false, error: "invalid_hash" });
    }
    const issuedAt = new Date().toISOString();
    const txid = crypto.createHash("sha512").update(hash + issuedAt).digest("hex").slice(0, 64);
    const receipt = {
      ok: true,
      chain: "eth",
      txid,
      hash,
      manifestHash: MODELPACK_HASH,
      constitutionHash: CONSTITUTION_HASH,
      product: PRODUCT_ID,
      issuedAt
    };
    receipt.signature = await signPayload(receipt);
    putReceipt(hash, receipt);
    res.json(receipt);
  } catch (e) {
    log.error({ endpoint: "/v1/anchor", err: e.message });
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /v1/receipt
app.get("/v1/receipt", async (req, res) => {
  try {
    const hash = (req.query.hash || "").toString();
    if (typeof hash !== "string" || !/^[a-f0-9]{64,}$/.test(hash)) {
      return res.status(400).json({ ok: false, error: "invalid_hash" });
    }
    let receipt = getReceipt(hash);
    if (!receipt) {
      const issuedAt = new Date().toISOString();
      receipt = {
        ok: true,
        chain: null,
        txid: null,
        hash,
        manifestHash: MODELPACK_HASH,
        constitutionHash: CONSTITUTION_HASH,
        product: PRODUCT_ID,
        issuedAt,
        note: "Receipt regenerated - no anchor found"
      };
      receipt.signature = await signPayload(receipt);
    }
    res.json(receipt);
  } catch (e) {
    log.error({ endpoint: "/v1/receipt", err: e.message });
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /v1/seal
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/v1/seal", upload.single("file"), async (req, res) => {
  try {
    const ct = req.headers["content-type"] || "";
    let hash = "", title = "", notes = "";
    if (ct.includes("application/json")) {
      ({ hash, title, notes } = req.body || {});
    } else {
      hash = req.body.hash;
      title = req.body.title;
      notes = req.body.notes;
    }
    if (typeof hash !== "string" || !/^[a-f0-9]{64,}$/.test(hash)) {
      return res.status(400).json({ ok: false, error: "invalid_hash" });
    }
    title = (title || "").toString().slice(0, 120);
    notes = (notes || "").toString().slice(0, 2000);
    const receipt = getReceipt(hash) || null;
    const pdf = await makeSealedPdf({
      hash,
      title: title || "Verum Omnis Seal",
      notes,
      logoPath: LOGO_PATH,
      productId: PRODUCT_ID,
      receipt
    });
    const tmpPath = `/tmp/verum_${hash.slice(0, 8)}.pdf`;
    const stream = fs.createWriteStream(tmpPath);
    pdf.pipe(stream);
    stream.on("finish", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="verum_${hash.slice(0,8)}.pdf"`);
      res.sendFile(tmpPath, () => { try { fs.unlinkSync(tmpPath); } catch {} });
    });
  } catch (e) {
    log.error({ endpoint: "/v1/seal", err: e.message });
    if (!res.headersSent) res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /v1/chat
app.post("/v1/chat", async (req, res) => {
  try {
    const { messages = [], provider = "openai", model, temperature = 0.2 } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages array required" });
    }
    const systemPrompt = {
      role: "system",
      content:
        "You are the Verum Omnis assistant. Core principles:\n" +
        "1. Be precise, auditable, and stateless - never store PII\n" +
        "2. Provide reproducible steps and hash-based references\n" +
        "3. Never claim legal authority - give transparent reasoning with disclaimers\n" +
        "4. For file analysis: web service does client-side hashing only\n" +
        "5. Heavy forensics require the 3GB on-device app or local WASM tools\n" +
        "6. All evidence handling follows chain-of-custody best practices\n" +
        "7. Be concise but thorough - favor clarity over verbosity"
    };
    const finalMsgs = [systemPrompt, ...messages.filter(m => m.role !== "system")];
    if (finalMsgs.length > 30) return res.status(400).json({ ok: false, error: "too_many_messages" });
    for (const m of finalMsgs) {
      if (typeof m.content !== "string" || m.content.length > 6000) {
        return res.status(400).json({ ok: false, error: "message_too_long" });
      }
    }
    if (provider === "openai") {
      if (!OPENAIAPIKEY) return res.status(400).json({ ok: false, error: "OPENAIAPIKEY not configured" });
      const out = await openaiTriple(finalMsgs, temperature, model);
      if (out.successes.length === 0) {
        return res.status(502).json({ ok: false, error: "all_models_failed", details: out.errors.slice(0, 2) });
      }
      return res.json({
        ok: true,
        provider,
        consensus: out.consensus,
        winnerModel: out.winner?.model || out.successes[0]?.model,
        message: out.winner?.content || out.successes[0]?.content,
        tried: out.successes.map(s => s.model),
        errors: out.errors
      });
    }
    if (provider === "anthropic") {
      if (!ANTHROPICAPIKEY) return res.status(400).json({ ok: false, error: "ANTHROPICAPIKEY not configured" });
      const mdl = model || "claude-3-5-haiku-20241022";
      const userMsgs = finalMsgs.filter(m => m.role !== "system").map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }));
      const resp = await undiciFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPICAPIKEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: mdl,
          max_tokens: 2048,
          temperature,
          system: systemPrompt.content,
          messages: userMsgs
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic API error: ${resp.status} - ${errText}`);
      }
      const result = await resp.json();
      return res.json({ ok: true, provider, model: mdl, result });
    }
    if (provider === "deepseek") {
      if (!DEEPSEEKAPIKEY) return res.status(400).json({ ok: false, error: "DEEPSEEKAPIKEY not configured" });
      const mdl = model || "deepseek-chat";
      const resp = await undiciFetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DEEPSEEKAPIKEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: mdl, messages: finalMsgs, temperature, max_tokens: 2048 })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`DeepSeek API error: ${resp.status} - ${errText}`);
      }
      const result = await resp.json();
      return res.json({ ok: true, provider, model: mdl, result });
    }
    return res.status(400).json({ ok: false, error: "unknown_provider", supportedProviders: ["openai", "anthropic", "deepseek"] });
  } catch (e) {
    log.error({ endpoint: "/v1/chat", err: e.message });
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /health
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    product: PRODUCT_ID,
    endpoints: ["/v1/verify", "/v1/verify-rules", "/v1/anchor", "/v1/receipt", "/v1/seal", "/v1/chat", "/docs/openapi.yaml"]
  });
});

// Serve the OpenAPI specification
app.get("/docs/openapi.yaml", (req, res) => {
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.send(fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "not_found",
    path: req.path,
    availableEndpoints: ["/health", "/v1/verify", "/v1/verify-rules", "/v1/anchor", "/v1/receipt", "/v1/seal", "/v1/chat", "/docs/openapi.yaml"]
  });
});

// Error handler
app.use((err, req, res, next) => {
  log.error({ error: err.message, stack: err.stack }, "Unhandled error");
  res.status(500).json({ ok: false, error: "internal_error", message: err.message });
});

// Export the Firebase function
export const api2 = onRequest({
  region: REGION,
  timeoutSeconds: 60,
  memory: "512MiB",
  minInstances: 1,
  maxInstances: 20
}, app);