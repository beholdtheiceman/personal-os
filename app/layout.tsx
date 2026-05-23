import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Your personal AI-powered life dashboard",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Personal OS" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#c2cdd6" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ServiceWorkerRegistration />
          {children}
          {/* Global toast notification system */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#FFFFFF",
                color: "#2C1A20",
                border: "1px solid #E8D4DA",
                borderRadius: "10px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#4E9E77", secondary: "#FFFFFF" },
              },
              error: {
                iconTheme: { primary: "#C94848", secondary: "#FFFFFF" },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
