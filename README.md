# Keystone — Trustless Multi-Milestone Escrow on Stellar

**Keystone** is a high-fidelity, trustless freelance escrow and payment routing platform built on the Stellar network (Soroban smart contracts). A keystone is the central piece that locks an arch structure together until it is structurally complete. This project acts exactly like that keystone: securing and locking milestone capital in secure smart contracts until freelancers submit deliverables and clients approve them, at which point funds are split-routed to platform fees and contractor accounts.

---

## 🔗 Submission Details & Checklist Reference

*   **Public GitHub Repository:** [https://github.com/vanshdhiwar09/keystone.git](https://github.com/vanshdhiwar09/keystone.git)
*   **Live Demo (Frontend):** [https://keystone-escrow.vercel.app](https://keystone-escrow.vercel.app) *(or your deployed Vercel URL)*
*   **Demo Video (1–2 minutes):** *[Insert Demo Video Link here]*
*   **Commits Log:** 15+ meaningful commits tracked in master branch history.

### On-Chain Testnet Addresses
*   **Escrow Contract:** `CBZ472YIFAPH3MMP25AWKS53CVI3JVHSEJDOGBAWSPWJ6WFNNOMHL3VC`
*   **Fee Router Contract:** `CBYVRXSCGOIMIN746C77BYEV2QKNVP6RA4JC5TTHED4JX7C6SQQ6SZ47`
*   **Payout Contract:** `CCD5UJQEE2K7M3CATACJ5QOUZTW6V2EX54QKNROIRD423HL6OKFX5ZHA`
*   **Stellar Testnet Asset ID (Wrapped XLM):** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
*   **Contract Interaction Transaction Hash (`distribute_milestone`):** `756f329eac01ae2dde71936b1577365cf3cd595552356b8d4378938eb677cc8e`

---

## 🛠️ Tech Stack & Architecture

### 1. Smart Contracts (`/contracts`)
*   **`escrow`**: Core state machine managing multi-milestone payments based on unique job IDs.
*   **`fee-router`**: Splits 2% platform fee and routes the remaining 98% milestone payout.
*   **`payout`**: Bridges routing instructions to transfer tokens via the Stellar Asset Contract (SAC).

### 2. Backend (`/backend`)
*   Node.js/Express service providing indexed metadata caching on Supabase. Uses cryptographic signature verification to ensure clients write metadata matching on-chain data.

### 3. Frontend (`/frontend`)
*   Next.js React app integrating Freighter Wallet. Polling-based block event polling tracks on-chain changes chronologically, resolving contract IDs to Supabase metadata.

---

## 🎨 Layout & Key Features

1.  **Chamber (Create Job):** Input validators track amounts and title limits. Offers user-friendly transaction stage notifications (*Preparing transaction...*).
2.  **Dashboard:** Live dashboard showing metrics (e.g., total volume, contract counts) dynamically based on user address (Client, Freelancer, or Arbitrator).
3.  **Milestone Timeline:** Interactive track mapping statuses (Draft, Funded, Submitted, Approved, Disputed, Released). Controls roles (Employer Approve vs Contractor Submit) and handles Freighter cancels safely.
4.  **Disputes Room:** Supports client-side pagination (5 items limit) with custom detail review logs.
5.  **Live Activity Feed:** Periodically polls Testnet for events, rendering them with SVG state icons. Clicking items navigates to job details.

---

## 🚀 Local Development Setup

### Prerequisite System Setup
1.  Install [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup).
2.  Configure [Freighter wallet browser extension](https://www.freighter.app/) to **Testnet** and claim test assets using [Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

### 1. Contract Build & Testing
```bash
# Unify cargo packages if version conflicts occur
cargo update -p ed25519-dalek --precise 2.2.0

# Run Rust contract tests
cargo test
```

### 2. Backend Server Setup
Create a `secrets.json` or configure the `.env` settings under `/backend`:
```bash
cd backend
npm install
npm run build
npm run dev
```

### 3. Frontend Next.js Setup
Create a `.env.local` inside `/frontend` matching:
```env
NEXT_PUBLIC_ESCROW_ID=CBZ472YIFAPH3MMP25AWKS53CVI3JVHSEJDOGBAWSPWJ6WFNNOMHL3VC
NEXT_PUBLIC_FEE_ROUTER_ID=CBYVRXSCGOIMIN746C77BYEV2QKNVP6RA4JC5TTHED4JX7C6SQQ6SZ47
NEXT_PUBLIC_PAYOUT_ID=CCD5UJQEE2K7M3CATACJ5QOUZTW6V2EX54QKNROIRD423HL6OKFX5ZHA
NEXT_PUBLIC_TOKEN_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_ARBITER_ID=GC66O7ANIHELSXEAJFF7ES7OMCSYQCMBJT4TESQTNSYJGF4KTP2XET2M
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```
Run development server:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 🔒 Security & Architecture Decisions
*   **Permissionless Execution:** Calling `distribute_milestone` is permissionless. Capital can only transfer to the addresses saved on-chain, preventing external exploiters from redirecting funds.
*   **Simulation Caching:** Read-only state retrieval simulates contract execution locally using mock wallets (`Account("GC66O...", "0")`) to fetch data without blocking sequence numbers.
*   **Query Deduplication:** Coalesces simultaneous frontend queries to prevent duplicate network calls.
