# Keystone — Trustless Milestone Payments for Freelance Work

**Tagline:** *Keystone — trustless milestone payments for freelance work, built on Stellar.*

## Wallet Setup Note (Testnet)
To interact with this dApp (once running):
1. Install the [Freighter browser extension](https://www.freighter.app/).
2. Create a wallet and save your recovery phrase.
3. Switch the network within Freighter to **Testnet**.
4. Fund your account using the Stellar Testnet [Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

## Troubleshooting
**Note:** If `cargo test` fails with a `CryptoRng`/`ed25519-dalek` trait error resulting from loose SDK dependencies resolving dual versions, run this command to pin it and unify the tree:
```bash
cargo update -p ed25519-dalek --precise 2.2.0
```

## Security Note: Permissionless Execution
Because `distribute_milestone` restricts token fallback flows exclusively to the cryptographically locked destination paths stored directly natively in the contract state, we designed this endpoint inherently permissionless — allowing any party (crank or network actor) to trigger the resolution flawlessly without natively introducing any asset vulnerabilities.

## Live Testnet Deployment Configuration
The Keystone architecture successfully maps its atomic Capital Flows across a 3-hop hierarchy. The current verified network execution targets for live UI integration on Testnet are below:

**Contract Workspace Identifiers**
- **Escrow Contract:** `CBZ472YIFAPH3MMP25AWKS53CVI3JVHSEJDOGBAWSPWJ6WFNNOMHL3VC`
- **Fee Router:** `CBYVRXSCGOIMIN746C77BYEV2QKNVP6RA4JC5TTHED4JX7C6SQQ6SZ47`
- **Payout:** `CCD5UJQEE2K7M3CATACJ5QOUZTW6V2EX54QKNROIRD423HL6OKFX5ZHA`

**Network Asset Bindings**
- **Wrapped XLM Asset ID:** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

**E2E Output Transaction Example (`distribute_milestone`)**
- **Job ID:** `1`
- **Milestone ID:** `1`
- **Confirmation Hash:** [756f329eac01ae2dde71936b1577365cf3cd595552356b8d4378938eb677cc8e](https://stellar.expert/explorer/testnet/tx/756f329eac01ae2dde71936b1577365cf3cd595552356b8d4378938eb677cc8e)  
*(Executing verifiable state mutations bridging the Escrow to the Fee-Router, unlocking 2% to the Platform target and explicitly routing the final 98% smoothly down through Payout natively into the Freelancer Node!)*
