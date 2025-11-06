import {
    ActionBarPrimitive,
    useAssistantState
} from "@assistant-ui/react";
import {TooltipIconButton} from "@/components/tooltip-icon-button";
import {PencilIcon} from "lucide-react";

interface LastUserMessageActionsProps {
    messageId: string;
}

export const LastUserMessageActions: React.FC<LastUserMessageActionsProps> = ({messageId}) => {
    const isLastUserMessage = useAssistantState(state => {
        const allMessages = state.thread.messages;
        if (!allMessages || allMessages.length === 0) {
            return false;
        }

        const lastUserMessage = allMessages.findLast((m) => m.role === "user");
        return lastUserMessage?.id === messageId;
    });

    if (!isLastUserMessage) {
        return null;
    }

    return (
        <ActionBarPrimitive.Edit asChild>
            <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
                <PencilIcon/>
            </TooltipIconButton>
        </ActionBarPrimitive.Edit>
    );
};