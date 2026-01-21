import type { Metadata } from "next";
import { AuthProvider } from "@/lib/supabase/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatlamix - AI Influencer Platform",
  description: "Create, customize, and interact with virtual AI characters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-surface-dark text-foreground min-h-screen">
        <div className="fixed inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-primary-800/10 pointer-events-none" />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
