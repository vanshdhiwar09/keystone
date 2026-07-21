"use client";

import { useEffect, useState } from "react";
import { useWallet } from "../../context/WalletContext";
import { fetchJobData } from "../../lib/soroban";

function HeroArch() {
    // ... Original HeroArch retained precisely
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
            opacity: 1, transform: 'translateY(0)', stroke: isKeystone ? 'var(--brass)' : 'var(--iron)',
            fill: isKeystone ? 'var(--brass)' : 'var(--alum)', filter: isKeystone ? 'drop-shadow(0 0 24px rgba(191,161,95,0.8))' : 'none',
            strokeWidth: '1.5px', strokeDasharray: 400, strokeDashoffset: 0, transition: `all 0.8s cubic-bezier(0.85, 0, 0.15, 1) ${delay}ms`
        } : {
            opacity: isKeystone ? 0 : 1, transform: isKeystone ? 'translateY(-40px)' : 'translateY(0)',
            fill: 'transparent', stroke: 'var(--iron)', strokeWidth: '1.5px', strokeDasharray: 400, strokeDashoffset: 400,
            filter: 'none', transition: `all 0.8s cubic-bezier(0.85, 0, 0.15, 1)`
        };

        return <path key={i} d={d} style={style} />;
    });

    return (
        <svg className="dynamic-arch" viewBox="0 0 400 300" fill="none">
            <path d="M20,250 L380,250" stroke="var(--grid-major)" strokeWidth="2" />
            {paths}
        </svg>
    );
}

export default function DashboardView({ setView }: { setView: (v: string) => void }) {
    const { publicKey } = useWallet();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [tvl, setTvl] = useState(0);

    const truncate = (str: string) => `${str.slice(0, 4)}…${str.slice(-4)}`;

    // Existing "hardcoded scan" logic rewritten gracefully restoring Day 11 logic
    useEffect(() => {
        let active = true;
        async function fetchJobs() {
            if (!publicKey) return;
            setLoading(true);
            const found: any[] = [];
            let cumulativeXlm = 0;


            for (let i = 1; i <= 5; i++) {
                try {
                    const val = await fetchJobData(i, publicKey);
                    if (val && (val.client === publicKey || val.freelancer === publicKey)) {
                        found.push({ id: i, data: val });
                    }
                } catch {
                    // Job doesn't exist at this ID, continue scanning
                }
            }
            if (active) {
                setJobs(found);
                setTvl(cumulativeXlm);
                setLoading(false);
            }
        }
        fetchJobs();
        return () => { active = false; };
    }, [publicKey]);

    return (
        <main className="page-view active animate-[fade-in_400ms_ease-out]" id="view-dashboard">
            <div className="hero-grid-layout">
                <div className="hero-statement stagger-2">
                    <p className="cad-label" style={{ marginBottom: "16px" }}>System Protocol v2.4</p>
                    <h2 className="display">Work locks in.<br /><em>Trust</em> holds it.</h2>
                    <p className="hero-sub">Cryptographically secure escrow without intermediaries. Funds remain locked structurally until milestones are mathematically proven.</p>
                </div>

                <div className="arch-theater stagger-3" id="hero-arch">
                    <HeroArch />
                </div>
            </div>

            <div className="data-girder stagger-4">
                <div className="data-block">
                    <span className="cad-label">Total Volume Locked</span>
                    <span className="data-value mono">{tvl} XLM</span>
                </div>
                <div className="data-block" style={{ paddingLeft: "40px" }}>
                    <span className="cad-label">Active Contracts</span>
                    <span className="data-value mono">{jobs.length}.00</span>
                </div>
                <div className="data-block" style={{ paddingLeft: "40px" }}>
                    <span className="cad-label">Distribution Rate</span>
                    <span className="data-value mono">100%</span>
                </div>
            </div>

            <div className="stagger-4" style={{ animationDelay: "0.5s", marginTop: "60px" }}>
                <div className="blueprint-header" style={{ marginBottom: "40px" }}>
                    <h3 className="section-title display">Active Architecture</h3>
                    <button className="btn-massive" style={{ padding: "12px 24px", minWidth: "200px" }} onClick={() => setView('create')}>Initialize Contract</button>
                </div>

                {loading && <p className="cad-label text-center pt-8">Scanning Cryptographic Architecture...</p>}

                {jobs.map(job => {
                    const statusStr = job.data.status ? (Array.isArray(job.data.status) ? job.data.status[0] : job.data.status) : "Active";

                    return (
                        <div key={job.id} className="contract-module" onClick={() => setView('blueprint')} role="button" tabIndex={0}>
                            <div>
                                <p className="c-title display">Contract {job.id.toString().padStart(3, '0')}</p>
                                <p className="c-meta mono">Client: {truncate(job.data.client)}</p>
                            </div>
                            <div className="c-status">
                                <span className="status-dot" style={{ background: statusStr === 'Disputed' ? 'var(--oxide)' : 'var(--brass)' }}></span>
                                <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    {statusStr}
                                </span>
                            </div>
                            <div className="c-meta mono">{job.data.milestone_count || 0} Milestones</div>
                            <div className="c-value mono">*** XLM</div>
                        </div>
                    );
                })}

                {!loading && jobs.length === 0 && (
                    <div className="contract-module" style={{ opacity: 0.5, pointerEvents: "none" }}>
                        <div>
                            <p className="c-title display">No Active Contracts</p>
                            <p className="c-meta">Awaiting Deployments</p>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
