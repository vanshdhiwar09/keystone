import {
    rpc,
    Networks,
    Contract,
    TransactionBuilder,
    xdr,
    Address,
    nativeToScVal,
    scValToNative
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
export const server = new rpc.Server(RPC_URL);

export const ESCROW_CONTRACT_ID = (process.env.NEXT_PUBLIC_ESCROW_ID || "").trim();
export const FEE_ROUTER_CONTRACT_ID = (process.env.NEXT_PUBLIC_FEE_ROUTER_ID || "").trim();
export const PAYOUT_CONTRACT_ID = (process.env.NEXT_PUBLIC_PAYOUT_ID || "").trim();
export const TOKEN_CONTRACT_ID = (process.env.NEXT_PUBLIC_TOKEN_ID || "").trim();
export const ARBITER_ID = (process.env.NEXT_PUBLIC_ARBITER_ID || "").trim();

export async function buildContractTransaction(
    sourcePublicKey: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[]
) {
    const account = await server.getAccount(sourcePublicKey);

    const contract = new Contract(contractId);
    const operation = contract.call(method, ...args);

    const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(operation)
        .setTimeout(30)
        .build();

    try {
        const preparedTx = await server.prepareTransaction(tx);
        return preparedTx;
    } catch (error: any) {
        const msg = error.message || String(error);
        console.error("Soroban Simulation Failed:", msg);

        if (method === "distribute_milestone" && msg.includes("Error(Contract")) {
            throw new Error("Distribution failed — check the transaction on Stellar Expert for details (Cross-Contract Error).");
        }

        if (msg.includes("Error(Contract, #1)")) {
            throw new Error("Action failed: Escrow sequence is already initialized natively.");
        } else if (msg.includes("Error(Contract, #2)")) {
            throw new Error("Action failed: Escrow constraints are not securely initialized yet.");
        } else if (msg.includes("Error(Contract, #11)")) {
            throw new Error("Action failed: Contract is not in the valid Status for this operation.");
        } else if (msg.includes("Error(Contract, #7)")) {
            throw new Error("Authorization failed: You are not the assigned Client.");
        } else if (msg.includes("Error(Contract, #8)")) {
            throw new Error("Authorization failed: You are not the assigned Freelancer.");
        } else if (msg.includes("Error(Contract, #6)")) {
            throw new Error("Authorization failed: Self-dealing is prohibited.");
        } else if (msg.includes("Error(Contract, #5)")) {
            throw new Error("Action failed: Invalid funding amount.");
        } else if (msg.includes("Error(Contract, #3)")) {
            throw new Error("Ledger failure: Original Job structure not found.");
        } else if (msg.includes("Error(Contract, #4)")) {
            throw new Error("Ledger failure: Original Milestone structure not found.");
        }

        throw new Error(`Simulation Failed: ${msg}`);
    }
}

export async function txCreateJob(clientPubKey: string, freelancerPubKey: string, tokenPubKey: string) {
    return await buildContractTransaction(
        clientPubKey,
        ESCROW_CONTRACT_ID,
        "create_job",
        [
            new Address(clientPubKey).toScVal(),
            new Address(freelancerPubKey).toScVal(),
            new Address(tokenPubKey || TOKEN_CONTRACT_ID).toScVal()
        ]
    );
}

export async function txAddMilestone(clientPubKey: string, jobId: number, amount: bigint) {
    return await buildContractTransaction(
        clientPubKey,
        ESCROW_CONTRACT_ID,
        "add_milestone",
        [
            new Address(clientPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            nativeToScVal(amount, { type: "i128" })
        ]
    );
}

export async function txFundMilestone(clientPubKey: string, jobId: number, milestoneId: number) {
    return await buildContractTransaction(
        clientPubKey,
        ESCROW_CONTRACT_ID,
        "fund_milestone",
        [
            new Address(clientPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId)
        ]
    );
}

export async function txSubmitMilestone(freelancerPubKey: string, jobId: number, milestoneId: number) {
    return await buildContractTransaction(
        freelancerPubKey,
        ESCROW_CONTRACT_ID,
        "submit_milestone",
        [
            new Address(freelancerPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId)
        ]
    );
}

export async function txApproveMilestone(clientPubKey: string, jobId: number, milestoneId: number) {
    return await buildContractTransaction(
        clientPubKey,
        ESCROW_CONTRACT_ID,
        "approve_milestone",
        [
            new Address(clientPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId)
        ]
    );
}

export async function txDistributeMilestone(callerPubKey: string, jobId: number, milestoneId: number) {
    return await buildContractTransaction(
        callerPubKey,
        ESCROW_CONTRACT_ID,
        "distribute_milestone",
        [
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId)
        ]
    );
}

export async function txRaiseDispute(callerPubKey: string, jobId: number, milestoneId: number) {
    return await buildContractTransaction(
        callerPubKey,
        ESCROW_CONTRACT_ID,
        "raise_dispute",
        [
            new Address(callerPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId)
        ]
    );
}

export async function txResolveDispute(callerPubKey: string, jobId: number, milestoneId: number, releaseFunds: boolean) {
    return await buildContractTransaction(
        callerPubKey,
        ESCROW_CONTRACT_ID,
        "resolve_dispute",
        [
            new Address(callerPubKey).toScVal(),
            xdr.ScVal.scvU32(jobId),
            xdr.ScVal.scvU32(milestoneId),
            xdr.ScVal.scvBool(releaseFunds)
        ]
    );
}

export async function fetchJobData(jobId: number, sourcePublicKey: string) {
    try {
        const account = await server.getAccount(sourcePublicKey);
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
            .addOperation(new Contract(ESCROW_CONTRACT_ID).call("get_job", xdr.ScVal.scvU32(jobId)))
            .setTimeout(30)
            .build();

        const sim = await server.simulateTransaction(tx);
        if (!rpc.Api.isSimulationSuccess(sim) || !sim.result || !sim.result.retval) return null;

        return scValToNative(sim.result.retval);
    } catch (e) {
        console.error("Soroban RPC Job Query Failed:", e);
        return null;
    }
}

export async function fetchMilestoneData(jobId: number, milestoneId: number, sourcePublicKey: string) {
    try {
        const account = await server.getAccount(sourcePublicKey);
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
            .addOperation(new Contract(ESCROW_CONTRACT_ID).call("get_milestone", xdr.ScVal.scvU32(jobId), xdr.ScVal.scvU32(milestoneId)))
            .setTimeout(30)
            .build();

        const sim = await server.simulateTransaction(tx);
        if (!rpc.Api.isSimulationSuccess(sim) || !sim.result || !sim.result.retval) return null;

        return scValToNative(sim.result.retval);
    } catch (e) {
        console.error("Soroban RPC Milestone Query Failed:", e);
        return null;
    }
}

export async function pollTx(hash: string, maxAttempts = 10): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
        const tx = await server.getTransaction(hash);
        if (tx.status === "SUCCESS") return tx;
        if (tx.status === "FAILED") throw new Error("Transaction execution failed on the ledger.");
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error("Transaction polling timed out continuously.");
}
