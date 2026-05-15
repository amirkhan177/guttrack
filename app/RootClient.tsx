"use client";

import { useEffect } from "react";
import { useFeedbackModal } from "@/contexts/FeedbackModalContext";
import FeedbackModal from "@/src/shared/components/FeedbackModal";

export default function RootClient({ children }: { children: React.ReactNode }) {
  const { openFeedbackModal, isOpen, closeFeedbackModal } = useFeedbackModal();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_FEEDBACK_MODAL") {
        openFeedbackModal();
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [openFeedbackModal]);

  return (
    <>
      <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
        <div style={{ maxWidth: "430px", minHeight: "100vh", margin: "0 auto" }}>
          {children}
        </div>
      </div>
      <FeedbackModal isOpen={isOpen} onClose={closeFeedbackModal} />
    </>
  );
}
