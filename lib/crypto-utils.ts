/**
 * Veritas Mesh — Cryptographic Utilities
 *
 * Generates and verifies "Audit Receipts" — deterministic SHA-256 commitments
 * over { modelId, modelWeightHash, inputHash, outputHash, workerNodeId, nonce }
 * which act as the off-chain witness for the on-chain VeritasRegistry contract.
 */

const enc = new TextEncoder()

/** Convert a hex string (no 0x) into a Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

/** Convert a Uint8Array (or ArrayBuffer) into a 0x-prefixed hex string */
export function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let out = "0x"
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0")
  }
  return out
}

/** Universal SHA-256 helper that works in both Node 20+ and the browser */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? enc.encode(data) : data
  // Web Crypto is available in Node 20+ globally and in all modern browsers.
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return bytesToHex(digest)
}

/** Truncate a hex hash for display: 0xabcd...1234 */
export function shortHash(hash: string, head = 6, tail = 4): string {
  if (!hash) return ""
  const h = hash.startsWith("0x") ? hash : `0x${hash}`
  if (h.length <= head + tail + 2) return h
  return `${h.slice(0, 2 + head)}…${h.slice(-tail)}`
}

export interface AuditReceiptInput {
  modelId: string
  modelWeightHash: string
  prompt: string
  output: string
  workerNodeId: string
  nonce: string
  timestamp: number
}

export interface AuditReceipt {
  modelId: string
  modelWeightHash: string
  inputHash: string
  outputHash: string
  workerNodeId: string
  nonce: string
  timestamp: number
  /** Final receipt commitment — what gets written on-chain */
  receiptHash: string
  /** Mock zero-knowledge proof commitment */
  zkProof: string
}

/**
 * Generate an Audit Receipt for an inference call.
 * The receipt commits to model weights + input + output and is the value
 * checked by VeritasRegistry.verifyProof on-chain.
 */
export async function generateAuditReceipt(
  input: AuditReceiptInput,
): Promise<AuditReceipt> {
  const inputHash = await sha256(input.prompt)
  const outputHash = await sha256(input.output)

  const commitment = [
    input.modelId,
    input.modelWeightHash,
    inputHash,
    outputHash,
    input.workerNodeId,
    input.nonce,
    String(input.timestamp),
  ].join("|")

  const receiptHash = await sha256(commitment)

  // Simulated ZK proof commitment — in production this would be a Groth16 / PLONK proof.
  const zkProof = await sha256(`zk:${receiptHash}:${input.workerNodeId}`)

  return {
    modelId: input.modelId,
    modelWeightHash: input.modelWeightHash,
    inputHash,
    outputHash,
    workerNodeId: input.workerNodeId,
    nonce: input.nonce,
    timestamp: input.timestamp,
    receiptHash,
    zkProof,
  }
}

/**
 * Re-derive the receipt commitment from its parts and compare to the claimed
 * receiptHash. Returns true iff the receipt is internally consistent
 * (i.e. nothing was tampered with after the worker signed it).
 */
export async function verifyAuditReceipt(receipt: AuditReceipt): Promise<boolean> {
  const commitment = [
    receipt.modelId,
    receipt.modelWeightHash,
    receipt.inputHash,
    receipt.outputHash,
    receipt.workerNodeId,
    receipt.nonce,
    String(receipt.timestamp),
  ].join("|")
  const expected = await sha256(commitment)
  return expected === receipt.receiptHash
}

/** Cryptographically random hex nonce, 16 bytes / 32 chars */
export function randomNonce(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return bytesToHex(buf)
}

/** Generate a fake but stable worker node id like "wn-7a3f-bse" */
export function generateWorkerNodeId(): string {
  const buf = new Uint8Array(2)
  crypto.getRandomValues(buf)
  const regions = ["bse", "ord", "fra", "sgp", "sao", "tok", "lhr", "nyc"]
  return `wn-${bytesToHex(buf).slice(2)}-${regions[buf[0] % regions.length]}`
}

/**
 * Simulated on-chain verification — would normally call
 * VeritasRegistry.verifyProof(receiptHash, zkProof) via viem/wagmi.
 */
export async function simulateOnChainVerification(
  receipt: AuditReceipt,
): Promise<{ verified: boolean; blockNumber: number; txHash: string }> {
  const verified = await verifyAuditReceipt(receipt)
  const txHash = await sha256(`tx:${receipt.receiptHash}:${Date.now()}`)
  return {
    verified,
    blockNumber: 18_000_000 + Math.floor(Math.random() * 50_000),
    txHash,
  }
}

// Re-export for callers that want the raw helpers
export const cryptoUtils = {
  sha256,
  bytesToHex,
  hexToBytes,
  shortHash,
  randomNonce,
  generateWorkerNodeId,
  generateAuditReceipt,
  verifyAuditReceipt,
  simulateOnChainVerification,
}
