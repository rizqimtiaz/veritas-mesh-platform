import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { MeshNavigation } from "@/components/mesh-navigation"

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Veritas Mesh // DePIN for Auditable AI",
  description:
    "A decentralized physical infrastructure network for cryptographically verifiable AI inference. Every output carries a tamper-proof Audit Receipt.",
  generator: "Veritas Mesh",
  keywords: [
    "DePIN",
    "AI",
    "Auditable AI",
    "Zero Knowledge Proofs",
    "Layer 2",
    "Decentralized GPU",
    "Proof of Inference",
  ],
}

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} dark bg-background`}>
      <body className="font-mono antialiased min-h-screen bg-background text-foreground">
        <div className="relative z-10 flex min-h-screen flex-col">
          <MeshNavigation />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/60 px-6 py-4 text-xs text-muted-foreground">
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 md:flex-row md:items-center">
              <span>
                <span className="text-amber">VERITAS MESH</span> v0.1.4 // L2 :
                BASE-SEPOLIA // BLOCK 0x{Math.floor(Date.now() / 1000).toString(16).toUpperCase()}
              </span>
              <span className="text-muted-foreground/70">
                © {new Date().getFullYear()} VERITAS PROTOCOL FOUNDATION
              </span>
            </div>
          </footer>
        </div>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
