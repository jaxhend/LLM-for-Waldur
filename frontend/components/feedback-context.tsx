import {createContext, useContext, useState} from "react";
import {ThreadMessage} from "@assistant-ui/react";

type FeedbackContextType = {
    isOpen: boolean;
    isSending: boolean;
    openPanel: () => void;
    closePanel: () => void;
    sendFeedback: (
        message: string,
        rating: number,
        user: string,
        threadMessages: ThreadMessage[]
    ) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);


export const FeedbackProvider = ({children}: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const openPanel = () => setIsOpen(true);
    const closePanel = () => setIsOpen(false);

    const sendFeedback = async (
        message: string,
        rating: number,
        user: string,
        threadMessages: ThreadMessage[]
    ) => {
        setIsSending(true);
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

        console.log(JSON.stringify({user: user, rating: rating, message: message, thread: threadText}, null, 2));
        // Mock backend delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        alert("✅ Feedback sent successfully!");
        setIsSending(false);
        setIsOpen(false);
    };
    return (
        // Any component within FeedbackProvider can access the feedback context
        <FeedbackContext.Provider value={{isOpen, openPanel, closePanel, sendFeedback, isSending}}>
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