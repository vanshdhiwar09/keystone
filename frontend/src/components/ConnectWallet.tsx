"use client";

import { useEffect, useState } from "react";
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

type InstallState = "loading" | "error" | true | false;

export default function ConnectWallet() {
  const [installed, setInstalled] = useState<InstallState>("loading");
  const [network, setNetwork] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const checkFreighter = async () => {
    setInstalled("loading");
    try {
      const { isConnected: extConnected } = await isConnected();
      setInstalled(extConnected);

      if (extConnected) {
        // MUST be called before NetworkDetails; calling Network without Auth officially throws! 
        const { isAllowed: extAllowed } = await isAllowed();
        if (extAllowed) {
          const { network: currentNetwork } = await getNetworkDetails();
          setNetwork(currentNetwork);

          const { address } = await getAddress();
          if (address) {
            setPublicKey(address);
          }
        }
      }
    } catch (error) {
      console.error("Error accessing Freighter API:", error);
      setInstalled("error");
    }
  };

  useEffect(() => {
    checkFreighter();
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

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (installed === "loading") {
    return (
      <div className="px-3 py-1.5 bg-gray-200 text-gray-500 rounded text-[11px] font-medium animate-pulse">
        Loading Wallet...
      </div>
    );
  }

  // 1: API Check Error UI 
  if (installed === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-red-500 font-semibold uppercase tracking-tight">Connection Error</span>
        <button
          onClick={checkFreighter}
          className="px-2 py-1 bg-red-100 shadow-sm hover:bg-red-200 text-red-700 rounded text-[10px] font-bold transition-colors uppercase tracking-tight"
        >
          Check Again
        </button>
      </div>
    );
  }

  // 2: Not Installed
  if (installed === false) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-blue-600 shadow-sm hover:bg-blue-700 text-white rounded font-medium text-xs transition-colors tracking-tight whitespace-nowrap"
      >
        Install Freighter
      </a>
    );
  }

  // 3: Connected but distinctly Wrong Network (Evaluates safely because network only populates if auth passed)
  if (publicKey && network !== "TESTNET") {
    return (
      <div className="px-3 py-1.5 bg-amber-600 shadow-sm text-white rounded text-[10px] text-center flex flex-col items-center leading-tight whitespace-nowrap">
        <span className="font-semibold uppercase tracking-wide">Wrong Network</span>
        <span className="text-amber-200 tracking-tight">Switch to Testnet</span>
      </div>
    );
  }

  // 4: Installed / Authorized cleanly, just waiting to Connect
  if (!publicKey) {
    return (
      <button
        onClick={connect}
        className="px-3 py-1.5 bg-blue-600 shadow-sm hover:bg-blue-700 text-white rounded font-medium text-xs transition-colors tracking-tight whitespace-nowrap"
      >
        Connect Wallet
      </button>
    );
  }

  // 5: Online & Bound Correctly
  return (
    <div className="flex items-center gap-1.5">
      <div className="px-2 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded text-[10px] font-mono tracking-tight shadow-inner whitespace-nowrap">
        {truncateAddress(publicKey)}
      </div>
      <button
        onClick={disconnect}
        className="px-2 py-1 bg-gray-800 shadow-sm hover:bg-gray-700 text-gray-300 rounded text-[10px] transition-colors whitespace-nowrap tracking-tight"
      >
        Disconnect
      </button>
    </div>
  );
}
