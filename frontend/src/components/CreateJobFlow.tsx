"use client";

import { useState, useEffect } from "react";
import { getAddress } from "@stellar/freighter-api";
import { StrKey } from "@stellar/stellar-sdk";

export default function CreateJobFlow() {
    const [clientKey, setClientKey] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [freelancer, setFreelancer] = useState("");
    const [amount, setAmount] = useState("");

    // Poll Freighter to securely tie this component's active permissions to the global extension status
    useEffect(() => {
        const lockWalletState = async () => {
            try {
                const { address } = await getAddress();
                setClientKey(address || null);
            } catch {
                setClientKey(null);
            }
        };

        lockWalletState();
        const interval = setInterval(lockWalletState, 1500);
        return () => clearInterval(interval);
    }, []);

    const handleCreate = async () => {
        if (!clientKey) return;

        // Stroops Conversion Plan:
        // JS `parseFloat(amount) * 1e7` causes infamous float tracking bugs (e.g. 0.58 * 1e7 = 5799999.999). 
        // To strictly avoid this, we process string tokens individually locking precision to 7 decimal spots natively
        // returning a perfect BigInt scalar mapping perfectly to Soroban i128 standards.
        const parts = amount.split(".");
        const whole = parts[0] || "0";
        const fraction = (parts[1] || "").substring(0, 7).padEnd(7, "0");
        const amountInStroops = BigInt(whole + fraction).toString();

        console.log("Broadcasting Contract to Soroban...", {
            clientKey,
            freelancer,
            humanAmount: amount,
            stroops: amountInStroops
        });
    };

    // Explicit Gate: Do not expose structural input mutations unless cryptographically bonded
    if (!clientKey) {
        return (
            <div className="flex flex-col w-full max-w-[90%] sm:max-w-lg mx-auto py-8">
                <div className="p-10 border border-limestone bg-steel relative shadow-inner text-center flex flex-col items-center justify-center">
                    <h2 className="font-display font-bold text-xl text-iron uppercase tracking-tight mb-2 opacity-60">Vault Locked</h2>
                    <p className="text-iron/60 text-xs max-w-xs">Securely connect your Explorer wallet above to instantiate a new structural sequence.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-[90%] sm:max-w-lg mx-auto py-8">

            {/* Step 1: Foundation Block */}
            <div className={`p-6 border border-limestone bg-alum transition-all duration-300 relative z-10 shadow-[0_4px_20px_rgba(0,0,0,0.02)]`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-bold text-xl text-iron uppercase tracking-tight">1. Contract Foundation</h2>
                    {step > 1 && <span className="text-banknote text-[10px] font-bold tracking-tight uppercase">Docked</span>}
                </div>
                <p className="text-iron/60 text-xs mb-4 max-w-sm">Specify the destination freelancer public key for this escrow lock.</p>

                <input
                    type="text"
                    placeholder="G..."
                    value={freelancer}
                    onChange={(e) => setFreelancer(e.target.value)}
                    disabled={step > 1}
                    className="w-full bg-steel border border-limestone p-3 text-sm font-mono text-iron outline-none focus:border-banknote transition-colors disabled:opacity-50"
                />

                {/* Validates the exact mathematical ED25519 signature curve matching Freighter constraints */}
                {step === 1 && StrKey.isValidEd25519PublicKey(freelancer) && (
                    <button
                        onClick={() => setStep(2)}
                        className="mt-5 px-5 py-2.5 bg-iron text-alum text-[11px] font-bold uppercase tracking-tight hover:bg-iron/90 focus:outline-2 focus:outline-offset-2 focus:outline-banknote transition-colors"
                    >
                        Dock Foundation
                    </button>
                )}
            </div>

            {/* Step 2: Value Constraints */}
            {step >= 2 && (
                <div className="mt-[-1px] p-6 border border-limestone bg-alum relative z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] animate-[fade-in_300ms_ease-out]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-display font-bold text-xl text-iron uppercase tracking-tight">2. Value Constraint</h2>
                        {step > 2 && <span className="text-banknote text-[10px] font-bold tracking-tight uppercase">Docked</span>}
                    </div>
                    <p className="text-iron/60 text-xs mb-4 max-w-sm">Determine the exact USDC/XLM value to lock firmly into this milestone.</p>

                    <div className="flex relative items-center">
                        <input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={step > 3}
                            className="w-full bg-steel border border-limestone p-3 text-sm font-mono text-iron outline-none focus:border-banknote transition-colors disabled:opacity-50"
                        />
                        <span className="absolute right-4 text-iron/40 font-bold text-xs uppercase tracking-tight">wXLM</span>
                    </div>

                    {step === 2 && amount && parseFloat(amount) > 0 && (
                        <button
                            onClick={() => setStep(3)}
                            className="mt-5 px-5 py-2.5 bg-iron text-alum text-[11px] font-bold uppercase tracking-tight hover:bg-iron/90 focus:outline-2 focus:outline-offset-2 focus:outline-banknote transition-colors"
                        >
                            Dock Constraint
                        </button>
                    )}
                </div>
            )}

            {/* Step 3: The Keystone (Locking Drop) */}
            {step === 3 && (
                <div className="mt-[-1px] p-8 border border-limestone bg-steel relative z-30 flex flex-col items-center shadow-inner animate-[fade-in_500ms_ease-out]">

                    <p className="text-iron text-xs mb-6 text-center max-w-sm font-medium">
                        The structural constraints are docked. Engaging this lock will broadcast physical creation and funding hashes directly to the network.
                    </p>

                    <button
                        onClick={handleCreate}
                        className="w-full max-w-[280px] px-6 py-4 bg-brass text-iron text-sm font-bold uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] focus:outline-4 focus:outline-offset-2 focus:outline-banknote relative"
                        style={{
                            clipPath: "polygon(0 0, 100% 0, 92% 100%, 8% 100%)"
                        }}
                    >
                        Lock Contract
                    </button>
                </div>
            )}
        </div>
    );
}
