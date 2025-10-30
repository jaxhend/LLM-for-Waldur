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
    setCurrentThreadId: () => {},
    threads: new Map(),
    setThreads: () => {},
});

// Thread provider component
export function ThreadProvider({ children }: { children: ReactNode }) {
    const [threads, setThreads] = useState<Map<string, ThreadMessageLike[]>>(
        new Map([["default", []]]),
    );
    const [currentThreadId, setCurrentThreadId] = useState("default");

    return (
        <ThreadContext.Provider
            value={{ currentThreadId, setCurrentThreadId, threads, setThreads }}
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