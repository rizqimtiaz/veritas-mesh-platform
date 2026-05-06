"use client"

import { create } from "zustand"
import type { AuditReceipt } from "@/lib/crypto-utils"

export type JobStatus =
  | "idle"
  | "routing"
  | "computing"
  | "verifying"
  | "complete"
  | "failed"

export type ModelKind = "text" | "image"

export interface InferenceJob {
  id: string
  prompt: string
  modelId: string
  modelKind: ModelKind
  status: JobStatus
  workerNodeId?: string
  output?: string
  receipt?: AuditReceipt
  txHash?: string
  blockNumber?: number
  verified?: boolean
  createdAt: number
  completedAt?: number
  /** Human-readable system log lines, appended as the job progresses */
  log: string[]
}

export interface MeshStats {
  totalInferences: number
  verifiedInferences: number
  activeNodes: number
  avgLatencyMs: number
  l2BlockHeight: number
}

interface MeshState {
  walletConnected: boolean
  walletAddress?: string
  activeJobId?: string
  jobs: InferenceJob[]
  stats: MeshStats

  connectWallet: () => void
  disconnectWallet: () => void

  startJob: (input: { prompt: string; modelId: string; modelKind: ModelKind }) => string
  setJobStatus: (id: string, status: JobStatus) => void
  appendLog: (id: string, line: string) => void
  completeJob: (
    id: string,
    payload: {
      output: string
      workerNodeId: string
      receipt: AuditReceipt
      txHash: string
      blockNumber: number
      verified: boolean
    },
  ) => void
  failJob: (id: string, reason: string) => void
  clearJobs: () => void

  tickStats: () => void
}

function rid(): string {
  return `job_${Math.random().toString(36).slice(2, 10)}`
}

export const useMeshStore = create<MeshState>((set, get) => ({
  walletConnected: false,
  walletAddress: undefined,
  activeJobId: undefined,
  jobs: [],
  stats: {
    totalInferences: 14_829,
    verifiedInferences: 14_811,
    activeNodes: 247,
    avgLatencyMs: 412,
    l2BlockHeight: 18_421_337,
  },

  connectWallet: () => {
    const addr =
      "0x" +
      Array.from({ length: 40 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("")
    set({ walletConnected: true, walletAddress: addr })
  },

  disconnectWallet: () => set({ walletConnected: false, walletAddress: undefined }),

  startJob: ({ prompt, modelId, modelKind }) => {
    const id = rid()
    const job: InferenceJob = {
      id,
      prompt,
      modelId,
      modelKind,
      status: "routing",
      createdAt: Date.now(),
      log: [
        `[${new Date().toISOString()}] >> INFERENCE_REQUEST received`,
        `[${new Date().toISOString()}] >> model=${modelId} kind=${modelKind}`,
        `[${new Date().toISOString()}] >> routing to nearest available worker node…`,
      ],
    }
    set((s) => ({
      jobs: [job, ...s.jobs].slice(0, 50),
      activeJobId: id,
    }))
    return id
  },

  setJobStatus: (id, status) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, status } : j)),
    })),

  appendLog: (id, line) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? { ...j, log: [...j.log, `[${new Date().toISOString()}] ${line}`] }
          : j,
      ),
    })),

  completeJob: (id, payload) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "complete",
              completedAt: Date.now(),
              ...payload,
            }
          : j,
      ),
      stats: {
        ...s.stats,
        totalInferences: s.stats.totalInferences + 1,
        verifiedInferences:
          s.stats.verifiedInferences + (payload.verified ? 1 : 0),
        l2BlockHeight: s.stats.l2BlockHeight + 1,
      },
    })),

  failJob: (id, reason) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "failed",
              completedAt: Date.now(),
              log: [
                ...j.log,
                `[${new Date().toISOString()}] !! FAILED: ${reason}`,
              ],
            }
          : j,
      ),
    })),

  clearJobs: () => set({ jobs: [], activeJobId: undefined }),

  tickStats: () =>
    set((s) => ({
      stats: {
        ...s.stats,
        l2BlockHeight: s.stats.l2BlockHeight + 1,
        activeNodes:
          s.stats.activeNodes + (Math.random() > 0.5 ? 1 : -1),
        avgLatencyMs: Math.max(
          120,
          Math.min(900, s.stats.avgLatencyMs + (Math.random() * 40 - 20)),
        ),
      },
    })),
}))
