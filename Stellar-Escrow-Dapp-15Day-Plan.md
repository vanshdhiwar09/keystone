# Keystone — Trustless Milestone Payments for Freelance Work
### Full Project Context & 15-Day Build Plan · Orange Belt Submission (Stellar / Soroban)

**Tagline:** *Keystone — trustless milestone payments for freelance work, built on Stellar.*

**Naming note:** a keystone is the piece that locks a structure together until it's correctly placed — the same role this project's escrow plays with funds: locked until milestone conditions are met, then released. Use this line in your README intro and demo video opener; it gives judges an instant, memorable framing.

---

## 0. Instructions for AI Coding Agents (Antigravity, Claude Code, etc.)

If you are an AI agent reading this file to execute the build, follow these rules exactly:

1. **Work one day at a time.** Do not jump ahead to a later day's tasks until the human has reviewed and explicitly approved the current day's output. After completing a day's steps, stop and summarize what was done, then wait for confirmation before starting the next day.
2. **Use Plan mode (or equivalent plan-before-execute mode) for anything touching contract logic, deployment, or CI/CD** — i.e. Days 1–7, 12, 13. Only use Fast/auto mode for small, low-risk polish tasks (styling tweaks, copy edits, minor bug fixes).
3. **Never install a dependency, tool, CLI, or package — and never run an install/build/deploy command — without first telling the human:**
   - the exact command or dependency you intend to use,
   - the version it will install, and
   - whether you have verified this is the current/latest recommended version by checking official docs (e.g. `developers.stellar.org`, crates.io, npmjs.com) versus relying on training data.
   
   **Then wait for explicit confirmation from the human before running it.** This applies every time a new dependency is introduced or an existing one is upgraded — not just on Day 1. Stellar/Soroban tooling changes quickly (CLI naming, SDK versions, event APIs), so do not assume a remembered command is still correct.
4. **If a command fails or a package/API has clearly changed from what's described in this plan,** stop, explain the discrepancy, propose the corrected command after checking current docs, and get confirmation before proceeding — do not silently substitute your own guess.
5. **Surface Artifacts (screenshots, diffs, test output, plans) at the end of each day** so the human can verify progress without reading raw tool-call logs.
6. **Preserve the requirement mapping in Section 1.2** — if you ever propose a deviation from the plan (different architecture, skipped feature, etc.), explicitly state which checklist requirement(s) it affects before making the change.

---

---

## 1. Project Context — What You're Building and Why

### 1.1 The idea in plain language
Two parties — a **Client** and a **Freelancer** — agree on a job with one or more **milestones**. The Client deposits funds up front into a smart contract (escrow), so the Freelancer knows the money is real and locked. As each milestone is completed, the Freelancer submits it, the Client approves it, and the contract automatically releases the payment — splitting off a small platform fee first. If something goes wrong, either party can raise a dispute and funds stay locked until resolved.

This is a real product pattern (Upwork/Deel-style trust layer), not a toy counter app — which is exactly what "production-ready architecture" graders are looking for.

### 1.2 Why this satisfies *every* requirement, not just some
| Requirement from the brief | Where it lives in this project |
|---|---|
| Advanced smart contract development | 3 interacting Soroban contracts with real state machines |
| Inter-contract communication | Escrow → Fee Router → Payout (two real cross-contract calls) |
| Event streaming & real-time updates | Contract events (`MilestoneSubmitted`, `MilestoneApproved`, `FundsReleased`, `DisputeRaised`) polled by frontend and shown live |
| CI/CD pipeline setup | GitHub Actions: build + test on every push |
| Smart contract deployment workflow | Scripted `soroban contract deploy` to Testnet, addresses saved in README |
| Mobile responsive frontend | Next.js + Tailwind, tested at 375px |
| Error handling & loading states | Wallet errors, tx pending/failure states, insufficient balance handling |
| Writing tests (contract + frontend) | 8–10 Rust unit tests + Vitest component tests |
| Production-ready architecture | Env separation, clean repo structure, documented scripts |
| Documentation & demo | This plan becomes your README skeleton + a 1–2 min video |

### 1.3 The three contracts (mental model before you write code)

**Escrow Contract** — the core. Holds funds, owns the milestone state machine:
```
Created → Funded → Submitted → Approved → Released
                             → Disputed → (Resolved: Released or Refunded)
```

**Fee Router Contract** — a small, focused contract. When Escrow releases funds, it calls Fee Router instead of paying the freelancer directly. Fee Router splits the amount (e.g. 95% freelancer / 5% platform) and forwards accordingly. This is your first inter-contract call.

**Payout Contract** — Fee Router calls this to actually execute the freelancer-facing transfer and emit the final `FundsReleased` event. This is your second inter-contract call, and it's the contract that would be extended later (e.g. batching, multiple payees) — a nice thing to mention in your README as "designed for extension," which reads as production thinking.

Why split Payout from Fee Router at all, instead of one contract? Because it demonstrates a genuine separation of concerns (fee logic vs. payment execution) — which is exactly what "production-ready" and "advanced" mean to a grader, versus a single monolithic contract that does everything.

### 1.4 Tech stack (all Stellar-native)
- **Contracts:** Rust + `soroban-sdk`, compiled to `wasm32-unknown-unknown`
- **CLI/deploy:** Stellar CLI (`stellar` / `soroban` command — see Day 1 note on naming)
- **Network:** Stellar **Testnet** (Futurenet is deprecated territory now — use Testnet)
- **Wallet:** Freighter browser extension
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS
- **Chain connection:** `@stellar/stellar-sdk`
- **Contract tests:** Rust's built-in `#[test]` + `soroban-sdk`'s test utilities
- **Frontend tests:** Vitest + React Testing Library
- **CI/CD:** GitHub Actions
- **Hosting:** Vercel
- **Repo:** GitHub (public)

> **Important note before Day 1:** Anthropic's knowledge of exact current Soroban/Stellar CLI commands, package names, and SDK versions may be stale — Stellar tooling has moved fast (the CLI was renamed from `soroban` to `stellar` at one point, SDK versions shift). **On Day 1, before installing anything, search the current official Stellar developer docs (`developers.stellar.org`) to confirm exact install commands and current versions**, and swap them into the steps below. Treat the commands here as the right *shape* of what to do, verified against the live docs before you run them.

---

## 2. Repo Structure (target)

```
keystone/
├── contracts/
│   ├── escrow/
│   │   ├── src/lib.rs
│   │   ├── src/test.rs
│   │   └── Cargo.toml
│   ├── fee-router/
│   │   ├── src/lib.rs
│   │   ├── src/test.rs
│   │   └── Cargo.toml
│   └── payout/
│       ├── src/lib.rs
│       ├── src/test.rs
│       └── Cargo.toml
├── frontend/
│   ├── app/ (Next.js app router)
│   ├── components/
│   ├── lib/ (stellar-sdk helpers, event polling)
│   ├── tests/
│   └── package.json
├── scripts/
│   ├── deploy.sh
│   └── invoke-examples.sh
├── .github/workflows/
│   └── ci.yml
├── docs/
│   ├── architecture-diagram.png
│   └── screenshots/
├── README.md
└── Cargo.toml (workspace root)
```

---

## 3. The 15-Day Plan

### **Day 1 — Environment Setup + Repo Init**
Goal: everything installed, verified, and your first commits made.

1. Search `developers.stellar.org` for the current Rust/Stellar CLI install instructions (versions drift — don't rely on memory).
2. Install core tooling:
   - Rust via `rustup` (stable toolchain)
   - Add the WASM target: `rustup target add wasm32-unknown-unknown`
   - Stellar CLI (confirm exact install command from docs — historically `cargo install --locked stellar-cli` or via Homebrew)
   - Node.js (LTS) + npm/pnpm
3. Install **Freighter** wallet browser extension, create a wallet, switch it to **Testnet**, and fund it using the Stellar Testnet **Friendbot**.
4. Create the GitHub repo (public) named `keystone`, add a `.gitignore` for Rust + Node, add a placeholder README titled "Keystone — Trustless Milestone Payments for Freelance Work, built on Stellar."
5. Set up the Cargo workspace and three empty contract crates (`escrow`, `fee-router`, `payout`) using `stellar contract init` or manual `cargo new --lib` + Soroban boilerplate.
6. Commit: *"chore: initial repo structure and Soroban workspace scaffold"*
7. Commit: *"chore: add Freighter testnet wallet setup notes to README"*

**End of Day 1 checkpoint:** `cargo build` succeeds on all three empty crates; wallet is funded on Testnet.

---

### **Day 2 — Escrow Contract: Design + Storage**
1. Define the `Escrow` contract's data model in `lib.rs`:
   - `Job` struct: `client`, `freelancer`, `amount`, `status`, `milestone_id`
   - Status enum: `Created`, `Funded`, `Submitted`, `Approved`, `Disputed`, `Released`, `Refunded`
2. Implement storage functions (`set_job`, `get_job`) using Soroban's persistent storage.
3. Implement `create_job(client, freelancer, amount)`.
4. Write your **first unit test**: create a job, assert stored state is correct.
5. Commit: *"feat(escrow): job struct, storage, and create_job method"*
6. Commit: *"test(escrow): unit test for create_job"*

---

### **Day 3 — Escrow Contract: Fund + Submit + Approve**
1. Implement `fund_job` (transfer client's funds into escrow, require auth, move status `Created → Funded`).
2. Implement `submit_milestone` (freelancer-only, `Funded → Submitted`).
3. Implement `approve_milestone` (client-only, `Submitted → Approved`).
4. Add `require_auth()` checks on every state-changing call — this is what makes it "production-ready" vs. a toy contract.
5. Write 3 more unit tests covering these transitions, plus one negative test (e.g. freelancer tries to approve their own milestone — should fail).
6. Commit: *"feat(escrow): fund, submit, approve milestone flow"*
7. Commit: *"test(escrow): auth and state-transition tests"*

---

### **Day 4 — Escrow Contract: Dispute + Events**
1. Implement `raise_dispute` (either party, `Submitted/Approved → Disputed`).
2. Implement `resolve_dispute` (arbiter/client logic — decide and document your dispute resolution rule, e.g. client always initiates refund vs release for MVP).
3. Emit Soroban events at every transition: `MilestoneSubmitted`, `MilestoneApproved`, `DisputeRaised`.
4. Write 2 more tests: dispute flow + one edge case (double-submit rejected).
5. Commit: *"feat(escrow): dispute flow + event emission"*
6. Commit: *"test(escrow): dispute and edge-case tests"*

**End of Day 4 checkpoint:** Escrow contract has ~8 passing tests. This alone covers "3+ passing tests," but keep going — more tests strengthen the submission.

---

### **Day 5 — Fee Router + Payout Contracts (Inter-Contract Communication)**
1. Build `fee-router` contract: `route_payment(escrow_address, freelancer, amount)` — splits amount by a fee percentage constant (e.g. 5%).
2. Build `payout` contract: `execute_payout(recipient, amount)` — performs the actual transfer, emits `FundsReleased`.
3. Wire Fee Router to call Payout using Soroban's cross-contract call pattern (`env.invoke_contract`).
4. Wire Escrow's `release_funds` (on `Approved`) to call Fee Router — **this is your inter-contract communication requirement, fully implemented.**
5. Write tests: Fee Router split math (unit test with mock values), Payout transfer test.
6. Commit: *"feat(fee-router): payment splitting logic"*
7. Commit: *"feat(payout): payout execution + FundsReleased event"*
8. Commit: *"feat(escrow): wire release_funds to Fee Router (cross-contract call)"*
9. Commit: *"test(fee-router,payout): split and payout unit tests"*

**End of Day 5 checkpoint:** all 3 contracts compile, cross-contract call chain is proven by a test that simulates the full flow (fund → submit → approve → release → payout).

---

### **Day 6 — Buffer / Hardening Day for Contracts**
Use this day to catch up if Days 2–5 ran long (very likely on a first Soroban project). If on schedule:
1. Add input validation (reject zero/negative amounts, reject self-dealing where client == freelancer).
2. Add a `get_job_status` read-only view method for the frontend to query directly (in addition to events).
3. Refactor: pull repeated auth-check logic into a shared helper.
4. Commit: *"refactor(contracts): shared auth helpers + input validation"*
5. Commit: *"test: additional edge-case coverage"*

---

### **Day 7 — Deploy to Testnet**
1. Confirm current deploy commands against `developers.stellar.org` docs (don't trust memory here — this changes often).
2. Build all three contracts to WASM.
3. Deploy Payout first, then Fee Router (passing Payout's address as a constructor/init arg), then Escrow (passing Fee Router's address).
4. Run a manual end-to-end `invoke` sequence from the CLI: create job → fund → submit → approve → release, and confirm funds move and events emit.
5. **Save these for your README and submission checklist:**
   - All 3 contract addresses
   - The transaction hash from a real `release_funds` invocation
6. Write `scripts/deploy.sh` so the deployment is repeatable, not manual-only (this is what "deployment workflow" means, not just "I deployed it once").
7. Commit: *"chore(deploy): deploy script + testnet contract addresses"*
8. Commit: *"docs: record deployed addresses and sample tx hash"*

**End of Day 7 checkpoint:** you have real Testnet addresses and a real tx hash — two required checklist items done.

---

### **Day 8 — Frontend Scaffold + Wallet Connect**
1. `npx create-next-app` (TypeScript + Tailwind) inside `frontend/`.
2. Install `@stellar/stellar-sdk` and Freighter's connection API (`@stellar/freighter-api`).
3. Build a `ConnectWallet` component: detect Freighter, request connection, display connected address, handle "not installed" and "wrong network" states.
4. Build a basic layout (header, job list placeholder, mobile-first from the start — don't retrofit mobile later).
5. Commit: *"feat(frontend): Next.js scaffold + Freighter wallet connect"*
6. Commit: *"style(frontend): base layout, mobile-first structure"*

---

### **Day 9 — Frontend: Create + Fund Job Flow**
1. Build a "Create Job" form (client role): freelancer address, amount, submit → calls `create_job` then `fund_job` via `stellar-sdk`.
2. Build loading states: "Waiting for wallet signature…", "Submitting to network…", "Confirmed ✅".
3. Build error states: rejected signature, insufficient balance, network mismatch — each with a clear message, not a raw error dump.
4. Commit: *"feat(frontend): create + fund job flow with loading/error states"*

---

### **Day 10 — Frontend: Submit / Approve / Dispute Flow + Job Detail View**
1. Build the Job Detail page: shows current status, and role-appropriate action buttons (freelancer sees "Submit Milestone," client sees "Approve" / "Raise Dispute").
2. Wire each action to its contract call, with the same loading/error pattern from Day 9.
3. Finish the responsive pass across all pages at 375px, 768px, 1024px breakpoints — take your **mobile screenshot** here while it's fresh (checklist item).
4. Commit: *"feat(frontend): job detail view with milestone actions"*
5. Commit: *"style(frontend): responsive breakpoints finalized"*

---

### **Day 11 — Event Streaming (Real-Time Updates)**
1. Write a polling helper in `lib/events.ts` that queries Soroban RPC's `getEvents` for your Escrow contract's event topics on an interval (e.g. every 5s), or use a subscription pattern if the current SDK supports it (**check current docs — this API has evolved**).
2. Feed new events into a live "Activity Feed" component on the Job Detail page — new `MilestoneSubmitted` / `MilestoneApproved` / `FundsReleased` entries appear without a page refresh.
3. Add a subtle "live" indicator (pulsing dot) so it visibly reads as real-time in your demo video — this is a cheap, high-impact detail for judging.
4. Commit: *"feat(frontend): live event polling + activity feed"*

---

### **Day 12 — Frontend Tests + CI/CD Pipeline**
1. Write 3–5 Vitest/React Testing Library tests: wallet-not-connected state renders correctly, create-job form validation, status badge renders correct label per contract status.
2. Write `.github/workflows/ci.yml`:
   - Job 1: `cargo test --workspace` (all contract tests)
   - Job 2: `cargo build --target wasm32-unknown-unknown --release` (contracts actually build)
   - Job 3: `npm ci && npm run test && npm run build` (frontend)
3. Push and confirm the pipeline runs green in the Actions tab — **screenshot this** (checklist item).
4. Commit: *"test(frontend): component tests for wallet, form, status badge"*
5. Commit: *"ci: GitHub Actions pipeline for contracts + frontend"*

---

### **Day 13 — Deploy Frontend to Vercel + Error/Loading Polish**
1. Push env vars (contract addresses, network passphrase, RPC URL) into Vercel project settings — never hardcode them, this is a production-practice detail worth calling out in your README.
2. Deploy to Vercel, connect to your GitHub repo for auto-deploy on push (another "production-ready" checkbox). A URL like `keystone-escrow.vercel.app` or `keystone-app.vercel.app` keeps naming consistent for judges.
3. Full click-through on the live Vercel URL on both desktop and a real mobile device (or device emulation) — fix anything that breaks off localhost.
4. Take the **test-output screenshot** (terminal showing `cargo test` results with 3+ passing) and the **CI/CD screenshot** if not already done.
5. Commit: *"chore: production env config for Vercel deploy"*
6. Commit: *"fix: post-deploy polish and edge cases found on live testing"*

---

### **Day 14 — README + Demo Video**
1. Write the full README:
   - Project overview (adapt Section 1 of this doc)
   - Architecture diagram (simple boxes-and-arrows: Client → Escrow → Fee Router → Payout, with event emissions marked)
   - Setup/run instructions (local dev)
   - Deployed contract addresses + sample tx hash
   - Live demo link
   - Test instructions + screenshot
   - CI/CD screenshot
   - Tech stack list
2. Record a 1–2 minute demo video: show wallet connect → create/fund job → submit → approve → live event feed updates → funds released. Script it tightly; rehearse once before recording so it fits the time limit.
3. Upload video (YouTube unlisted or Loom), add link to README.
4. Commit: *"docs: complete README with architecture, setup, and demo links"*

---

### **Day 15 — Buffer, QA, Final Submission**
1. Walk the **entire submission checklist** line by line against your repo — literally tick each box:
   - [ ] Public GitHub repo
   - [ ] README complete
   - [ ] 10+ meaningful commits (you'll have well over this by now)
   - [ ] Live demo link works
   - [ ] Contract deployment address(es) listed
   - [ ] Transaction hash listed
   - [ ] Mobile responsive screenshot
   - [ ] CI/CD pipeline screenshot
   - [ ] Test output screenshot (3+ passing)
   - [ ] Demo video link (1–2 min)
2. Ask one other person (or reread cold yourself) to follow your README setup steps from scratch — fix anything confusing.
3. Final commit: *"docs: final polish and submission checklist verification"*
4. Submit.

---

## 4. Commit Cadence Sanity Check
The plan above naturally produces **25–30+ commits**, well above the 10+ minimum, and each one is a real, meaningful unit of work (not padding) — which itself signals genuine iterative development to anyone reviewing your commit history.

## 5. A Note on Keeping This Accurate
Stellar/Soroban tooling (CLI name, SDK package names, event-subscription APIs) changes faster than general blockchain tooling. Before Day 1 and again before Day 11 (event streaming), do a quick search of `developers.stellar.org` to confirm the exact current commands/APIs rather than relying on any cached knowledge — including mine. Everything else in this plan (architecture, sequencing, requirement mapping) will hold regardless of small tooling syntax changes.
