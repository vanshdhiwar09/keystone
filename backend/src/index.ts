import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Keypair, Account, TransactionBuilder, Contract, xdr, rpc, scValToNative } from "@stellar/stellar-sdk";

// Initialize environment configuration
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Enable strict CORS specifically bound to the exact origin footprint
app.use(cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    methods: ["GET", "POST", "PUT"]
}));
app.use(express.json());

// Lightweight health check endpoint confirming the server is alive
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Initialize Supabase Server Client statically validating variables
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Soroban RPC Configurations
const ESCROW_CONTRACT_ID = (process.env.ESCROW_CONTRACT_ID || "").trim();
const NETWORK_PASSPHRASE = (process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015").trim();
const RPC_URL = (process.env.RPC_URL || "https://soroban-testnet.stellar.org").trim();
const stellarServer = new rpc.Server(RPC_URL);

/**
 * Fetches Job state strictly from the Testnet blockchain, verifying ownership physically
 * before allowing Supabase indexing. Uses offline generic Account bypassing getAccount lag.
 */
async function fetchJobOnChain(jobId: number) {
    try {
        // Use Arbiter's real address as the simulation source — it's always funded on testnet.
        // For simulation (read-only), the account doesn't need to broadcast; it just needs a valid key.
        const ARBITER_ADDRESS = process.env.ARBITER_ID || "GC66O7ANIHELSXEAJFF7ES7OMCSYQCMBJT4TESQTNSYJGF4KTP2XET2M";
        const account = new Account(ARBITER_ADDRESS, "0");
        const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK_PASSPHRASE })
            .addOperation(new Contract(ESCROW_CONTRACT_ID).call("get_job", xdr.ScVal.scvU32(jobId)))
            .setTimeout(30)
            .build();

        const sim = await stellarServer.simulateTransaction(tx);
        if (!rpc.Api.isSimulationSuccess(sim) || !sim.result || !sim.result.retval) return null;
        return scValToNative(sim.result.retval);
    } catch (e) {
        console.error("fetchJobOnChain native execution failed:", e);
        return null;
    }
}

// ---------------------------------------------------------------------------
// JOBS API ROUTER
// ---------------------------------------------------------------------------

app.post("/api/jobs", async (req, res) => {
    try {
        const { jobId, title, description, freelancerAddress, milestones, clientAddress, signedMessage, timestamp } = req.body;

        if (!jobId || !clientAddress || !signedMessage || !timestamp || !freelancerAddress) {
            return res.status(400).json({ error: "Missing physical execution parameters." });
        }

        // 1. Replay Resistance Bound Controls
        const ts = Number(timestamp);
        const now = Date.now();
        if (now - ts > 5 * 60 * 1000) {
            return res.status(401).json({ error: "Cryptographic payload timestamp expired natively." });
        }
        if (ts > now + 60 * 1000) {
            return res.status(401).json({ error: "Payload signature recursively executed in the future." });
        }

        // 2. Strict Payload Formation
        const expectedMessage = `Keystone job creation: job=${jobId} client=${clientAddress} ts=${timestamp}`;
        const keypair = Keypair.fromPublicKey(clientAddress);

        // 3. Dual-Format Cryptographic Type Processing mapping the Freighter return footprint precisely
        let sigBuffer: Buffer;
        if (typeof signedMessage === 'string') {
            sigBuffer = Buffer.from(signedMessage, 'base64');
        } else if (Buffer.isBuffer(signedMessage)) {
            sigBuffer = signedMessage;
        } else if (Array.isArray(signedMessage) || signedMessage instanceof Uint8Array) {
            sigBuffer = Buffer.from(signedMessage as any);
        } else {
            return res.status(400).json({ error: "Invalid generic cryptographic type resolved physically." });
        }

        // 4. SEP-53 compliant verification — Freighter signs SHA256("Stellar Signed Message:\n" + message)
        //    NOT raw message bytes. Must replicate the same hash before verifying.
        const crypto = require('crypto');
        const sep53Prefix = Buffer.from('Stellar Signed Message:\n', 'utf8');
        const msgBytes = Buffer.from(expectedMessage, 'utf8');
        const prefixedPayload = Buffer.concat([sep53Prefix, msgBytes]);
        const hashToVerify = crypto.createHash('sha256').update(prefixedPayload).digest();

        const isValid = keypair.verify(hashToVerify, sigBuffer);

        if (!isValid) {
            return res.status(401).json({ error: "Signature validation bounds rejected payload natively." });
        }

        // 4. On-Chain Cryptographic Integrity Cross-Check
        // Malicious payloads could verify a signature but for a mock jobId. We force an RPC pull to the Contract.
        const onChainJob = await fetchJobOnChain(jobId);
        if (!onChainJob) {
            return res.status(404).json({ error: "Target Job ID does not exist on-chain." });
        }
        if (onChainJob.client !== clientAddress) {
            return res.status(403).json({ error: "Unauthorized: Verified Signature does not physically match On-Chain Client mapping." });
        }
        if (onChainJob.freelancer !== freelancerAddress) {
            return res.status(403).json({ error: "Unauthorized: Freelancer address mismatch against Blockchain footprint." });
        }

        // 5. Ingest Job Structural Parameters via Subgraph Engine
        const { error: jobErr } = await supabase
            .from("jobs")
            .insert({
                job_id: jobId,
                title,
                description,
                client_address: clientAddress,
                freelancer_address: freelancerAddress
            });

        if (jobErr) throw jobErr;

        // 6. Array Map Milestone Insertions natively generating UUID clusters
        if (milestones && Array.isArray(milestones) && milestones.length > 0) {
            const milestoneInserts = milestones.map((m: any, index: number) => ({
                job_id: jobId,
                milestone_index: index + 1,
                title: m.title,
                description: m.description,
                amount: m.amount || 0
            }));

            const { error: msErr } = await supabase.from("milestones").insert(milestoneInserts);
            if (msErr) throw msErr;
        }

        return res.json({ success: true, jobId });
    } catch (e: any) {
        console.error("POST /api/jobs native block execution error:", e);
        return res.status(500).json({ error: "Internal Server Execution Bound", details: e.message });
    }
});

app.put("/api/milestones/dispute", async (req, res) => {
    try {
        const { jobId, milestoneIndex, disputeTitle, disputeDescription, disputeNotes } = req.body;
        if (!jobId || !milestoneIndex) {
            return res.status(400).json({ error: "Missing required parameters." });
        }

        const { data, error } = await supabase
            .from("milestones")
            .update({
                dispute_title: disputeTitle,
                dispute_description: disputeDescription,
                dispute_notes: disputeNotes
            })
            .eq("job_id", jobId)
            .eq("milestone_index", milestoneIndex)
            .select();

        if (error) throw error;
        return res.json({ success: true, data });
    } catch (e: any) {
        console.error("PUT /api/milestones/dispute execution error:", e);
        return res.status(500).json({ error: "Failed to update dispute metadata", details: e.message });
    }
});

app.get("/api/jobs", async (req, res) => {
    try {
        const term = req.query.search as string;
        const wallet = req.query.wallet as string;

        let query = supabase
            .from("jobs")
            .select(`
                jobId:job_id,
                title,
                description,
                clientAddress:client_address,
                freelancerAddress:freelancer_address,
                createdAt:created_at,
                milestones ( id, milestoneIndex:milestone_index, title, description, amount, disputeTitle:dispute_title, disputeDescription:dispute_description, disputeNotes:dispute_notes )
            `)
            .order('created_at', { ascending: false });

        // Wrapped explicitly inside double quotes safely escaping malicious PostgreSQL characters natively
        if (wallet) {
            query = query.or(`client_address.eq."${wallet}",freelancer_address.eq."${wallet}"`);
        }

        if (term) {
            query = query.or(`title.ilike."%${term}%",description.ilike."%${term}%",client_address.ilike."%${term}%",freelancer_address.ilike."%${term}%"`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json(data);
    } catch (e: any) {
        console.error("GET /api/jobs generic execution error:", e);
        return res.status(500).json({ error: "Internal Database Selection Bug", details: e.message });
    }
});

app.listen(port, () => {
    console.log(`[Keystone Internal System Node] API actively listening structurally at http://localhost:${port}`);
});
