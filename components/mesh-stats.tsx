"use client"

import { Activity, CircleCheck, Cpu, Gauge, Hash } from "lucide-react"
import { useMeshStore } from "@/store/use-mesh-store"

export function MeshStats() {
  const stats = useMeshStore((s) => s.stats)

  const verificationRate =
    stats.totalInferences > 0
      ? (stats.verifiedInferences / stats.totalInferences) * 100
      : 100

  const cards: {
    label: string
    value: string
    sub: string
    icon: React.ReactNode
    accent?: boolean
  }[] = [
    {
      label: "Total Inferences",
      value: stats.totalInferences.toLocaleString(),
      sub: "lifetime",
      icon: <Hash className="h-4 w-4" />,
    },
    {
      label: "Verification Rate",
      value: `${verificationRate.toFixed(2)}%`,
      sub: `${stats.verifiedInferences.toLocaleString()} verified`,
      icon: <CircleCheck className="h-4 w-4" />,
      accent: true,
    },
    {
      label: "Active Worker Nodes",
      value: stats.activeNodes.toString(),
      sub: "8 regions online",
      icon: <Cpu className="h-4 w-4" />,
    },
    {
      label: "Mesh Latency p50",
      value: `${stats.avgLatencyMs.toFixed(0)}ms`,
      sub: "route → compute → verify",
      icon: <Gauge className="h-4 w-4" />,
    },
    {
      label: "L2 Block Height",
      value: `#${stats.l2BlockHeight.toLocaleString()}`,
      sub: "base-sepolia",
      icon: <Activity className="h-4 w-4" />,
    },
  ]

  return (
    <div id="network" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={[
            "relative overflow-hidden border bg-card p-4",
            c.accent
              ? "border-amber/60 border-glow-amber"
              : "border-border hover:border-amber/40",
          ].join(" ")}
        >
          <div className="mb-3 flex items-center justify-between text-muted-foreground">
            <span className="text-[9px] uppercase tracking-widest">{c.label}</span>
            <span className={c.accent ? "text-amber" : ""}>{c.icon}</span>
          </div>
          <div
            className={[
              "font-mono text-xl font-bold tracking-tight md:text-2xl",
              c.accent ? "text-amber glow-amber" : "text-foreground",
            ].join(" ")}
          >
            {c.value}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
