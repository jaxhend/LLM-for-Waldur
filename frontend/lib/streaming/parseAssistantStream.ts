import {ParseAssistantStreamParams} from "@/lib/types";
import {streamChat} from "./streamChat";

export async function parseAssistantStream({
                                               contextInput,
                                               userId,
                                               assistantId,
                                               setMessages,
                                               setIsRunning,
                                               signal,
                                           }: ParseAssistantStreamParams) {
    setIsRunning(true);
    try {
        for await (const part of streamChat(contextInput, userId, signal)) {
            if (signal?.aborted) {
                break;
            }

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
                        metadata: newMetadata,
                    };
                })
            );
        }
    } catch (error) {
        const errorText =
            error instanceof Error ? error.message : "An unknown error occurred";
        setMessages((prev) =>
            prev.map((m) =>
                m.id === assistantId
                    ? {
                        ...m,
                        status: {type: "incomplete", reason: "error", error: errorText},
                    }
                    : m
            )
        );
    } finally {
        setIsRunning(false);
    }
}