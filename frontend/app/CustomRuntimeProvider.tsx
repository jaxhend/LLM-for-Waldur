"use client";

import type {ReactNode} from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter, ThreadUserMessagePart, ThreadMessage
} from "@assistant-ui/react";


const CustomModelAdapter: ChatModelAdapter = {
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

        /*
        For extracting content from streaming data chunks or non-streaming responses.
        Example data formats:
        Streaming          data: {"id": "12345", "model": "llama3.2:1b", "delta": " Go", "done": false}
        Non-streaming      {"model":"llama3.2:1b","content":"Hello!","finish_reason":"stop","usage":null}
        */
        interface ChatbotChunk {
            delta?: string;
            content?: string;

            [k: string]: unknown;
        }

        const extractChatbotText = (data: ChatbotChunk): string => {
            return data.delta || data.content || '';
        };

        // For parsing Chatbot's streaming response lines
        const processChatbotLine = (line: string): string | null => {
            if (line.trim() === '') return null;

            try {
                let jsonStr: string = line;

                if (line.startsWith('data: ')) {
                    // Remove 'data: ' prefix
                    jsonStr = jsonStr.slice(6);

                    if (jsonStr === '[DONE]') {
                        return null;
                    }
                }
                const data: unknown = JSON.parse(jsonStr);
                if (typeof data === 'object' && data !== null) {
                    const content: string = extractChatbotText(data as ChatbotChunk);
                    return content || null;
                }
                return null;
            } catch {
                // Skip malformed JSON chunks silently
                return null;
            }
        };

        // For LLM context, use all but the last message
        const conversationHistory: string = messages
            .slice(0, -1)
            .map(msg => {
                const text = extractUserText(msg.content as unknown as ThreadUserMessagePart);
                return text ? `${msg.role}: ${text}` : "";
            })
            .filter(Boolean)
            .join("\n");


        const lastMessage: ThreadMessage = messages[messages.length - 1];
        const userMessageText: string = extractUserText(lastMessage.content as unknown as ThreadUserMessagePart);

        const modelName: string =
            process.env.NODE_ENV === "production"
                ? "gemma3:27b"
                : "llama3.2:1b";

        const requestBody = {
            messages: [
                {role: "system", content: "Be concise."},
                ...(conversationHistory ? [{role: "assistant", content: conversationHistory}] : []),
                {role: "user", content: userMessageText},
            ].filter(msg => msg.content.trim()),
            stream: true,
            model: modelName
        };

        const API_URL: string =
            process.env.NODE_ENV === "production"
                ? "/api/v1/chat"
                : "http://127.0.0.1:8000/api/v1/chat";

        const response: Response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: abortSignal,
        });

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
                const lines: string[] = chunk.split('\n');

                for (const line of lines) {
                    const content: string | null = processChatbotLine(line);

                    if (content) {
                        text += content;
                        // Yield incremental content as it's received
                        yield {
                            content: [{type: "text", text}],
                        };
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    },
};

export function CustomRuntimeProvider({
                                          children,
                                      }: Readonly<{
    children: ReactNode;
}>) {
    const runtime = useLocalRuntime(CustomModelAdapter);
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}