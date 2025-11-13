import {ThreadMessage, ThreadMessageLike} from "@assistant-ui/react";


export interface StreamChatChunk {
    content?: string;
    additional_kwargs?: {
        usage_metadata?: object;
    };
}

export interface ParseAssistantStreamParams {
    contextInput: string;
    userId: string;
    assistantId: string;
    setMessages: React.Dispatch<React.SetStateAction<readonly ThreadMessageLike[]>>;
    signal?: AbortSignal;
}

export type RunConfig = {
    readonly custom?: Record<string, unknown>;
};

export type StartRunConfig = {
    parentId: string | null;
    sourceId: string | null;
    runConfig: RunConfig;
};

export type FeedbackAdapterFeedback = {
    message: ThreadMessage;
    type: "positive" | "negative";
};