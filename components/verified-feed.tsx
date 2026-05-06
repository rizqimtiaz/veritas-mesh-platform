"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, ChevronRight, ImageIcon, Type } from "lucide-react"
import { useMeshStore } from "@/store/use-mesh-store"
import { shortHash } from "@/lib/crypto-utils"

interface FeedItem {
  id: string
  modelId: string
  modelKind: "text" | "image"
  receiptHash: string
  workerNodeId: string
  blockNumber: number
  ts: number
  source: "mesh" | "self"
}

const SAMPLE_MODELS = [
  { id: "veritas/llama-3.3-70b-instruct", kind: "text" as const },
  { id: "veritas/mistral-large-2411", kind: "text" as const },
  { id: "veritas/qwen3-32b", kind: "text" as const },
  { id: "veritas/sd3-medium", kind: "image" as const },
  { id: "veritas/flux-pro", kind: "image" as const },
]

const REGIONS = ["bse", "ord", "fra", "sgp", "sao", "tok", "lhr", "nyc"]

function fakeHash(prefix: string): string {
  const chars = "0123456789abcdef"
  let s = "0x"
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * 16)]
  return s
}

function makeSyntheticItem(): FeedItem {
  const m = SAMPLE_MODELS[Math.floor(Math.random() * SAMPLE_MODELS.length)]
  return {
    id: Math.random().toString(36).slice(2),
    modelId: m.id,
    modelKind: m.kind,
    receiptHash: fakeHash("r"),
    workerNodeId: `wn-${Math.random().toString(16).slice(2, 6)}-${
      REGIONS[Math.floor(Math.random() * REGIONS.length)]
    }`,
    blockNumber: 18_400_000 + Math.floor(Math.random() * 50_000),
    ts: Date.now() - Math.floor(Math.random() * 6000),
    source: "mesh",
  }
}

export function VerifiedFeed() {
  const jobs = useMeshStore((s) => s.jobs)
  const [items, setItems] = useState<FeedItem[]>(() =>
    Array.from({ length: 8 }, makeSyntheticItem).sort((a, b) => b.ts - a.ts),
  )

  // Stream synthetic verified inferences
  useEffect(() => {
    const t = setInterval(() => {
      setItems((prev) => [makeSyntheticItem(), ...prev].slice(0, 18))
    }, 3000 + Math.random() * 2500)
    return () => clearInterval(t)
  }, [])

  // Merge in user-submitted completed jobs at the top
  useEffect(() => {
    const userItems: FeedItem[] = jobs
      .filter((j) => j.status === "complete" && j.receipt && j.workerNodeId)
      .map((j) => ({
        id: j.id,
        modelId: j.modelId,
        modelKind: j.modelKind,
        receiptHash: j.receipt!.receiptHash,
        workerNodeId: j.workerNodeId!,
        blockNumber: j.blockNumber ?? 0,
        ts: j.completedAt ?? Date.now(),
        source: "self",
      }))

    setItems((prev) => {
      const existingIds = new Set(prev.map((p) => p.id))
      const fresh = userItems.filter((u) => !existingIds.has(u.id))
      if (fresh.length === 0) return prev
      return [...fresh, ...prev].slice(0, 18)
    })
  }, [jobs])

  return (
    <div id="feed" className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-2 text-amber">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-bold">Verified Inference Feed</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success pulse-amber" />
          LIVE · L2 BASE-SEPOLIA
        </div>
      </div>

      <div className="max-h-[540px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-normal">Type</th>
              <th className="px-4 py-2 text-left font-normal">Model</th>
              <th className="px-4 py-2 text-left font-normal">Receipt</th>
              <th className="hidden px-4 py-2 text-left font-normal md:table-cell">Worker</th>
              <th className="hidden px-4 py-2 text-left font-normal lg:table-cell">Block</th>
              <th className="px-4 py-2 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.tr
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -8, backgroundColor: "rgba(255,191,0,0.12)" }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255,191,0,0)" }}
                  transition={{ duration: 0.6 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-border/50 hover:bg-secondary/30"
                >
                  <td className="px-4 py-2">
                    {item.modelKind === "image" ? (
                      <span className="inline-flex items-center gap-1 text-amber">
                        <ImageIcon className="h-3 w-3" />
                        IMG
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Type className="h-3 w-3" />
                        TXT
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    <span className="text-muted-foreground">veritas/</span>
                    {item.modelId.replace("veritas/", "")}
                    {item.source === "self" && (
                      <span className="ml-2 border border-amber/60 px-1 py-0.5 text-[9px] text-amber">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-amber">
                    {shortHash(item.receiptHash, 6, 4)}
                  </td>
                  <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                    {item.workerNodeId}
                  </td>
                  <td className="hidden px-4 py-2 text-muted-foreground lg:table-cell">
                    #{item.blockNumber.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                      <ChevronRight className="h-3 w-3 opacity-50" />
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
