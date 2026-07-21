export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000").trim();

export interface JobMetadataPayload {
    jobId: number;
    title: string;
    description: string;
    clientAddress: string;
    freelancerAddress: string;
    milestones: { title: string; description: string }[];
    timestamp: number;
    signedMessage: string | any;
}

/**
 * Creates the structural job allocation footprint safely logging cryptographically signed Freighter states.
 */
export async function createJobMetadata(payload: JobMetadataPayload) {
    const res = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to generate Job metadata natively. Status: ${res.status}`);
    }
    return res.json();
}

/**
 * Native querying array fetching active offline Job footprints executing PostgreSQL dynamic bounds dynamically.
 */
export async function fetchJobMetadata(params?: { search?: string, wallet?: string }) {
    const url = new URL(`${BACKEND_URL}/api/jobs`);
    if (params?.search) url.searchParams.append("search", params.search);
    if (params?.wallet) url.searchParams.append("wallet", params.wallet);

    const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch Metadata arrays securely. Status: ${res.status}`);
    }
    return res.json();
}
