"use client";

import { useWallet } from "../../context/WalletContext";
import CreateJobFlow from "../CreateJobFlow";

export default function VaultView({ setView }: { setView?: (v: string) => void }) {
    const { installed, publicKey, connect } = useWallet();

    // If not connected, show the connect prompt
    if (!publicKey) {
        return (
            <main className="page-view active" id="view-create">
                <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 0", textAlign: "center" }}>
                    <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", marginBottom: 16 }}>
                        New Contract
                    </h2>
                    <p style={{ color: "rgba(22,26,29,0.5)", marginBottom: 40 }}>
                        Connect your Freighter wallet to deploy a new escrow contract.
                    </p>

                    {installed === false ? (
                        <a
                            href="https://www.freighter.app/"
                            target="_blank"
                            rel="noreferrer"
                            className="stone-btn primary"
                            style={{ padding: "14px 32px", borderRadius: 4, fontSize: 13, textDecoration: "none", display: "inline-block" }}
                        >
                            Install Freighter
                        </a>
                    ) : (
                        <button
                            className="stone-btn primary"
                            style={{ padding: "14px 32px", borderRadius: 4, fontSize: 13 }}
                            onClick={connect}
                        >
                            Connect Wallet
                        </button>
                    )}
                </div>
            </main>
        );
    }

    // Wallet connected — show the full CreateJobFlow
    return (
        <main className="page-view active" id="view-create" style={{ paddingBottom: 120 }}>
            <CreateJobFlow setView={setView} />
        </main>
    );
}
