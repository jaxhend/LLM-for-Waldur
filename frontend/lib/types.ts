import {ThreadMessageLike} from "@assistant-ui/react";

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
    setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
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
