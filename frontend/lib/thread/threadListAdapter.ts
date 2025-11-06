import {ExternalStoreThreadData, ExternalStoreThreadListAdapter, ThreadMessageLike} from "@assistant-ui/react";

interface CreateThreadListAdapterParams {
    currentThreadId: string;
    threads: Map<string, ThreadMessageLike[]>;
    threadList: ExternalStoreThreadData<"regular" | "archived">[];
    setThreadList: React.Dispatch<React.SetStateAction<ExternalStoreThreadData<"regular" | "archived">[]>>;
    setCurrentThreadId: (id: string) => void;
    setThreads: React.Dispatch<React.SetStateAction<Map<string, ThreadMessageLike[]>>>;
    abortThreadStream: (threadId: string) => void;
}

const deleteEmptyThread = (
    threads: Map<string, ThreadMessageLike[]>,
    setThreads: React.Dispatch<React.SetStateAction<Map<string, ThreadMessageLike[]>>>,
    currentThreadId: string) => {

    threads.forEach((thread) => {
        if (thread.length === 0) {
            setThreads((prev) => {
                const next = new Map(prev);
                next.delete(currentThreadId);
                return next;
            });
        }
    })
};


export const createThreadListAdapter = ({
                                            currentThreadId,
                                            threads,
                                            threadList,
                                            setThreadList,
                                            setCurrentThreadId,
                                            setThreads,
                                            abortThreadStream,
                                        }: CreateThreadListAdapterParams): ExternalStoreThreadListAdapter => ({
    threadId: currentThreadId,
    threads: threadList.filter(
        (t): t is ExternalStoreThreadData<"regular"> => t.status === "regular"
    ),
    archivedThreads: threadList.filter(
        (t): t is ExternalStoreThreadData<"archived"> => t.status === "archived"
    ),

    onSwitchToNewThread: () => {
        const newId = crypto.randomUUID();

        // Remove current thread from if it has no messages
        deleteEmptyThread(threads, setThreads, currentThreadId);

        // A thread is added to thread list when a new message is added, so we only need to create a thread here
        setThreads((prev) => {
            const next = new Map(prev);
            next.set(newId, []);
            return next;
        });
        setCurrentThreadId(newId);
    },

    onSwitchToThread: (threadId) => {
        deleteEmptyThread(threads, setThreads, currentThreadId);
        setCurrentThreadId(threadId);
    },

    onRename: (threadId, newTitle) => {
        setThreadList((prev) =>
            prev.map((t) => (t.id === threadId ? {...t, title: newTitle} : t))
        );
    },

    onArchive: (threadId) => {
        abortThreadStream(threadId);

        setThreadList((prev) =>
            prev.map((t) => (t.id === threadId ? {...t, status: "archived" as const} : t))
        );

        if (currentThreadId === threadId) {
            const regularThreads = threadList.filter(
                (t) => t.status === "regular" && t.id !== threadId
            );

            if (regularThreads.length > 0) {
                setCurrentThreadId(regularThreads[0].id);
            } else {
                const newId = crypto.randomUUID();

                setThreads((prev) => {
                    const next = new Map(prev);
                    next.set(newId, []);
                    return next;
                });

                setCurrentThreadId(newId);
            }
        }
    },
});