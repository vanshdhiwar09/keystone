"use client";

import { useWallet } from "../context/WalletContext";

export default function Header() {
    const { installed, network, publicKey, connect, disconnect } = useWallet();

    const truncateAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

    const handleClick = () => {
        if (installed === false) {
            window.open("https://www.freighter.app/", "_blank");
        } else if (!publicKey) {
            connect();
        } else {
            disconnect();
        }
    };

    return (
        <header className="global-header stagger-1">
            <div className="brand-lockup">
                <svg className="brand-logo-svg" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 21h18L12 2z" stroke="#111315" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 8l4 9H8l4-9z" fill="#BFA15F" stroke="none" />
                </svg>
                <h1 className="display">Keystone</h1>
            </div>

            <div className="status-vault">
                <span className="network-tag uppercase">
                    {network || "Testnet"} Active
                </span>
                <div className="wallet-id mono" onClick={handleClick} style={{ cursor: "pointer" }}>
                    {publicKey
                        ? truncateAddress(publicKey)
                        : installed === false
                            ? "Install Freighter"
                            : "Connect Wallet"
                    }
                </div>
            </div>
        </header>
    );
}
