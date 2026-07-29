"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    isConnected,
    isAllowed,
    requestAccess,
    getAddress,
    getNetworkDetails,
    signTransaction,
    signMessage,
} from "@stellar/freighter-api";

export type InstallState = "loading" | "error" | true | false;

interface InjectedStellar {
    isFreighter?: boolean;
    platform?: string;
    isAllowed?: () => Promise<boolean | { isAllowed: boolean }>;
    getNetworkDetails?: () => Promise<string | { network: string }>;
    getAddress?: () => Promise<string | { address: string; publicKey?: string }>;
    requestAccess?: () => Promise<string | { address: string; publicKey?: string }>;
    signTransaction?: (xdr: string, opts?: { network?: string; networkPassphrase?: string; address?: string }) => Promise<string | { signedTxXdr: string }>;
    signMessage?: (message: string, opts?: { address?: string }) => Promise<unknown>;
}

interface WalletContextType {
    installed: InstallState;
    network: string | null;
    publicKey: string | null;
    isMobile: boolean;
    checkFreighter: () => Promise<void>;
    connect: () => Promise<void>;
    disconnect: () => void;
    signTransaction: (xdr: string, opts?: { network?: string; networkPassphrase?: string; address?: string }) => Promise<{ signedTxXdr: string }>;
    signMessage: (message: string, opts?: { address?: string }) => Promise<unknown>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [installed, setInstalled] = useState<InstallState>("loading");
    const [network, setNetwork] = useState<string | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
        }
    }, []);

    const checkFreighter = async () => {
        try {
            let extConnected = false;
            if (typeof window !== "undefined") {
                const win = window as Window & { stellar?: InjectedStellar; freighter?: InjectedStellar };
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
                let extAllowed = false;
                const win = window as Window & { stellar?: InjectedStellar; freighter?: InjectedStellar };

                if (win.stellar && typeof win.stellar.isAllowed === "function") {
                    const res = await win.stellar.isAllowed();
                    extAllowed = typeof res === "boolean" ? res : !!res.isAllowed;
                } else if (win.freighter && typeof win.freighter.isAllowed === "function") {
                    const res = await win.freighter.isAllowed();
                    extAllowed = typeof res === "boolean" ? res : !!res.isAllowed;
                } else {
                    const res = await isAllowed();
                    extAllowed = !!res.isAllowed;
                }

                if (extAllowed) {
                    let currentNetwork = "";
                    if (win.stellar && typeof win.stellar.getNetworkDetails === "function") {
                        const netRes = await win.stellar.getNetworkDetails();
                        currentNetwork = typeof netRes === "string" ? netRes : netRes.network || "";
                    } else if (win.freighter && typeof win.freighter.getNetworkDetails === "function") {
                        const netRes = await win.freighter.getNetworkDetails();
                        currentNetwork = typeof netRes === "string" ? netRes : netRes.network || "";
                    } else {
                        const netRes = await getNetworkDetails();
                        currentNetwork = netRes.network || "";
                    }
                    setNetwork(currentNetwork);

                    let address = "";
                    if (win.stellar && typeof win.stellar.getAddress === "function") {
                        const addrRes = await win.stellar.getAddress();
                        if (typeof addrRes === "string") {
                            address = addrRes;
                        } else if (addrRes && typeof addrRes === "object") {
                            address = addrRes.address || addrRes.publicKey || "";
                        }
                    } else if (win.freighter && typeof win.freighter.getAddress === "function") {
                        const addrRes = await win.freighter.getAddress();
                        if (typeof addrRes === "string") {
                            address = addrRes;
                        } else if (addrRes && typeof addrRes === "object") {
                            address = addrRes.address || addrRes.publicKey || "";
                        }
                    }

                    if (!address) {
                        try {
                            const res = await getAddress();
                            address = res.address || "";
                        } catch (err) {
                            console.error("getAddress fallback error:", err);
                        }
                    }

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
            let address = "";
            let currentNetwork = "";
            const win = window as Window & { stellar?: InjectedStellar; freighter?: InjectedStellar };

            if (win.stellar && typeof win.stellar.requestAccess === "function") {
                const res = await win.stellar.requestAccess();
                if (typeof res === "string") {
                    address = res;
                } else if (res && typeof res === "object") {
                    address = res.address || res.publicKey || "";
                }
            } else if (win.freighter && typeof win.freighter.requestAccess === "function") {
                const res = await win.freighter.requestAccess();
                if (typeof res === "string") {
                    address = res;
                } else if (res && typeof res === "object") {
                    address = res.address || res.publicKey || "";
                }
            }

            if (!address) {
                const res = await requestAccess();
                address = res.address || "";
            }

            if (address) {
                setPublicKey(address);

                if (win.stellar && typeof win.stellar.getNetworkDetails === "function") {
                    const netRes = await win.stellar.getNetworkDetails();
                    currentNetwork = typeof netRes === "string" ? netRes : netRes.network || "";
                } else if (win.freighter && typeof win.freighter.getNetworkDetails === "function") {
                    const netRes = await win.freighter.getNetworkDetails();
                    currentNetwork = typeof netRes === "string" ? netRes : netRes.network || "";
                } else {
                    const netRes = await getNetworkDetails();
                    currentNetwork = netRes.network || "";
                }
                setNetwork(currentNetwork);
            }
        } catch (e) {
            console.error("Failed to connect Freighter Extension:", e);
        }
    };

    const signTransactionWrapper = async (
        xdr: string,
        opts?: { network?: string; networkPassphrase?: string; address?: string }
    ) => {
        const win = window as Window & { stellar?: InjectedStellar; freighter?: InjectedStellar };
        if (win.stellar && typeof win.stellar.signTransaction === "function") {
            const res = await win.stellar.signTransaction(xdr, opts);
            if (typeof res === "string") return { signedTxXdr: res };
            return res;
        }
        if (win.freighter && typeof win.freighter.signTransaction === "function") {
            const res = await win.freighter.signTransaction(xdr, opts);
            if (typeof res === "string") return { signedTxXdr: res };
            return res;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await signTransaction(xdr, opts as any);
    };

    const signMessageWrapper = async (
        message: string,
        opts?: { address?: string }
    ): Promise<unknown> => {
        const win = window as Window & { stellar?: InjectedStellar; freighter?: InjectedStellar };
        if (win.stellar && typeof win.stellar.signMessage === "function") {
            return await win.stellar.signMessage(message, opts);
        }
        if (win.freighter && typeof win.freighter.signMessage === "function") {
            return await win.freighter.signMessage(message, opts);
        }
        return await signMessage(message, opts);
    };

    const disconnect = () => {
        setPublicKey(null);
    };

    return (
        <WalletContext.Provider
            value={{
                installed,
                network,
                publicKey,
                isMobile,
                checkFreighter,
                connect,
                disconnect,
                signTransaction: signTransactionWrapper,
                signMessage: signMessageWrapper,
            }}
        >
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
