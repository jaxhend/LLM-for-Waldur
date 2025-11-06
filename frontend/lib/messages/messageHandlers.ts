import {AppendMessage, ExternalStoreThreadData, ThreadMessageLike} from "@assistant-ui/react";
import {StartRunConfig} from "@/lib/types";
import {createUserMessage, createAssistantPlaceholder} from "./messageFactories";
import {addContext, addPreviousText} from "./messageUtils";
import {parseAssistantStream} from "@/lib/streaming/parseAssistantStream";
import {addThreadToListIfNotExists} from "@/lib/thread/threadListAdapter";
import {generateAndSetThreadTitle} from "@/lib/streaming/generateAndSetThreadTitle";

export interface MessageHandlerDependencies {
    userId: string;
    messages: readonly ThreadMessageLike[];
    setMessages: React.Dispatch<React.SetStateAction<readonly ThreadMessageLike[]>>;
    currentThreadId: string;
    setIsRunning: (threadId: string, value: boolean | ((prev: boolean) => boolean)) => void;
    createController: (threadId: string) => AbortController;
    cleanupController: (threadId: string) => void;
    setThreadList: React.Dispatch<React.SetStateAction<ExternalStoreThreadData<"regular" | "archived">[]>>;
}

export const createOnNew = (deps: MessageHandlerDependencies) => {
    return async (message: AppendMessage) => {
        const firstContent = message.content[0];
        if (typeof firstContent !== "object" || !firstContent || firstContent.type !== "text") {
            throw new Error("Only text messages are supported");
        }
        const input = firstContent.text;
        const isFirstMessage = deps.messages.length === 0;

        const userMessage = createUserMessage(input);
        deps.setMessages((prev) => [...prev, userMessage]);

        // Add thread to thread list if it doesn't exist there yet
        addThreadToListIfNotExists(deps.setThreadList, deps.currentThreadId);

        const assistantPlaceholder = createAssistantPlaceholder();
        deps.setMessages((prev) => [...prev, assistantPlaceholder]);

        const contextInput = addContext(input, deps.messages.slice(0, -1));
        const abortController = deps.createController(deps.currentThreadId);

        try {
            await parseAssistantStream({
                contextInput,
                userId: deps.userId,
                assistantId: assistantPlaceholder.id!,
                setMessages: deps.setMessages,
                setIsRunning: (running) => deps.setIsRunning(deps.currentThreadId, running),
                signal: abortController.signal,
            });
            if (isFirstMessage) {
                await generateAndSetThreadTitle(input, deps);
            }
        } finally {
            deps.cleanupController(deps.currentThreadId);
        }
    };
}

export const createOnEdit = (deps: MessageHandlerDependencies) => {
    return async (message: AppendMessage) => {
        const firstContent = message.content[0];
        if (typeof firstContent !== "object" || !firstContent || firstContent.type !== "text") {
            throw new Error("Only text messages are supported");
        }
        const input = firstContent.text;
        const sourceId = message.sourceId;

        const userIndex = deps.messages.findIndex((m) => m.id === sourceId);
        if (userIndex === -1) return;

        const oldUser = deps.messages[userIndex];
        const oldText = (oldUser.content[0] as any)?.text ?? "";

        const oldAssistant = deps.messages[userIndex + 1];
        const oldAssistantText =
            oldAssistant?.role === "assistant"
                ? (oldAssistant.content[0] as any)?.text ?? ""
                : "";

        const assistantIdToStream = oldAssistant?.id ?? "";
        if (!assistantIdToStream) return;

        deps.setMessages((prev) => {
            const updated = [...prev];
            updated[userIndex] = {
                ...oldUser,
                content: [{type: "text", text: input}],
                metadata: addPreviousText(oldUser.metadata, oldText),
            };
            updated[userIndex + 1] = {
                ...oldAssistant,
                content: [{type: "text", text: ""}],
                metadata: addPreviousText(oldAssistant.metadata, oldAssistantText),
            };
            return updated;
        });

        const contextInput = addContext(input, deps.messages.slice(0, userIndex));
        const abortController = deps.createController(deps.currentThreadId);

        try {
            await parseAssistantStream({
                contextInput,
                userId: deps.userId,
                assistantId: assistantIdToStream,
                setMessages: deps.setMessages,
                setIsRunning: (running) => deps.setIsRunning(deps.currentThreadId, running),
                signal: abortController.signal,
            });
        } finally {
            deps.cleanupController(deps.currentThreadId);
        }
    };
};

export const createOnReload = (deps: MessageHandlerDependencies) => {
    return async (parentId: string | null, config: StartRunConfig) => {
        const sourceId = config.sourceId;
        if (!sourceId) return;

        const assistantIndex = deps.messages.findIndex((m) => m.id === sourceId);
        if (assistantIndex === -1) return;

        const oldAssistant = deps.messages[assistantIndex];
        const oldAssistantText = (oldAssistant.content[0] as any)?.text ?? "";

        const userIndex = assistantIndex - 1;
        if (userIndex < 0) return;
        const oldUser = deps.messages[userIndex];
        const input = (oldUser.content[0] as any)?.text ?? "";

        if (oldAssistant.role !== "assistant" || oldUser.role !== "user") {
            return;
        }

        deps.setMessages((prev) => {
            const updated = [...prev];
            updated[userIndex + 1] = {
                ...oldAssistant,
                content: [{type: "text", text: ""}],
                metadata: addPreviousText(oldAssistant.metadata, oldAssistantText),
            };
            return updated;
        });

        const contextInput = addContext(input, deps.messages.slice(0, userIndex));
        const abortController = deps.createController(deps.currentThreadId);

        try {
            await parseAssistantStream({
                contextInput,
                userId: deps.userId,
                assistantId: sourceId,
                setMessages: deps.setMessages,
                setIsRunning: (running) => deps.setIsRunning(deps.currentThreadId, running),
                signal: abortController.signal,
            });
        } finally {
            deps.cleanupController(deps.currentThreadId);
        }
    };
};