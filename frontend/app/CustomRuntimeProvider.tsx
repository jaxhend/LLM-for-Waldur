"use client";

import type {ReactNode} from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter, ThreadUserMessagePart, ThreadMessage, ChatModelRunResult
} from "@assistant-ui/react";

type Mode = "stream" | "invoke";

function makeAdapter(mode: Mode): ChatModelAdapter {
    return {
        async* run({messages, abortSignal}) {
            // For parsing user messages objects
            const extractUserText = (content: ThreadUserMessagePart): string => {
                if (Array.isArray(content)) {
                    return content
                        .filter(c => c.type === "text" && c.text)
                        .map(c => c.text)
                        .join("\n");
                }
                return "";
            };

            // For parsing Chatbot's streaming response lines
            const processChatbotLine = (line: string): string | null => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                const payload = trimmed.slice(5).trim();
                if (!payload || payload === "[DONE]") return null;

                try {
                    const obj = JSON.parse(payload) as {
                        content?: string;
                        type?: string;
                        output?: { content?: string };
                        [k: string]: unknown;
                    };

                    // LangServe stream
                    if (obj.type === "AIMessageChunk" && obj.content) {
                        return obj.content;
                    }

                    // LangServe invoke
                    if (obj.output?.content) return obj.output.content

                    return null;
                } catch {
                    // Skip malformed JSON chunks silently
                    return null;
                }
            };


            const lastMessage: ThreadMessage = messages[messages.length - 1];
            const userMessageText: string = extractUserText(lastMessage.content as unknown as ThreadUserMessagePart);


            // Single string input for LangServe
            const prompt =
                `System: Be concise.\n` +
                `user: ${userMessageText}`


            const BASE_API_URL: string =
                process.env.NODE_ENV === "production"
                    ? "https://llm.testing.waldur.com"
                    : "http://127.0.0.1:8000";


            const THREAD_ID = 1;

            // --------------- invoke (complete message) -------------------
            if (mode === "invoke") {
                const response = await fetch(`${BASE_API_URL}/api/lc/chat/invoke`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        input: prompt,
                        config: {
                            configurable: {thread_id: THREAD_ID}
                        }
                    }),
                    signal: abortSignal,
                });

                if (!response.ok) {
                    const body = await response.text().catch(() => "");
                    throw new Error(`LangServe ${response.status}: ${body || "request failed"}`);
                }
                const json = (await response.json()) as {
                    output?: { content?: string };
                    content?: string;
                };
                const text =
                    json?.output?.content ??
                    json?.content ??
                    ""; // tolerancy of shapes


                const result: ChatModelRunResult = {
                    content: [{type: "text", text}],
                    metadata: {
                        custom: {
                            role: "assistant"
                        }
                    },
                };

                yield result;
                return;
            }

            // ----------------- Streaming (SSE) ------------------
            const response: Response = await fetch(`${BASE_API_URL}/api/lc/chat/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    input: prompt,
                    config: {
                        configurable: {thread_id: THREAD_ID}
                    }
                }),
                signal: abortSignal,
            });


            if (!response.ok) {
                const body = await response.text().catch(() => "");
                throw new Error(`LangServe ${response.status}: ${body || "request failed"}`)
            }

            if (!response.body) {
                throw new Error("No response body received");
            }


            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let text = "";

            try {
                while (true) {
                    const {done, value} = await reader.read();

                    if (done) {
                        break;
                    }

                    const chunk: string = decoder.decode(value, {stream: true});
                    for (const line of chunk.split("\n")) {
                        const piece = processChatbotLine(line);
                        if (piece) {
                            text += piece;
                            yield {
                                content: [{type: "text", text: text}],
                                metadata: {
                                    custom: {
                                        role: "assistant"
                                    }
                                }
                            } as ChatModelRunResult


                        }
                    }

                }
            } finally {
                reader.releaseLock();
            }


            yield {
                metadata: {
                    custom: {
                        role: "assistant",
                    }
                }
            } as ChatModelRunResult
        },
    };
}

export function CustomRuntimeProvider({
                                          children,
                                          mode = "stream", // default:streaming

                                      }: Readonly<{
    children: ReactNode;
    mode?: Mode; // "stream" | "invoke"
}>) {
    const runtime = useLocalRuntime(makeAdapter(mode));
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}