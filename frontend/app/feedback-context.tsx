"use client";

import {createContext, useContext, useState, ReactNode} from "react";
import {ThreadMessage} from "@assistant-ui/react";
import {FeedbackAdapterFeedback} from "@/lib/types";

type FeedbackContextType = {
    isOpen: boolean;
    isSending: boolean;
    messageToRate: ThreadMessage | null;
    openPanel: (feedback: FeedbackAdapterFeedback) => void;
    closePanel: () => void;
    sendFeedback: (...args: any) => Promise<void>;
};

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider = ({children}: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [messageToRate, setMessageToRate] = useState<ThreadMessage | null>(null);

    const openPanel = (feedback: FeedbackAdapterFeedback) => {
        setMessageToRate(feedback.message);
        setIsOpen(true);
    };

    const closePanel = () => {
        setIsOpen(false);
        setMessageToRate(null);
    };

    const sendFeedback = async (feedbackMessage: string, rating: number) => {
        setIsSending(true);
        console.log("Submitting final feedback:", {
            feedbackMessage,
            rating,
            ratedMessageId: messageToRate?.id,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        setIsSending(false);
        closePanel();
    };

    const value = {
        isOpen,
        isSending,
        messageToRate,
        openPanel,
        closePanel,
        sendFeedback,
    };

    return (
        <FeedbackContext.Provider value={value}>
            {children}
        </FeedbackContext.Provider>
    );
};

export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error("useFeedback must be used within a FeedbackProvider");
    }
    return context;
};