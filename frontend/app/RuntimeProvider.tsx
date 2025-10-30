"use client";

{/*
    Continue: https://www.assistant-ui.com/docs/runtimes/custom/external-store#2-advanced-conversion-with-useexternalmessageconverter
    Live LLM responses: http://localhost:3000/
    Features to be added:
    TODO: add message context

    TODO: onCancel, OnReload, feedback adapters
    TODO: thread management (delete, rename, create new, navigate between, naming, message ID)
    TODO: add history button to messages to show previous versions
    TODO: autoscroll to bottom (like ChatGPT)
    TODO: userID to identify different users
    TODO: mock DB integration with threading, messages and user management
    TODO: token button

    Changes to revert:
    - backend\app\main.py CORS settings
*/

}
import {v4 as uuidv4} from "uuid";
import {useState, ReactNode} from "react";
import {
    useExternalStoreRuntime,
    ThreadMessageLike,
    AppendMessage,
    AssistantRuntimeProvider,
} from "@assistant-ui/react";
import type {StartRunConfig} from "@/lib/types";


async function* streamChat(input: string, userId: string): AsyncGenerator<{
    content?: string;
    additional_kwargs?: {
        usage_metadata?: object;
    };
}> {
    const response = await fetch("https://llm.testing.waldur.com/api/lc/chat/stream", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({input, user_id: userId}),
    });

    if (!response.body) throw new Error("No response body for streaming");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    yield JSON.parse(line.slice(6));
                } catch (e) {
                    throw new Error("Failed to parse stream data");
                }
            }
        }
    }
    // yield any leftover buffer if it contains valid JSON
    if (buffer.trim()) {
        try {
            yield JSON.parse(buffer.trim().replace(/^data: /, ""));
        } catch (e) {
            // It's possible the buffer is incomplete, so we can ignore this error
        }
    }
}

async function saveAssistantStream({
                                       contextInput,
                                       userId,
                                       assistantId,
                                       setMessages,
                                       setIsRunning,
                                   }: {
    contextInput: string;
    userId: string;
    assistantId: string;
    setMessages: React.Dispatch<React.SetStateAction<readonly ThreadMessageLike[]>>;
    setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    setIsRunning(true);
    try {
        for await (const part of streamChat(contextInput, userId)) {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const newContent = part.content
                        ? (m.content[0] as any).text + part.content
                        : (m.content[0] as any).text;
                    const newMetadata = part.additional_kwargs?.usage_metadata
                        ? {
                            ...m.metadata,
                            custom: {
                                ...m.metadata?.custom,
                                ...part.additional_kwargs?.usage_metadata,
                            },
                        }
                        : m.metadata;

                    return {
                        ...m,
                        content: [{type: "text", text: newContent}],
                        metadata: newMetadata
                    };
                }),
            );
        }
    } catch (error) {
        const errorText = error instanceof Error ? error.message : "An unknown error occurred";
        setMessages((prev) =>
            prev.map((m) =>
                m.id === assistantId
                    ? {...m, status: {type: "incomplete", reason: "error", error: errorText}}
                    : m,
            ),
        );
    } finally {
        setIsRunning(false);
    }
}

const addPreviousText = (
    metadata: ThreadMessageLike["metadata"] | undefined,
    previousText: string,
) => {
    const custom = metadata?.custom ?? {};
    const edits =
        (custom.textChange as { previousText: string; editedAt: string }[]) ?? [];

    return {
        ...metadata,
        custom: {
            ...custom,
            textChange: [
                ...edits,
                {previousText, editedAt: new Date().toISOString()},
            ],
        },
    };
};

const addContext = (userInput: string, pastMessages: readonly ThreadMessageLike[]): string => {
    if (!pastMessages || pastMessages.length === 0) {
        return userInput;
    }

    const contextMessages = pastMessages.slice(-50); // Limit to last 50 messages for context
    let context = "This is the system prompt: You are a highly knowledgeable and helpful support assistant for " +
        "Waldur. Your primary goal is to provide clear, accurate, and friendly assistance to users. " +
        "Always respond in a professional and polite tone, breaking down complex instructions into simple, " +
        "easy-to-follow steps.\n";
    context += "This is the conversation history:\n";
    for (const message of contextMessages) {
        const contentText = (message.content[0] as any)?.text ?? "";
        context += `${message.role}: ${contentText}\n`;
    }

    context += `\nThis is the user prompt: ${userInput}\n`;
    return context;
}

const convertMessage = (message: ThreadMessageLike) => {
    return message;
};

const createUserMessage = (text: string): ThreadMessageLike => ({
    id: uuidv4(),
    role: "user",
    content: [{type: "text", text}],
    createdAt: new Date(),
    metadata: {},
    // Thread ID
});

const createAssistantPlaceholder = (): ThreadMessageLike => ({
    id: uuidv4(),
    role: "assistant",
    content: [{type: "text", text: ""}],
    createdAt: new Date(),
    metadata: {},
    // Thread ID
});


export function RuntimeProvider({children, userId}: Readonly<{ children: ReactNode; userId: string }>) {
    const [isRunning, setIsRunning] = useState(false);
    const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);

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
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
