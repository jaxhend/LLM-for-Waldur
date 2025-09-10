"use client";

import { ThreadList } from "@/components/thread-list";
import { Thread } from '@/components/thread'

export default function Page() {
    return (
        <div className="grid h-dvh grid-cols-[200px_1fr] gap-x-2 px-4 py-4">
            <ThreadList />
            <Thread />
        </div>
    );
}