# Relaxed execution preference to bypass standard error pipelines gracefully

Write-Host "=========================================="
Write-Host " Keystone Testnet Payload Network Standup "
Write-Host "=========================================="

Write-Host ""
Write-Host "[1/5] Bootstrapping Explicit Tooling Identities (Local CLI Config Only)"
stellar keys generate deployer --network testnet --fund 2>$null
stellar keys generate client --network testnet --fund 2>$null
stellar keys generate freelancer --network testnet --fund 2>$null
stellar keys generate arbiter --network testnet --fund 2>$null
stellar keys generate platform --network testnet --fund 2>$null

$DEPLOYER = stellar keys address deployer
$CLIENT = stellar keys address client
$FREELANCER = stellar keys address freelancer
$ARBITER = stellar keys address arbiter
$PLATFORM = stellar keys address platform

Write-Host " Deployer Exec Address: $DEPLOYER"

Write-Host ""
Write-Host "[2/5] Wrapping Native XLM Asset for Cross-Workspace Routing"
stellar contract asset deploy --asset native --network testnet --source-account deployer
$TOKEN_ADDR = stellar contract id asset --asset native --network testnet
Write-Host " XLM Wrapper Address: $TOKEN_ADDR"

Write-Host ""
Write-Host "[3/5] Compacting and Deploying Modular Workspaces"
$PAYOUT_ID = stellar contract deploy --wasm target/wasm32v1-none/release/payout.wasm --source-account deployer --network testnet
$ROUTER_ID = stellar contract deploy --wasm target/wasm32v1-none/release/fee_router.wasm --source-account deployer --network testnet
$ESCROW_ID = stellar contract deploy --wasm target/wasm32v1-none/release/escrow.wasm --source-account deployer --network testnet

Write-Host " PAYOUT:  $PAYOUT_ID"
Write-Host " ROUTER:  $ROUTER_ID"
Write-Host " ESCROW:  $ESCROW_ID"

Write-Host ""
Write-Host "[4/5] Initializing Nested Dependencies"
stellar contract invoke --id $PAYOUT_ID --source-account deployer --network testnet -- init_payout --fee_router $ROUTER_ID
stellar contract invoke --id $ROUTER_ID --source-account deployer --network testnet -- init_fee_router --platform $PLATFORM --escrow $ESCROW_ID --payout $PAYOUT_ID
stellar contract invoke --id $ESCROW_ID --source-account deployer --network testnet -- initialize --arbiter $ARBITER --fee_router $ROUTER_ID
Write-Host " Dependencies Dynamically Locked!"

Write-Host ""
Write-Host "[5/5] Executing E2E Physical Deployment Verification (1000 Stroops)"

$JOB_ID = stellar contract invoke --id $ESCROW_ID --source-account client --network testnet -- create_job --client $CLIENT --freelancer $FREELANCER --token $TOKEN_ADDR
$JOB_ID = $JOB_ID -replace """", ""
Write-Host " Job Successfully Defined. ID=$JOB_ID"

$MILESTONE_ID = stellar contract invoke --id $ESCROW_ID --source-account client --network testnet -- add_milestone --client $CLIENT --job_id $JOB_ID --amount 1000
$MILESTONE_ID = $MILESTONE_ID -replace """", ""
Write-Host " Milestone Successfully Generated. ID=$MILESTONE_ID"

Write-Host " > Funding Escrow Node..."
stellar contract invoke --id $ESCROW_ID --source-account client --network testnet -- fund_milestone --client $CLIENT --job_id $JOB_ID --milestone_id $MILESTONE_ID | Out-Null

Write-Host " > Freelancer Output Trigger..."
stellar contract invoke --id $ESCROW_ID --source-account freelancer --network testnet -- submit_milestone --freelancer $FREELANCER --job_id $JOB_ID --milestone_id $MILESTONE_ID | Out-Null

Write-Host " > Client Approval Routing..."
stellar contract invoke --id $ESCROW_ID --source-account client --network testnet -- approve_milestone --client $CLIENT --job_id $JOB_ID --milestone_id $MILESTONE_ID | Out-Null

Write-Host ""
Write-Host "=========================================="
Write-Host " DISTRIBUTING PHYSICAL NETWORK CAPITAL"
Write-Host "=========================================="
$DISTRIBUTION_OUTPUT = stellar contract invoke --id $ESCROW_ID --source-account client --network testnet -- distribute_milestone --job_id $JOB_ID --milestone_id $MILESTONE_ID 2>&1
Write-Host "Full CLI output (stdout + stderr):"
Write-Host $DISTRIBUTION_OUTPUT

$TX_HASH_LINE = $DISTRIBUTION_OUTPUT | Select-String -Pattern "hash" -SimpleMatch:$false
if ($TX_HASH_LINE) {
    Write-Host ""
    Write-Host "TRANSACTION HASH LINE FOUND:"
    Write-Host $TX_HASH_LINE
} else {
    Write-Host ""
    Write-Host "WARNING: No line containing 'hash' found in CLI output."
    Write-Host "Fallback: look up this contract's recent transactions on Stellar Expert:"
    Write-Host "https://stellar.expert/explorer/testnet/contract/$ESCROW_ID"
}
