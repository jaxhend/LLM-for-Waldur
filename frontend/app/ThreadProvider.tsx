"use client";

{/*
    Continue: https://www.assistant-ui.com/docs/runtimes/custom/external-store#2-advanced-conversion-with-useexternalmessageconverter
    Live LLM responses: http://localhost:3000/
    Features to be added:
    TODO: thread management (delete, rename, create new, navigate between, naming, message ID)

    TODO: onCancel, OnReload, feedback adapters
    TODO: add history button to messages to show previous versions
    TODO: autoscroll to bottom (like ChatGPT)
    TODO: userID to identify different users
    TODO: mock DB integration with threading, messages and user management
    TODO: token button

    Changes to revert:
    - backend\app\main.py CORS settings
*/}


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