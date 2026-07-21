"use client";

import React, { createContext, useContext, useState } from "react";

export type TxStep = "idle" | "awaiting_signature" | "submitting" | "confirmed" | "error";

interface TxState {
    step: TxStep;
    title: string;
    sub: string;
    progress: number;
    errorLevel?: boolean;
}

interface TransactionContextType {
    state: TxState;
    setState: (s: TxState) => void;
    resetTx: () => void;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<TxState>({ step: "idle", title: "Awaiting Instructions", sub: "The network is standing by.", progress: 0 });

    const resetTx = () => setState({ step: "idle", title: "Awaiting Instructions", sub: "The network is standing by.", progress: 0, errorLevel: false });

    return (
        <TransactionContext.Provider value={{ state, setState, resetTx }}>
            {children}
        </TransactionContext.Provider>
    );
}

export function useTx() {
    const context = useContext(TransactionContext);
    if (context === undefined) {
        throw new Error("useTx must be used within a TransactionProvider");
    }
    return context;
}
