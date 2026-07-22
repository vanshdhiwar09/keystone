"use client";

import { useEffect, useState } from "react";
import { useWallet } from "../../context/WalletContext";
import { fetchJobMetadata, JobMetadataPayload } from "../../lib/api";

// ── Status Ring Icons — copied verbatim from reference ────────────────────────

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

// ── Hero Arch SVG — animated masonry arch ─────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str: string) { return `${str.slice(0, 4)}…${str.slice(-4)}`; }

function getJobStatus(job: any): "active" | "disputed" | "done" {
    const raw = job.data?.status;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (!s) return "active";
    const str = typeof s === "string" ? s.toLowerCase() : "";
    if (str.includes("dispute")) return "disputed";
    if (str.includes("complete") || str.includes("release") || str.includes("refund")) return "done";
    return "active";
}

function getStatusLabel(status: "active" | "disputed" | "done"): string {
    if (status === "disputed") return "Disputed";
    if (status === "done") return "Complete";
    return "In Progress";
}

function getStatusColor(status: "active" | "disputed" | "done"): string {
    if (status === "disputed") return "var(--oxide)";
    if (status === "done") return "var(--iron)";
    return "var(--banknote)";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardView({ setView }: { setView: (v: string) => void }) {
    const { publicKey } = useWallet();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        async function fetchJobs() {
            if (!publicKey) return;
            setLoading(true);
            try {
                const data = await fetchJobMetadata({ wallet: publicKey });
                if (active) {
                    setJobs(Array.isArray(data) ? data : (data.jobs ?? []));
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (active) setLoading(false);
            }
        }
        fetchJobs();
        return () => { active = false; };
    }, [publicKey]);

    return (
        <main className="page-view active" id="view-dashboard">
            {/* ── Dashboard Grid — 2-column reference layout ── */}
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

                    {/* Stats row — reference design */}
                    <div style={{ display: "flex", gap: 40, marginTop: 60 }}>
                        <div>
                            <p className="mono" style={{ fontSize: 32, fontWeight: 600, color: "var(--iron)" }}>
                                {jobs.length > 0 ? `${jobs.length}` : "—"}
                            </p>
                            <p className="uppercase" style={{ color: "rgba(22,26,29,0.5)" }}>
                                {jobs.length === 1 ? "Contract Active" : "Contracts Active"}
                            </p>
                        </div>
                        <div>
                            <p className="mono" style={{ fontSize: 32, fontWeight: 600, color: "var(--iron)" }}>100%</p>
                            <p className="uppercase" style={{ color: "rgba(22,26,29,0.5)" }}>Release Rate</p>
                        </div>
                    </div>
                </div>

                {/* Right: Animated Arch */}
                <div className="arch-container" id="hero-arch-container">
                    <HeroArch />
                </div>

                {/* Bottom: Active Contracts — spans full width */}
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
                                Scanning architecture…
                            </p>
                        )}

                        {!loading && jobs.length === 0 && (
                            <div className="contract-module" style={{ opacity: 0.4, pointerEvents: "none" }}>
                                <div>
                                    <p className="c-title display">No Active Contracts</p>
                                    <p className="c-meta mono">Deploy your first escrow to get started</p>
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

                        {jobs.map((job: JobMetadataPayload) => {
                            // Determine role label based on connected wallet
                            const roleLabel = job.clientAddress === publicKey ? "Client" : "Freelancer";
                            const counterparty = job.clientAddress === publicKey
                                ? truncate(job.freelancerAddress || "")
                                : truncate(job.clientAddress || "");

                            const tvl = Array.isArray(job.milestones)
                                ? job.milestones.reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0)
                                : 0;

                            return (
                                <div
                                    key={job.jobId}
                                    className="contract-module"
                                    onClick={() => setView(`blueprint:${job.jobId}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === "Enter" && setView(`blueprint:${job.jobId}`)}
                                >
                                    <div>
                                        <p className="c-title display">{job.title || `Contract ${job.jobId.toString().padStart(3, "0")}`}</p>
                                        <p className="c-meta mono">{roleLabel} · {counterparty}</p>
                                    </div>
                                    <div className="c-status">
                                        <RingActive />
                                        <span className="uppercase" style={{ color: "var(--banknote)" }}>In Progress</span>
                                    </div>
                                    <div className="c-value mono">{tvl > 0 ? `${tvl} XLM` : "— XLM"}</div>
                                    <div style={{ textAlign: "right" }}>
                                        <span style={{ fontSize: 24, opacity: 0.3 }}>→</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </main>
    );
}
