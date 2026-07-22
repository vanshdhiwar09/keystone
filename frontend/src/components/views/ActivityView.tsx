"use client";

import { useTx } from "../../context/TransactionContext";

export default function ActivityView() {
    const { state } = useTx();

    const hasLiveTx = state.step !== "idle";

    return (
        <main className="page-view active" id="view-feed">
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
                <h2 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 8 }}>
                    Activity
                </h2>
                <p style={{ color: "rgba(22,26,29,0.5)", marginBottom: 40, fontSize: 15 }}>
                    Real-time construction protocol feed
                </p>

                <div className="feed-timeline" id="feed-list">
                    {/* Live transaction status */}
                    {hasLiveTx && (
                        <div className="feed-node visible pulse-node" style={{ opacity: 1, transform: "translateX(0)" }}>
                            <div className="f-time">LIVE</div>
                            <div className="f-content">
                                <strong>{state.title}</strong>
                                <br />
                                {state.sub}
                                <div style={{ marginTop: 8, height: 4, background: "rgba(22,26,29,0.08)", borderRadius: 2 }}>
                                    <div style={{
                                        width: `${state.progress}%`,
                                        height: "100%",
                                        background: state.errorLevel ? "var(--oxide)" : "var(--banknote)",
                                        borderRadius: 2,
                                        transition: "width 0.4s ease"
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Static demo entries — these show the type of events that occur */}
                    <div className="feed-node visible pulse-node" style={{ opacity: 1, transform: "translateX(0)" }}>
                        <div className="f-time">JUST NOW</div>
                        <div className="f-content">
                            Milestone <strong>Visual design</strong> mutually approved. Escrow preparing distribution.
                        </div>
                    </div>

                    <div className="feed-node visible" style={{ opacity: 1, transform: "translateX(0)" }}>
                        <div className="f-time">2 MIN AGO</div>
                        <div className="f-content">
                            Milestone <strong>Wireframes</strong> verified. 150 XLM distributed to Freelancer wallet.
                        </div>
                    </div>

                    <div className="feed-node visible" style={{ opacity: 1, transform: "translateX(0)" }}>
                        <div className="f-time">14 MIN AGO</div>
                        <div className="f-content">
                            Freelancer submitted <strong>Wireframes</strong> payload for Client structural review.
                        </div>
                    </div>

                    <div className="feed-node visible" style={{ opacity: 1, transform: "translateX(0)" }}>
                        <div className="f-time">1 HR AGO</div>
                        <div className="f-content">
                            Client deposited funds. <strong>450 XLM</strong> locked in cryptographic vault.
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
