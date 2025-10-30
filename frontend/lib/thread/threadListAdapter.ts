import {ExternalStoreThreadData, ExternalStoreThreadListAdapter, ThreadMessageLike} from "@assistant-ui/react";

interface CreateThreadListAdapterParams {
    currentThreadId: string;
    threadList: ExternalStoreThreadData<"regular" | "archived">[];
    setThreadList: React.Dispatch<React.SetStateAction<ExternalStoreThreadData<"regular" | "archived">[]>>;
    setCurrentThreadId: (id: string) => void;
    setThreads: React.Dispatch<React.SetStateAction<Map<string, ThreadMessageLike[]>>>;
    abortThreadStream: (threadId: string) => void;
}

export const createThreadListAdapter = ({
                                            currentThreadId,
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
        setThreadList((prev) => [
            ...prev,
            {
                id: newId,
                status: "regular" as const,
                title: "New Chat",
            },
        ]);
        setThreads((prev) => {
            const next = new Map(prev);
            next.set(newId, []);
            return next;
        });
        setCurrentThreadId(newId);
    },

    onSwitchToThread: (threadId) => {
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

                setThreadList((prev) => [
                    ...prev,
                    {id: newId, status: "regular" as const, title: "New Chat"},
                ]);

                setCurrentThreadId(newId);
            }
        }
    },
});