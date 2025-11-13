import {ExternalStoreThreadData, ThreadMessageLike} from "@assistant-ui/react";

/**
 * Debug all threads
 */
export const debugAllThreads = (
    threads: Map<string, ThreadMessageLike[]>,
    threadList: ExternalStoreThreadData<"regular" | "archived">[],
    currentThreadId: string,
) => {
    console.group("🧵 Debug Threads");
    console.table(
        Array.from(threads.entries()).map(([id, messages]) => ({
            ThreadID: id,
            IsCurrent: id === currentThreadId ? "✅" : "",
            Name: threadList.find(t => t.id === id)?.title ?? "Unnamed",
            MessageCount: messages.length,
            LastMessage: messages[messages.length - 1]
                ? ((messages[messages.length - 1].content[0] as any)?.text ?? "").slice(0, 30)
                : "Empty",
        }))
    );
    console.groupEnd();
};