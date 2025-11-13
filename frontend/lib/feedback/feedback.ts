import {FeedbackAdapter} from "@assistant-ui/react";
import {FeedbackAdapterFeedback} from "@/lib/types";

export const feedbackAdapter = (
    openPanelCallback: (feedback: FeedbackAdapterFeedback) => void,
): FeedbackAdapter => {
    return {
        submit: (feedback: FeedbackAdapterFeedback) => {
            openPanelCallback(feedback);
        },
    };
};