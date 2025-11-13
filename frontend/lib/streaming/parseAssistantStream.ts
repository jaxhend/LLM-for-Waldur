import {ParseAssistantStreamParams} from "@/lib/types";
import {streamChat} from "./streamChat";
import {extractTextFromMessageContent} from "@/lib/messages/messageUtils";

export async function parseAssistantStream({
                                               contextInput,
                                               userId,
                                               assistantId,
                                               setMessages,
                                               signal,
                                           }: ParseAssistantStreamParams) {
    try {
        for await (const part of streamChat(contextInput, userId, signal)) {
            if (signal?.aborted) {
                break;
            }

            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const existingText = extractTextFromMessageContent(m.content)
                    const newContent = part.content
                        ? existingText + part.content
                        : existingText;
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
                        metadata: newMetadata,
                        status: {type: "running"} // For cancellation handling
                    };
                })
            );
        }
    } catch (error: unknown) {
        const aborted = signal?.aborted;
        const errorMessage =
            aborted
                ? "Assistant message was cancelled"
                : error instanceof Error ? error.message
                    : "An unknown error occurred";

        const reason: "cancelled" | "error" = aborted ? "cancelled" : "error";

        setMessages((prev) =>
            prev.map((m) =>
                m.id === assistantId
                    ? {
                        ...m,
                        status: {
                            type: "incomplete",
                            reason,
                            error: errorMessage,
                        },
                    }
                    : m
            )
        );
    } finally {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== assistantId) return m;

                // Don’t overwrite incomplete status
                if (m.status?.type === "incomplete") return m;

                return {
                    ...m,
                    status: { type: "complete", reason: "stop" },
                };
            })
        );
    }
}