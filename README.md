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
