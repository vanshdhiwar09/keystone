"use client";

import { useState } from "react";
import { StrKey, TransactionBuilder, xdr, scValToNative } from "@stellar/stellar-sdk";
import { signTransaction, signMessage } from "@stellar/freighter-api";
import { useWallet } from "../context/WalletContext";
import { useTx } from "../context/TransactionContext";
import { useToast } from "../context/ToastContext";
import {
    txCreateJob,
    txAddMilestone,
    txFundMilestone,
    pollTx,
    server,
    TOKEN_CONTRACT_ID
} from "../lib/soroban";
import { createJobMetadata } from "../lib/api";
import {
    validateAmount,
    validateDescription,
    validateProjectTitle,
    validateRequiredText
} from "../lib/validation";

interface MilestoneInput {
    title: string;
    description: string;
    amount: string;
}

function stroopsFromXlm(amount: string): bigint {
    const parts = amount.split(".");
    const whole = parts[0] || "0";
    const fraction = (parts[1] || "").substring(0, 7).padEnd(7, "0");
    return BigInt(whole + fraction);
}

export default function CreateJobFlow({ setView }: { setView?: (v: string) => void }) {
    const { publicKey } = useWallet();
    const { setState, resetTx } = useTx();
    const { toast, dismissToast, isUserCancellation, getFriendlyErrorMessage } = useToast();

    const [freelancer, setFreelancer] = useState("");
    const [milestones, setMilestones] = useState<MilestoneInput[]>([
        { title: "", description: "", amount: "" }
    ]);
    const [jobTitle, setJobTitle] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deployed, setDeployed] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

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
        if (milestones.length <= 1) return;
        setMilestones(prev => prev.filter((_, i) => i !== index));
        setErrors(prev => {
            const copy = { ...prev };
            delete copy[`m_${index}_title`];
            delete copy[`m_${index}_amount`];
            return copy;
        });
    };

    const allMilestonesValid = milestones.every(m =>
        m.title.trim().length > 0 &&
        m.amount.trim().length > 0 &&
        parseFloat(m.amount) > 0
    );

    const totalXlm = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

    const canDeploy = publicKey &&
        StrKey.isValidEd25519PublicKey(freelancer) &&
        allMilestonesValid;

    const handleDeploy = async () => {
        const newErrors: Record<string, string> = {};

        const titleErr = validateProjectTitle(jobTitle);
        if (titleErr) newErrors.title = titleErr;

        const descErr = validateDescription(jobDescription);
        if (descErr) newErrors.description = descErr;

        if (!freelancer.trim()) {
            newErrors.freelancer = "Freelancer Address is required.";
        } else if (!StrKey.isValidEd25519PublicKey(freelancer)) {
            newErrors.freelancer = "Invalid Stellar public key.";
        }

        milestones.forEach((m, i) => {
            const mTitleErr = validateRequiredText(m.title, `Milestone ${i + 1} Title`, 3, 100);
            if (mTitleErr) newErrors[`m_${i}_title`] = mTitleErr;

            const mAmountErr = validateAmount(m.amount);
            if (mAmountErr) newErrors[`m_${i}_amount`] = mAmountErr;
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please resolve validation errors first.");

            setTimeout(() => {
                const firstErrKey = Object.keys(newErrors)[0];
                let query = "";
                if (firstErrKey === "title") query = "input[placeholder='Landing page redesign']";
                else if (firstErrKey === "description") query = "textarea[placeholder*='Full redesign']";
                else if (firstErrKey === "freelancer") query = "input[placeholder*='GABC']";
                else if (firstErrKey.startsWith("m_")) {
                    const parts = firstErrKey.split("_");
                    const index = parseInt(parts[1]);
                    const type = parts[2];
                    if (type === "title") query = `div.milestone-builder-block:nth-of-type(${index + 1}) input[placeholder='Wireframes']`;
                    else query = `div.milestone-builder-block:nth-of-type(${index + 1}) input[placeholder='150']`;
                }

                if (query) {
                    const el = document.querySelector(query) as HTMLElement;
                    if (el) el.focus();
                }
            }, 100);
            return;
        }

        if (!publicKey || !signTransaction || !signMessage) {
            setError("Wallet not connected or Freighter unavailable.");
            return;
        }

        setIsLoading(true);
        setError(null);
        const toastId = toast.loading("Preparing transaction...");

        try {
            // ── STEP 1: create_job ──
            setState({
                step: "awaiting_signature",
                title: "Step 1 of 3: Create Job",
                sub: "Awaiting wallet signature...",
                progress: 10
            });
            if (setView) setView("tx");

            const createTx = await txCreateJob(publicKey, freelancer, TOKEN_CONTRACT_ID);
            const { signedTxXdr: signedCreate } = await signTransaction(createTx.toXDR(), {
                networkPassphrase: "Test SDF Network ; September 2015"
            });
            if (!signedCreate) {
                throw new Error("User declined to sign");
            }

            setState({ step: "submitting", title: "Step 1 of 3: Create Job", sub: "Submitting transaction...", progress: 20 });

            const submittedCreate = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedCreate, "Test SDF Network ; September 2015") as any
            );

            if (submittedCreate.status !== "PENDING") {
                throw new Error(`Unexpected submission status: ${submittedCreate.status}`);
            }

            setState({ step: "submitting", title: "Step 1 of 3: Create Job", sub: "Confirming transaction...", progress: 30 });
            const confirmedCreate = await pollTx(submittedCreate.hash);

            // ── Proven extraction: read returnValue directly from pollTx result ──
            const rpcVal = (confirmedCreate as any).returnValue;
            const xdrVal = typeof rpcVal === "string"
                ? xdr.ScVal.fromXDR(rpcVal, "base64")
                : rpcVal;
            const jobId = parseInt(String(scValToNative(xdrVal)), 10);

            if (!jobId || isNaN(jobId)) {
                throw new Error("Job created, but could not extract Job ID. Check Stellar Expert.");
            }

            // ── STEP 2: add_milestone + fund_milestone for each milestone ──
            for (let i = 0; i < milestones.length; i++) {
                const m = milestones[i];
                const stroops = stroopsFromXlm(m.amount);

                // Add milestone
                const progress1 = 30 + ((i / milestones.length) * 35);
                setState({
                    step: "awaiting_signature",
                    title: `Step 2 of 3: Milestone ${i + 1}/${milestones.length}`,
                    sub: "Awaiting wallet signature...",
                    progress: progress1
                });

                const addTx = await txAddMilestone(publicKey, jobId, stroops);
                const { signedTxXdr: signedAdd } = await signTransaction(addTx.toXDR(), {
                    networkPassphrase: "Test SDF Network ; September 2015"
                });
                if (!signedAdd) {
                    throw new Error("User declined to sign");
                }

                setState({ step: "submitting", title: `Step 2 of 3: Milestone ${i + 1}/${milestones.length}`, sub: "Submitting transaction...", progress: progress1 + 5 });

                const submittedAdd = await server.sendTransaction(
                    TransactionBuilder.fromXDR(signedAdd, "Test SDF Network ; September 2015") as any
                );
                if (submittedAdd.status !== "PENDING") throw new Error(`add_milestone failed: ${submittedAdd.status}`);

                setState({ step: "submitting", title: `Step 2 of 3: Milestone ${i + 1}/${milestones.length}`, sub: "Confirming transaction...", progress: progress1 + 10 });
                await pollTx(submittedAdd.hash);

                // Fund milestone
                const progress2 = 30 + (((i + 0.5) / milestones.length) * 35);
                setState({
                    step: "awaiting_signature",
                    title: `Step 2 of 3: Funding Milestone ${i + 1}`,
                    sub: "Awaiting wallet signature...",
                    progress: progress2
                });

                const fundTx = await txFundMilestone(publicKey, jobId, i + 1);
                const { signedTxXdr: signedFund } = await signTransaction(fundTx.toXDR(), {
                    networkPassphrase: "Test SDF Network ; September 2015"
                });
                if (!signedFund) {
                    throw new Error("User declined to sign");
                }

                setState({ step: "submitting", title: `Step 2 of 3: Funding Milestone ${i + 1}`, sub: "Submitting transaction...", progress: progress2 + 5 });

                const submittedFund = await server.sendTransaction(
                    TransactionBuilder.fromXDR(signedFund, "Test SDF Network ; September 2015") as any
                );
                if (submittedFund.status !== "PENDING") throw new Error(`fund_milestone failed: ${submittedFund.status}`);

                setState({ step: "submitting", title: `Step 2 of 3: Funding Milestone ${i + 1}`, sub: "Confirming transaction...", progress: progress2 + 10 });
                await pollTx(submittedFund.hash);
            }

            // ── STEP 3: Off-chain metadata ──
            setState({ step: "awaiting_signature", title: "Step 3 of 3: Indexing", sub: "Awaiting wallet signature...", progress: 80 });

            const ts = Date.now();
            const proofMsg = `Keystone job creation: job=${jobId} client=${publicKey} ts=${ts}`;
            const sigResult = await signMessage(proofMsg, { address: publicKey });
            if (!sigResult || (typeof sigResult !== "string" && !sigResult.signedMessage)) {
                throw new Error("User declined to sign");
            }
            const sigBytes = typeof sigResult === "string" ? sigResult : sigResult.signedMessage;

            setState({ step: "submitting", title: "Indexing metadata…", sub: "Submitting transaction...", progress: 90 });

            await createJobMetadata({
                jobId,
                title: jobTitle,
                description: jobDescription,
                clientAddress: publicKey,
                freelancerAddress: freelancer,
                milestones: milestones.map((m, i) => ({
                    milestoneIndex: i + 1,
                    title: m.title,
                    description: m.description,
                    amount: parseFloat(m.amount) || 0
                })),
                timestamp: ts,
                signedMessage: sigBytes
            });

            dismissToast(toastId);
            toast.success("Transaction completed.");
            setState({ step: "confirmed", title: "Contract Deployed", sub: "Transaction completed.", progress: 100 });
            setDeployed(true);

        } catch (e: any) {
            console.error("Deploy error details (developer console):", e);
            dismissToast(toastId);
            const userMsg = getFriendlyErrorMessage(e);

            if (isUserCancellation(e)) {
                toast.info(userMsg);
                setError("Transaction cancelled.");
                setState({ step: "idle", title: "Awaiting Instructions", sub: "Transaction cancelled.", progress: 0 });
            } else {
                setError(userMsg);
                toast.error(userMsg);
                setState({ step: "error", title: "Transaction Failed", sub: userMsg, progress: 100, errorLevel: true });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ── SUCCESS STATE ──
    if (deployed) {
        return (
            <div className="drafting-container">
                <div className="drafting-board" style={{ textAlign: "center", padding: "80px 48px" }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--banknote)" strokeWidth="2" style={{ marginBottom: 24 }}>
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <h2 className="display" style={{ fontSize: 32, marginBottom: 12 }}>Contract Deployed</h2>
                    <p style={{ color: "rgba(22,26,29,0.5)", marginBottom: 40 }}>
                        Your escrow has been committed to the Soroban ledger and indexed off-chain.
                    </p>
                    <button className="btn-deploy" onClick={() => {
                        resetTx();
                        setDeployed(false);
                        setFreelancer("");
                        setMilestones([{ title: "", description: "", amount: "" }]);
                        setJobTitle("");
                        setJobDescription("");
                        setErrors({});
                        if (setView) setView("dashboard");
                    }}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ── MAIN FORM — Drafting Board Design ──
    return (
        <div className="drafting-container">
            <p className="uppercase" style={{ color: "rgba(22,26,29,0.4)", marginBottom: 20, alignSelf: "flex-start", maxWidth: 800, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
                Initialize New Contract
            </p>

            <div className="drafting-board">
                <div className="draft-header">
                    <h2>Contract Foundation</h2>
                    <p>Define the job parameters and lock in the freelancer before adding milestones.</p>
                </div>

                <div className="draft-body">
                    {/* Project Title */}
                    <div className="draft-group">
                        <label className="draft-label">Project Title</label>
                        <input
                            type="text"
                            className="draft-input"
                            placeholder="Landing page redesign"
                            value={jobTitle}
                            onChange={e => {
                                setJobTitle(e.target.value);
                                const err = validateProjectTitle(e.target.value);
                                setErrors(prev => ({ ...prev, title: err || "" }));
                            }}
                            disabled={isLoading}
                            style={{ borderColor: errors.title ? "var(--oxide)" : "" }}
                        />
                        {errors.title && <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.title}</p>}
                    </div>

                    {/* Project Description */}
                    <div className="draft-group">
                        <label className="draft-label">Project Description</label>
                        <textarea
                            className="draft-input"
                            placeholder="Full redesign of the marketing site homepage and pricing page, including mobile layout."
                            value={jobDescription}
                            onChange={e => {
                                setJobDescription(e.target.value);
                                const err = validateDescription(e.target.value);
                                setErrors(prev => ({ ...prev, description: err || "" }));
                            }}
                            disabled={isLoading}
                            style={{ borderColor: errors.description ? "var(--oxide)" : "" }}
                        />
                        {errors.description && <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.description}</p>}
                    </div>

                    {/* Freelancer Address */}
                    <div className="draft-group">
                        <label className="draft-label">Freelancer Address</label>
                        <input
                            type="text"
                            className="draft-input mono"
                            placeholder="GABC7X9K2LFRE4M1PQRS8T2NHIJKLMNOPQRSTUVWXYZ"
                            value={freelancer}
                            onChange={e => {
                                const val = e.target.value;
                                setFreelancer(val);
                                let err = "";
                                if (!val.trim()) {
                                    err = "Freelancer Address is required.";
                                } else if (!StrKey.isValidEd25519PublicKey(val)) {
                                    err = "Invalid Stellar public key.";
                                }
                                setErrors(prev => ({ ...prev, freelancer: err }));
                            }}
                            disabled={isLoading}
                            style={{ borderColor: errors.freelancer ? "var(--oxide)" : "" }}
                        />
                        {errors.freelancer && (
                            <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.freelancer}</p>
                        )}
                    </div>

                    {/* Structural Milestones */}
                    <div style={{ marginTop: 16 }}>
                        <label className="draft-label" style={{ marginBottom: 20 }}>Structural Milestones</label>

                        {milestones.map((m, i) => (
                            <div key={i} className="milestone-builder-block">
                                <div className="m-header">
                                    <span className="m-pill">Milestone {i + 1}</span>
                                    {milestones.length > 1 && (
                                        <button className="m-remove" onClick={() => removeMilestone(i)} disabled={isLoading}>
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="m-row">
                                    <div>
                                        <label className="draft-label" style={{ fontSize: 9, color: "rgba(22,26,29,0.3)" }}>Title</label>
                                        <input
                                            type="text"
                                            className="draft-input"
                                            placeholder="Wireframes"
                                            value={m.title}
                                            onChange={e => {
                                                updateMilestone(i, "title", e.target.value);
                                                const err = validateRequiredText(e.target.value, `Milestone ${i + 1} Title`, 3, 100);
                                                setErrors(prev => ({ ...prev, [`m_${i}_title`]: err || "" }));
                                            }}
                                            disabled={isLoading}
                                            style={{ borderColor: errors[`m_${i}_title`] ? "var(--oxide)" : "" }}
                                        />
                                        {errors[`m_${i}_title`] && <p style={{ color: "var(--oxide)", fontSize: 11, marginTop: 4 }}>{errors[`m_${i}_title`]}</p>}
                                    </div>
                                    <div className="amount-wrap">
                                        <div style={{ flex: 1 }}>
                                            <label className="draft-label" style={{ fontSize: 9, color: "rgba(22,26,29,0.3)" }}>Amount</label>
                                            <input
                                                type="text"
                                                className="draft-input"
                                                placeholder="150"
                                                value={m.amount}
                                                onChange={e => {
                                                    const cleanVal = e.target.value.replace(/[^0-9.]/g, "");
                                                    updateMilestone(i, "amount", cleanVal);
                                                    const err = validateAmount(cleanVal);
                                                    setErrors(prev => ({ ...prev, [`m_${i}_amount`]: err || "" }));
                                                }}
                                                onKeyDown={e => {
                                                    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Escape", "Enter"].includes(e.key)) return;
                                                    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                disabled={isLoading}
                                                style={{ borderColor: errors[`m_${i}_amount`] ? "var(--oxide)" : "" }}
                                            />
                                            {errors[`m_${i}_amount`] && <p style={{ color: "var(--oxide)", fontSize: 11, marginTop: 4 }}>{errors[`m_${i}_amount`]}</p>}
                                        </div>
                                        <span style={{ paddingTop: 20 }}>XLM</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button className="btn-add-milestone" onClick={addMilestone} disabled={isLoading}>
                            + Add Milestone
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="draft-footer">
                    <div className="draft-summary">
                        {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · <strong>{totalXlm.toFixed(0)} XLM</strong> total · {1 + milestones.length * 2 + 1} signatures required
                    </div>
                    <button
                        className="btn-deploy"
                        onClick={handleDeploy}
                        disabled={isLoading || !canDeploy}
                        style={{ opacity: (isLoading || !canDeploy) ? 0.5 : 1, cursor: (isLoading || !canDeploy) ? "not-allowed" : "pointer" }}
                    >
                        {isLoading ? "Deploying…" : "Deploy Contract"}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ maxWidth: 800, margin: "16px auto 0", padding: "12px 16px", background: "rgba(164,76,39,0.08)", border: "1px solid var(--oxide)", borderRadius: 6, fontSize: 13, color: "var(--oxide)" }}>
                    {error}
                </div>
            )}
        </div>
    );
}
