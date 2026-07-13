"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    isConnected,
    isAllowed,
    requestAccess,
    getAddress,
    getNetworkDetails,
} from "@stellar/freighter-api";

export type InstallState = "loading" | "error" | true | false;

interface WalletContextType {
    installed: InstallState;
    network: string | null;
    publicKey: string | null;
    checkFreighter: () => Promise<void>;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [installed, setInstalled] = useState<InstallState>("loading");
    const [network, setNetwork] = useState<string | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);

    const checkFreighter = async () => {
        try {
            const { isConnected: extConnected } = await isConnected();

            // Prevent flashing back to 'loading' if already resolved cleanly
            if (installed === "loading") {
                setInstalled(extConnected);
            } else if (installed !== extConnected) {
                setInstalled(extConnected);
            }

            if (extConnected) {
                const { isAllowed: extAllowed } = await isAllowed();
                if (extAllowed) {
                    const { network: currentNetwork } = await getNetworkDetails();
                    setNetwork(currentNetwork);

                    const { address } = await getAddress();
                    if (address) {
                        setPublicKey(address);
                    } else {
                        setPublicKey(null);
                    }
                } else {
                    setPublicKey(null);
                    setNetwork(null);
                }
            }
        } catch (error) {
            console.error("Error accessing Freighter API:", error);
            setInstalled("error");
        }
    };

    useEffect(() => {
        checkFreighter();
        const interval = setInterval(checkFreighter, 2000);
        return () => clearInterval(interval);
    }, []);

    const connect = async () => {
        try {
            const { address } = await requestAccess();
            if (address) {
                setPublicKey(address);
            }
            const { network: currentNetwork } = await getNetworkDetails();
            setNetwork(currentNetwork);
        } catch (e) {
            console.error("Failed to connect Freighter Extension:", e);
        }
    };

    const disconnect = () => {
        setPublicKey(null);
    };

    return (
        <WalletContext.Provider value={{ installed, network, publicKey, checkFreighter, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
