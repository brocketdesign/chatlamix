import type { Metadata } from "next";
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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
