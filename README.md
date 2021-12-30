# Veritas Mesh — DePIN for Auditable AI

> Cryptographically verifiable AI inference on a decentralized GPU network, anchored on Layer 2.

Veritas Mesh routes inference requests across a decentralized GPU mesh and attests
every output with a SHA-256 **Audit Receipt** + a zero-knowledge **Proof-of-Inference**.
The receipt is registered on-chain via the `VeritasRegistry` smart contract so any
client can verify, in O(1) gas, that:

1. The exact requested model was loaded (Merkle root over weights).
2. The inference was run on a registered, non-slashed worker node.
3. The output bytes were not tampered with after computation.

This codebase is the reference implementation: a Next.js 16 dashboard ("Command
Center"), an inference gateway API, the Solidity registry contract, and the
crypto utilities that bind them together.

---

## Stack

| Layer            | Tech                                                         |
| ---------------- | ------------------------------------------------------------ |
| Frontend         | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 |
| State            | Zustand                                                      |
| Animation        | Framer Motion                                                |
| Web3             | Viem (hashing + future on-chain calls)                       |
| Smart contract   | Solidity ^0.8.24 — gas-optimized, event-driven audit trail   |
| Validation       | Zod                                                          |

## Project layout

```
app/
  api/inference/route.ts     # Gateway: routes prompts to mesh + signs Audit Receipt
  layout.tsx                 # Root layout, fonts, metadata, navigation
  page.tsx                   # Command Center dashboard
  globals.css                # Terminal-Core theme (obsidian + neon amber)

components/
  mesh-navigation.tsx        # Sticky command bar with live block height + wallet
  inference-terminal.tsx     # Prompt input + animated system log
  verified-feed.tsx          # Real-time table of verified inferences
  mesh-stats.tsx             # Network telemetry cards

lib/
  crypto-utils.ts            # SHA-256, audit receipts, ZK-proof simulation

store/
  use-mesh-store.ts          # Zustand store: jobs, stats, wallet, lifecycle

contracts/
  VeritasRegistry.sol        # On-chain registry (Solidity ^0.8.24)
```

---

## How a request flows

```
        ┌────────────────┐                  ┌─────────────────────┐
USER ──▶│  /api/inference │ ─── routing ──▶ │  Mesh Worker (GPU)  │
        └────────────────┘                  └──────────┬──────────┘
                ▲                                      │ inference
                │  Audit Receipt + ZK Proof            ▼
                │                              ┌────────────────┐
                └─── verify on-chain ◀─────────│   L2 Registry  │
                                               │ submitAudit()  │
                                               └────────────────┘
```

1. Client `POST /api/inference` with `{ prompt, modelId, modelKind }`.
2. Gateway resolves the model weight hash, picks a worker, runs the inference.
3. Server hashes `model | weights | input | output | worker | nonce | ts` →
   produces a single `receiptHash` (this is the **Audit Receipt**).
4. A simulated ZK proof commits to the receipt.
5. The receipt + proof are submitted to `VeritasRegistry.submitAudit(...)`.
6. Anyone can call `verifyProof(receiptHash)` on-chain to confirm validity.

---

## Local development

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

The app works fully end-to-end without any external services — the L2 calls are
<!-- metadata: 4ljfrukkpv -->
<!-- metadata: djkdmftmsw -->
<!-- metadata: domr5sywrg -->
<!-- metadata: ilelk8rc31 -->
<!-- metadata: uhx5c4nn4b -->
<!-- metadata: xf2mnu5o04 -->
simulated by `lib/crypto-utils.ts` and `app/api/inference/route.ts`. To wire up
real on-chain submission, swap `simulateOnChainVerification` for a viem
`writeContract` call against your deployed `VeritasRegistry`.

### Production build

```bash
pnpm build
pnpm start
```

---

## Smart contract

`contracts/VeritasRegistry.sol` is the on-chain anchor. Key design choices:

- **Events as the audit trail** — heavy payload (`modelId`, `inputHash`,
  `outputHash`, `modelWeightHash`, `nonce`) is emitted via `AuditSubmitted` and
  indexed off-chain (TheGraph / Ponder), keeping per-call gas low (~50k).
- **Compact storage** — only `ReceiptStatus { exists, revoked, worker, ts }` is
  retained on-chain per receipt.
- **Pluggable verifier** — `IZKVerifier` lets you hot-swap Groth16, PLONK, or
  STARK verifiers without redeploying the registry.
- **Custom errors** instead of revert strings — saves ~50 gas per failure path.

Deploy with your preferred toolchain (Foundry / Hardhat). Example with Foundry:

```bash
forge create contracts/VeritasRegistry.sol:VeritasRegistry \
  --rpc-url $L2_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --constructor-args 0x0000000000000000000000000000000000000000
```

---

## Environment variables

This project runs without any env vars by default. To wire up real services,
copy `.env.example` to `.env.local` and fill in the values you need.

| Var                          | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_L2_RPC_URL`     | Public RPC endpoint for the L2 (e.g. Base Sepolia) |
| `NEXT_PUBLIC_REGISTRY_ADDR`  | Deployed `VeritasRegistry` address               |
| `MESH_GATEWAY_KEY`           | Server-side key for routing to a real GPU mesh   |

---

## Roadmap

- [ ] Wire viem `writeContract` to `submitAudit` for real on-chain attestation
- [ ] Replace stub inference with Akash / Render SDK
- [ ] Add Groth16 verifier contract under `contracts/verifiers/`
- [ ] Subgraph (Ponder) for the public Audit Feed
- [ ] Worker-side daemon (Rust) for attested-GPU inference

---

## License

MIT — see [`LICENSE`](./LICENSE).
