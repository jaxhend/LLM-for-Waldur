import {createContext, useContext, useState} from "react";
import {ThreadMessage} from "@assistant-ui/react";

type FeedbackContextType = {
    isOpen: boolean;
    isSending: boolean;
    activeMessageId?: number;
    openPanel: (messageId?: number) => void;
    closePanel: () => void;
    sendFeedback: (
        comment: string,
        rating: number,
        messageId?: number
    ) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);


export const FeedbackProvider = ({children}: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activeMessageId, setActiveMessageId] = useState<number | undefined>(undefined);

    const openPanel = (messageId?: number) => {
        setActiveMessageId(messageId);
        setIsOpen(true);
    };
    const closePanel = () => setIsOpen(false);


    const sendFeedback = async (
        comment: string,
        rating: number,
        messageId?: number
    ) => {
        const targetMessageId = messageId ?? activeMessageId;
        setIsSending(true);
        /*
        const threadText = threadMessages
            .map(msg => {
                const textParts = Array.isArray(msg.content)
                    ? msg.content
                        .filter(c => c.type === "text")
                        .map(c => c.text)
                        .join("\n")
                    : "";
                return `${msg.role}: ${textParts}`;
            })
            .join("\n");

         */
        const BASE_API_URL =
            process.env.NODE_ENV === "production"
                ? "https://llm.testing.waldur.com"
                : "http://127.0.0.1:8000";

        const res = await fetch(`${BASE_API_URL}/api/feedback/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message_id: targetMessageId,
                rating: rating,
                comment: comment,
                //thread: threadText,
            }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setIsSending(false)
            throw new Error(body.detail ?? "Failed to send feedback");
        }

        console.log(JSON.stringify({messageId: messageId, rating: rating, comment: comment}, null, 2));

        // Mock backend delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        alert("✅ Feedback sent successfully!");
        setIsSending(false);
        setIsOpen(false);
    };
    return (
        // Any component within FeedbackProvider can access the feedback context
        <FeedbackContext.Provider value={{isOpen, openPanel, closePanel, sendFeedback, isSending, activeMessageId}}>
            {children}
        </FeedbackContext.Provider>
    );
};

// A helper hook to access the feedback context
export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) throw new Error("useFeedback must be used within FeedbackProvider");
    return context;
};