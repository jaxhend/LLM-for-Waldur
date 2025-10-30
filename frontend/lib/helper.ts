import {ThreadMessageLike} from "@assistant-ui/react";
import {v4 as uuidv4} from "uuid";



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

export {
    streamChat,
    saveAssistantStream,
    addPreviousText,
    addContext,
    convertMessage,
    createUserMessage,
    createAssistantPlaceholder,
};

