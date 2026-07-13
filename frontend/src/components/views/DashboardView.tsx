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
