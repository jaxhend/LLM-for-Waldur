import {FC} from "react";
import {useFeedback} from "@/components/feedback-context";
import {TooltipIconButton} from "@/components/tooltip-icon-button";
import {MessageSquare} from "lucide-react";

export const FeedbackButton: FC = () => {
    const {openPanel} = useFeedback();

    return (
        <TooltipIconButton
            tooltip="Send feedback"
            onClick={openPanel}
        >
            <MessageSquare/>
        </TooltipIconButton>
    );
};