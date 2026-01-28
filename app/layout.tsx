import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { AdminFloatingButton } from "@/components/admin/AdminFloatingButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artsogen - AI Influencer Platform",
  description: "Create, customize, and interact with virtual AI characters",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Artsogen",
  },
  applicationName: "Artsogen",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-surface-dark text-foreground min-h-screen">
        <div className="fixed inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-primary-800/10 pointer-events-none" />
        <AuthProvider>
          {children}
          <AdminFloatingButton />
        </AuthProvider>
      </body>
    </html>
  );
}
