import { useState } from "react";

export default function BlueprintView() {
    const [selectedContract, setSelectedContract] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    // --- DETAIL VIEW ---
    if (selectedContract) {
        return (
            <main id="view-detail" className="view active-view" style={{ animation: "none", opacity: 1, transform: "none" }}>
                <div style={{ marginBottom: "20px", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => setSelectedContract(null)} className="btn-arch btn-outline" style={{ padding: "8px 16px", fontSize: "10px", borderColor: "var(--grid-major)" }}>
                        Close Architecture
                    </button>
                </div>

                <div className="blueprint-sheet stagger-2">
                    <div className="bp-header">
                        <div>
                            <p className="cad-label" style={{ marginBottom: "12px" }}>Contract Document #{selectedContract}</p>
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

    // --- EXPLORER VIEW ---
    return (
        <main id="view-explorer" className="view active-view">
            <div className="blueprint-sheet stagger-2">
                <div className="bp-header" style={{ borderBottom: "1px solid var(--grid-main)", paddingBottom: "32px", marginBottom: "32px" }}>
                    <div>
                        <h2 className="bp-title display">Ledger Explorer</h2>
                        <p className="cad-label text-iron/60" style={{ marginTop: "12px" }}>Navigate Global Escrow Architecture</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "8px" }}>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search Public Key or ID..."
                            className="mono text-iron"
                            style={{ background: "transparent", borderBottom: "2px solid var(--grid-major)", padding: "8px", outline: "none", width: "260px", fontSize: "13px" }}
                        />
                    </div>
                </div>

                <div className="structural-stack">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="stone-module"
                            onClick={() => setSelectedContract(`${1024 + (page - 1) * 6 + i}`)}
                            style={{ cursor: "pointer", border: "1px solid var(--grid-major)", background: "transparent", transition: "all 0.2s ease" }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--iron)"}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--grid-major)"}
                        >
                            <div className="stone-step" style={{ color: "var(--brass)", fontWeight: 800 }}>#{(page - 1) * 6 + i + 1}</div>
                            <div className="stone-content">
                                <h3 className="display">Contract #{1024 + (page - 1) * 6 + i}</h3>
                                <p className="mono" style={{ fontSize: "11px", marginTop: "4px" }}>Client: GFRE...9K2L</p>
                            </div>
                            <div className="stone-price" style={{ background: "var(--alum)", padding: "4px 12px", border: "1px solid var(--grid-major)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                                <div className="dot-pulse"></div> Active
                            </div>
                        </div>
                    ))}
                </div>

                <div className="action-bar" style={{ justifyContent: "space-between", marginTop: "48px", borderTop: "none", background: "transparent" }}>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-arch btn-outline" style={{ padding: "8px 24px", borderColor: "var(--grid-major)", color: page === 1 ? "var(--oxide)" : "var(--iron)" }}>&larr; Prev</button>
                    <span className="mono" style={{ alignSelf: "center", fontSize: "12px", fontWeight: 600 }}>Page {page} of 140</span>
                    <button onClick={() => setPage(p => p + 1)} className="btn-arch btn-outline" style={{ padding: "8px 24px", borderColor: "var(--grid-major)", color: "var(--iron)" }}>Next &rarr;</button>
                </div>
            </div>
        </main>
    );
}
