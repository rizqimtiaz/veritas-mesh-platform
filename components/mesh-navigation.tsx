"use client"

import Link from "next/link"
import { Activity, Network, ScrollText, Wallet } from "lucide-react"
import { useEffect, useState } from "react"
import { useMeshStore } from "@/store/use-mesh-store"
import { shortHash } from "@/lib/crypto-utils"

export function MeshNavigation() {
  const { walletConnected, walletAddress, connectWallet, disconnectWallet, stats, tickStats } =
    useMeshStore()

  const [time, setTime] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => {
      setTime(new Date().toISOString().split("T")[1].split(".")[0] + "Z")
      tickStats()
    }, 1000)
    return () => clearInterval(t)
  }, [tickStats])

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative flex h-8 w-8 items-center justify-center border border-amber/60 bg-secondary">
            <div className="absolute inset-0 border-glow-amber opacity-60" />
            <span className="text-amber text-sm font-bold glow-amber">V</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Veritas
            </span>
            <span className="text-sm font-bold tracking-wider text-amber glow-amber">
              MESH//CMD
            </span>
          </div>
        </Link>

        {/* Center nav */}
        <nav className="hidden items-center gap-1 text-xs uppercase tracking-wider md:flex">
          <NavItem href="/" icon={<Activity className="h-3.5 w-3.5" />} label="Terminal" active />
          <NavItem href="/#feed" icon={<ScrollText className="h-3.5 w-3.5" />} label="Audit Feed" />
          <NavItem href="/#network" icon={<Network className="h-3.5 w-3.5" />} label="Mesh" />
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground lg:flex">
            <span>
              NODES{" "}
              <span className="text-amber">{stats.activeNodes}</span>
            </span>
            <span className="text-border">|</span>
            <span>
              BLK{" "}
              <span className="text-amber">
                #{stats.l2BlockHeight.toLocaleString()}
              </span>
            </span>
            <span className="text-border">|</span>
            <span>
              UTC <span className="text-amber">{mounted ? time : "--:--:--"}</span>
            </span>
          </div>

          <button
            onClick={() => (walletConnected ? disconnectWallet() : connectWallet())}
            className="group relative flex items-center gap-2 border border-amber/60 bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider text-amber transition hover:border-amber hover:bg-accent"
          >
            <span className="absolute inset-0 -z-10 opacity-0 transition group-hover:opacity-100 border-glow-amber" />
            <Wallet className="h-3.5 w-3.5" />
            <span>
              {walletConnected && walletAddress
                ? shortHash(walletAddress, 4, 4)
                : "Connect L2"}
            </span>
            {walletConnected && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-success pulse-amber" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 transition",
        active
          ? "text-amber border-b-2 border-amber"
          : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:border-border",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
