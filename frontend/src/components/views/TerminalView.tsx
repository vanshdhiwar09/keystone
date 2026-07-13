export default function TerminalView() {
    return (
        <main id="view-tx" className="view active-view">
            <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }} className="stagger-2">
                <div className="terminal-overlay" id="tx-ui">
                    <div className="tx-grid">
                        <div className="tx-visualizer">
                            <div className="hex-spin" id="tx-spin"></div>
                            <div className="hex-inner" id="tx-inner"></div>
                        </div>
                        <div>
                            <h3 className="tx-title display" id="tx-title">Awaiting Signature</h3>
                            <p className="tx-sub" id="tx-sub">Awaiting cryptographic proof from Freighter.</p>
                        </div>
                    </div>
                    <div className="tx-progress">
                        <div className="tx-bar" id="tx-bar" style={{ width: "25%" }}></div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "40px" }}>
                        <div className="tx-dot" style={{ width: "8px", height: "8px", background: "var(--brass)", cursor: "pointer", borderRadius: "50%" }}></div>
                        <div className="tx-dot" style={{ width: "8px", height: "8px", background: "rgba(255,255,255,0.2)", cursor: "pointer", borderRadius: "50%" }}></div>
                        <div className="tx-dot" style={{ width: "8px", height: "8px", background: "rgba(255,255,255,0.2)", cursor: "pointer", borderRadius: "50%" }}></div>
                        <div className="tx-dot" style={{ width: "8px", height: "8px", background: "rgba(255,255,255,0.2)", cursor: "pointer", borderRadius: "50%" }}></div>
                    </div>
                </div>
            </div>
        </main>
    );
}
