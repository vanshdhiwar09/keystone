import {
    rpc,
    Networks,
    Contract,
    TransactionBuilder,
    Account,
    xdr,
    Address,
    nativeToScVal,
    scValToNative
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
export const server = new rpc.Server(RPC_URL);

// Helper to identify temporary/transient errors
function isTransientError(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err.error || err || "").toLowerCase();

    if (
        msg.includes("failed to fetch") ||
        msg.includes("network error") ||
        msg.includes("timeout") ||
        msg.includes("request failed") ||
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("429") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504") ||
        msg.includes("cors") ||
        msg.includes("networkerror")
    ) {
        return true;
    }

    const status = err.status || (err.response && err.response.status);
    if (status === 429 || status === 502 || status === 503 || status === 504) {
        return true;
    }

    return false;
}

// Global retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;
            const isTransient = isTransientError(error) || String(error.message || error).toLowerCase().includes("account not found");

            if (isTransient && attempt < maxAttempts) {
                const delay = Math.pow(2, attempt) * 500;
                if (
                    (typeof process !== "undefined" && process.env?.NODE_ENV === "development") ||
                    (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
                ) {
                    console.warn(`[RPC Retry ${attempt}/${maxAttempts}] ${label} failed with transient error: "${error.message || error}". Retrying in ${delay}ms...`);
                }
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error(`${label} failed after maximum retry attempts.`);
}

// Override server calls globally to add intercepting transient retries
const originalGetAccount = server.getAccount.bind(server);
server.getAccount = async function (address: string) {
    return await withRetry(
        () => originalGetAccount(address),
        `getAccount(${address})`
    );
};

const originalSimulateTransaction = server.simulateTransaction.bind(server);
server.simulateTransaction = async function (tx: any) {
    return await withRetry(
        () => originalSimulateTransaction(tx),
        "simulateTransaction"
    );
};

const originalPrepareTransaction = server.prepareTransaction.bind(server);
server.prepareTransaction = async function (tx: any) {
    return await withRetry(
        () => originalPrepareTransaction(tx),
        "prepareTransaction"
    );
};

const originalSendTransaction = server.sendTransaction.bind(server);
server.sendTransaction = async function (tx: any) {
    return await withRetry(
        () => originalSendTransaction(tx),
        "sendTransaction"
    );
};

const originalGetTransaction = server.getTransaction.bind(server);
server.getTransaction = async function (hash: string) {
    return await withRetry(
        () => originalGetTransaction(hash),
        `getTransaction(${hash})`
    );
};

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

const inFlightJobQueries = new Map<string, Promise<any>>();
const inFlightMilestoneQueries = new Map<string, Promise<any>>();

export async function fetchJobData(jobId: number, sourcePublicKey: string) {
    const key = `${jobId}-${sourcePublicKey}`;
    if (inFlightJobQueries.has(key)) {
        return inFlightJobQueries.get(key);
    }

    const promise = (async () => {
        try {
            // Read-only query builds Account directly
            const account = new Account(sourcePublicKey, "0");
            const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
                .addOperation(new Contract(ESCROW_CONTRACT_ID).call("get_job", xdr.ScVal.scvU32(jobId)))
                .setTimeout(30)
                .build();

            const sim = await server.simulateTransaction(tx);
            if (!rpc.Api.isSimulationSuccess(sim) || !sim.result || !sim.result.retval) return null;

            const job = scValToNative(sim.result.retval);
            if (!job) return null;

            const count = Number(job.milestone_count ?? 0);
            const promises = [];
            for (let i = 1; i <= count; i++) {
                promises.push(fetchMilestoneData(jobId, i, sourcePublicKey));
            }
            const milestones = await Promise.all(promises);

            return {
                ...job,
                milestones
            };
        } catch (e) {
            console.error("Soroban RPC Job Query Failed:", e);
            return null;
        } finally {
            inFlightJobQueries.delete(key);
        }
    })();

    inFlightJobQueries.set(key, promise);
    return promise;
}

export async function fetchMilestoneData(jobId: number, milestoneId: number, sourcePublicKey: string) {
    const key = `${jobId}-${milestoneId}-${sourcePublicKey}`;
    if (inFlightMilestoneQueries.has(key)) {
        return inFlightMilestoneQueries.get(key);
    }

    const promise = (async () => {
        try {
            const account = new Account(sourcePublicKey, "0");
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
        } finally {
            inFlightMilestoneQueries.delete(key);
        }
    })();

    inFlightMilestoneQueries.set(key, promise);
    return promise;
}

export async function pollTx(hash: string, maxAttempts = 10): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const tx = await server.getTransaction(hash);
            if (tx.status === "SUCCESS") return tx;
            if (tx.status === "FAILED") throw new Error("Transaction execution failed on the ledger.");
        } catch (e: any) {
            if (e.message && e.message.includes("failed on the ledger")) {
                throw e;
            }
            if (i === maxAttempts - 1) throw e;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error("Transaction polling timed out continuously.");
}

// ── Shared Job Status & Session Cache ──────────────────────────────────────────

export type JobStatus = "active" | "disputed" | "done";

export function getJobStatus(chainData: any): JobStatus {
    if (!chainData?.milestones) return "active";
    const statuses: string[] = chainData.milestones.map((m: any) => String(m?.status ?? "").toLowerCase());
    if (statuses.some(s => s.includes("dispute"))) return "disputed";
    if (statuses.every(s => s.includes("approve") || s.includes("release") || s.includes("refund"))) return "done";
    return "active";
}

const jobSessionCache = new Map<number, { chainData: any; status: JobStatus }>();

export function invalidateJobCache(jobId: number) {
    jobSessionCache.delete(jobId);
}

export async function fetchJobDataEnriched(jobId: number, sourcePublicKey: string, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = jobSessionCache.get(jobId);
        if (cached) return cached;
    }
    const chainData = await fetchJobData(jobId, sourcePublicKey);
    if (!chainData) {
        if (process.env.NODE_ENV === "development") {
            console.warn(`[Dev Only] fetchJobData returned null for jobId ${jobId}`);
        }
        return { chainData: null, status: "active" as JobStatus };
    }
    const status = getJobStatus(chainData);
    const result = { chainData, status };
    jobSessionCache.set(jobId, result);
    return result;
}

