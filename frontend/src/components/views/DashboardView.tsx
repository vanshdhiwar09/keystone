import { useEffect, useState } from "react";

function HeroArch() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setTimeout(() => setMounted(true), 50);
    }, []);

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
            opacity: 1,
            transform: 'translateY(0)',
            stroke: isKeystone ? 'var(--brass)' : 'var(--iron)',
            fill: isKeystone ? 'var(--brass)' : 'var(--alum)',
            filter: isKeystone ? 'drop-shadow(0 0 24px rgba(191,161,95,0.8))' : 'none',
            strokeWidth: '1.5px',
            strokeDasharray: 400,
            strokeDashoffset: 0,
            transition: `all 0.8s cubic-bezier(0.85, 0, 0.15, 1) ${delay}ms`
        } : {
            opacity: isKeystone ? 0 : 1,
            transform: isKeystone ? 'translateY(-40px)' : 'translateY(0)',
            fill: 'transparent',
            stroke: 'var(--iron)',
            strokeWidth: '1.5px',
            strokeDasharray: 400,
            strokeDashoffset: 400,
            filter: 'none',
            transition: `all 0.8s cubic-bezier(0.85, 0, 0.15, 1)`
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
    return (
        <main className="view active-view" id="view-dashboard">
            <div className="hero-grid-layout">
                <div className="hero-statement stagger-2">
                    <p className="cad-label" style={{ marginBottom: "16px" }}>System Protocol v2.4</p>
                    <h2 className="display">Work locks in.<br /><em>Trust</em> holds it.</h2>
                    <p className="hero-sub">Cryptographically secure escrow without intermediaries. Funds remain locked structurally until milestones are mathematically proven.</p>
                </div>

                <div className="arch-theater stagger-3" id="hero-arch">
                    {/* Static rendering. In production this could house ThreeJS or SVG dynamic draw tracking. */}
                    <svg className="dynamic-arch" viewBox="0 0 100 100" fill="none">
                        <path d="M 20 100 L 20 40 C 20 10 80 10 80 40 L 80 100" stroke="var(--brass)" strokeWidth="6" strokeLinecap="square" />
                        <path d="M 40 100 L 40 45 C 40 30 60 30 60 45 L 60 100" stroke="var(--iron)" strokeWidth="2" />
                    </svg>
                </div>
            </div>

            <div className="data-girder stagger-4">
                <div className="data-block">
                    <span className="cad-label">Total Volume Locked</span>
                    <span className="data-value mono">2,140 XLM</span>
                </div>
                <div className="data-block" style={{ paddingLeft: "40px" }}>
                    <span className="cad-label">Active Contracts</span>
                    <span className="data-value mono">7.00</span>
                </div>
                <div className="data-block" style={{ paddingLeft: "40px" }}>
                    <span className="cad-label">Distribution Rate</span>
                    <span className="data-value mono">100%</span>
                </div>
            </div>

            <div className="stagger-4" style={{ animationDelay: "0.5s" }}>
                <div className="cad-header">
                    <h3 className="cad-title display">Active Architecture</h3>
                    <button className="btn-arch">Initialize Contract</button>
                </div>

                {/* Module 1 */}
                <div className="contract-module" onClick={() => setView('blueprint')} role="button" tabIndex={0}>
                    <div className="c-id">#003</div>
                    <div>
                        <h4 className="c-name display">Landing page redesign</h4>
                        <p className="c-parties">Client: GFRE…9K2L</p>
                    </div>
                    <div className="status-indicator"><div className="dot-pulse"></div> In Progress</div>
                    <div className="c-amount">450 XLM</div>
                </div>

                {/* Module 2 */}
                <div className="contract-module">
                    <div className="c-id" style={{ color: "var(--oxide)", background: "rgba(164,76,39,0.1)" }}>#002</div>
                    <div>
                        <h4 className="c-name display">Smart contract audit</h4>
                        <p className="c-parties">Freelancer: GABC…WXYZ</p>
                    </div>
                    <div className="status-indicator" style={{ color: "var(--oxide)" }}><div className="dot-pulse" style={{ background: "var(--oxide)", animation: "none" }}></div> Disputed</div>
                    <div className="c-amount">1,200 XLM</div>
                </div>

                {/* Module 3 */}
                <div className="contract-module">
                    <div className="c-id" style={{ color: "var(--iron)", background: "rgba(17,19,21,0.05)" }}>#001</div>
                    <div>
                        <h4 className="c-name display">Brand identity pack</h4>
                        <p className="c-parties">Client: GQRS…4M1P</p>
                    </div>
                    <div className="status-indicator" style={{ color: "var(--iron)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Complete
                    </div>
                    <div className="c-amount">300 XLM</div>
                </div>
            </div>
        </main>
    );
}
