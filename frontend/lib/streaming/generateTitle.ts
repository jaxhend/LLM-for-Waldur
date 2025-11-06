import { MessageHandlerDependencies } from "@/lib/messages/messageHandlers";
import {streamChat} from "@/lib/streaming/streamChat";

export const generateAndSetThreadTitle = async (
    input: string,
    deps: Pick<MessageHandlerDependencies, "userId" | "currentThreadId" | "setThreadList">
): Promise<void> => {
    // We use a separate AbortController specifically for the title generation stream.
    const titleAbortController = new AbortController();

    try {
        const titlePrompt =
            "Generate a concise title of max 30 characters for the user's first message summary, and output ONLY the title. User Message:" + input;

        const streamInput = streamChat(
            titlePrompt,
            deps.userId,
            titleAbortController.signal
        );

        let newTitle = "";
        // 2. Stream the title content
        for await (const part of streamInput) {
            if (part.content) {
                newTitle += part.content;
            }
        }

        // 3. Clean and set the title
        if (newTitle) {
            // Trim whitespace, remove quotes, and strictly enforce the 30-character limit.
            const finalTitle = newTitle
                .trim()
                .replace(/^['"]|['"]$/g, '') // Remove starting/ending quotes if present
                .substring(0, 30); // Force max 30 characters

            deps.setThreadList((prev) =>
                prev.map((thread) =>
                    thread.id === deps.currentThreadId
                        ? { ...thread, title: finalTitle } // Update the title immutably
                        : thread
                )
            );
        }
    } catch (titleError) {
        // Log title error but don't disrupt the main application flow
        console.error("Failed to generate and set thread title:", titleError);
    }
};