"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileSignature,
  Loader2,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react"
import { useMeshStore } from "@/store/use-mesh-store"
import { shortHash } from "@/lib/crypto-utils"

const MODELS = [
  { id: "veritas/llama-3.3-70b-instruct", label: "Llama 3.3 70B", kind: "text" as const },
  { id: "veritas/mistral-large-2411", label: "Mistral Large", kind: "text" as const },
  { id: "veritas/qwen3-32b", label: "Qwen3 32B", kind: "text" as const },
  { id: "veritas/sd3-medium", label: "SD3 Medium", kind: "image" as const },
  { id: "veritas/flux-pro", label: "FLUX Pro", kind: "image" as const },
]

const VERIFY_STEPS = [
  "Hashing input payload (SHA-256)…",
  "Routing to mesh worker via libp2p relay…",
  "Hashing model weights (Merkle root)…",
  "Worker computing inference on attested GPU…",
  "Generating Proof-of-Inference (Groth16)…",
  "Submitting Audit Receipt to L2 (Base Sepolia)…",
  "Verifying ZK-Proof against VeritasRegistry…",
]

export function InferenceTerminal() {
  const { jobs, activeJobId, startJob, appendLog, setJobStatus, completeJob, failJob } =
    useMeshStore()

  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState(MODELS[0].id)
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  const activeJob = useMemo(
    () => jobs.find((j) => j.id === activeJobId) ?? null,
    [jobs, activeJobId],
  )

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [activeJob?.log.length])

  const selectedModel = MODELS.find((m) => m.id === modelId) ?? MODELS[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || busy) return

    setBusy(true)
    const jobId = startJob({
      prompt: prompt.trim(),
      modelId: selectedModel.id,
      modelKind: selectedModel.kind,
    })

    try {
      // Simulated progressive log entries while the API runs
      setJobStatus(jobId, "routing")
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 280))
        appendLog(jobId, `>> ${VERIFY_STEPS[i]}`)
      }

      setJobStatus(jobId, "computing")
      const res = await fetch("/api/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          modelId: selectedModel.id,
          modelKind: selectedModel.kind,
        }),
      })

      appendLog(jobId, `>> ${VERIFY_STEPS[3]}`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.message || "Inference failed")

      setJobStatus(jobId, "verifying")
      for (let i = 4; i < VERIFY_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 320))
        appendLog(jobId, `>> ${VERIFY_STEPS[i]}`)
      }

      appendLog(
        jobId,
        `>> RECEIPT_HASH=${shortHash(data.receipt.receiptHash, 8, 6)}`,
      )
      appendLog(jobId, `>> WORKER_NODE=${data.workerNodeId}`)
      appendLog(
        jobId,
        `>> L2_TX=${shortHash(data.onchain.txHash, 8, 6)} BLOCK=#${data.onchain.blockNumber.toLocaleString()}`,
      )
      appendLog(
        jobId,
        data.onchain.verified
          ? `<< VERIFIED ✓ chain-of-custody intact`
          : `!! VERIFICATION FAILED — possible tampering detected`,
      )

      completeJob(jobId, {
        output: data.output,
        workerNodeId: data.workerNodeId,
        receipt: data.receipt,
        txHash: data.onchain.txHash,
        blockNumber: data.onchain.blockNumber,
        verified: data.onchain.verified,
      })
    } catch (err) {
      failJob(jobId, (err as Error).message)
    } finally {
      setBusy(false)
      setPrompt("")
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      {/* LEFT — Input panel */}
      <div className="flex flex-col border border-border bg-card">
        <PanelHeader icon={<Terminal className="h-3.5 w-3.5" />} label="INFERENCE_REQUEST">
          <span className="text-muted-foreground/80">/api/inference</span>
        </PanelHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Target Model
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  className={[
                    "border px-2 py-2 text-left text-[11px] uppercase tracking-wider transition",
                    modelId === m.id
                      ? "border-amber bg-secondary text-amber"
                      : "border-border bg-background text-muted-foreground hover:border-amber/40 hover:text-foreground",
                  ].join(" ")}
                >
                  <div className="text-[9px] opacity-70">[{m.kind}]</div>
                  <div className="truncate">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Prompt Payload
            </label>
            <div className="relative flex flex-1 flex-col">
              <span className="pointer-events-none absolute left-3 top-3 text-amber">{">"}</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="describe an output to commit on-chain…"
                rows={6}
                className="min-h-[140px] w-full resize-none border border-border bg-background py-3 pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-amber focus:outline-none"
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success pulse-amber" />
              MESH ONLINE · 247 NODES
            </div>
            <button
              type="submit"
              disabled={busy || !prompt.trim()}
              className="group flex items-center gap-2 border border-amber bg-amber px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-[#ffc933] disabled:cursor-not-allowed disabled:border-border disabled:bg-secondary disabled:text-muted-foreground"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Computing…
                </>
              ) : (
                <>
                  Submit to Mesh
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT — System log + result */}
      <div className="flex flex-col border border-border bg-card">
        <PanelHeader
          icon={<FileSignature className="h-3.5 w-3.5" />}
          label="SYSTEM_LOG"
        >
          {activeJob ? (
            <StatusBadge status={activeJob.status} />
          ) : (
            <span className="text-muted-foreground/80">awaiting request</span>
          )}
        </PanelHeader>

        <div className="relative flex-1">
          {busy && <div className="scan-line absolute inset-0 z-20" />}
          <div
            ref={logRef}
            className="relative z-10 h-full max-h-[420px] min-h-[300px] overflow-y-auto bg-background p-4 text-[11px] leading-relaxed text-muted-foreground"
          >
            {!activeJob && (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground/60">
                <div>
                  <Cpu className="mx-auto mb-2 h-6 w-6 text-amber" />
                  <p className="text-xs uppercase tracking-widest">
                    Submit an inference request to begin
                  </p>
                  <p className="mt-1 text-[10px]">
                    The mesh will route, compute & verify on-chain
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {activeJob?.log.map((line, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={[
                    "whitespace-pre-wrap font-mono",
                    line.includes("VERIFIED ✓") && "text-success",
                    line.includes("FAILED") || line.includes("!!") ? "text-destructive" : "",
                    line.includes(">>") && !line.includes("FAILED") && "text-foreground/80",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {line}
                </motion.div>
              ))}
            </AnimatePresence>

            {activeJob && busy && (
              <div className="mt-1 inline-block text-amber cursor-blink" />
            )}
          </div>
        </div>

        {/* Result block */}
        {activeJob?.status === "complete" && activeJob.output && (
          <div className="border-t border-border bg-secondary/40 p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Output
              </span>
              <span className="text-muted-foreground">
                receipt {shortHash(activeJob.receipt?.receiptHash ?? "", 6, 4)}
              </span>
            </div>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-xs text-foreground">
              {activeJob.output}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}

function PanelHeader({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-widest">
      <div className="flex items-center gap-2 text-amber">
        {icon}
        <span className="font-bold">{label}</span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    idle: { color: "text-muted-foreground", icon: null, label: "IDLE" },
    routing: {
      color: "text-amber",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "ROUTING",
    },
    computing: {
      color: "text-amber",
      icon: <Cpu className="h-3 w-3 animate-pulse" />,
      label: "COMPUTING",
    },
    verifying: {
      color: "text-amber",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "VERIFYING",
    },
    complete: {
      color: "text-success",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "VERIFIED",
    },
    failed: {
      color: "text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      label: "FAILED",
    },
  }
  const s = map[status] ?? map.idle
  return (
    <span className={`flex items-center gap-1.5 ${s.color}`}>
      {s.icon}
      {s.label}
    </span>
  )
}
