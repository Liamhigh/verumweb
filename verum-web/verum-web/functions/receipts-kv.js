// In-memory key/value store for receipts. This can be swapped for a persistent store
// if needed. For strict statelessness, you can remove this and always re-sign
// receipts on demand.
const kv = new Map();

export function putReceipt(hash, receipt) {
  kv.set(hash, receipt);
}

export function getReceipt(hash) {
  return kv.get(hash) || null;
}