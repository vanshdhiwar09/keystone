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
      <div className="px-3 py-1.5 bg-steel border border-limestone text-iron/70 rounded text-[11px] font-medium animate-pulse">
        Loading...
      </div>
    );
  }

  // 1: API Check Error UI 
  if (installed === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-oxide font-bold uppercase tracking-tight">Connection Fault</span>
        <button
          onClick={checkFreighter}
          className="px-2 py-1 bg-limestone hover:bg-limestone/80 text-iron rounded text-[10px] font-bold transition-colors uppercase tracking-tight focus:outline-2 focus:outline-offset-2 focus:outline-banknote"
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
        className="px-3 py-1.5 bg-banknote text-alum hover:bg-banknote/90 rounded font-medium text-xs transition-colors tracking-tight whitespace-nowrap focus:outline-2 focus:outline-offset-2 focus:outline-banknote"
      >
        Install Freighter
      </a>
    );
  }

  // 3: Connected but distinctly Wrong Network 
  if (network && network !== "TESTNET") {
    return (
      <div className="px-3 py-1.5 border border-oxide text-oxide bg-alum rounded text-[10px] text-center flex flex-col items-center leading-tight whitespace-nowrap">
        <span className="font-bold uppercase tracking-wide">Network Fault</span>
        <span className="tracking-tight">Switch to Testnet</span>
      </div>
    );
  }

  // 4: Installed / Authorized cleanly, just waiting to Connect
  if (!publicKey) {
    return (
      <button
        onClick={connect}
        className="px-3 py-1.5 bg-banknote text-alum hover:bg-banknote/90 rounded font-medium text-xs transition-colors tracking-tight whitespace-nowrap focus:outline-2 focus:outline-offset-2 focus:outline-banknote"
      >
        Connect Wallet
      </button>
    );
  }

  // 5: Online & Bound Correctly
  return (
    <div className="flex items-center gap-1.5">
      <div className="px-2 py-1 bg-brass text-iron rounded text-[10px] font-mono tracking-tight font-bold shadow-inner whitespace-nowrap uppercase">
        {truncateAddress(publicKey)}
      </div>
      <button
        onClick={disconnect}
        className="px-2 py-1 bg-steel border border-limestone hover:bg-limestone text-iron rounded text-[10px] transition-colors whitespace-nowrap tracking-tight font-medium focus:outline-2 focus:outline-offset-2 focus:outline-banknote"
      >
        Disconnect
      </button>
    </div>
  );
}
