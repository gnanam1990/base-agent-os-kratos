# Kratos

> Adversarial contract stress-tester for Base — pays-per-scan, runs static/fuzz/symbolic analysis plus on-fork exploit templates, and records results on-chain.

![license](https://img.shields.io/badge/license-MIT-blue)

## Overview

Kratos is the "Base Agent OS" adversarial security agent. It exposes a paid HTTP API (gated by the x402 payment protocol) where callers submit a Solidity contract for an automated security review. Jobs are queued in Redis and consumed by an orchestrator that spins up forked Base mainnet nodes (Anvil) and runs a multi-stage analysis pipeline: static analysis, property fuzzing, symbolic execution, and a library of Foundry-based exploit templates. Results are aggregated into a Markdown report, optionally pinned to IPFS, and can be written on-chain to the `KratosRegistry` contract and attested via EAS.

This is an early-stage system. The core pieces are implemented, but the external analysis tools must be installed separately and the on-chain registry is not yet deployed (see [Status](#status)).

## Features

- **Paid scan API** — Hono HTTP server with tiered endpoints (`fast`, `standard`, `deep`) and a `monitor` subscription, gated per-route by x402 payment middleware on Base mainnet.
- **Job queue** — scan requests are pushed onto a Redis stream and processed by a separate orchestrator worker via consumer groups.
- **Fork pool** — a pool of forked Base mainnet Anvil nodes is warmed up and reused across jobs, with per-job state reset (`anvil_reset`).
- **Tiered analysis pipeline** — static analysis runs on every tier; fuzzing is added for `standard`/`deep`; symbolic execution is added for `deep`. Exploit templates run for all tiers.
- **Static analysis** (Python) — wraps Slither, Mythril, and 4naly3er and normalizes their output into a common finding schema.
- **Property fuzzing** (Python) — auto-generates Echidna property contracts from the target source and runs Echidna.
- **Symbolic execution** (Python) — auto-generates assertion harnesses and runs Halmos.
- **Exploit templates** — a Foundry test suite of common attack categories (reentrancy, oracle, access control, math, MEV, flash loans, cross-function, token, DoS, economic, misc) executed against the deployed target on a fork.
- **Finding aggregation** — dedupes findings across tools and sorts by severity and per-tool reliability weighting; produces a Markdown report with an executive summary and disclaimer.
- **On-chain registry** — `KratosRegistry` Solidity contract records audit results (target, source hash, severity, finding count, attestation UID, tier), restricted to an authorized agent wallet.
- **EAS attestation** — helpers to register a schema and attest audit results using the Ethereum Attestation Service on Base.
- **Block watcher** — subscribes to Base blocks and re-enqueues scan jobs for monitored targets until their subscription expires.

## Tech stack

- **API / services:** TypeScript, Hono, `x402-hono` + `@coinbase/x402`, Redis
- **Onchain interaction:** viem, ethers, `@ethereum-attestation-service/eas-sdk`
- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin (`Ownable`)
- **Analysis pipelines:** Python 3.11+, Pydantic, with external tools Slither, Mythril, 4naly3er, Echidna, and Halmos
- **Forking:** Anvil (Foundry)
- **Tooling:** pnpm workspaces, TypeScript, `tsx`, `execa`

## Architecture

This is a pnpm monorepo with several Solidity and Python sub-projects.

- `server/` — the public Hono API. Defines the x402-gated scan/monitor routes and enqueues jobs onto the `kratos:jobs` Redis stream.
- `orchestrator/` — the worker. Consumes jobs, manages the Anvil fork pool, runs the analysis pipeline, aggregates findings, uploads reports, and watches blocks for monitored targets.
- `packages/core/` — shared types and schemas (Zod), the `KratosRegistry` ABI, EAS constants/schema string, and small helpers.
- `packages/eas-attest/` — EAS attestation client and a schema-registration script.
- `pipelines/` — Python analysis modules (`static.py`, `fuzz.py`, `symbolic.py`, plus property generators), invoked by the orchestrator.
- `contracts/` — Foundry project containing `KratosRegistry.sol`, its tests, and the deploy script.
- `exploit-templates/` — standalone Foundry project of categorized exploit test templates run against the target on a fork.
- `ops/` — deployment metadata (`deployments.json`).

Flow: a paid request to `server` → job on the `kratos:jobs` Redis stream → `orchestrator` acquires a fork, runs the tiered pipeline → aggregated report pushed to the `kratos:results` stream and (optionally) pinned to IPFS / recorded on-chain.

## Getting started

### Prerequisites

- Node.js 18+ and pnpm 9 (`packageManager: pnpm@9.0.0`)
- Redis (reachable via `REDIS_URL`)
- Foundry (`forge`, `anvil`) on `PATH`
- Python 3.11+ for the analysis pipelines
- Optional external analysis tools, installed separately and on `PATH`: Slither, Mythril (`myth`), 4naly3er, Echidna, Halmos. Missing tools are skipped gracefully (their stage returns no findings).
- A Base mainnet RPC endpoint for forking

### Installation

```bash
pnpm install
git submodule update --init --recursive   # OpenZeppelin contracts for the Foundry build
```

### Configuration

Copy `.env.example` to `.env` and fill in the values. The project reads the following environment variables (names only — never commit real secrets):

| Variable | Purpose |
|----------|---------|
| `BASE_MAINNET_RPC` | Base mainnet RPC URL used for forking and onchain calls |
| `BASE_WS_RPC` | Base WebSocket RPC for the block watcher (defaults to a public endpoint) |
| `BASESCAN_API_KEY` | Block explorer API key for contract verification |
| `DEPLOYER_PK` | Private key used to deploy the registry / register the EAS schema |
| `AGENT_PK` | Agent private key (signs EAS attestations / schema registration) |
| `AGENT_WALLET` | Agent/payee address; required by the server to configure x402 payment gating |
| `KRATOS_REGISTRY_ADDR` | Deployed `KratosRegistry` address |
| `REDIS_URL` | Redis connection string used by the server, orchestrator, and watcher |
| `PORT_API` | Port the API server listens on (default `3000`) |
| `CDP_API_KEY_ID` | CDP facilitator API key id, required by the x402 middleware to verify/settle real payments |
| `CDP_API_KEY_SECRET` | CDP facilitator API key secret (paired with the key id) |
| `EAS_SCHEMA_UID_AUDIT` | EAS schema UID for audit attestations |
| `MAX_CONCURRENT_FORKS` | Maximum number of concurrent Anvil forks (default `4`) |
| `PINATA_JWT` | IPFS pinning token; if unset, reports return a placeholder URI |
| `IPFS_GATEWAY` | IPFS gateway base URL |
| `ETH_PRICE_USD` | ETH price reference used in reporting/pricing |
| `TELEGRAM_WEBHOOK` | Optional Telegram webhook for notifications |
| `CONSUMER_ID` | Orchestrator consumer name within the Redis consumer group (default `orch-1`) |

> Note: the server fails closed — it will not start without `AGENT_WALLET`. Without valid CDP facilitator credentials and `network: 'base'`, x402 would fall back to a testnet facilitator.

### Running

Install dependencies, then run the services (each in its own process):

```bash
# Build all TypeScript packages
pnpm build

# API server (in server/) — dev with watch:
pnpm --filter @kratos/server dev
# or production: pnpm --filter @kratos/server start

# Orchestrator worker (in orchestrator/):
pnpm --filter @kratos/orchestrator start
```

Contracts and exploit templates use Foundry directly:

```bash
# contracts/
forge build
forge test

# deploy the registry (requires DEPLOYER_PK and AGENT_WALLET in env)
forge script script/Deploy.s.sol:Deploy --rpc-url base --broadcast
```

Register the EAS schema (from `packages/eas-attest/`, requires `BASE_MAINNET_RPC` and `AGENT_PK`/`DEPLOYER_PK`):

```bash
tsx src/scripts/register-schema.ts
```

## Usage

The API exposes the following routes (paid routes are gated by x402):

| Method | Path | Price | Description |
|--------|------|-------|-------------|
| `GET`  | `/health` | free | Liveness/version check |
| `GET`  | `/openapi.json` | free | Minimal OpenAPI description |
| `POST` | `/api/scan/fast` | $50 | Static + exploit-template scan |
| `POST` | `/api/scan/standard` | $200 | Adds fuzzing |
| `POST` | `/api/scan/deep` | $500 | Adds symbolic execution |
| `POST` | `/api/monitor` | $1000 | Subscribe a target for ongoing block-based re-scans |
| `GET`  | `/api/jobs/:id` | free | Job status (not yet implemented) |
| `GET`  | `/api/audits/:target/:sourceHash` | free | Audit lookup (not yet implemented) |

A scan request body provides the contract `source`, an optional `contract_name`, and an optional `requester`; the response returns a `job_id` and `status: "queued"`. Results are published to the `kratos:results` Redis stream once the orchestrator finishes.

## Testing

- **Contracts:** `forge test` in `contracts/` (covers `KratosRegistry`). A gas snapshot is checked in.
- **Exploit templates:** `forge test` in `exploit-templates/`.

There is currently no JavaScript/TypeScript test suite; `pnpm test` is wired to run package-level tests but no package defines one yet. `pnpm typecheck` runs TypeScript checks across the workspace.

## Project structure

```
.
├── server/             # x402-gated Hono API; enqueues jobs
├── orchestrator/       # worker: fork pool, pipeline, reporter, block watcher
├── packages/
│   ├── core/           # shared types, ABI, EAS constants, helpers
│   └── eas-attest/     # EAS attestation client + schema registration
├── pipelines/          # Python static / fuzz / symbolic analysis
├── contracts/          # Foundry: KratosRegistry + deploy script + tests
├── exploit-templates/  # Foundry: categorized exploit test templates
└── ops/                # deployment metadata
```

## Status

Early-stage / pre-deployment. The API, orchestrator, fork pool, analysis pipeline wiring, contract, and exploit-template suite are implemented, but:

- The `KratosRegistry` contract and EAS schema are **not yet deployed**. `ops/deployments.json` contains placeholder addresses (`0xPLACEHOLDER`) and the registry is not yet wired into the report-completion path.
- The external analysis tools (Slither, Mythril, 4naly3er, Echidna, Halmos) must be installed separately; if absent, those stages return no findings.
- `GET /api/jobs/:id` and `GET /api/audits/:target/:sourceHash` return `not_implemented`.
- IPFS pinning requires `PINATA_JWT`; without it, reports get a placeholder URI.

Automated analysis is a first pass and not a substitute for a professional human security audit.

## License

MIT. See [LICENSE](LICENSE).
