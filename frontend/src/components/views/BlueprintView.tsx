"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "../../context/WalletContext";
import {
    fetchJobData,
    txSubmitMilestone, txApproveMilestone, txRaiseDispute,
    txDistributeMilestone, txResolveDispute, txFundMilestone,
    pollTx, server, ARBITER_ID
} from "../../lib/soroban";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { fetchJobMetadata, JobMetadataPayload, updateDisputeMetadata } from "../../lib/api";
import { signTransaction } from "@stellar/freighter-api";
import { useToast } from "../../context/ToastContext";
import { validateRequiredText } from "../../lib/validation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string) { return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "—"; }

type MsStatus = "approved" | "disputed" | "active" | "pending";

function getMilestoneStatus(ms: any): MsStatus {
    const s = String(ms?.status ?? "").toLowerCase();
    if (s.includes("approve") || s.includes("release") || s.includes("submitted")) return "approved";
    if (s.includes("dispute") || s.includes("refund")) return "disputed";
    if (s.includes("funded") || s.includes("progress")) return "active";
    return "pending";
}

// Maps milestone status to the reference-design CSS block class + label
function stoneBlockClass(status: MsStatus): string {
    if (status === "approved") return "stone-block stone-approved";   // gold
    if (status === "disputed") return "stone-block stone-disputed";   // black
    if (status === "active") return "stone-block stone-active";    // green shaded
    return "stone-block";                                              // default/pending
}

function stageLabel(status: MsStatus, index: number, raw: any): string {
    const rawStr = String(raw?.status ?? "").toLowerCase();
    let labelSuffix = "";
    if (rawStr === "created") {
        labelSuffix = "CREATED • AWAITING FUNDING";
    } else if (rawStr === "funded") {
        labelSuffix = "FUNDED • IN PROGRESS";
    } else if (rawStr === "submitted") {
        labelSuffix = "APPROVED • AWAITING DISTRIBUTION";
    } else if (rawStr === "approved") {
        labelSuffix = "APPROVED • AWAITING DISTRIBUTION";
    } else if (rawStr === "released") {
        labelSuffix = "FUNDS RELEASED";
    } else if (rawStr === "disputed") {
        labelSuffix = "DISPUTED BY CLIENT";
    } else if (rawStr === "refunded") {
        labelSuffix = "FUNDS REFUNDED";
    } else {
        labelSuffix = rawStr.toUpperCase() || "CREATED • AWAITING FUNDING";
    }
    return `STAGE ${String(index + 1).padStart(2, "0")} — ${labelSuffix}`;
}

// ── Raise Dispute Modal ───────────────────────────────────────────────────────

function RaiseDisputeModal({
    jobId,
    milestoneIndex,
    milestoneTitle,
    onClose,
    onSuccess,
}: {
    jobId: number;
    milestoneIndex: number;
    milestoneTitle: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { publicKey, network } = useWallet();
    const { toast, dismissToast, isUserCancellation, getFriendlyErrorMessage } = useToast();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [working, setWorking] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setMounted(true);
        // Lock background scrolling
        document.body.style.overflow = "hidden";
        return () => {
            setMounted(false);
            document.body.style.overflow = "unset";
        };
    }, []);

    const passphrase = network === "TESTNET"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Enforce validations before transaction building starts
        const newErrors: Record<string, string> = {};

        const titleErr = validateRequiredText(title, "Dispute Title", 3, 100);
        if (titleErr) newErrors.title = titleErr;

        const descErr = validateRequiredText(description, "Dispute Description", 10, 1000);
        if (descErr) newErrors.description = descErr;

        if (notes) {
            const notesErr = validateRequiredText(notes, "Supporting Notes", 1, 500);
            if (notesErr) newErrors.notes = notesErr;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please resolve validation errors first.");
            // Focus the first error field
            setTimeout(() => {
                const firstErrKey = Object.keys(newErrors)[0];
                let query = "";
                if (firstErrKey === "title") query = "input[placeholder*='e.g. Work does not']";
                else if (firstErrKey === "description") query = "textarea[placeholder*='Describe why this']";
                else if (firstErrKey === "notes") query = "textarea[placeholder*='Any additional context']";
                if (query) {
                    const el = document.querySelector(query) as HTMLElement;
                    if (el) el.focus();
                }
            }, 100);
            return;
        }

        if (working || !publicKey) return;
        setWorking(true);
        const toastId = toast.loading("Preparing transaction...");
        try {
            // 1. Submit on-chain dispute transaction
            const tx = await txRaiseDispute(publicKey, jobId, milestoneIndex + 1);
            const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: passphrase, address: publicKey });
            if (!signedTxXdr) {
                throw new Error("User declined to sign");
            }
            const submitTx = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedTxXdr, passphrase) as any
            );
            if (submitTx.status !== "PENDING") throw new Error(`Submission failed: ${submitTx.status}`);
            await pollTx(submitTx.hash);

            // 2. Sync dispute metadata to Supabase via backend PUT endpoint
            await updateDisputeMetadata({
                jobId,
                milestoneIndex: milestoneIndex + 1,
                disputeTitle: title,
                disputeDescription: description,
                disputeNotes: notes || ""
            });

            dismissToast(toastId);
            toast.success("Transaction completed.");
            onSuccess();
            onClose();
        } catch (e: any) {
            dismissToast(toastId);
            const userMsg = getFriendlyErrorMessage(e);

            if (isUserCancellation(e)) {
                toast.info(userMsg);
            } else {
                console.error("Raise dispute failed details (developer console):", e);
                toast.error(userMsg);
            }
            setWorking(false);
        }
    }

    if (!mounted) return null;

    return createPortal(
        <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(22,26,29,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24
        }}>
            <div className="drafting-board" style={{ maxWidth: 640 }}>
                {/* Header */}
                <div className="draft-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h2>Raise Dispute</h2>
                        <p style={{ marginTop: 8 }}>
                            Milestone {milestoneIndex + 1} — {milestoneTitle}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", opacity: 0.4, color: "var(--iron)", lineHeight: 1 }}>✕</button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit}>
                    <div className="draft-body" style={{ gap: 24, padding: "32px 48px" }}>
                        <div className="draft-group">
                            <label className="draft-label">Dispute Title</label>
                            <input
                                type="text"
                                className="draft-input"
                                value={title}
                                onChange={e => {
                                    setTitle(e.target.value);
                                    const err = validateRequiredText(e.target.value, "Dispute Title", 3, 100);
                                    setErrors(prev => ({ ...prev, title: err || "" }));
                                }}
                                placeholder="e.g. Work does not meet specifications"
                                disabled={working}
                                style={{ borderColor: errors.title ? "var(--oxide)" : "" }}
                            />
                            {errors.title && <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.title}</p>}
                        </div>

                        <div className="draft-group">
                            <label className="draft-label">Reason / Evidence</label>
                            <textarea
                                className="draft-input"
                                value={description}
                                onChange={e => {
                                    setDescription(e.target.value);
                                    const err = validateRequiredText(e.target.value, "Dispute Description", 10, 1000);
                                    setErrors(prev => ({ ...prev, description: err || "" }));
                                }}
                                placeholder="Describe why this milestone should be disputed. Be specific."
                                rows={4}
                                disabled={working}
                                style={{ borderColor: errors.description ? "var(--oxide)" : "" }}
                            />
                            {errors.description && <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.description}</p>}
                        </div>

                        <div className="draft-group">
                            <label className="draft-label">Supporting Notes <span style={{ opacity: 0.4 }}>(optional)</span></label>
                            <textarea
                                className="draft-input"
                                value={notes}
                                onChange={e => {
                                    setNotes(e.target.value);
                                    const err = e.target.value ? validateRequiredText(e.target.value, "Supporting Notes", 1, 500) : "";
                                    setErrors(prev => ({ ...prev, notes: err || "" }));
                                }}
                                placeholder="Any additional context, links, or reference for the arbiter."
                                rows={2}
                                disabled={working}
                                style={{ borderColor: errors.notes ? "var(--oxide)" : "" }}
                            />
                            {errors.notes && <p style={{ color: "var(--oxide)", fontSize: 12, marginTop: 4 }}>{errors.notes}</p>}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="draft-footer" style={{ borderTop: "1px solid var(--glass-border)", padding: "24px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(246, 247, 249, 0.3)" }}>
                        {working ? (
                            <span className="mono" style={{ fontSize: 12, opacity: 0.6, maxWidth: "60%", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Processing...</span>
                        ) : <div />}
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={working}
                                className="stone-btn"
                                style={{ padding: "12px 24px", border: "1px solid var(--grid-line)", background: "none" }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={working}
                                className="btn-deploy"
                                style={{ padding: "12px 24px", margin: 0, height: "auto" }}
                            >
                                {working ? "Processing…" : "Submit Dispute"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}



// ── Per-Milestone Action Row ──────────────────────────────────────────────────

function MilestoneActions({
    jobId, milestoneIndex, status, role,
    milestoneTitle, chainMs, onRaiseDispute, onSuccess
}: {
    jobId: number;
    milestoneIndex: number;
    status: MsStatus;
    role: "client" | "freelancer" | "observer" | "arbiter";
    milestoneTitle: string;
    chainMs: any;
    onRaiseDispute: (index: number, title: string) => void;
    onSuccess: () => void;
}) {
    const [working, setWorking] = useState(false);
    const [msg, setMsg] = useState("");
    const { publicKey, network } = useWallet();
    const { toast, dismissToast, isUserCancellation, getFriendlyErrorMessage } = useToast();

    const passphrase = network === "TESTNET"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";

    async function exec(fn: () => Promise<any>, label: string) {
        if (working || !publicKey) return;
        setWorking(true);
        setMsg("Preparing transaction...");
        const toastId = toast.loading("Preparing transaction...");
        try {
            const tx = await fn();
            setMsg("Awaiting wallet signature...");
            const xdrStr = typeof tx === "string" ? tx : tx.toXDR();
            const { signedTxXdr } = await signTransaction(xdrStr, { networkPassphrase: passphrase, address: publicKey });
            if (!signedTxXdr) {
                throw new Error("User declined to sign");
            }
            setMsg("Submitting transaction...");
            const submitTx = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedTxXdr, passphrase) as any
            );
            if (submitTx.status !== "PENDING") throw new Error(`Submission failed: ${submitTx.status}`);
            setMsg("Confirming transaction...");
            await pollTx(submitTx.hash);
            setMsg("Transaction completed.");
            dismissToast(toastId);
            toast.success("Transaction completed.");
            setTimeout(() => {
                setMsg("");
                onSuccess();
            }, 1200);
        } catch (e: any) {
            dismissToast(toastId);
            const userMsg = getFriendlyErrorMessage(e);

            if (isUserCancellation(e)) {
                setMsg("Transaction cancelled.");
                toast.info(userMsg);
            } else {
                console.error(`${label} failed details (developer console):`, e);
                setMsg("Transaction failed.");
                toast.error(userMsg);
            }
            setTimeout(() => setMsg(""), 3000);
        } finally {
            setWorking(false);
        }
    }

    const rawStr = String(chainMs?.status ?? "").toLowerCase();

    return (
        <>
            <div className="stone-actions">
                {msg && <span className="mono" style={{ fontSize: 11, opacity: 0.6, alignSelf: "center", marginRight: "auto" }}>{msg}</span>}

                {/* EMPLOYER Actions */}
                {role === "client" && (
                    <>
                        {rawStr === "created" && (
                            <button
                                disabled={working}
                                className="stone-btn primary"
                                onClick={() => exec(
                                    () => txFundMilestone(publicKey!, jobId, milestoneIndex + 1),
                                    "Fund Milestone"
                                )}
                            >
                                Fund Milestone
                            </button>
                        )}
                        {(rawStr === "funded" || rawStr === "submitted" || rawStr === "approved") && (
                            <button
                                disabled={working}
                                className="stone-btn"
                                onClick={() => onRaiseDispute(milestoneIndex, milestoneTitle)}
                            >
                                Raise Dispute
                            </button>
                        )}
                        {rawStr === "submitted" && (
                            <button
                                disabled={working}
                                className="stone-btn primary"
                                onClick={() => exec(
                                    () => txApproveMilestone(publicKey!, jobId, milestoneIndex + 1),
                                    "Approve Milestone"
                                )}
                            >
                                Approve Milestone
                            </button>
                        )}
                    </>
                )}

                {/* FREELANCER Actions */}
                {role === "freelancer" && (
                    <>
                        {(rawStr === "funded" || rawStr === "submitted" || rawStr === "approved") && (
                            <button
                                disabled={working}
                                className="stone-btn"
                                onClick={() => onRaiseDispute(milestoneIndex, milestoneTitle)}
                            >
                                Raise Dispute
                            </button>
                        )}
                        {rawStr === "funded" && (
                            <button
                                disabled={working}
                                className="stone-btn primary"
                                onClick={() => exec(
                                    () => txSubmitMilestone(publicKey!, jobId, milestoneIndex + 1),
                                    "Submit Milestone"
                                )}
                            >
                                Submit Milestone
                            </button>
                        )}
                    </>
                )}

                {/* ARBITRATOR Actions */}
                {role === "arbiter" && (
                    <>
                        {rawStr === "approved" && (
                            <button
                                disabled={working}
                                className="stone-btn primary"
                                onClick={() => exec(
                                    () => txDistributeMilestone(publicKey!, jobId, milestoneIndex + 1),
                                    "Distribute Funds"
                                )}
                            >
                                DISTRIBUTE FUNDS
                            </button>
                        )}
                        {rawStr === "disputed" && (
                            <>
                                <button
                                    disabled={working}
                                    className="stone-btn"
                                    onClick={() => exec(
                                        () => txResolveDispute(publicKey!, jobId, milestoneIndex + 1, true),
                                        "Resolve — Release"
                                    )}
                                >
                                    RESOLVE — RELEASE
                                </button>
                                <button
                                    disabled={working}
                                    className="stone-btn"
                                    onClick={() => exec(
                                        () => txResolveDispute(publicKey!, jobId, milestoneIndex + 1, false),
                                        "Resolve — Refund"
                                    )}
                                >
                                    RESOLVE — REFUND
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

// ── Detail View ───────────────────────────────────────────────────────────────

function DetailView({
    jobId,
    meta,
    onBack
}: {
    jobId: number;
    meta: JobMetadataPayload | null;
    onBack: () => void;
}) {
    const { publicKey } = useWallet();
    const [chain, setChain] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);
    const [disputeMilestone, setDisputeMilestone] = useState<{ index: number; title: string } | null>(null);

    // Fetch rich DB metadata if not passed in (e.g. deep link from dashboard)
    const [localMeta, setLocalMeta] = useState<JobMetadataPayload | null>(meta);
    useEffect(() => {
        if (meta) { setLocalMeta(meta); return; }
        fetchJobMetadata().then((d: any) => {
            const all = Array.isArray(d) ? d : (d.jobs ?? []);
            const found = all.find((j: any) => j.jobId === jobId);
            if (found) setLocalMeta(found);
        }).catch(() => { });
    }, [jobId, meta]);

    useEffect(() => {
        let active = true;
        if (!publicKey) { setLoading(false); return; }
        setLoading(true);
        fetchJobData(jobId, publicKey)
            .then(d => { if (active) { setChain(d); setLoading(false); } })
            .catch(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [jobId, publicKey, refresh]);

    const role: "client" | "freelancer" | "arbiter" | "observer" =
        !publicKey ? "observer" :
            publicKey === ARBITER_ID ? "arbiter" :
                (chain?.client && chain.client === publicKey) ? "client" :
                    (chain?.freelancer && chain.freelancer === publicKey) ? "freelancer" : "observer";

    const milestones = localMeta?.milestones ?? [];
    const totalXlm = milestones.reduce((s, m) => s + Number(m.amount ?? 0), 0);

    return (
        <div id="view-detail" className="page-view active">
            <button className="btn-back" onClick={onBack}>← Back to Explorer</button>

            {/* Header */}
            <div className="blueprint-header">
                <div className="blueprint-title-block">
                    <p className="uppercase mono" style={{ fontSize: 11, color: "rgba(22,26,29,0.4)", marginBottom: 8 }}>
                        CONTRACT {String(jobId).padStart(3, "0")}
                    </p>
                    <h2 className="display">
                        {localMeta?.title ?? `Contract ${String(jobId).padStart(3, "0")}`}
                    </h2>
                    {localMeta?.description && (
                        <p style={{ color: "rgba(22,26,29,0.5)", marginTop: 8, fontSize: 14, maxWidth: 520 }}>
                            {localMeta.description}
                        </p>
                    )}
                    <div className="parties-grid" style={{ marginTop: 20 }}>
                        <div>
                            <p className="party-label">Client Address</p>
                            <p className="party-hash mono">{truncate(chain?.client ?? localMeta?.clientAddress ?? "")}</p>
                        </div>
                        <div>
                            <p className="party-label">Freelancer Address</p>
                            <p className="party-hash mono">{truncate(chain?.freelancer ?? localMeta?.freelancerAddress ?? "")}</p>
                        </div>
                    </div>
                </div>

                <div className="escrow-total">
                    <p className="party-label" style={{ textAlign: "right" }}>Total Escrow</p>
                    <p className="escrow-amount display">{totalXlm > 0 ? totalXlm : "—"}</p>
                    <p className="escrow-label">XLM</p>
                </div>
            </div>

            {/* Milestones timeline */}
            {loading && <p className="uppercase" style={{ color: "rgba(22,26,29,0.4)", padding: "40px 0" }}>Loading contract state…</p>}

            {!loading && (
                <div className="structural-timeline">
                    {milestones.length === 0 && (
                        <div className="stone-block">
                            <div className="stone-info">
                                <div className="stone-meta">
                                    <h3>No milestones recorded</h3>
                                    <p>On-chain data only</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {milestones.map((ms, i) => {
                        const chainMs = chain?.milestones?.[i];
                        const status = getMilestoneStatus(chainMs);
                        const blockClass = stoneBlockClass(status);
                        const label = stageLabel(status, i, chainMs);

                        return (
                            <div key={i} className={blockClass}>
                                <div className="stone-info">
                                    <div className="stone-meta">
                                        <p className="uppercase mono" style={{ fontSize: 11, marginBottom: 6, opacity: 0.6 }}>
                                            {label}
                                        </p>
                                        <h3 className="display">{ms.title}</h3>
                                        {ms.description && (
                                            <p style={{ fontSize: 13, marginTop: 4, opacity: 0.6 }}>{ms.description}</p>
                                        )}
                                    </div>
                                    <div className="stone-value mono">{ms.amount ?? "—"} XLM</div>
                                </div>

                                <MilestoneActions
                                    jobId={jobId}
                                    milestoneIndex={i}
                                    status={status}
                                    role={role}
                                    milestoneTitle={ms.title || `Milestone ${i + 1}`}
                                    chainMs={chainMs}
                                    onRaiseDispute={(idx, title) => setDisputeMilestone({ index: idx, title })}
                                    onSuccess={() => setRefresh(r => r + 1)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {disputeMilestone && (
                <RaiseDisputeModal
                    jobId={jobId}
                    milestoneIndex={disputeMilestone.index}
                    milestoneTitle={disputeMilestone.title}
                    onClose={() => setDisputeMilestone(null)}
                    onSuccess={() => setRefresh(r => r + 1)}
                />
            )}
        </div>
    );
}

// ── Explorer (List) View ──────────────────────────────────────────────────────

function ExplorerView({ onSelect }: { onSelect: (id: number, meta: JobMetadataPayload) => void }) {
    const { publicKey } = useWallet();
    const [search, setSearch] = useState("");
    const [jobs, setJobs] = useState<JobMetadataPayload[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (q: string) => {
        setLoading(true);
        try {
            const data = await fetchJobMetadata();
            const allJobs: JobMetadataPayload[] = Array.isArray(data) ? data : (data.jobs ?? []);
            const filtered = q
                ? allJobs.filter(j =>
                    String(j.jobId).includes(q) ||
                    (j.title ?? "").toLowerCase().includes(q.toLowerCase()) ||
                    (j.clientAddress ?? "").toLowerCase().includes(q.toLowerCase()) ||
                    (j.freelancerAddress ?? "").toLowerCase().includes(q.toLowerCase())
                )
                : allJobs;
            setJobs(filtered);
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [publicKey]);

    useEffect(() => {
        const t = setTimeout(() => load(search), 350);
        return () => clearTimeout(t);
    }, [search, load]);

    return (
        <div id="view-explorer" className="page-view active">
            <div className="blueprint-explorer-header">
                <div>
                    <h2 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.04em" }}>
                        Explorer
                    </h2>
                    <p style={{ color: "rgba(22,26,29,0.5)", marginTop: 8, fontSize: 15 }}>
                        Browse and inspect all escrow contracts on-chain
                    </p>
                </div>
                <input
                    className="explorer-search mono"
                    type="text"
                    placeholder="Search by title, address, or ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="contract-list-view">
                {loading && (
                    <p className="uppercase" style={{ color: "rgba(22,26,29,0.4)", padding: "40px 0" }}>
                        Fetching contracts…
                    </p>
                )}

                {!loading && jobs.length === 0 && (
                    <div className="contract-module" style={{ opacity: 0.4, pointerEvents: "none" }}>
                        <div><p className="c-title">No contracts found</p></div>
                    </div>
                )}

                {jobs.map((job) => {
                    const totalXlm = job.milestones?.reduce((s, m) => s + Number(m.amount ?? 0), 0) ?? 0;
                    return (
                        <div
                            key={job.jobId}
                            className="contract-module"
                            onClick={() => onSelect(job.jobId, job)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === "Enter" && onSelect(job.jobId, job)}
                        >
                            <div>
                                <p className="c-title display">
                                    {job.title || `Contract ${String(job.jobId).padStart(3, "0")}`}
                                </p>
                                <p className="c-meta mono">
                                    {truncate(job.clientAddress)} · {job.milestones?.length ?? 0} milestone{(job.milestones?.length ?? 0) !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <div className="c-status">
                                <div className="status-ring ring-active">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                    </svg>
                                </div>
                                <span className="uppercase" style={{ color: "var(--banknote)" }}>Active</span>
                            </div>
                            <div className="c-value mono">
                                {totalXlm > 0 ? `${totalXlm} XLM` : "—"}
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: 24, opacity: 0.3 }}>→</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function BlueprintView({
    setView,
    initialJobId
}: {
    setView?: (v: string) => void;
    initialJobId?: number;
}) {
    const [selected, setSelected] = useState<{ id: number; meta: JobMetadataPayload } | null>(
        initialJobId !== undefined ? { id: initialJobId, meta: null as any } : null
    );

    return selected ? (
        <DetailView
            jobId={selected.id}
            meta={selected.meta}
            onBack={() => setSelected(null)}
        />
    ) : (
        <ExplorerView
            onSelect={(id, meta) => setSelected({ id, meta })}
        />
    );
}
