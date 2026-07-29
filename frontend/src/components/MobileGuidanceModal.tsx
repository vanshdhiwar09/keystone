"use client";

import React, { useState, useEffect } from "react";

interface MobileGuidanceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileGuidanceModal({ isOpen, onClose }: MobileGuidanceModalProps) {
    const [copied, setCopied] = useState(false);
    const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const userAgent = navigator.userAgent || "";
            if (/iPhone|iPad|iPod/i.test(userAgent)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPlatform("ios");
            } else if (/Android/i.test(userAgent)) {
                setPlatform("android");
            }
        }
    }, []);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy link: ", err);
        }
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
            animation: "fadeIn 0.2s ease-out"
        }}>
            <div style={{
                backgroundColor: "#16191c",
                border: "1px solid rgba(191, 161, 95, 0.2)",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "460px",
                padding: "28px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                color: "#e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                position: "relative"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: "20px",
                        fontWeight: 600,
                        color: "#fff",
                        fontFamily: "var(--font-display, inherit)"
                    }}>
                        Connecting on Mobile
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontSize: "22px",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}
                    >
                        &times;
                    </button>
                </div>

                <p style={{
                    margin: 0,
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#94a3b8"
                }}>
                    Standard mobile browsers (like Chrome, Brave, and Samsung Internet) do not support desktop-style content injection. To interact with your account and contracts:
                </p>

                <div style={{
                    backgroundColor: "#1c2024",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.05)"
                }}>
                    <strong style={{ fontSize: "14px", color: "#BFA15F" }}>
                        How to Connect:
                    </strong>
                    <ol style={{
                        margin: 0,
                        paddingLeft: "20px",
                        fontSize: "13px",
                        lineHeight: "1.5",
                        color: "#cbd5e1",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                    }}>
                        <li>Copy this page&apos;s URL using the button below.</li>
                        <li>Open the <strong>Freighter Mobile App</strong>.</li>
                        {platform === "ios" ? (
                            <li>
                                Go to the <strong>Browser</strong> tab and paste the URL.
                                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", fontStyle: "italic" }}>
                                    Tip: You can also enable the <strong>Freighter Extension</strong> in Safari settings.
                                </div>
                            </li>
                        ) : (
                            <li>Go to the <strong>Browser</strong> tab and paste the URL.</li>
                        )}
                    </ol>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button
                        onClick={handleCopy}
                        style={{
                            backgroundColor: copied ? "#10b981" : "#BFA15F",
                            color: "#111315",
                            fontWeight: "600",
                            border: "none",
                            borderRadius: "10px",
                            padding: "12px 16px",
                            fontSize: "14px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px"
                        }}
                    >
                        {copied ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Copied Website URL!
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy Website Link
                            </>
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: "transparent",
                            color: "#cbd5e1",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px",
                            padding: "12px 16px",
                            fontSize: "14px",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                            e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "#cbd5e1";
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
