"use client";

import { useEffect, useState, useRef } from "react";
import { server, ESCROW_CONTRACT_ID } from "../../lib/soroban";
import { fetchJobMetadata } from "../../lib/api";
import { scValToNative } from "@stellar/stellar-sdk";

interface ActivityViewProps {
    setView?: (v: string) => void;
}

interface ParsedEvent {
    id: string; // stable identifier
    type: "CREATED" | "ADDED" | "FUNDED" | "SUBMITTED" | "APPROVED" | "DISPUTED" | "RESOLVED" | "RELEASED";
    jobId: number;
    milestoneId?: number;
    amount?: string;
    releaseFunds?: boolean;
    ledgerClosedAt: string;
    ledger: number;
    transactionIndex: number;
    txHash: string;
}

// Recalculates relative date/time labels
function formatRelativeTime(dateString: string): string {
    const closed = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - closed.getTime();
    if (isNaN(diffMs)) return "UNKNOWN DATE";
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSecs < 60) return "JUST NOW";

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} MIN AGO`;

    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} HR${diffHrs > 1 ? "S" : ""} AGO`;

    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} DAY${diffDays > 1 ? "S" : ""} AGO`;
}

function renderEventIcon(type: string) {
    const iconProps = {
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        strokeWidth: "2",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        style: { display: "block" }
    };

    switch (type) {
        case "CREATED":
            return (
                <svg {...iconProps} stroke="var(--banknote)">
                    <path d="M12 5v14M5 12h14" />
                </svg>
            );
        case "ADDED":
            return (
                <svg {...iconProps} stroke="var(--brass)">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
            );
        case "FUNDED":
            return (
                <svg {...iconProps} stroke="var(--banknote)">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            );
        case "SUBMITTED":
            return (
                <svg {...iconProps} stroke="var(--brass)">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
            );
        case "APPROVED":
            return (
                <svg {...iconProps} stroke="var(--banknote)">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            );
        case "DISPUTED":
            return (
                <svg {...iconProps} stroke="var(--oxide)">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            );
        case "RELEASED":
            return (
                <svg {...iconProps} stroke="var(--brass)">
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                    <circle cx="12" cy="12" r="2" />
                    <line x1="6" y1="12" x2="6.01" y2="12" />
                    <line x1="18" y1="12" x2="18.01" y2="12" />
                </svg>
            );
        case "RESOLVED":
            return (
                <svg {...iconProps} stroke="var(--iron)">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M22 4L12 14.01l-3-3" />
                </svg>
            );
        default:
            return (
                <svg {...iconProps} stroke="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            );
    }
}

function ActivitySkeleton() {
    return (
        <>
            {[1, 2, 3, 4].map(i => (
                <div className="feed-node skeleton-node-pulse" key={i} style={{ opacity: 1 - i * 0.15 }}>
                    <div className="feed-time" style={{ width: 80, height: 16, background: "rgba(22,26,29,0.06)", borderRadius: 2, marginLeft: "auto" }} />
                    <div className="feed-content" style={{ background: "var(--alum)", pointerEvents: "none" }}>
                        <div style={{ height: 16, background: "rgba(22,26,29,0.06)", borderRadius: 2, width: "65%", marginBottom: 12 }} />
                        <div style={{ height: 14, background: "rgba(22,26,29,0.06)", borderRadius: 2, width: "85%" }} />
                    </div>
                </div>
            ))}
        </>
    );
}

export default function ActivityView({ setView }: ActivityViewProps) {
    const [events, setEvents] = useState<ParsedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [reconnecting, setReconnecting] = useState(false);
    const [timeTicker, setTimeTicker] = useState(0);

    const lastLedgerRef = useRef<number | null>(null);
    const activePollingRef = useRef<boolean>(true);
    const currentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentAbortControllerRef = useRef<AbortController | null>(null);
    const retryDelayRef = useRef<number>(10000); // 10s default

    // Metadata caches
    const metadataMapRef = useRef<{
        jobs: Record<number, string>;
        milestones: Record<string, string>;
    }>({ jobs: {}, milestones: {} });

    // 1. Fetch metadata lookup schema once on mount
    useEffect(() => {
        let active = true;
        async function initMetadata() {
            try {
                const res = await fetchJobMetadata();
                const metaJobs = Array.isArray(res) ? res : (res.jobs ?? []);
                const jobsMap: Record<number, string> = {};
                const msMap: Record<string, string> = {};

                for (const job of metaJobs) {
                    jobsMap[job.jobId] = job.title;
                    if (job.milestones) {
                        job.milestones.forEach((m: any, idx: number) => {
                            msMap[`${job.jobId}-${idx + 1}`] = m.title || `Milestone #${idx + 1}`;
                        });
                    }
                }
                if (active) {
                    metadataMapRef.current = { jobs: jobsMap, milestones: msMap };
                }
            } catch (err) {
                console.error("Failed to load metadata lookup mapping:", err);
            }
        }
        initMetadata();
        return () => { active = false; };
    }, []);

    // 2. Timer to refresh relative time labels (every 15s)
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeTicker(t => t + 1);
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    // 3. Core Delta Polling Flow
    useEffect(() => {
        activePollingRef.current = true;

        async function pollEvents() {
            if (!activePollingRef.current) return;

            // Re-instantiate AbortController for this fetch
            if (currentAbortControllerRef.current) {
                currentAbortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            currentAbortControllerRef.current = abortController;

            try {
                const ledgerInfo = await server.getLatestLedger();
                const latestLedger = ledgerInfo.sequence;

                let startLedger = 0;
                if (lastLedgerRef.current === null) {
                    // Initial load: go back ~1500 ledgers (approx. 2 hours)
                    startLedger = Math.max(1, latestLedger - 1500);
                } else if (latestLedger > lastLedgerRef.current) {
                    startLedger = lastLedgerRef.current + 1;
                } else {
                    // No new ledgers, skip query execution
                    scheduleNext(10000);
                    return;
                }

                // If abort signal occurred during getLatestLedger await
                if (abortController.signal.aborted) return;

                const request = {
                    startLedger,
                    filters: [{
                        type: "contract" as const,
                        contractIds: [ESCROW_CONTRACT_ID]
                    }],
                    limit: 100
                };

                const response = await server.getEvents(request);

                if (abortController.signal.aborted) return;

                const newParsed: ParsedEvent[] = [];
                for (const rawEv of response.events) {
                    if (rawEv.type !== "contract" || !rawEv.inSuccessfulContractCall) continue;

                    try {
                        const topics = rawEv.topic.map(t => scValToNative(t));
                        const val = scValToNative(rawEv.value);

                        if (!topics || topics.length < 2) continue;

                        const category = topics[0];
                        const action = topics[1];

                        if (category === "JOB" && action === "CREATED") {
                            const jobId = Number(val);
                            newParsed.push({
                                id: rawEv.id,
                                type: "CREATED",
                                jobId,
                                ledgerClosedAt: rawEv.ledgerClosedAt,
                                ledger: rawEv.ledger,
                                transactionIndex: rawEv.transactionIndex,
                                txHash: rawEv.txHash
                            });
                        } else if (category === "MILESTONE") {
                            const jobId = Number(val[0]);
                            const milestoneId = Number(val[1]);
                            const typeMap: Record<string, ParsedEvent["type"]> = {
                                ADDED: "ADDED",
                                FUNDED: "FUNDED",
                                SUBMITTED: "SUBMITTED",
                                APPROVED: "APPROVED",
                                DISPUTED: "DISPUTED",
                                RELEASED: "RELEASED",
                                RESOLVED: "RESOLVED"
                            };

                            const evType = typeMap[action];
                            if (!evType) continue;

                            newParsed.push({
                                id: rawEv.id,
                                type: evType,
                                jobId,
                                milestoneId,
                                amount: action === "ADDED" ? String(val[2]) : undefined,
                                releaseFunds: action === "RESOLVED" ? Boolean(val[2]) : undefined,
                                ledgerClosedAt: rawEv.ledgerClosedAt,
                                ledger: rawEv.ledger,
                                transactionIndex: rawEv.transactionIndex,
                                txHash: rawEv.txHash
                            });
                        }
                    } catch (err) {
                        console.warn("Failed to parse individual event:", err);
                    }
                }

                // If abort signal occurred during parsing loop
                if (abortController.signal.aborted) return;

                setEvents((prev) => {
                    // Deduplicate
                    const map = new Map<string, ParsedEvent>();
                    prev.forEach(e => map.set(e.id, e));
                    newParsed.forEach(e => map.set(e.id, e));

                    // Sort chronologically (Descending: newest first)
                    const sorted = Array.from(map.values()).sort((a, b) => {
                        if (b.ledger !== a.ledger) return b.ledger - a.ledger;
                        if (b.transactionIndex !== a.transactionIndex) return b.transactionIndex - a.transactionIndex;
                        return b.id.localeCompare(a.id);
                    });

                    // Keep recent 150 entries in memory
                    return sorted.slice(0, 150);
                });

                lastLedgerRef.current = latestLedger;
                setLoading(false);
                setReconnecting(false);
                retryDelayRef.current = 10000; // Reset backoff delay on success
                scheduleNext(10000);
            } catch (err) {
                if (abortController.signal.aborted) return;

                console.error("Delta event query failed:", err);
                setLoading(false);
                setReconnecting(true);

                // Exponential retry backoff cap at 80 seconds
                const nextDelay = Math.min(80000, retryDelayRef.current * 2);
                retryDelayRef.current = nextDelay;
                scheduleNext(nextDelay);
            }
        }

        function scheduleNext(delay: number) {
            if (!activePollingRef.current) return;
            if (currentTimeoutRef.current) clearTimeout(currentTimeoutRef.current);
            currentTimeoutRef.current = setTimeout(pollEvents, delay);
        }

        // 4. Tab Visibility Listener
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                // Resume immediately
                pollEvents();
            } else {
                // Pause and abort
                if (currentTimeoutRef.current) clearTimeout(currentTimeoutRef.current);
                if (currentAbortControllerRef.current) currentAbortControllerRef.current.abort();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        pollEvents(); // Run initial poll

        return () => {
            activePollingRef.current = false;
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (currentTimeoutRef.current) clearTimeout(currentTimeoutRef.current);
            if (currentAbortControllerRef.current) currentAbortControllerRef.current.abort();
        };
    }, []);

    // Helper text formattings
    function getEventMessage(e: ParsedEvent) {
        const jobs = metadataMapRef.current.jobs;
        const milestones = metadataMapRef.current.milestones;

        const jobName = jobs[e.jobId] ? `"${jobs[e.jobId]}"` : `Contract #${e.jobId}`;
        const msName = milestones[`${e.jobId}-${e.milestoneId}`]
            ? `"${milestones[`${e.jobId}-${e.milestoneId}`]}"`
            : `Milestone #${e.milestoneId}`;

        switch (e.type) {
            case "CREATED":
                return (
                    <>Contract {jobName} created.</>
                );
            case "ADDED": {
                const rawAmount = Number(e.amount ?? 0) / 1e7;
                return (
                    <>Milestone {msName} added to {jobName} (<strong>{rawAmount} XLM</strong>).</>
                );
            }
            case "FUNDED":
                return (
                    <>Milestone {msName} of {jobName} funded by Client. <strong>Funds locked</strong>.</>
                );
            case "SUBMITTED":
                return (
                    <>Freelancer submitted {msName} of {jobName} for review.</>
                );
            case "APPROVED":
                return (
                    <>Milestone {msName} of {jobName} <strong>approved</strong> by Client.</>
                );
            case "DISPUTED":
                return (
                    <>Milestone {msName} of {jobName} <strong>disputed</strong>. Escalated to Arbitrator.</>
                );
            case "RELEASED":
                return (
                    <>Milestone {msName} of {jobName} released. Funds paid out to Freelancer.</>
                );
            case "RESOLVED":
                const direct = e.releaseFunds ? "released to Freelancer" : "refunded to Client";
                return (
                    <>Dispute on {msName} of {jobName} <strong>resolved</strong> by Arbitrator (Funds {direct}).</>
                );
            default:
                return <>Contract action detected on #{e.jobId}</>;
        }
    }

    return (
        <main className="page-view active" id="view-feed">
            <div className="feed-layout" style={{ maxWidth: 1200, margin: "0 auto" }}>

                <div className="feed-title-col">
                    <h2 className="feed-title display">LIVE<br />FEED</h2>

                    {reconnecting && (
                        <div className="reconnecting-badge" style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            background: "rgba(230, 95, 92, 0.1)",
                            border: "1px solid rgba(230, 95, 92, 0.2)",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontFamily: "'DM Mono', monospace",
                            color: "var(--oxide)",
                            marginTop: "16px"
                        }}>
                            <span className="reconnecting-dot" style={{
                                width: "6px",
                                height: "6px",
                                background: "var(--oxide)",
                                borderRadius: "50%",
                                display: "inline-block",
                                animation: "pulseOpacity 1.5s infinite ease-in-out"
                            }} />
                            RECONNECTING...
                        </div>
                    )}
                </div>

                <div className="timeline-feed">
                    {loading && events.length === 0 ? (
                        <ActivitySkeleton />
                    ) : events.length === 0 ? (
                        <div className="feed-node-empty" style={{
                            gridColumn: "1 / -1",
                            padding: "48px",
                            textAlign: "center",
                            background: "var(--alum)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "8px",
                            fontFamily: "'DM Mono', monospace",
                            color: "rgba(22, 26, 29, 0.4)"
                        }}>
                            NO CONTRACT EVENTS DETECTED YET.
                        </div>
                    ) : (
                        events.map((e) => (
                            <div
                                className="feed-node clickable-feed-node"
                                key={e.id}
                                onClick={() => setView?.(`blueprint:${e.jobId}`)}
                                style={{ cursor: setView ? "pointer" : "default" }}
                            >
                                <div className="feed-time">
                                    {formatRelativeTime(e.ledgerClosedAt)}
                                </div>
                                <div className="feed-content" style={{
                                    display: "flex",
                                    gap: "16px",
                                    alignItems: "flex-start"
                                }}>
                                    <div className="feed-icon-wrapper" style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "6px",
                                        background: "rgba(22, 26, 29, 0.04)",
                                        flexShrink: 0,
                                        marginTop: "-4px"
                                    }}>
                                        {renderEventIcon(e.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p className="feed-text">
                                            {getEventMessage(e)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes pulseOpacity {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
                @keyframes pulseSkeleton {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                :global(.skeleton-node-pulse) {
                    animation: pulseSkeleton 1.5s infinite ease-in-out;
                }
                :global(.clickable-feed-node .feed-content) {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                :global(.clickable-feed-node:hover .feed-content) {
                    transform: translateX(4px);
                    box-shadow: 0 4px 12px rgba(22, 26, 29, 0.05);
                }
            `}</style>
        </main >
    );
}
