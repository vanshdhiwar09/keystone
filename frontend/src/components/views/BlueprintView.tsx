"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../../context/WalletContext";
import { fetchJobData, txSubmitMilestone, txApproveMilestone, txRaiseDispute } from "../../lib/soroban";

import { fetchJobMetadata, JobMetadataPayload } from "../../lib/api";
import { signTransaction } from "@stellar/freighter-api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string) { return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "—"; }

function getMilestoneStatus(ms: any): "approved" | "disputed" | "active" {
    const s = String(ms?.status ?? "").toLowerCase();
    if (s.includes("approve") || s.includes("release")) return "approved";
    if (s.includes("dispute")) return "disputed";
    return "active";
}

// ── Per-Milestone Action Row ──────────────────────────────────────────────────

function MilestoneActions({
    jobId, milestoneIndex, status, role
}: {
    jobId: number;
    milestoneIndex: number;
    status: "approved" | "disputed" | "active";
    role: "client" | "freelancer" | "observer";
}) {
    const [working, setWorking] = useState(false);
    const [msg, setMsg] = useState("");
    const { publicKey, network } = useWallet();

    const passphrase = network === "TESTNET"
        ? "Test SDF Network ; September 2015"
        : "Public Global Stellar Network ; September 2015";

    async function exec(fn: () => Promise<any>, label: string) {
        if (!publicKey) return;
        setWorking(true);
        setMsg(`Preparing ${label}…`);
        try {
            const tx = await fn();
            setMsg("Sign in Freighter…");
            const xdrStr = typeof tx === "string" ? tx : tx.toXDR();
            const { signedTxXdr } = await signTransaction(xdrStr, { networkPassphrase: passphrase, address: publicKey });
            setMsg(`${label} submitted ✓`);
            setTimeout(() => setMsg(""), 3000);
            console.log("Signed XDR:", signedTxXdr);
        } catch (e: any) {
            setMsg(`Error: ${e.message ?? e}`);
        } finally {
            setWorking(false);
        }
    }

    if (status === "approved") return null; // approved stones show nothing

    return (
        <div className="stone-actions">
            {msg && <span className="mono" style={{ fontSize: 11, opacity: 0.6, alignSelf: "center" }}>{msg}</span>}

            {/* FREELANCER: submit work */}
            {role === "freelancer" && status === "active" && (
                <button
                    disabled={working}
                    className="stone-btn primary"
                    onClick={() => exec(
                        () => txSubmitMilestone(publicKey!, jobId, milestoneIndex),
                        "Submit Milestone"
                    )}
                >
                    Submit Work
                </button>
            )}

            {/* CLIENT: approve or dispute */}
            {role === "client" && status === "active" && (
                <>
                    <button
                        disabled={working}
                        className="stone-btn danger"
                        onClick={() => exec(
                            () => txRaiseDispute(publicKey!, jobId, milestoneIndex),
                            "Raise Dispute"
                        )}
                    >
                        Raise Dispute
                    </button>
                    <button
                        disabled={working}
                        className="stone-btn primary"
                        onClick={() => exec(
                            () => txApproveMilestone(publicKey!, jobId, milestoneIndex),
                            "Approve Milestone"
                        )}
                    >
                        Approve &amp; Release
                    </button>
                </>
            )}
        </div>
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

    useEffect(() => {
        let active = true;
        if (!publicKey) { setLoading(false); return; }
        fetchJobData(jobId, publicKey).then(d => { if (active) { setChain(d); setLoading(false); } }).catch(() => setLoading(false));
        return () => { active = false; };
    }, [jobId, publicKey]);

    const role =
        chain?.client === publicKey ? "client" :
            chain?.freelancer === publicKey ? "freelancer" : "observer";

    const milestones = meta?.milestones ?? [];
    const totalXlm = milestones.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);

    return (
        <div id="view-detail" className="page-view active">
            <button className="btn-back" onClick={onBack}>← Back to Explorer</button>

            {/* Header */}
            <div className="blueprint-header">
                <div className="blueprint-title-block">
                    <h2 className="display">
                        {meta?.title ?? `Contract ${String(jobId).padStart(3, "0")}`}
                    </h2>
                    <div className="parties-grid">
                        <div>
                            <p className="party-label">Client</p>
                            <p className="party-hash mono">{truncate(chain?.client ?? meta?.clientAddress ?? "")}</p>
                        </div>
                        <div>
                            <p className="party-label">Freelancer</p>
                            <p className="party-hash mono">{truncate(chain?.freelancer ?? meta?.freelancerAddress ?? "")}</p>
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
                    {milestones.map((ms: any, i: number) => {
                        const chainMs = chain?.milestones?.[i];
                        const status = getMilestoneStatus(chainMs);
                        const blockClass = `stone-block${status === "approved" ? " stone-approved" : status === "disputed" ? " stone-disputed" : ""}`;

                        return (
                            <div key={i} className={blockClass}>
                                <div className="stone-info">
                                    <div className="stone-meta">
                                        <h3 className="display">{ms.title}</h3>
                                        <p>
                                            {status === "approved" && "Stage Complete — Funds Released"}
                                            {status === "disputed" && "Milestone Disputed"}
                                            {status === "active" && "In Progress"}
                                        </p>
                                    </div>
                                    <div className="stone-value mono">
                                        {ms.amount ?? "—"} XLM
                                    </div>
                                </div>

                                <MilestoneActions
                                    jobId={jobId}
                                    milestoneIndex={i}
                                    status={status}
                                    role={role}
                                />
                            </div>
                        );
                    })}
                </div>
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
            const params: { search?: string; wallet?: string } = {};
            if (q) params.search = q;
            const data = await fetchJobMetadata(params);
            setJobs(Array.isArray(data) ? data : (data.jobs ?? []));
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce search
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

                {jobs.map((job) => (
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
                                {truncate(job.clientAddress)} · {job.milestones.length} milestone{job.milestones.length !== 1 ? "s" : ""}
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
                            {job.milestones.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0) || "—"} XLM
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 24, opacity: 0.3 }}>→</span>
                        </div>
                    </div>
                ))}
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
