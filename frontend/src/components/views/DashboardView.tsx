"use client";

import { useEffect, useState } from "react";
import { useWallet } from "../../context/WalletContext";
import { fetchJobData, ARBITER_ID, JobStatus, getJobStatus } from "../../lib/soroban";
import { fetchJobMetadata, JobMetadataPayload } from "../../lib/api";

function RingActive() {
    return (
        <div className="status-ring ring-active">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        </div>
    );
}

function RingDispute() {
    return (
        <div className="status-ring ring-dispute">
            <span style={{ fontWeight: 800, fontFamily: "sans-serif" }}>!</span>
        </div>
    );
}

function RingDone() {
    return (
        <div className="status-ring ring-done">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </div>
    );
}

function HeroArch() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

    const stones = 9;
    const paths = Array.from({ length: stones }).map((_, i) => {
        const cx = 200, cy = 250, r1 = 100, r2 = 160;
        const startAngle = 180, endAngle = 0;
        const a0 = startAngle - (i / stones) * (startAngle - endAngle);
        const a1 = startAngle - ((i + 1) / stones) * (startAngle - endAngle);
        const rad0 = (a0 * Math.PI) / 180, rad1 = (a1 * Math.PI) / 180;
        const x1 = cx + r1 * Math.cos(rad0), y1 = cy - r1 * Math.sin(rad0);
        const x2 = cx + r2 * Math.cos(rad0), y2 = cy - r2 * Math.sin(rad0);
        const x3 = cx + r2 * Math.cos(rad1), y3 = cy - r2 * Math.sin(rad1);
        const x4 = cx + r1 * Math.cos(rad1), y4 = cy - r1 * Math.sin(rad1);
        const isKeystone = i === Math.floor(stones / 2);
        const d = `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`;
        const delay = isKeystone ? 1000 : (i < 4 ? i * 150 : (8 - i) * 150);

        const style = mounted ? {
            opacity: 1, transform: "translateY(0)",
            stroke: isKeystone ? "var(--brass)" : "var(--iron)",
            fill: isKeystone ? "var(--brass)" : "var(--alum)",
            filter: isKeystone ? "drop-shadow(0 0 24px rgba(191,161,95,0.8))" : "none",
            strokeWidth: "1.5px", strokeDasharray: 400, strokeDashoffset: 0,
            transition: `all 0.8s cubic-bezier(0.85, 0, 0.15, 1) ${delay}ms`
        } : {
            opacity: isKeystone ? 0 : 1,
            transform: isKeystone ? "translateY(-40px)" : "translateY(0)",
            fill: "transparent", stroke: "var(--iron)", strokeWidth: "1.5px",
            strokeDasharray: 400, strokeDashoffset: 400,
            filter: "none", transition: "all 0.8s cubic-bezier(0.85, 0, 0.15, 1)"
        };

        return <path key={i} d={d} style={style} />;
    });

    return (
        <svg viewBox="0 0 400 300" fill="none" style={{ width: "100%", maxWidth: 600, overflow: "visible", filter: "drop-shadow(0 24px 48px rgba(191,161,95,0.15))" }}>
            <path d="M20,250 L380,250" stroke="var(--grid-major)" strokeWidth="2" />
            {paths}
        </svg>
    );
}

function truncate(str: string) { return str ? `${str.slice(0, 4)}…${str.slice(-4)}` : "—"; }


function getMilestoneProgress(meta: JobMetadataPayload, chainData: any) {
    const total = meta.milestones?.length ?? 0;
    if (!total || !chainData?.milestones) return { done: 0, total };
    const done = chainData.milestones.filter((m: any) => {
        const s = String(m?.status ?? "").toLowerCase();
        return s.includes("approve") || s.includes("release");
    }).length;
    return { done, total };
}

interface DashboardJob {
    meta: JobMetadataPayload;
    chain: any;
    status: JobStatus;
}

export default function DashboardView({ setView }: { setView: (v: string) => void }) {
    const { publicKey } = useWallet();
    const [jobs, setJobs] = useState<DashboardJob[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        async function loadJobs() {
            if (!publicKey) return;
            setLoading(true);
            try {
                const isArbiter = publicKey === ARBITER_ID;
                const res = await fetchJobMetadata(isArbiter ? undefined : { wallet: publicKey });
                const metaJobs: JobMetadataPayload[] = Array.isArray(res) ? res : (res.jobs ?? []);

                const found: DashboardJob[] = [];
                for (const meta of metaJobs) {
                    try {
                        const chain = await fetchJobData(meta.jobId, publicKey);
                        found.push({ meta, chain, status: getJobStatus(chain) });
                    } catch {
                        found.push({ meta, chain: null, status: "active" });
                    }
                }

                if (active) setJobs(found);
            } catch (err) {
                console.error("Dashboard job fetch error", err);
            } finally {
                if (active) setLoading(false);
            }
        }
        loadJobs();
        return () => { active = false; };
    }, [publicKey]);

    const statusLabel = (s: JobStatus) => s === "disputed" ? "Disputed" : s === "done" ? "Complete" : "In Progress";
    const statusColor = (s: JobStatus) => s === "disputed" ? "var(--oxide)" : s === "done" ? "var(--iron)" : "var(--banknote)";

    const isArbiter = publicKey === ARBITER_ID;
    const isFreelancer = !isArbiter && jobs.some(j => j.meta.freelancerAddress === publicKey);

    const countLabel = isArbiter
        ? (jobs.length === 1 ? "Job Under Jurisdiction" : "Jobs Under Jurisdiction")
        : isFreelancer
            ? (jobs.length === 1 ? "Assigned Contract" : "Assigned Contracts")
            : (jobs.length === 1 ? "Contract Active" : "Contracts Active");

    const amountLabel = isArbiter
        ? "Escrow Under Mgt"
        : isFreelancer
            ? "Escrow Associated"
            : "Total Escrow Funded";

    return (
        <main className="page-view active" id="view-dashboard">
            <div className="dashboard-grid">
                {/* Left: Hero Statement */}
                <div className="hero-statement">
                    <h2 className="display">
                        Work locks in.<br />
                        Trust <em>holds it together.</em>
                    </h2>
                    <p>
                        Funds remain cryptographically locked in escrow until milestones are mutually approved.
                        No invoicing, no chasing, no intermediaries.
                    </p>

                    <div style={{ display: "flex", gap: 40, marginTop: 60 }}>
                        <div>
                            <p className="mono" style={{ fontSize: 32, fontWeight: 600, color: "var(--iron)" }}>
                                {jobs.length > 0 ? `${jobs.length}` : "—"}
                            </p>
                            <p className="uppercase" style={{ color: "rgba(22,26,29,0.5)" }}>
                                {countLabel}
                            </p>
                        </div>
                        <div>
                            <p className="mono" style={{ fontSize: 32, fontWeight: 600, color: "var(--iron)" }}>
                                {jobs.length > 0
                                    ? `${jobs.reduce((sum, j) => sum + (j.meta.milestones?.reduce((s, m) => s + Number(m.amount ?? 0), 0) ?? 0), 0)} XLM`
                                    : "—"}
                            </p>
                            <p className="uppercase" style={{ color: "rgba(22,26,29,0.5)" }}>{amountLabel}</p>
                        </div>
                    </div>
                </div>

                {/* Right: Animated Arch */}
                <div className="arch-container" id="hero-arch-container">
                    <HeroArch />
                </div>

                {/* Bottom: Active Contracts */}
                <div className="contracts-section">
                    <div className="section-header">
                        <h3 className="display section-title">Active Contracts</h3>
                        <button
                            className="stone-btn primary"
                            style={{ padding: "12px 24px", borderRadius: 4, fontSize: 12 }}
                            onClick={() => setView("create")}
                        >
                            New Contract
                        </button>
                    </div>

                    <div>
                        {loading && (
                            <p className="uppercase" style={{ color: "rgba(22,26,29,0.4)", padding: "40px 0" }}>
                                Loading contracts…
                            </p>
                        )}

                        {!loading && jobs.length === 0 && (
                            <div className="contract-module" style={{ opacity: 0.4, pointerEvents: "none" }}>
                                <div>
                                    <p className="c-title display">No Active Contracts</p>
                                    <p className="c-meta mono">
                                        {isArbiter
                                            ? "Awaiting disputes or contracts under jurisdiction"
                                            : isFreelancer
                                                ? "Awaiting escrow assignments from clients"
                                                : "Deploy your first escrow to get started"}
                                    </p>
                                </div>
                                <div className="c-status">
                                    <RingDone />
                                    <span className="uppercase" style={{ color: "rgba(22,26,29,0.4)" }}>Awaiting</span>
                                </div>
                                <div className="c-value mono">0 XLM</div>
                                <div style={{ textAlign: "right" }}>
                                    <span style={{ fontSize: 24, opacity: 0.2 }}>→</span>
                                </div>
                            </div>
                        )}

                        {jobs.map(({ meta, chain, status }) => {
                            const totalXlm = meta.milestones?.reduce((s, m) => s + Number(m.amount ?? 0), 0) ?? 0;
                            const { done, total } = getMilestoneProgress(meta, chain);
                            const isArbiter = publicKey === ARBITER_ID;
                            const roleLabel = isArbiter ? "Arbiter"
                                : chain?.client === publicKey ? "Client"
                                    : "Freelancer";

                            return (
                                <div
                                    key={meta.jobId}
                                    className="contract-module"
                                    onClick={() => setView(`blueprint:${meta.jobId}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === "Enter" && setView(`blueprint:${meta.jobId}`)}
                                    style={{ cursor: "pointer" }}
                                >
                                    {/* Column 1: Title & Meta */}
                                    <div>
                                        <p className="c-title display" style={{ marginBottom: 4 }}>
                                            {meta.title || `Contract ${String(meta.jobId).padStart(3, "0")}`}
                                        </p>
                                        {meta.description && (
                                            <p className="c-meta" style={{ color: "rgba(22,26,29,0.5)", fontSize: 13, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                                                {meta.description}
                                            </p>
                                        )}
                                        <p className="c-meta mono" style={{ fontSize: 12 }}>
                                            {roleLabel} · {total > 0 ? `${done}/${total} milestones` : "No milestones"}
                                        </p>
                                    </div>

                                    {/* Column 2: Status */}
                                    <div className="c-status">
                                        {status === "active" && <RingActive />}
                                        {status === "disputed" && <RingDispute />}
                                        {status === "done" && <RingDone />}
                                        <span className="uppercase" style={{ color: statusColor(status) }}>{statusLabel(status)}</span>
                                    </div>

                                    {/* Column 3 & 4: Value and Arrow merged and right-aligned */}
                                    <div style={{ gridColumn: "3 / 5", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16 }}>
                                        <div className="c-value mono">
                                            {totalXlm > 0 ? `${totalXlm} XLM` : "—"}
                                        </div>
                                        <span style={{ fontSize: 24, opacity: 0.3 }}>→</span>
                                    </div>

                                    {/* Spanned Row: Progress bar */}
                                    {total > 0 && (
                                        <div style={{ gridColumn: "1 / -1", width: "100%", height: 3, background: "rgba(22,26,29,0.08)", borderRadius: 2, marginTop: 24 }}>
                                            <div style={{
                                                width: `${Math.round((done / total) * 100)}%`,
                                                height: "100%",
                                                background: status === "disputed" ? "var(--oxide)" : "var(--brass)",
                                                borderRadius: 2,
                                                transition: "width 0.4s ease"
                                            }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </main>
    );
}
