import { InferenceTerminal } from "@/components/inference-terminal"
import { VerifiedFeed } from "@/components/verified-feed"
import { MeshStats } from "@/components/mesh-stats"
import { ShieldCheck, Zap } from "lucide-react"

export default function Page() {
  return (
    <div className="grid-bg">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        {/* Hero band */}
        <section className="relative overflow-hidden border border-border bg-card p-6 md:p-8">
          <div className="absolute inset-0 -z-10 grid-bg opacity-60" />
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-gradient-to-l from-amber/10 to-transparent md:block" />

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-amber">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber pulse-amber" />
                DePIN · PROTOCOL v0.1.4 · BETA
              </div>
              <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                Auditable AI inference, <br />
                cryptographically guaranteed.
              </h1>
              <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                Veritas Mesh routes inference to a decentralized GPU network and
                attests every output with a SHA-256 Audit Receipt + zero-knowledge
                Proof-of-Inference, anchored on Layer 2.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-[11px] uppercase tracking-widest md:items-end">
              <div className="flex items-center gap-2 border border-amber/60 bg-secondary px-3 py-1.5 text-amber">
                <ShieldCheck className="h-3.5 w-3.5" />
                Tamper-evident outputs
              </div>
              <div className="flex items-center gap-2 border border-border bg-background px-3 py-1.5 text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Sub-second L2 finality
              </div>
            </div>
          </div>
        </section>

        {/* Network telemetry */}
        <MeshStats />

        {/* Inference terminal */}
        <InferenceTerminal />

        {/* Verified feed */}
        <VerifiedFeed />
      </div>
    </div>
  )
}
