# Keystone

<!-- ADD: CI badge once GitHub Actions workflow is set up, e.g.
[![CI](https://github.com/<you>/keystone/actions/workflows/ci.yml/badge.svg)](https://github.com/<you>/keystone/actions/workflows/ci.yml)
-->

**Live app:** <!-- INSERT: Vercel production URL, e.g. https://keystone-escrow.vercel.app -->

**Escrow contract (Testnet):** `CBZ472YIFAPH3MMP25AWKS53CVI3JVHSEJDOGBAWSPWJ6WFNNOMHL3VC`

Trustless milestone escrow for freelance work on Stellar. Clients lock funds in a smart contract per milestone; freelancers get paid automatically on approval — no invoicing, no platform holding funds, and a neutral on-chain arbiter for disputes.

---

## Demo

| Resource | Link |
|---|---|
| Live app | <!-- INSERT: Vercel URL --> |
| Create job transaction | [Stellar Expert](https://stellar.expert/explorer/testnet/tx/756f329eac01ae2dde71936b1577365cf3cd595552356b8d4378938eb677cc8e) |
| Escrow contract | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBZ472YIFAPH3MMP25AWKS53CVI3JVHSEJDOGBAWSPWJ6WFNNOMHL3VC) |
| Fee Router contract | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBYVRXSCGOIMIN746C77BYEV2QKNVP6RA4JC5TTHED4JX7C6SQQ6SZ47) |
| Payout contract | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCD5UJQEE2K7M3CATACJ5QOUZTW6V2EX54QKNROIRD423HL6OKFX5ZHA) |
| Demo video (1–2 min) | <!-- INSERT: YouTube/Loom/Drive link --> |

Every on-chain action in the app links to Stellar Expert using this pattern:

```
https://stellar.expert/explorer/testnet/tx/{transaction_hash}
```

Example distribution transaction (Escrow → Fee Router → Payout → freelancer, full inter-contract chain):

```
https://stellar.expert/explorer/testnet/tx/756f329eac01ae2dde71936b1577365cf3cd595552356b8d4378938eb677cc8e
```

---

## Screenshots

### Mobile responsive UI
<!-- ADD: 2-3 screenshots at ~375px viewport width — Dashboard, Job Detail, Create Job -->
<!-- Example markdown once images exist:
| Dashboard | Job Detail | Create Job |
|---|---|---|
| ![Dashboard mobile](docs/screenshots/dashboard-mobile.png) | ![Job detail mobile](docs/screenshots/detail-mobile.png) | ![Create job mobile](docs/screenshots/create-mobile.png) |
-->

### CI/CD pipeline
<!-- ADD: screenshot of GitHub Actions run passing -->

### Test output
<!-- ADD: screenshot or pasted terminal output of `cargo test` showing 3+ passing tests -->

---

## Features

- Freighter wallet connect / disconnect, with network and installation state handling
- Multi-milestone job creation — one job, multiple milestones, each independently titled, described, and priced
- Deferred, per-milestone funding — client funds each milestone individually from the Job Detail view, not all upfront
- Full on-chain milestone lifecycle: `Created → Funded → Submitted → Approved → Released`, with a parallel `Disputed → Refunded` path
- Real inter-contract fund distribution: Escrow → Fee Router (98/2 split) → Payout → freelancer, three separate contracts, two cross-contract calls
- Neutral, contract-designated arbiter role for dispute resolution — distinct from both client and freelancer, resolves via `resolve_dispute`
- Off-chain job metadata (titles, descriptions) indexed via a signature-verified backend, cross-checked against on-chain ownership before being accepted
- Searchable, filterable contract Explorer
- Live activity feed via Soroban event polling
- Role-gated actions throughout — every button checks the connected wallet against the job's real on-chain client/freelancer/arbiter identity before rendering

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Wallet | Freighter (`@stellar/freighter-api`) |
| Chain | `@stellar/stellar-sdk`, Soroban RPC |
| Contracts | Rust, Soroban SDK |
| Backend | Express, TypeScript |
| Off-chain data | Supabase (Postgres) |
| Deployment | Vercel (frontend), <!-- INSERT: backend host, e.g. Railway/Render --> |

---

## Architecture

### Design principles

- **Funds on-chain, always** — every XLM moved is a real Soroban transaction; the backend never custodies funds or decides outcomes.
- **Metadata off-chain, verified** — job titles/descriptions live in Supabase for real search/filtering, but every write is signature-verified and cross-checked against on-chain job ownership before being accepted, so metadata can't be spoofed for jobs you don't own.
- **Three contracts, not one** — Escrow, Fee Router, and Payout are separate contracts with distinct responsibilities, communicating via real Soroban cross-contract calls, not internal function calls.
- **Neutral arbitration** — disputes are resolved by a designated arbiter address, distinct from both client and freelancer, avoiding the conflict of interest of self-arbitration.

### Contract architecture

```
Client funds milestone
        │
        ▼
  ┌───────────┐   distribute_milestone   ┌────────────┐   route_funds   ┌──────────┐
  │  Escrow   │ ───────────────────────▶ │ Fee Router │ ──────────────▶ │  Payout  │ ──▶ Freelancer (98%)
  └───────────┘                          └────────────┘                └──────────┘
        │                                        │
        │                                        └──▶ Platform (2%)
        ▼
  Disputed? → resolve_dispute (arbiter only) → Refund client OR proceed to distribute
```

### Milestone lifecycle

```
Created → Funded → Submitted → Approved → Released
             │          │          │
             └──────────┴──────────┴──▶ Disputed ──▶ Refunded (via arbiter)
                                                  └──▶ Approved (via arbiter) ──▶ Released
```

### Folder structure

```
keystone/
├── contracts/
│   ├── escrow/          # Job/milestone state machine, dispute logic
│   ├── fee-router/       # Platform fee split (98/2)
│   └── payout/           # Final freelancer-facing transfer
├── frontend/
│   ├── src/app/           # Next.js App Router pages
│   ├── src/components/    # Views (Dashboard, Blueprint/Explorer, Create, Terminal, Activity, Disputes)
│   ├── src/context/       # WalletContext, TransactionContext
│   └── src/lib/           # soroban.ts (contract calls), api.ts (backend calls)
├── backend/
│   ├── src/index.ts       # Express API — job metadata read/write, signature + on-chain verification
│   └── .env.example
├── scripts/
│   └── deploy.ps1         # Testnet deployment script
└── docs/
    └── screenshots/
```

---

## Smart contracts

### Escrow

| Function | Who calls | Effect |
|---|---|---|
| `initialize` | Deployer | Sets arbiter and Fee Router addresses |
| `create_job` | Client | Creates a job with client, freelancer, token |
| `add_milestone` | Client | Adds a milestone with an amount |
| `fund_milestone` | Client | Locks funds for a specific milestone |
| `submit_milestone` | Freelancer | Marks a milestone as submitted for review |
| `approve_milestone` | Client | Approves a submitted milestone |
| `raise_dispute` | Client or freelancer | Freezes a milestone pending arbitration |
| `resolve_dispute` | Arbiter only | Releases or refunds a disputed milestone |
| `distribute_milestone` | Anyone (permissionless trigger) | Releases approved funds through the Fee Router chain |
| `get_job` / `get_milestone` | Anyone | Read-only state queries |

### Fee Router

| Function | Who calls | Effect |
|---|---|---|
| `init_fee_router` | Deployer | Sets platform, Escrow, and Payout addresses |
| `route_funds` | Escrow only (self-authorizing) | Splits incoming funds 98% freelancer / 2% platform |

### Payout

| Function | Who calls | Effect |
|---|---|---|
| `init_payout` | Deployer | Sets trusted Fee Router address |
| `execute_payout` | Fee Router only (self-authorizing) | Executes the final freelancer-facing transfer |

Build and test:

```bash
cd contracts
cargo test --workspace
stellar contract build
```

<!-- CONFIRM: exact test count across all 3 contracts and paste final `cargo test` summary here -->

---

## Installation

### Prerequisites

- Node.js 20+ (frontend and backend both require this)
- Rust 1.84+ with `wasm32v1-none` target (for contracts only)
- Stellar CLI
- Freighter browser extension

```bash
rustup target add wasm32v1-none
```

### Setup

```bash
git clone <!-- INSERT: your repo URL -->
cd keystone

# Frontend
cd frontend
npm install
cp .env.example .env.local
# Fill in contract addresses, RPC URL, arbiter address — see below

# Backend
cd ../backend
npm install
cp .env.example .env
# Fill in Supabase URL/key and Escrow contract ID — must match frontend's value
```

### Environment variables

**`frontend/.env.local`:**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ESCROW_ID` | Yes | Deployed Escrow contract address |
| `NEXT_PUBLIC_ROUTER_ID` | Yes | Deployed Fee Router contract address |
| `NEXT_PUBLIC_PAYOUT_ID` | Yes | Deployed Payout contract address |
| `NEXT_PUBLIC_TOKEN_ID` | Yes | Wrapped native XLM asset contract address |
| `NEXT_PUBLIC_ARBITER_ID` | Yes | Designated arbiter's public address |
| `NEXT_PUBLIC_NETWORK` | No | `testnet` |
| `NEXT_PUBLIC_RPC_URL` | No | Soroban RPC URL (defaults to public Testnet RPC) |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API base URL |

**`backend/.env`:**

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Defaults to `4000` |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, never exposed to frontend) |
| `RPC_URL` | No | Soroban RPC URL |
| `NETWORK_PASSPHRASE` | No | Defaults to Testnet passphrase |
| `ESCROW_CONTRACT_ID` | Yes | Must exactly match `frontend/.env.local`'s `NEXT_PUBLIC_ESCROW_ID` |

### Development

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
cd frontend && npm run build && npm start
```

---

## Demo instructions

End-to-end walkthrough on Stellar Testnet:

### 1. Prepare wallets

- Install [Freighter](https://www.freighter.app/)
- Switch Freighter to Testnet
- Fund at least two accounts (client + freelancer) via Friendbot

### 2. Deploy contracts (if not using the addresses above)

```bash
cd scripts
./deploy.ps1
```

Copy the resulting contract addresses into both `.env` files.

### 3. Create a job (client wallet)

- Connect Freighter as the client
- Navigate to Create, fill in title, description, freelancer address, and one or more milestones
- Submit — approve each sequential Freighter signature prompt (one per milestone plus the on-chain creation call)
- Confirm the job appears on Dashboard

### 4. Fund and progress a milestone

- As client: open the job, click Fund Milestone on the first milestone
- Switch to freelancer wallet: click Submit Milestone
- Switch back to client: click Approve
- Either party: click Distribute Funds — confirm the freelancer's balance increases by the milestone amount minus the 2% platform fee

### 5. Dispute flow

- As client or freelancer: raise a dispute on a milestone
- Switch to the arbiter wallet: confirm Resolve options appear (and only for the arbiter — verify this explicitly with a non-arbiter wallet)
- Resolve by releasing or refunding

---

## Deployment

### Frontend (Vercel)

<!-- INSERT: production URL once deployed -->

1. Import the repo in Vercel
2. Framework preset: Next.js
3. Add all `NEXT_PUBLIC_*` environment variables listed above
4. Deploy

### Backend

<!-- INSERT: host used (Railway/Render/etc.) and URL -->

1. Deploy `backend/` as a standalone Node service
2. Set all backend environment variables
3. Update CORS origin in `backend/src/index.ts` to the production frontend URL
4. Update `NEXT_PUBLIC_BACKEND_URL` in Vercel to point to this deployed backend

### Contracts (Testnet)

Already deployed at the addresses listed above. To redeploy:

```bash
cd contracts
stellar contract build
cd ../scripts
./deploy.ps1
```

After redeploying, update **both** `frontend/.env.local` and `backend/.env` with the new addresses — they are independently maintained and must stay in sync manually.

---

## Testing

```bash
# Contracts
cd contracts
cargo test --workspace

# Frontend
cd frontend
npm run test          # <!-- CONFIRM: exact command and test count -->
```

<!-- CONFIRM: does a CI workflow exist yet? If not, this is a required checklist item — add
.github/workflows/ci.yml running: cargo test (contracts), cargo build --target wasm32v1-none
(contracts), and npm run build + any frontend tests. -->

---

## Known limitations

- Job discovery for Dashboard/Explorer depends on the backend's Supabase index rather than a fully generalized on-chain indexer — jobs only appear once their metadata has been registered through the normal Create Job flow.
- Dispute reasons are not yet captured as structured on-chain or off-chain data; the arbiter currently resolves based on off-app communication with both parties.
- Currently supports Freighter only; multi-wallet support (Albedo, xBull, etc. via Stellar Wallets Kit) is a natural next step.
- The public Testnet RPC endpoint is occasionally subject to brief availability hiccups; a production deployment would use a dedicated/paid RPC provider.

---

## Future improvements

- [ ] On-chain event indexer replacing the Supabase-assisted job discovery
- [ ] Structured dispute-reason capture, shown to the arbiter
- [ ] Multi-wallet support beyond Freighter
- [ ] Mainnet deployment guide
- [ ] Configurable platform fee percentage
- [ ] Notification system for milestone status changes

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run the full test suite before opening a PR
4. Open a pull request with a clear description