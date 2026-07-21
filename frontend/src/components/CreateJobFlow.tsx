"use client";

import { useState } from "react";
import { StrKey, TransactionBuilder, xdr, scValToNative } from "@stellar/stellar-sdk";
import { signTransaction, signMessage } from "@stellar/freighter-api";
import { useWallet } from "../context/WalletContext";
import { useTx } from "../context/TransactionContext";
import {
    txCreateJob,
    txAddMilestone,
    txFundMilestone,
    pollTx,
    server,
    TOKEN_CONTRACT_ID
} from "../lib/soroban";
import { createJobMetadata } from "../lib/api";

interface MilestoneInput {
    title: string;
    description: string;
    amount: string;
}

function stroopsFromXlm(amount: string): bigint {
    // Precise string-based conversion — avoids float imprecision (e.g. 0.58 * 1e7 = 5799999.999)
    const parts = amount.split(".");
    const whole = parts[0] || "0";
    const fraction = (parts[1] || "").substring(0, 7).padEnd(7, "0");
    return BigInt(whole + fraction);
}

export default function CreateJobFlow({ setView }: { setView?: (v: string) => void }) {
    const { publicKey } = useWallet();
    const { setState, resetTx } = useTx();

    // Step state: 1 = Parties, 2 = Milestones, 3 = Metadata, 4 = Deploying
    const [step, setStep] = useState(1);
    const [freelancer, setFreelancer] = useState("");
    const [milestones, setMilestones] = useState<MilestoneInput[]>([
        { title: "", description: "", amount: "" }
    ]);
    const [jobTitle, setJobTitle] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addMilestone = () => {
        setMilestones(prev => [...prev, { title: "", description: "", amount: "" }]);
    };

    const updateMilestone = (index: number, field: keyof MilestoneInput, value: string) => {
        setMilestones(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const removeMilestone = (index: number) => {
        if (milestones.length <= 1) return; // Always keep at least 1
        setMilestones(prev => prev.filter((_, i) => i !== index));
    };

    const allMilestonesValid = milestones.every(m =>
        m.title.trim().length > 0 &&
        m.amount.trim().length > 0 &&
        parseFloat(m.amount) > 0
    );

    const handleDeploy = async () => {
        if (!publicKey || !signTransaction || !signMessage) {
            setError("Wallet not connected or Freighter unavailable.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // ── STEP 1: create_job ─────────────────────────────────────────────────
            setState({
                step: "awaiting_signature",
                title: "Step 1 of 3: Create Job",
                sub: "Sign the create_job transaction in Freighter.",
                progress: 10
            });

            const createTx = await txCreateJob(publicKey, freelancer, TOKEN_CONTRACT_ID);
            const { signedTxXdr: signedCreate } = await signTransaction(createTx.toXDR(), {
                networkPassphrase: "Test SDF Network ; September 2015"
            });

            setState({ step: "submitting", title: "Step 1 of 3: Create Job", sub: "Broadcasting to the Soroban network…", progress: 20 });

            const submittedCreate = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedCreate, "Test SDF Network ; September 2015") as any
            );

            if (submittedCreate.status !== "PENDING") {
                throw new Error(`Unexpected submission status: ${submittedCreate.status}`);
            }

            setState({ step: "submitting", title: "Step 1 of 3: Create Job", sub: "Awaiting ledger confirmation…", progress: 30 });
            const confirmedCreate = await pollTx(submittedCreate.hash);

            // Extract Job ID — read from the confirmed transaction's returnVal via resultMetaXdr
            // The create_job function returns the new job_id as a u32 ScVal.
            // We parse it from resultMetaXdr which is reliably populated post-confirmation.
            let jobId: number | null = null;
            try {
                if (confirmedCreate.resultMetaXdr) {
                    const meta = xdr.TransactionMeta.fromXDR(confirmedCreate.resultMetaXdr, "base64");
                    // V3 meta stores operation results in sorobanMeta
                    const retval = (meta as any).v3?.sorobanMeta?.returnValue;
                    if (retval) {
                        jobId = Number(scValToNative(retval));
                    }
                }
            } catch {
                // If extraction fails, throw so the user knows to check Stellar Expert
                throw new Error("Could not read Job ID from on-chain response. Check Stellar Expert for the transaction.");
            }

            if (jobId === null || jobId === undefined || isNaN(jobId)) {
                throw new Error("Invalid Job ID returned from create_job.");
            }


            // ── STEP 2: add_milestone × N ──────────────────────────────────────────
            for (let i = 0; i < milestones.length; i++) {
                const m = milestones[i];
                const amountInStroops = stroopsFromXlm(m.amount);

                setState({
                    step: "awaiting_signature",
                    title: `Step 2 of 3: Add Milestone ${i + 1}/${milestones.length}`,
                    sub: `Sign add_milestone for "${m.title}" in Freighter.`,
                    progress: 35 + Math.floor((i / milestones.length) * 20)
                });

                const addTx = await txAddMilestone(publicKey, jobId, amountInStroops);
                const { signedTxXdr: signedAdd } = await signTransaction(addTx.toXDR(), {
                    networkPassphrase: "Test SDF Network ; September 2015"
                });

                setState({
                    step: "submitting",
                    title: `Step 2 of 3: Add Milestone ${i + 1}/${milestones.length}`,
                    sub: "Confirming on ledger…",
                    progress: 40 + Math.floor((i / milestones.length) * 20)
                });

                const addSubmit = await server.sendTransaction(
                    TransactionBuilder.fromXDR(signedAdd, "Test SDF Network ; September 2015") as any
                );
                if (addSubmit.status !== "PENDING") throw new Error(`add_milestone submit failed: ${addSubmit.status}`);
                await pollTx(addSubmit.hash);
            }

            // ── STEP 3: fund_milestone × N ─────────────────────────────────────────
            for (let i = 0; i < milestones.length; i++) {
                const milestoneId = i + 1;

                setState({
                    step: "awaiting_signature",
                    title: `Step 3 of 3: Fund Milestone ${i + 1}/${milestones.length}`,
                    sub: `Sign fund_milestone #${milestoneId} in Freighter.`,
                    progress: 60 + Math.floor((i / milestones.length) * 20)
                });

                const fundTx = await txFundMilestone(publicKey, jobId, milestoneId);
                const { signedTxXdr: signedFund } = await signTransaction(fundTx.toXDR(), {
                    networkPassphrase: "Test SDF Network ; September 2015"
                });

                setState({
                    step: "submitting",
                    title: `Step 3 of 3: Fund Milestone ${i + 1}/${milestones.length}`,
                    sub: "Confirming on ledger…",
                    progress: 65 + Math.floor((i / milestones.length) * 20)
                });

                const fundSubmit = await server.sendTransaction(
                    TransactionBuilder.fromXDR(signedFund, "Test SDF Network ; September 2015") as any
                );
                if (fundSubmit.status !== "PENDING") throw new Error(`fund_milestone submit failed: ${fundSubmit.status}`);
                await pollTx(fundSubmit.hash);
            }

            // ── STEP 4: Register metadata in backend (with signMessage) ────────────
            setState({
                step: "awaiting_signature",
                title: "Finalizing: Register Metadata",
                sub: "Sign identity proof for off-chain indexing.",
                progress: 85
            });

            const timestamp = Date.now();
            const messageToSign = `Keystone job creation: job=${jobId} client=${publicKey} ts=${timestamp}`;
            const { signedMessage: signedMsg } = await signMessage(messageToSign, { address: publicKey });

            await createJobMetadata({
                jobId,
                title: jobTitle,
                description: jobDescription,
                clientAddress: publicKey,
                freelancerAddress: freelancer,
                milestones: milestones.map(m => ({ title: m.title, description: m.description })),
                timestamp,
                signedMessage: signedMsg
            });

            // ── DONE ───────────────────────────────────────────────────────────────
            setState({
                step: "confirmed",
                title: "Contract Deployed",
                sub: `Job #${jobId} is live on-chain and indexed.`,
                progress: 100
            });

            setStep(4); // Show success state

        } catch (e: any) {
            const msg = e?.message || String(e);
            setError(msg);
            setState({
                step: "error",
                title: "Deployment Failed",
                sub: msg,
                progress: 0,
                errorLevel: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    // ── NOT CONNECTED ──────────────────────────────────────────────────────────
    if (!publicKey) {
        return (
            <div className="page-view active" id="view-create">
                <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "60px 40px", border: "1px solid var(--iron)", background: "var(--alum)" }}>
                    <p className="cad-label" style={{ marginBottom: 16 }}>Access Restricted</p>
                    <h2 className="display" style={{ fontSize: 28, marginBottom: 12 }}>Vault Locked</h2>
                    <p style={{ color: "rgba(22,26,29,0.5)", fontSize: 14 }}>Connect your Freighter wallet to initialize a new structural sequence.</p>
                </div>
            </div>
        );
    }

    // ── SUCCESS STATE ──────────────────────────────────────────────────────────
    if (step === 4) {
        return (
            <div className="page-view active" id="view-create">
                <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center", padding: "60px 40px", border: "1px solid var(--brass)", background: "var(--alum)" }}>
                    <p className="cad-label" style={{ color: "var(--brass)", marginBottom: 16 }}>Contract Deployed</p>
                    <h2 className="display" style={{ fontSize: 32, marginBottom: 12 }}>Escrow Live</h2>
                    <p style={{ color: "rgba(22,26,29,0.6)", fontSize: 14, marginBottom: 32 }}>Your contract has been committed to the Soroban ledger and indexed off-chain.</p>
                    <button className="btn-massive" onClick={() => { resetTx(); setStep(1); setFreelancer(""); setMilestones([{ title: "", description: "", amount: "" }]); setJobTitle(""); setJobDescription(""); if (setView) setView("dashboard"); }}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ── MAIN FORM ──────────────────────────────────────────────────────────────
    return (
        <div className="page-view active" id="view-create" style={{ paddingBottom: 120 }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ marginBottom: 48 }}>
                    <p className="cad-label" style={{ marginBottom: 12 }}>Initialize Contract</p>
                    <h2 className="display" style={{ fontSize: 36, marginBottom: 8 }}>New Escrow</h2>
                    <p style={{ color: "rgba(22,26,29,0.5)", fontSize: 14 }}>Deploy a multi-milestone escrow contract to the Stellar Testnet.</p>
                </div>

                {/* Step 1: Parties */}
                <div style={{ marginBottom: 32 }}>
                    <div className="cad-header" style={{ marginBottom: 20 }}>
                        <h3 className="cad-title display">1. Contract Parties</h3>
                        {step > 1 && <span className="cad-label" style={{ color: "var(--brass)" }}>Locked</span>}
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label className="cad-label" style={{ display: "block", marginBottom: 8 }}>Your Address (Client)</label>
                        <div className="mono" style={{ padding: "12px 16px", background: "rgba(22,26,29,0.04)", border: "1px solid var(--glass-border)", fontSize: 13, wordBreak: "break-all" }}>
                            {publicKey}
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label className="cad-label" style={{ display: "block", marginBottom: 8 }}>Freelancer Public Key</label>
                        <input
                            type="text"
                            placeholder="G..."
                            value={freelancer}
                            onChange={e => setFreelancer(e.target.value)}
                            disabled={step > 1}
                            className="mono"
                            style={{ width: "100%", padding: "12px 16px", border: "1px solid var(--iron)", background: step > 1 ? "rgba(22,26,29,0.04)" : "white", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: step > 1 ? 0.6 : 1 }}
                        />
                        {freelancer && !StrKey.isValidEd25519PublicKey(freelancer) && (
                            <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 6 }}>Invalid Stellar public key</p>
                        )}
                    </div>

                    {step === 1 && StrKey.isValidEd25519PublicKey(freelancer) && freelancer !== publicKey && (
                        <button className="btn-massive" style={{ padding: "12px 32px" }} onClick={() => setStep(2)}>
                            Lock Parties
                        </button>
                    )}
                </div>

                {/* Step 2: Milestones */}
                {step >= 2 && (
                    <div style={{ marginBottom: 32 }}>
                        <div className="cad-header" style={{ marginBottom: 20 }}>
                            <h3 className="cad-title display">2. Milestones</h3>
                            {step > 2 && <span className="cad-label" style={{ color: "var(--brass)" }}>Locked</span>}
                        </div>

                        {milestones.map((m, i) => (
                            <div key={i} style={{ border: "1px solid var(--glass-border)", padding: "20px", marginBottom: 12, position: "relative" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <span className="cad-label">Milestone {i + 1}</span>
                                    {milestones.length > 1 && step === 2 && (
                                        <button onClick={() => removeMilestone(i)} style={{ fontSize: 11, color: "var(--oxide)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>REMOVE</button>
                                    )}
                                </div>
                                <input type="text" placeholder="Title" value={m.title} onChange={e => updateMilestone(i, "title", e.target.value)} disabled={step > 2}
                                    style={{ width: "100%", marginBottom: 8, padding: "10px 14px", border: "1px solid var(--glass-border)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                <input type="text" placeholder="Description (optional)" value={m.description} onChange={e => updateMilestone(i, "description", e.target.value)} disabled={step > 2}
                                    style={{ width: "100%", marginBottom: 8, padding: "10px 14px", border: "1px solid var(--glass-border)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input type="number" placeholder="0.00" value={m.amount} onChange={e => updateMilestone(i, "amount", e.target.value)} disabled={step > 2}
                                        className="mono" style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--glass-border)", fontSize: 13, outline: "none" }} />
                                    <span className="cad-label">XLM</span>
                                </div>
                            </div>
                        ))}

                        {step === 2 && (
                            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                                <button onClick={addMilestone} style={{ padding: "10px 20px", border: "1px solid var(--iron)", background: "none", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", cursor: "pointer" }}>
                                    + ADD MILESTONE
                                </button>
                                {allMilestonesValid && (
                                    <button className="btn-massive" style={{ padding: "10px 28px" }} onClick={() => setStep(3)}>
                                        Lock Milestones
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Metadata + Deploy */}
                {step >= 3 && (
                    <div style={{ marginBottom: 32 }}>
                        <div className="cad-header" style={{ marginBottom: 20 }}>
                            <h3 className="cad-title display">3. Job Metadata</h3>
                        </div>

                        <input type="text" placeholder="Job Title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} disabled={isLoading}
                            style={{ width: "100%", marginBottom: 12, padding: "12px 16px", border: "1px solid var(--iron)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                        <textarea placeholder="Description" value={jobDescription} onChange={e => setJobDescription(e.target.value)} disabled={isLoading} rows={3}
                            style={{ width: "100%", marginBottom: 20, padding: "12px 16px", border: "1px solid var(--iron)", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }} />

                        {error && (
                            <div style={{ padding: "12px 16px", background: "rgba(164,76,39,0.08)", border: "1px solid var(--oxide)", marginBottom: 16, fontSize: 13, color: "var(--oxide)" }}>
                                {error}
                            </div>
                        )}

                        <div style={{ padding: "20px", border: "1px solid var(--glass-border)", background: "rgba(22,26,29,0.02)", marginBottom: 24 }}>
                            <p className="cad-label" style={{ marginBottom: 12 }}>Deployment Summary</p>
                            <p style={{ fontSize: 13, marginBottom: 4 }}>Freelancer: <span className="mono">{freelancer.slice(0, 8)}…{freelancer.slice(-8)}</span></p>
                            <p style={{ fontSize: 13, marginBottom: 4 }}>Milestones: {milestones.length}</p>
                            <p style={{ fontSize: 13 }}>
                                Total: <span className="mono">{milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0).toFixed(2)} XLM</span>
                            </p>
                        </div>

                        <p style={{ fontSize: 12, color: "rgba(22,26,29,0.5)", marginBottom: 20 }}>
                            Freighter will prompt {1 + milestones.length + milestones.length + 1} times total: once to create the job, once per milestone to add, once per milestone to fund, and once to sign an identity proof for off-chain indexing.
                        </p>

                        <button
                            className="btn-massive"
                            style={{ width: "100%", padding: "18px", fontSize: 16, opacity: isLoading ? 0.6 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}
                            onClick={handleDeploy}
                            disabled={isLoading || !jobTitle.trim()}
                        >
                            {isLoading ? "Deploying…" : "Deploy Contract"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
