"use client";

import { FC, useState } from "react";
import { createPortal } from "react-dom";
import { useFeedback } from "./feedback-context";
import {ThreadMessage} from "@assistant-ui/react";

interface FeedbackPanelProps {
    threadMessages: readonly ThreadMessage[];
    user: string;
}

export const FeedbackPanel: FC<FeedbackPanelProps> = ({threadMessages, user}) => {
    const { isOpen, closePanel, sendFeedback, isSending } = useFeedback();
    const [message, setMessage] = useState("");
    const [rating, setRating] = useState<number | null>(null);

    const handleSubmit = async () => {
        if (rating === null) return alert("Please select a rating");
        await sendFeedback(message, rating, user, threadMessages as ThreadMessage[]);
        setMessage("");
        setRating(null);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-50">
            {/* Overlay with smooth backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all"
                onClick={closePanel}
            />

            {/* Modal with entrance animation */}
            <div className="relative bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Share your feedback
                    </h2>
                    <p className="text-sm text-gray-500">
                        Help us improve your experience
                    </p>
                </div>

                {/* Textarea */}
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think..."
                    className="w-full p-4 border-2 border-gray-200 rounded-xl mb-6 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none transition-all placeholder:text-gray-400"
                    rows={4}
                />

                {/* Rating Section */}
                <div className="mb-8">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Rate your experience
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                            <button
                                key={num}
                                onClick={() => setRating(num)}
                                className={`aspect-square rounded-xl font-semibold text-base transition-all duration-200 ${
                                    rating === num
                                        ? "bg-blue-500 text-white shadow-lg scale-110 ring-4 ring-blue-500/30"
                                        : "bg-gray-100 hover:bg-gray-200 text-gray-700 hover:scale-105"
                                }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Very poor</span>
                        <span>Excellent</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={closePanel}
                        className="flex-1 px-5 py-3 text-gray-700 font-medium border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSending || rating === null || message.trim() === ""}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold px-5 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                    >
                        {isSending ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Sending...
                            </span>
                        ) : (
                            "Send Feedback"
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};