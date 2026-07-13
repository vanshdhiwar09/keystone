export default function ActivityView() {
    return (
        <main id="view-feed" className="view active-view">
            <div className="feed-container stagger-2">
                <p className="cad-label" style={{ marginBottom: "40px" }}>Real-time Construction Protocol</p>
                <div className="feed-timeline" id="feed-list">

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
