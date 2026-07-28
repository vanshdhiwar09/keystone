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
    isMobile: boolean;
    checkFreighter: () => Promise<void>;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [installed, setInstalled] = useState<InstallState>("loading");
    const [network, setNetwork] = useState<string | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
        }
    }, []);

    const checkFreighter = async () => {
        try {
            let extConnected = false;
            if (typeof window !== "undefined") {
                const win = window as any;
                const hasInjected = !!(
                    win.freighter ||
                    win.stellar?.isFreighter ||
                    win.stellar?.platform === "mobile"
                );
                if (hasInjected) {
                    extConnected = true;
                } else {
                    const res = await isConnected();
                    extConnected = !!res.isConnected;
                }
            }

            setInstalled(prev => {
                if (prev !== extConnected) return extConnected;
                return prev;
            });

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
            } else {
                setPublicKey(null);
                setNetwork(null);
            }
        } catch (error) {
            console.error("Error accessing Freighter API:", error);
            setInstalled("error");
        }
    };

    useEffect(() => {
        checkFreighter();

        // Short poll on mount to catch asynchronous injection on mobile/delayed loads
        let count = 0;
        const pollInterval = setInterval(() => {
            checkFreighter();
            count++;
            if (count >= 6) clearInterval(pollInterval);
        }, 500);

        // Fallback slow interval for general syncing
        const slowInterval = setInterval(checkFreighter, 4000);

        // Event listeners to check when tab is focused/visible again
        const handleFocusCheck = () => {
            checkFreighter();
        };

        window.addEventListener("focus", handleFocusCheck);
        window.addEventListener("visibilitychange", handleFocusCheck);

        return () => {
            clearInterval(pollInterval);
            clearInterval(slowInterval);
            window.removeEventListener("focus", handleFocusCheck);
            window.removeEventListener("visibilitychange", handleFocusCheck);
        };
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
        <WalletContext.Provider value={{ installed, network, publicKey, isMobile, checkFreighter, connect, disconnect }}>
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
