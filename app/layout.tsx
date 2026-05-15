import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FeedbackModalProvider } from "@/contexts/FeedbackModalContext";
import Providers from "@/src/shared/components/Providers";
import RootClient from "./RootClient";

export const metadata: Metadata = {
  title: "GutTrack",
  description: "Your personal gut health AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GutTrack",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GutTrack" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
      </head>
      <body>
        <Providers>
          <FeedbackModalProvider>
            <RootClient>{children}</RootClient>
          </FeedbackModalProvider>
        </Providers>
      </body>
    </html>
  );
}
