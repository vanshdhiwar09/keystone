export default function BlueprintView() {
    return (
        <main id="view-detail" className="view active-view">
            <div className="blueprint-sheet stagger-2">
                <div className="bp-header">
                    <div>
                        <p className="cad-label" style={{ marginBottom: "12px" }}>Contract Document #003</p>
                        <h2 className="bp-title display">Landing page<br />redesign</h2>
                        <div style={{ display: "flex", gap: "32px" }}>
                            <div><span className="cad-label">Client</span><br /><span className="mono" style={{ fontWeight: 600 }}>GFRE…9K2L</span></div>
                            <div><span className="cad-label">Freelancer</span><br /><span className="mono" style={{ fontWeight: 600 }}>GABC…WXYZ</span></div>
                        </div>
                    </div>
                    <div className="escrow-lock">
                        <p className="cad-label" style={{ color: "rgba(255,255,255,0.5)", marginBottom: "12px" }}>Escrow Locked</p>
                        <p className="escrow-val">450</p>
                        <p className="cad-label" style={{ color: "var(--brass)" }}>XLM</p>
                    </div>
                </div>

                <div className="structural-stack">
                    {/* Milestone 1 */}
                    <div className="stone-module stone-approved">
                        <div className="stone-step">01</div>
                        <div className="stone-content">
                            <h3 className="display">Wireframes</h3>
                            <p>Stage Complete — Funds Released</p>
                        </div>
                        <div className="stone-price">150 XLM</div>
                    </div>

                    {/* Milestone 2 */}
                    <div className="stone-module" style={{ background: "var(--alum)", border: "1px solid var(--grid-major)", borderLeft: "8px solid var(--banknote)" }}>
                        <div className="stone-step" style={{ color: "var(--banknote)" }}>02</div>
                        <div className="stone-content">
                            <h3 className="display">Visual design</h3>
                            <p style={{ color: "var(--banknote)" }}>Approved — Awaiting Distribution</p>
                        </div>
                        <div className="stone-price">200 XLM</div>
                    </div>

                    {/* Milestone 3 */}
                    <div className="stone-module stone-disputed">
                        <div className="stone-step">03</div>
                        <div className="stone-content">
                            <h3 className="display">Responsive build</h3>
                            <p>Disputed by Client</p>
                        </div>
                        <div className="stone-price">100 XLM</div>
                    </div>
                </div>

                <div className="action-bar">
                    <button className="btn-arch btn-danger btn-outline">Raise Dispute</button>
                    <button className="btn-arch">Approve Milestone</button>
                </div>
            </div>
        </main>
    );
}
