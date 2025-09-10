"use client";

import type {ReactNode} from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
} from "@assistant-ui/react";


const CustomModelAdapter: ChatModelAdapter = {
    async* run({messages, abortSignal}) {
        // For parsing user messages objects
        const extractUserText = (content: any): string => {
            if (Array.isArray(content)) {
                return content
                    .filter(c => c.type === "text" && c.text)
                    .map(c => c.text)
                    .join("\n");
            }
            return typeof content === "string" ? content : "";
        };

         /*
         For extracting content from streaming data chunks or non-streaming responses.
         Example data formats:
         Streaming          data: {"id": "12345", "model": "llama3.2:1b", "delta": " Go", "done": false}
         Non-streaming      {"model":"llama3.2:1b","content":"Hello!","finish_reason":"stop","usage":null}
         */
        const extractChatbotText = (data: { delta?: string; content?: string }): string => {
            return data.delta || data.content || '';
        };

        // For parsing Chatbot's streaming response lines
        const processChatbotLine = (line: string): string | null => {
            if (line.trim() === '') return null;

            try {
                let data: any;
                let jsonStr: string = line;

                if (line.startsWith('data: ')) {
                    // Remove 'data: ' prefix
                    jsonStr = jsonStr.slice(6);

                    if (jsonStr === '[DONE]') {
                        return null;
                    }
                }
                data = JSON.parse(jsonStr);
                const content = extractChatbotText(data);
                return content || null;
            } catch (parseError) {
                // Skip malformed JSON chunks silently
                return null;
            }
        };

        // For LLM context, use all but the last message
        const conversationHistory = messages
            .slice(0, -1)
            .map(msg => {
                const text = extractUserText(msg.content);
                return text ? `${msg.role}: ${text}` : "";
            })
            .filter(Boolean)
            .join("\n");


        const lastMessage = messages[messages.length - 1];
        const userMessageText = extractUserText(lastMessage.content);

        const requestBody = {
            messages: [
                {role: "system", content: "Be concise."},
                ...(conversationHistory ? [{role: "assistant", content: conversationHistory}] : []),
                {role: "user", content: userMessageText},
            ].filter(msg => msg.content.trim()),
            stream: true,
        };

        const response = await fetch("http://127.0.0.1:8080/api/v1/chat", {
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

                const chunk = decoder.decode(value, {stream: true});
                const lines = chunk.split('\n');

                for (const line of lines) {
                    const content = processChatbotLine(line);

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