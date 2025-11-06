import {
    ActionBarPrimitive,
    useAssistantState
} from "@assistant-ui/react";
import {TooltipIconButton} from "@/components/tooltip-icon-button";
import {EditIcon, PencilIcon} from "lucide-react";

interface LastUserMessageActionsProps {
    messageId: string;
}

export const LastUserMessageActions: React.FC<LastUserMessageActionsProps> = ({ messageId }) => {

    // Kasutame useAssistantState, et saada ligipääs kogu sõnumite massiivi
    // Oletus: Sõnumite massiiv asub thread-oleku all (state.thread.messages)
    const isLastUserMessage = useAssistantState(state => {
        // KONTROLL: Veendu, et su andmestruktuur on õige (thread.messages või messages)
        const allMessages = state.thread.messages;

        // Kui sõnumeid pole, tagasta false
        if (!allMessages || allMessages.length === 0) {
            return false;
        }

        // Leia viimane sõnum massiivist, mille roll on "user"
        const lastUserMessage = allMessages.findLast((m) => m.role === "user");

        // Kontrolli, kas praegune sõnum ühtib viimase kasutajasõnumiga
        return lastUserMessage?.id === messageId;
    });

    if (!isLastUserMessage) {
        return null; // Peidab tegevusriba, kui see pole viimane kasutaja sõnum
    }

    // Kui see on viimane kasutaja sõnum, kuvame nupu
    return (
        <ActionBarPrimitive.Edit asChild>
            <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
                <PencilIcon />
            </TooltipIconButton>
        </ActionBarPrimitive.Edit>
    );
};