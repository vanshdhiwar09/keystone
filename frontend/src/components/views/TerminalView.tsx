"use client";

import { useTx } from "../../context/TransactionContext";

export default function TerminalView() {
    const { state } = useTx();

    // Default visually to 'awaiting signature' if idle so it doesn't just look broken
    const isIdle = state.step === "idle";

    // Map our TxState to the visual properties (dark modal)
    let color = "var(--alum)";
    let bg = "var(--iron)";
    let icon = <div className="spinner-architectural"></div>;
    let dotActiveIndex = 0;

    if (state.step === "submitting") {
        color = "var(--brass)";
        icon = <div className="spinner-architectural" style={{ borderColor: 'var(--brass)' }}></div>;
        dotActiveIndex = 1;
    } else if (state.step === "confirmed") {
        bg = "var(--alum)";
        color = "var(--iron)";
        icon = (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--banknote)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        );
        dotActiveIndex = 2;
    } else if (state.step === "error" || state.errorLevel) {
        bg = "var(--oxide)";
        color = "var(--alum)";
        icon = (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        );
        dotActiveIndex = 3;
    }

    return (
        <main id="view-tx" className="page-view active">
            <div className="tx-theater">
                <div
                    className="tx-modal"
                    style={{
                        background: bg,
                        color: color,
                        transition: "all 0.3s ease"
                    }}
                >
                    <div className="tx-icon-wrap">
                        {icon}
                    </div>

                    <h3 className="display" style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.02em" }}>
                        {isIdle ? "Terminal Idle" : state.title}
                    </h3>
                    <p className="mono" style={{ fontSize: 16, color: state.step === "confirmed" ? "rgba(22,26,29,0.5)" : "rgba(255,255,255,0.5)" }}>
                        {isIdle ? "Awaiting cryptographic proof" : state.sub}
                    </p>

                    <div className="tx-states">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`tx-dot ${dotActiveIndex === i && !isIdle ? "active" : ""}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
