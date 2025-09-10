"use client";

import type {ReactNode} from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
} from "@assistant-ui/react";

const MyModelAdapter: ChatModelAdapter = {
    async run({messages, abortSignal}) {
        // Find the last message in the array
        const lastMessage = messages[messages.length - 1];
        // @ts-ignore
        const userMessageText = lastMessage.content[0].text;

        // Create the request body and properly format messages for the backend
        const requestBody = {
            messages: [
                {"role": "system", "content": "Be concise."},
                { role: lastMessage.role, content: userMessageText },
            ],
        };

        const result = await fetch("http://127.0.0.1:8080/api/v1/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // Properly stringify the JSON body
            body: JSON.stringify(requestBody),
            // if the user hits the "cancel" button or escape keyboard key, cancel the request
            signal: abortSignal,
        });

        const data = await result.json();
        return {
            content: [
                {
                    type: "text",
                    text: data.content || "",
                },
            ],
        };
    },
};

export function MyRuntimeProvider({
                                      children,
                                  }: Readonly<{
    children: ReactNode;
}>) {
    const runtime = useLocalRuntime(MyModelAdapter);
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}