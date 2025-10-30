"use client"

import {useThreadContext} from "@/app/ThreadProvider";
import {ReactNode, useState} from "react";
import {
    AppendMessage,
    AssistantRuntimeProvider,
    ExternalStoreThreadData,
    ExternalStoreThreadListAdapter, ThreadMessageLike,
    useExternalStoreRuntime
} from "@assistant-ui/react";
import {
    saveAssistantStream,
    convertMessage,
    addContext,
    createUserMessage,
    createAssistantPlaceholder,
    addPreviousText,
} from "@/lib/helper";
import type {StartRunConfig} from "@/lib/types";


export function ThreadRuntimeProvider({children, userId}: Readonly<{ children: ReactNode; userId: string }>) {
    const {currentThreadId, setCurrentThreadId, threads, setThreads} =
        useThreadContext();
    const [threadList, setThreadList] = useState<ExternalStoreThreadData<"regular" | "archived">[]>([
        {id: "default", status: "regular", title: "New Chat"},
    ]);

    const threadListAdapter: ExternalStoreThreadListAdapter = {
        threadId: currentThreadId,
        threads: threadList.filter((t): t is ExternalStoreThreadData<"regular"> => t.status === "regular"),
        archivedThreads: threadList.filter((t): t is ExternalStoreThreadData<"archived"> => t.status === "archived"),

        onSwitchToNewThread: () => {
            const newId = `thread-${Date.now()}`;
            setThreadList((prev) => [
                ...prev,
                {
                    id: newId,
                    status: "regular",
                    title: "New Chat",
                },
            ]);
            setThreads((prev) => new Map(prev).set(newId, []));
            setCurrentThreadId(newId);
        },

        onSwitchToThread: (threadId) => {
            setCurrentThreadId(threadId);
        },

        onRename: (threadId, newTitle) => {
            setThreadList((prev) =>
                prev.map((t) =>
                    t.id === threadId ? {...t, title: newTitle} : t,
                ),
            );
        },

        onArchive: (threadId) => {
            setThreadList((prev) =>
                prev.map((t) =>
                    t.id === threadId ? {...t, status: "archived"} : t,
                ),
            );
        },

        onDelete: (threadId) => {
            setThreadList((prev) => prev.filter((t) => t.id !== threadId));
            setThreads((prev) => {
                const next = new Map(prev);
                next.delete(threadId);
                return next;
            });
            if (currentThreadId === threadId) {
                setCurrentThreadId("default");
            }
        },
    };

    const [isRunning, setIsRunning] = useState(false);

    const messages = threads.get(currentThreadId) ?? [];
    const setMessages: React.Dispatch<React.SetStateAction<readonly ThreadMessageLike[]>> = (
        valueOrUpdater,
    ) => {
        setThreads(prev => {
            const currentMessages = prev.get(currentThreadId) ?? [];
            const newMessages =
                typeof valueOrUpdater === 'function'
                    ? (valueOrUpdater as (prev: readonly ThreadMessageLike[]) => readonly ThreadMessageLike[])(currentMessages)
                    : valueOrUpdater;

            if (newMessages === currentMessages) return prev;

            const newThreads = new Map(prev);
            newThreads.set(currentThreadId, newMessages as ThreadMessageLike[]);
            return newThreads;
        });
    };

    const onNew = async (message: AppendMessage) => {
        const firstContent = message.content[0];
        // Check if the content is a valid text object
        if (typeof firstContent !== "object" || !firstContent || firstContent.type !== "text") {
            throw new Error("Only text messages are supported");
        }
        const input = firstContent.text;

        const userMessage = createUserMessage(input);
        setMessages((prev) => [...prev, userMessage]);

        setIsRunning(true);
        const assistantPlaceholder = createAssistantPlaceholder();
        setMessages((prev) => [...prev, assistantPlaceholder]);

        const contextInput: string = addContext(input, messages.slice(0, -1));

        await saveAssistantStream({
            contextInput,
            userId,
            assistantId: assistantPlaceholder.id!,
            setMessages,
            setIsRunning,
        });
    };


    const onEdit = async (message: AppendMessage) => {
        const firstContent = message.content[0];

        if (typeof firstContent !== "object" || !firstContent || firstContent.type !== "text") {
            throw new Error("Only text messages are supported");
        }
        const input = firstContent.text;
        const sourceId = message.sourceId;

        // Find the user message and its following assistant message
        const userIndex = messages.findIndex((m) => m.id === sourceId);
        if (userIndex === -1) return;

        const oldUser = messages[userIndex];
        const oldText = (oldUser.content[0] as any)?.text ?? "";

        const oldAssistant = messages[userIndex + 1];
        const oldAssistantText = oldAssistant?.role === "assistant"
            ? (oldAssistant.content[0] as any)?.text ?? ""
            : "";

        const assistantIdToStream: string = oldAssistant?.id ?? "";
        if (!assistantIdToStream) return;


        // Update user message and reset assistant message content, preserving edit history
        setMessages((prev) => {
            const updated = [...prev];

            updated[userIndex] = {
                ...oldUser,
                content: [{type: "text", text: input}],
                metadata: addPreviousText(oldUser.metadata, oldText)
            };

            updated[userIndex + 1] = {
                ...oldAssistant,
                content: [{type: "text", text: ""}],
                metadata: addPreviousText(oldAssistant.metadata, oldAssistantText)
            };
            return updated;
        });

        const contextInput: string = addContext(input, messages.slice(0, userIndex));

        // Start streaming the new assistant response
        await saveAssistantStream({
            contextInput,
            userId,
            assistantId: assistantIdToStream,
            setMessages,
            setIsRunning,
        });
    };


    const onReload = async (parentId: string | null, config: StartRunConfig) => {
        const sourceId = config.sourceId; // assistant message ID to reload
        if (!sourceId) return;

        const assistantIndex = messages.findIndex((m) => m.id === sourceId);
        if (assistantIndex === -1) return

        const oldAssistant = messages[assistantIndex];
        const oldAssistantText = (oldAssistant.content[0] as any)?.text ?? "";

        const userIndex = assistantIndex - 1;
        if (userIndex < 0) return; // No preceding user message
        const oldUser = messages[userIndex];
        const input = (oldUser.content[0] as any)?.text ?? "";

        if (oldAssistant.role !== 'assistant' || oldUser.role !== 'user') {
            return; // Safety check
        }

        // Reset assistant message content and preserve edit history
        setMessages((prev) => {
            const updated = [...prev];

            updated[userIndex + 1] = {
                ...oldAssistant,
                content: [{type: "text", text: ""}],
                metadata: addPreviousText(oldAssistant.metadata, oldAssistantText)
            };
            return updated;
        });

        const contextInput: string = addContext(input, messages.slice(0, userIndex));

        await saveAssistantStream({
            contextInput,
            userId,
            assistantId: sourceId, // Stream into the existing assistant message
            setMessages,
            setIsRunning,
        });
    };


    const runtime = useExternalStoreRuntime({
        isRunning,
        messages,
        convertMessage,
        onNew,
        onEdit,
        onReload,
        adapters: {
            threadList: threadListAdapter
        },
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}