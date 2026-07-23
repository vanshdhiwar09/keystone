"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../../context/WalletContext";
import { fetchJobMetadata, JobMetadataPayload } from "../../lib/api";
import { fetchJobData, txResolveDispute, pollTx, server, ARBITER_ID, invalidateJobCache } from "../../lib/soroban";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { useToast } from "../../context/ToastContext";

function truncate(s: string) { return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "—"; }

interface DisputeEntry {
    job: JobMetadataPayload;
    chainJob: any;
    milestoneIndex: number;
    milestoneMeta: any;
    chainMs: any;
}

export default function DisputesView() {
    const { publicKey, network } = useWallet();
    const { toast, dismissToast, isUserCancellation, getFriendlyErrorMessage } = useToast();
    const [jobs, setJobs] = useState<JobMetadataPayload[]>([]);
    const [loading, setLoading] = useState(true);
    const [chainData, setChainData] = useState<Record<number, any>>({});
    const [working, setWorking] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const passphrase = network === "TESTNET"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJobMetadata();
            const allJobs = Array.isArray(data) ? data : (data.jobs ?? []);
            setJobs(allJobs);

            if (publicKey) {
                const cData: Record<number, any> = {};
                for (const j of allJobs) {
                    try {
                        cData[j.jobId] = await fetchJobData(j.jobId, publicKey);
                    } catch { /* silently skip */ }
                }
                setChainData(cData);
            }
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [publicKey]);

    useEffect(() => { load(); }, [load]);

    // Collect all disputed milestones across all jobs
    const disputes: DisputeEntry[] = [];
    for (const job of jobs) {
        const cJob = chainData[job.jobId];
        if (!cJob?.milestones) continue;
        job.milestones.forEach((mMeta, i) => {
            const cMs = cJob.milestones[i];
            const status = String(cMs?.status ?? "").toLowerCase();
            if (status.includes("dispute")) {
                disputes.push({ job, chainJob: cJob, milestoneIndex: i, milestoneMeta: mMeta, chainMs: cMs });
            }
        });
    }

    const totalDisputes = disputes.length;
    const totalPages = Math.ceil(totalDisputes / itemsPerPage);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalDisputes, totalPages, currentPage]);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(currentPage * itemsPerPage, totalDisputes);
    const paginatedDisputes = disputes.slice(startIndex, endIndex);

    const isArbiter = publicKey === ARBITER_ID;

    async function handleResolve(jobId: number, milestoneIndex: number, clientFault: boolean) {
        if (working || !publicKey) return;
        const key = `${jobId}-${milestoneIndex}-${clientFault ? "release" : "refund"}`;
        setWorking(key);
        const toastId = toast.loading("Preparing transaction...");
        try {
            const tx = await txResolveDispute(publicKey, jobId, milestoneIndex + 1, clientFault);
            const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: passphrase, address: publicKey });
            if (!signedTxXdr) {
                throw new Error("User declined to sign");
            }
            const submitted = await server.sendTransaction(
                TransactionBuilder.fromXDR(signedTxXdr, passphrase) as any
            );
            if (submitted.status !== "PENDING") throw new Error("Submission failed");
            await pollTx(submitted.hash);
            dismissToast(toastId);
            toast.success("Transaction completed.");
            invalidateJobCache(jobId);
            await load();
        } catch (e: any) {
            dismissToast(toastId);
            const userMsg = getFriendlyErrorMessage(e);

            if (isUserCancellation(e)) {
                toast.info(userMsg);
            } else {
                console.error("Resolve dispute transaction failed details (developer console):", e);
                toast.error(userMsg);
            }
        } finally {
            setWorking(null);
        }
    }

    return (
        <main id="view-disputes" className="page-view active" style={{ paddingBottom: 160 }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ marginBottom: 48 }}>
                    <p className="uppercase mono" style={{ fontSize: 11, color: "rgba(22,26,29,0.4)", marginBottom: 10 }}>
                        {isArbiter ? "Arbiter Console" : "Disputes"}
                    </p>
                    <h3 className="display section-title" style={{ fontSize: 36, marginBottom: 8 }}>
                        {isArbiter ? "Arbiter Jurisdiction" : "Active Disputes"}
                    </h3>
                    <p style={{ color: "rgba(22,26,29,0.5)", fontSize: 14 }}>
                        {isArbiter
                            ? "You are authenticated as the master Arbiter. Review and resolve disputed milestones below."
                            : "Contracts with active milestone disputes. Awaiting arbiter resolution."}
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <p className="uppercase mono" style={{ color: "rgba(22,26,29,0.4)", fontSize: 12 }}>
                        Scanning ledger for disputes…
                    </p>
                )}

                {/* Empty state */}
                {!loading && disputes.length === 0 && (
                    <div className="dispute-module" style={{ opacity: 0.4, pointerEvents: "none" }}>
                        <div className="d-top">
                            <div>
                                <p className="d-title display">No Active Disputes</p>
                                <p className="d-meta" style={{ marginTop: 6 }}>All contracts are in good standing.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dispute cards */}
                {paginatedDisputes.map((d) => {
                    const key = `${d.job.jobId}-${d.milestoneIndex}`;
                    const isWorking = working?.startsWith(key);
                    const disputeStatusRaw = String(d.chainMs?.status ?? "DISPUTED").toUpperCase().replace(/_/g, " ");
                    const clientAddr = d.chainJob?.client || d.job.clientAddress || "";
                    const freelancerAddr = d.chainJob?.freelancer || d.job.freelancerAddress || "";

                    return (
                        <div
                            key={key}
                            className="dispute-module"
                            style={{ opacity: isWorking ? 0.5 : 1, marginBottom: 24 }}
                        >
                            {/* Card top */}
                            <div className="d-top">
                                <div style={{ flex: 1 }}>
                                    {/* Project title + contract badge */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                                        <p className="d-title display">
                                            {d.job.title || `Contract ${String(d.job.jobId).padStart(3, "0")}`}
                                        </p>
                                        <span className="mono uppercase" style={{
                                            fontSize: 10, padding: "3px 8px",
                                            border: "1px solid var(--grid-line)",
                                            color: "rgba(22,26,29,0.4)"
                                        }}>
                                            CONTRACT {String(d.job.jobId).padStart(3, "0")}
                                        </span>
                                    </div>

                                    {/* Job description */}
                                    {d.job.description && (
                                        <p style={{ fontSize: 13, color: "rgba(22,26,29,0.5)", marginBottom: 12, maxWidth: 500 }}>
                                            {d.job.description}
                                        </p>
                                    )}

                                    {/* Milestone info */}
                                    <p className="d-meta" style={{ marginBottom: 10 }}>
                                        Milestone {d.milestoneIndex + 1}
                                        {d.milestoneMeta?.title ? ` — ${d.milestoneMeta.title}` : ""}
                                        {" · "}
                                        <span style={{ color: "var(--oxide)" }}>Disputed</span>
                                    </p>

                                    {/* Dispute status badge */}
                                    <span className="m-pill" style={{
                                        background: "rgba(164,76,39,0.1)", color: "var(--oxide)",
                                        boxShadow: "none", fontSize: 11
                                    }}>
                                        {disputeStatusRaw}
                                    </span>
                                </div>

                                {/* Amount */}
                                <div className="d-value mono" style={{ fontSize: 22, textAlign: "right", marginLeft: 24, flexShrink: 0 }}>
                                    {d.milestoneMeta?.amount ?? "—"} XLM
                                </div>
                            </div>

                            {/* Parties */}
                            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--grid-line)", display: "flex", gap: 40 }}>
                                <div>
                                    <p className="uppercase" style={{ fontSize: 10, color: "rgba(22,26,29,0.4)", marginBottom: 4 }}>Employer</p>
                                    <p className="mono" style={{ fontSize: 13 }}>{truncate(clientAddr)}</p>
                                </div>
                                <div>
                                    <p className="uppercase" style={{ fontSize: 10, color: "rgba(22,26,29,0.4)", marginBottom: 4 }}>Freelancer</p>
                                    <p className="mono" style={{ fontSize: 13 }}>{truncate(freelancerAddr)}</p>
                                </div>
                            </div>

                            {/* Dispute details if present, fallback to Milestone Scope */}
                            {(d.milestoneMeta?.disputeTitle || d.milestoneMeta?.disputeDescription) ? (
                                <div style={{
                                    padding: "20px 24px",
                                    background: "rgba(164, 76, 39, 0.03)",
                                    borderTop: "1px solid rgba(164, 76, 39, 0.1)",
                                    borderBottom: "1px solid rgba(164, 76, 39, 0.1)"
                                }}>
                                    <p className="uppercase mono" style={{ fontSize: 10, marginBottom: 12, color: "var(--oxide)", fontWeight: 700, letterSpacing: "0.05em" }}>
                                        Dispute Details
                                    </p>
                                    <h4 className="display" style={{ fontSize: 16, marginBottom: 8, color: "var(--iron)" }}>
                                        {d.milestoneMeta.disputeTitle}
                                    </h4>
                                    <p style={{ fontSize: 14, color: "rgba(22,26,29,0.8)", marginBottom: d.milestoneMeta.disputeNotes ? 12 : 0, lineHeight: 1.5 }}>
                                        {d.milestoneMeta.disputeDescription}
                                    </p>
                                    {d.milestoneMeta.disputeNotes && (
                                        <div style={{ padding: "10px 14px", background: "rgba(0, 0, 0, 0.02)", borderLeft: "2px solid rgba(164, 76, 39, 0.3)", fontSize: 12, color: "rgba(22,26,29,0.6)" }}>
                                            <strong style={{ display: "block", marginBottom: 2 }}>Supporting Notes:</strong>
                                            {d.milestoneMeta.disputeNotes}
                                        </div>
                                    )}
                                </div>
                            ) : d.milestoneMeta?.description ? (
                                <div style={{
                                    padding: "16px 24px",
                                    background: "rgba(22,26,29,0.02)",
                                    borderTop: "1px solid var(--grid-line)",
                                    borderBottom: "1px solid var(--grid-line)"
                                }}>
                                    <p className="uppercase" style={{ fontSize: 10, marginBottom: 8, color: "rgba(22,26,29,0.5)" }}>
                                        Milestone Scope
                                    </p>
                                    <p style={{ fontStyle: "italic", fontSize: 14, color: "rgba(22,26,29,0.7)" }}>
                                        "{d.milestoneMeta.description}"
                                    </p>
                                </div>
                            ) : null}

                            {/* Actions — ARBITER ONLY */}
                            <div className="d-actions" style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "center" }}>
                                {isArbiter ? (
                                    <>
                                        <button
                                            className="stone-btn"
                                            disabled={!!working}
                                            onClick={() => handleResolve(d.job.jobId, d.milestoneIndex, true)}
                                        >
                                            {working === `${key}-release` ? "Processing…" : "RESOLVE — RELEASE"}
                                        </button>
                                        <button
                                            className="stone-btn"
                                            disabled={!!working}
                                            onClick={() => handleResolve(d.job.jobId, d.milestoneIndex, false)}
                                        >
                                            {working === `${key}-refund` ? "Processing…" : "RESOLVE — REFUND"}
                                        </button>
                                    </>
                                ) : (
                                    <p className="uppercase mono" style={{
                                        fontSize: 11, color: "rgba(22,26,29,0.35)",
                                        padding: "8px 0"
                                    }}>
                                        Awaiting arbiter resolution — view only
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Pagination Footer */}
                {totalDisputes > 0 && (
                    <div className="pagination-footer">
                        <div className="pagination-summary">
                            Showing {startIndex + 1}–{endIndex} of {totalDisputes} active disputes
                        </div>
                        <div className="pagination-buttons">
                            <button
                                className="stone-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                                PREVIOUS
                            </button>
                            <button
                                className="stone-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                                NEXT
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
