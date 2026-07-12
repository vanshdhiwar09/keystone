"use client";

import { useEffect, useState } from "react";
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

export default function ConnectWallet() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    const checkFreighter = async () => {
      try {
        // v6.0 Returns object payload { isConnected: boolean }
        const { isConnected: extConnected } = await isConnected();
        setInstalled(extConnected);

        if (extConnected) {
          const { network: currentNetwork } = await getNetworkDetails();
          setNetwork(currentNetwork);

          const { isAllowed: extAllowed } = await isAllowed();
          if (extAllowed) {
            // v6.0 replaces `getUserInfo` securely extracting `{ address: string }`
            const { address } = await getAddress();
            if (address) {
              setPublicKey(address);
            }
          }
        }
      } catch (error) {
        console.error("Error accessing Freighter API:", error);
      }
    };
    checkFreighter();
  }, []);

  const connect = async () => {
    try {
      // v6.0 officially defines `requestAccess()` substituting generic `setAllowed()` returns payload directly!
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

  if (installed === null) {
    return (
      <div className="px-3 py-1.5 bg-gray-200 text-gray-500 rounded text-xs animate-pulse">
        Loading...
      </div>
    );
  }

  // State 1: Freighter Not Installed 
  if (!installed) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-blue-600 shadow-sm hover:bg-blue-700 text-white rounded text-xs transition-colors"
      >
        Install Freighter
      </a>
    );
  }

  // State 2: Installed, Connected, but Network is NOT "TESTNET"
  if (publicKey && network !== "TESTNET") {
    return (
      <div className="px-3 py-1.5 bg-amber-600 shadow-sm text-white rounded text-[10px] text-center flex flex-col items-center leading-tight">
        <span className="font-semibold uppercase">Wrong Network</span>
        <span className="text-amber-200">Switch to Testnet</span>
      </div>
    );
  }

  // State 3: Installed, waiting to explicitly Connect
  if (!publicKey) {
    return (
      <button
        onClick={connect}
        className="px-3 py-1.5 bg-blue-600 shadow-sm hover:bg-blue-700 text-white rounded font-medium text-xs transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  // State 4: Formally connected seamlessly bypassing Network flags!
  return (
    <div className="flex items-center gap-1.5">
      <div className="px-2 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded text-[10px] font-mono tracking-tight shadow-inner">
        {truncateAddress(publicKey)}
      </div>
      <button
        onClick={disconnect}
        className="px-2 py-1 bg-gray-800 shadow-sm hover:bg-gray-700 text-gray-300 rounded text-[11px] transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
