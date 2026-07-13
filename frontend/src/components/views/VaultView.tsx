"use client";

import { useWallet } from "../../context/WalletContext";

export default function VaultView() {
    const { installed, network, publicKey, connect } = useWallet();

    const truncate = (str: string) => `${str.slice(0, 4)}…${str.slice(-4)}`;

    return (
        <main id="view-wallet" className="view active-view">
            <div className="vault-chamber stagger-2">
                <div className="vault-mechanism" id="vault-ui">
                    <div className="v-ring-outer"></div>
                    <div className="v-ring-inner" id="v-ring"></div>

                    <h2 className="v-status display" id="v-title">
                        {publicKey ? "Connected" : installed === false ? "Missing" : installed === "error" ? "Fault" : "Locked"}
                    </h2>
                    <p className="v-hash" id="v-sub">
                        {publicKey ? truncate(publicKey) : installed === false ? "No Freighter Extension" : "Awaiting Explorer Signature"}
                    </p>
                </div>

                <div className="vault-controls stagger-3">
                    {!publicKey && (
                        <button className="btn-arch btn-outline" onClick={connect}>Connect Freighter</button>
                    )}
                    {network && network !== "TESTNET" && (
                        <button className="btn-arch btn-outline btn-danger">Switch to Testnet</button>
                    )}
                </div>
            </div>
        </main>
    );
}
