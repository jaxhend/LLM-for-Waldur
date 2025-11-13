import {FC} from "react";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react";
import { ArchiveIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import {useThreadContext} from "@/app/ThreadProvider";

export const ThreadList: FC = () => {
    const {threads, currentThreadId} = useThreadContext();

    // Starting condition: if there is exactly one thread and it is empty, treat as uninitialized
    if (threads.size === 1 && threads.get(currentThreadId)?.length === 0) {
        return (
            <ThreadListPrimitive.Root
                className="aui-root aui-thread-list-root flex flex-col items-stretch gap-1.5 overflow-y-hidden">
                <ThreadListNew/>
            </ThreadListPrimitive.Root>
        );
    }

    return (
        <ThreadListPrimitive.Root
            className="aui-root aui-thread-list-root flex flex-col items-stretch gap-1.5 overflow-y-hidden">
            <ThreadListNew/>
            <ThreadListItems/>
        </ThreadListPrimitive.Root>
    );
};

const ThreadListNew: FC = () => {
    const {currentThreadId, threads} = useThreadContext();
    if (!threads) return null; // Don't render anything until the data structure is available.

    const currentThreadMessages = threads?.get(currentThreadId) ?? [];
    const threadHasMessages = currentThreadMessages.length > 0;

    return (
    <ThreadListPrimitive.New asChild>
      <Button
        className="aui-thread-list-new flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted data-active:bg-muted"
        variant="ghost"
        disabled={!threadHasMessages}
      >
        <PlusIcon />
        New Thread
      </Button>
    </ThreadListPrimitive.New>
  );
};

const ThreadListItems: FC = () => {
    return (
        <div className="overflow-y-auto">
            <ThreadListPrimitive.Items components={{ ThreadListItem }} />
        </div>
    );
};

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="aui-thread-list-item flex items-center gap-2 rounded-lg transition-all hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger className="aui-thread-list-item-trigger flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemArchive />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemTitle: FC = () => {
  return (
    <span className="aui-thread-list-item-title text-sm">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </span>
  );
};

const ThreadListItemArchive: FC = () => {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="aui-thread-list-item-archive mr-3 ml-auto size-4 p-0 text-foreground hover:text-primary"
        variant="ghost"
        tooltip="Archive thread"
      >
        <ArchiveIcon />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  );
};
