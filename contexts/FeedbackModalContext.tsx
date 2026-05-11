"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type FeedbackModalContextType = {
  isOpen: boolean;
  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;
};

const FeedbackModalContext = createContext<FeedbackModalContextType>({
  isOpen: false,
  openFeedbackModal: () => {},
  closeFeedbackModal: () => {},
});

export function FeedbackModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openFeedbackModal = useCallback(() => setIsOpen(true), []);
  const closeFeedbackModal = useCallback(() => setIsOpen(false), []);

  return (
    <FeedbackModalContext.Provider value={{ isOpen, openFeedbackModal, closeFeedbackModal }}>
      {children}
    </FeedbackModalContext.Provider>
  );
}

export function useFeedbackModal() {
  return useContext(FeedbackModalContext);
}
