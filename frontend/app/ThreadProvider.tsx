"use client";

import {createContext, ReactNode, useContext, useState} from "react";
import {ThreadMessageLike} from "@assistant-ui/react";

const ThreadContext = createContext<{
    currentThreadId: string;
    setCurrentThreadId: (id: string) => void;
    threads: Map<string, ThreadMessageLike[]>;
    setThreads: React.Dispatch<
        React.SetStateAction<Map<string, ThreadMessageLike[]>>
    >;
}>({
    currentThreadId: "default",
    setCurrentThreadId: () => {
    },
    threads: new Map(),
    setThreads: () => {
    },
});

// Thread provider component
export function ThreadProvider({children}: { children: ReactNode }) {
    // Create initial thread with unique ID
    const [threadID] = useState(() => crypto.randomUUID());
    // Store ALL threads in a Map: threadId -> messages[]
    const [threads, setThreads] = useState<Map<string, ThreadMessageLike[]>>(
        () => new Map([[threadID, []]])
    );
    // Track which thread is currently active
    const [currentThreadId, setCurrentThreadId] = useState(threadID);

    // Provide this state to all child components
    return (
        <ThreadContext.Provider
            value={{currentThreadId, setCurrentThreadId, threads, setThreads}}
        >
            {children}
        </ThreadContext.Provider>
    );
}

// Hook for accessing thread context
export function useThreadContext() {
    const context = useContext(ThreadContext);
    if (!context) {
        throw new Error("useThreadContext must be used within ThreadProvider");
    }
    return context;
}