"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration?: number; // duration in ms
}

interface ToastContextType {
    toasts: ToastItem[];
    showToast: (message: string, type: ToastType, duration?: number) => string;
    dismissToast: (id: string) => void;
    isUserCancellation: (error: any) => boolean;
    getFriendlyErrorMessage: (error: any) => string;
    toast: {
        success: (msg: string, duration?: number) => string;
        error: (msg: string, duration?: number) => string;
        warning: (msg: string, duration?: number) => string;
        info: (msg: string, duration?: number) => string;
        loading: (msg: string) => string;
    };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Detects wallet signature cancellations consistently
export function isUserCancellation(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err.error || err || "").toLowerCase();
    return (
        msg.includes("declined") ||
        msg.includes("cancel") ||
        msg.includes("reject") ||
        msg.includes("user declined") ||
        msg.includes("user rejected")
    );
}

// Maps low-level SDK/Stellar errors to user-friendly messages
export function getFriendlyErrorMessage(err: any): string {
    if (!err) return "Something went wrong. Please try again.";
    if (isUserCancellation(err)) {
        return "Transaction cancelled.";
    }
    const msg = String(err.message || err.error || err || "").toLowerCase();

    // 1. Validation Error
    if (msg.includes("bigint") || msg.includes("convert") || msg.includes("format") || msg.includes("validation")) {
        return "Validation Error: Please enter a valid numeric amount.";
    }

    // 2. Authorization Error
    if (
        msg.includes("not authorized") ||
        msg.includes("authorization failed") ||
        msg.includes("self-dealing is prohibited") ||
        msg.includes("error(contract, #6)") ||
        msg.includes("error(contract, #7)") ||
        msg.includes("error(contract, #8)")
    ) {
        return "Authorization Error: You are not authorized for this operation.";
    }

    // 3. Contract Error
    if (
        msg.includes("action failed") ||
        msg.includes("ledger failure") ||
        msg.includes("distribution failed") ||
        msg.includes("error(contract")
    ) {
        if (err.message && (err.message.includes("Action failed:") || err.message.includes("Authorization failed:") || err.message.includes("Ledger failure:"))) {
            return err.message;
        }
        return "Contract Error: Action failed on the smart contract.";
    }

    // 4. Network / CORS Error
    if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("failed to fetch") ||
        msg.includes("cors") ||
        msg.includes("networkerror")
    ) {
        return "Network Error: Network connection temporarily unavailable. Please try again.";
    }

    // 5. RPC Error / Rate limit
    if (
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("429") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504") ||
        msg.includes("timeout")
    ) {
        return "RPC Error: Unable to reach the Stellar Testnet. Retrying...";
    }

    // 6. Simulation Error
    if (
        msg.includes("hosterror") ||
        msg.includes("simulation") ||
        msg.includes("failed") ||
        msg.includes("transaction failed")
    ) {
        return "Simulation Error: Transaction failed. Please try again.";
    }

    return "Something went wrong. Please try again.";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = (message: string, type: ToastType, duration?: number) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, message, duration }]);
        return id;
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const toast = {
        success: (msg: string, d?: number) => showToast(msg, "success", d ?? 4500),
        error: (msg: string, d?: number) => showToast(msg, "error", d ?? 5000),
        warning: (msg: string, d?: number) => showToast(msg, "warning", d ?? 4500),
        info: (msg: string, d?: number) => showToast(msg, "info", d ?? 4000),
        loading: (msg: string) => showToast(msg, "loading", 999999) // persistent
    };

    return (
        <ToastContext.Provider value={{ toasts, showToast, dismissToast, isUserCancellation, getFriendlyErrorMessage, toast }}>
            {children}
            <ToastContainer toasts={toasts} dismissToast={dismissToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// Single Toast Component supporting Hover pausing and ARIA live announcements
function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
    const { id, type, message, duration = 4500 } = toast;
    const [progress, setProgress] = useState(100);
    const hoverRef = useRef<boolean>(false);
    const startRef = useRef<number>(Date.now());
    const remainingRef = useRef<number>(duration);
    const timerRef = useRef<any>(null);

    const onMouseEnter = () => {
        hoverRef.current = true;
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const onMouseLeave = () => {
        hoverRef.current = false;
        startRef.current = Date.now();
        setupTimer();
    };

    const setupTimer = () => {
        if (type === "loading" || remainingRef.current <= 0) return;
        const interval = 50;
        const startTime = Date.now();
        const initialRemaining = remainingRef.current;

        timerRef.current = setInterval(() => {
            if (hoverRef.current) return;
            const elapsed = Date.now() - startTime;
            const newRemaining = Math.max(0, initialRemaining - elapsed);
            setProgress((newRemaining / duration) * 100);

            if (newRemaining <= 0) {
                clearInterval(timerRef.current);
                onDismiss(id);
            }
        }, interval);
    };

    useEffect(() => {
        setupTimer();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [id, type]);

    // Keyboard dismissal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onDismiss(id);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [id, onDismiss]);

    // Type symbols / icons
    const renderIcon = () => {
        switch (type) {
            case "success":
                return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3cd070" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                );
            case "error":
                return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d03c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                );
            case "warning":
                return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d0aa3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                );
            case "info":
                return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ca9d0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                );
            case "loading":
                return (
                    <svg className="toast-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                );
        }
    };

    const isAlert = type === "error" || type === "warning";

    return (
        <div
            className={`toast-card toast-${type}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            role={isAlert ? "alert" : "status"}
            aria-live={isAlert ? "assertive" : "polite"}
        >
            <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1 }}>
                {renderIcon()}
                <p className="toast-msg mono" style={{ fontSize: 12, margin: 0, lineHeight: 1.4, color: "var(--alum)" }}>
                    {message}
                </p>
            </div>
            <button
                className="toast-close"
                onClick={() => onDismiss(id)}
                aria-label={`Dismiss ${type} notification`}
            >
                &times;
            </button>
            {type !== "loading" && (
                <div className="toast-progress-bar" style={{ width: `${progress}%` }} />
            )}
        </div>
    );
}

// Toast Container overlay mounted in DOM
function ToastContainer({ toasts, dismissToast }: { toasts: ToastItem[]; dismissToast: (id: string) => void }) {
    return (
        <div className="toast-container" role="log" aria-live="polite" aria-atomic="true">
            {toasts.map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismissToast} />
            ))}
        </div>
    );
}
