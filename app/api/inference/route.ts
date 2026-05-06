import { NextResponse } from "next/server"
import { z } from "zod"
import {
  generateAuditReceipt,
  generateWorkerNodeId,
  randomNonce,
  simulateOnChainVerification,
  sha256,
} from "@/lib/crypto-utils"

export const runtime = "nodejs"

const RequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  modelId: z.string().min(1).max(128),
  modelKind: z.enum(["text", "image"]),
})

/** Stable mock model registry — would be on-chain in production */
const MODEL_WEIGHTS: Record<string, string> = {
  "veritas/llama-3.3-70b-instruct":
    "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "veritas/mistral-large-2411":
    "0x4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  "veritas/qwen3-32b":
    "0xef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
  "veritas/sd3-medium":
    "0x6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "veritas/flux-pro":
    "0xd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
}

/** Stub "AI" output — in production this would route to an Akash/Render worker */
function generateMockOutput(prompt: string, modelKind: "text" | "image"): string {
  if (modelKind === "image") {
    // Deterministic mock URL — in real impl this would be an IPFS CID
    return `ipfs://bafy${Math.abs(hashStr(prompt)).toString(16).padStart(8, "0")}/inference.png`
  }
  const seeds = [
    "Verified by the mesh:",
    "Decentralized inference complete.",
    "Cross-node consensus achieved.",
    "Proof-of-Inference attested.",
  ]
  const seed = seeds[Math.abs(hashStr(prompt)) % seeds.length]
  return `${seed} The model received "${prompt.slice(0, 80)}${
    prompt.length > 80 ? "…" : ""
  }" and produced a deterministic response committed to the on-chain registry. Output schema v2.1 — content hash anchors this payload to block ${
    18_000_000 + (Math.abs(hashStr(prompt)) % 50_000)
  } on Base Sepolia.`
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const { prompt, modelId, modelKind } = parsed.data

    const modelWeightHash =
      MODEL_WEIGHTS[modelId] ?? (await sha256(`unknown:${modelId}`))
    const workerNodeId = generateWorkerNodeId()
    const nonce = randomNonce()
    const timestamp = Date.now()

    // Simulated network latency for the routing + computation phase
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 600))

    const output = generateMockOutput(prompt, modelKind)

    const receipt = await generateAuditReceipt({
      modelId,
      modelWeightHash,
      prompt,
      output,
      workerNodeId,
      nonce,
      timestamp,
    })

    // Simulated L2 verification
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 400))
    const onchain = await simulateOnChainVerification(receipt)

    return NextResponse.json({
      ok: true,
      output,
      workerNodeId,
      receipt,
      onchain,
    })
  } catch (err) {
    console.error("[v0] /api/inference error:", err)
    return NextResponse.json(
      { error: "INFERENCE_FAILED", message: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: "veritas-mesh-gateway",
    version: "0.1.4",
    network: "base-sepolia",
    models: Object.keys(MODEL_WEIGHTS),
  })
}
