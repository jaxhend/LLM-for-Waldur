"use client";

{/*
    Features to be added:
    TODO: localstorage persistence for threads and messages
    TODO: view history button, view token usage button
    TODO: userID to identify different users (kasutaja1, kasutaja2)
    TODO: mock DB integration with threading, messages and user management

    Backend integration:
    TODO: connect with backend API
        - retrieve threads for user, save new thread, update name or status (archived)
        - save, update (edit, reload), abort messages
        - feedback and token usage

    Changes to revert:
    - backend\app\main.py CORS settings
*/
}

import {ReactNode, useEffect, useMemo, useState} from "react";
import {
    AssistantRuntimeProvider,
    ExternalStoreThreadData,
    ThreadMessageLike,
    useExternalStoreRuntime,
} from "@assistant-ui/react";
import {feedbackAdapter} from "@/lib/feedback/feedback";
import {useThreadContext} from "@/app/ThreadProvider";
import {useAbortControllers, useThreadRunningState} from "@/lib/thread/threadStateHooks";
import {convertMessage} from "@/lib/messages/messageUtils";
import {createThreadListAdapter} from "@/lib/thread/threadListAdapter";
import {createOnCancel, createOnEdit, createOnNew, createOnReload} from "@/lib/messages/messageHandlers";
import {debugAllThreads} from "@/lib/debug";
import {useFeedback} from "@/app/feedback-context";


export function ThreadRuntimeProvider({
                                          children,
                                          userId,
                                      }: Readonly<{ children: ReactNode; userId: string }>) {
    const {currentThreadId, setCurrentThreadId, threads, setThreads} = useThreadContext();

    const [threadList, setThreadList] = useState<
        ExternalStoreThreadData<"regular" | "archived">[]
    >([]);

    // Thread state management hooks
    const {getIsRunning, setIsRunning} = useThreadRunningState();
    const {createController, abortThread, cleanupController} = useAbortControllers();

    // Get current thread state
    const isRunning = getIsRunning(currentThreadId);
    const messages = threads.get(currentThreadId) ?? [];

    // Debugging effects
    if (process.env.NODE_ENV !== "production") {
        useEffect(() => {
            debugAllThreads(threads, threadList, currentThreadId);
        }, [threads.size, currentThreadId]);
    }

    // Messages setter for current thread
    const setMessages: React.Dispatch<React.SetStateAction<readonly ThreadMessageLike[]>> = (
        valueOrUpdater
    ) => {
        setThreads((prev) => {
            const currentMessages = prev.get(currentThreadId) ?? [];
            const newMessages =
                typeof valueOrUpdater === "function"
                    ? (valueOrUpdater as (prev: readonly ThreadMessageLike[]) => readonly ThreadMessageLike[])(currentMessages)
                    : valueOrUpdater;

            if (newMessages === currentMessages) return prev;

            const newThreads = new Map(prev);
            newThreads.set(currentThreadId, newMessages as ThreadMessageLike[]);

            return newThreads;
        });
    };

    // Abort stream helper
    const abortThreadStream = (threadId: string) => {
        abortThread(threadId);
        setIsRunning(threadId, false);
    };

    // Thread list adapter
    const threadListAdapter = createThreadListAdapter({
        currentThreadId,
        threads,
        threadList,
        setThreadList,
        setCurrentThreadId,
        setThreads,
        abortThreadStream,
    });

    // Message handler dependencies
    const handlerDeps = {
        userId,
        messages,
        setMessages,
        setIsRunning,
        currentThreadId,
        setThreadList,
        createController,
        cleanupController,
        abortThread,
    };

    // Message handlers
    const onNew = createOnNew(handlerDeps);
    const onEdit = createOnEdit(handlerDeps);
    const onReload = createOnReload(handlerDeps);
    const onCancel = createOnCancel(handlerDeps);

    // Feedback adapter
    const {openPanel} = useFeedback()
    const memoizedFeedbackAdapter = useMemo(
        () => feedbackAdapter(openPanel),
        [openPanel],
    );

    // Runtime
    const runtime = useExternalStoreRuntime({
        isRunning,
        messages,
        convertMessage,
        onNew,
        onEdit,
        onReload,
        onCancel,
        adapters: {
            threadList: threadListAdapter,
            feedback: memoizedFeedbackAdapter,
        },
    });

    return <AssistantRuntimeProvider runtime={runtime}>
        {children}
    </AssistantRuntimeProvider>;
}