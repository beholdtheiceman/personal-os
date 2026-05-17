import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal OS",
  description: "Your personal AI-powered life dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          {/* Global toast notification system */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#21262d",
                color: "#e6edf3",
                border: "1px solid #30363d",
                borderRadius: "10px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#3fb950", secondary: "#0d1117" },
              },
              error: {
                iconTheme: { primary: "#f85149", secondary: "#0d1117" },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
