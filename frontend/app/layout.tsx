import "./globals.css";
import type {Metadata} from "next";
import type {ReactNode} from "react";
import {Geist, Geist_Mono} from "next/font/google";
import {ThreadProvider} from "@/app/ThreadProvider";
import {ThreadRuntimeProvider} from "@/app/ThreadRuntimeProvider";
import {FeedbackProvider} from "@/app/feedback-context";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "LLM for Waldur",
    description: "LLM for Waldur",
};

export default function RootLayout({
               children,
           }: Readonly<{
    children: ReactNode;
}>) {
    const userId = "kasutaja";

    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body>
        <FeedbackProvider>
            <ThreadProvider>
                <ThreadRuntimeProvider userId={userId}>
                    {children}
                </ThreadRuntimeProvider>
            </ThreadProvider>
        </FeedbackProvider>
        </body>
        </html>
    );
}
