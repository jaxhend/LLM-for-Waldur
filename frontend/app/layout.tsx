import "./globals.css";
import type {Metadata} from "next";
import type {ReactNode} from "react";
import {Geist, Geist_Mono} from "next/font/google";
import {RuntimeProvider} from "./RuntimeProvider";

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
        <RuntimeProvider userId={userId}>
            {children}
        </RuntimeProvider>
        </body>
        </html>
    );
}
