import {ThreadMessageLike} from "@assistant-ui/react";

/**
 * Debug all threads
 */
export const debugAllThreads = (
    threads: Map<string, ThreadMessageLike[]>,
    currentThreadId: string
) => {
    const timestamp = new Date().toISOString();

    console.group(`[DEBUG] All Threads - ${timestamp}`);
    console.log("📍 Current Thread ID:", currentThreadId);
    console.log("📊 Total Threads:", threads.size);

    console.table(
        Array.from(threads.entries()).map(([id, messages]) => ({
            ThreadID: id,
            IsCurrent: id === currentThreadId ? "✅" : "",
            MessageCount: messages.length,
            LastMessage: messages[messages.length - 1]
                ? ((messages[messages.length - 1].content[0] as any)?.text ?? "").slice(0, 30)
                : "Empty",
        }))
    );

    console.groupEnd();
};

/**
 * Quick debug for current thread
 */
export const debugCurrentThread = (
    threadId: string,
    messages: readonly ThreadMessageLike[]
) => {
    console.log(
        `🧵 Thread: ${threadId} | 💬 Messages: ${messages.length} | ⏰ ${new Date().toLocaleTimeString()}`
    );
};