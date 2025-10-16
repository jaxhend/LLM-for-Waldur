export async function resolveAssistantMessageId(
    threadId: number,
    turn: number,
    {retries = 20, intervalMs = 150, signal}: { retries?: number; intervalMs?: number; signal?: AbortSignal } = {}
): Promise<number | null> {
    const BASE_API_URL: string =
        process.env.NODE_ENV === "production"
            ? "https://llm.testing.waldur.com"
            : "http://127.0.0.1:8000";

    for (let i = 0; i < retries; i++) {
        if (signal?.aborted) {
            return null;
        }

        const res = await fetch(`${BASE_API_URL}/api/messages/thread/${threadId}/turn/${turn}`);
        if (res.ok) {
            const rows: Array<{ id: number; role: string }> = await res.json();
            const assistant = rows.find(r => r.role === "assistant");
            if (assistant) return assistant.id;
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return null
}