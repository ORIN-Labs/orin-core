import type { Metadata } from "next";
import "./globals.css";
import SolanaWalletProvider from "@/providers/SolanaWalletProvider";

export const metadata: Metadata = {
  title: "ORIN · Your AI Concierge",
  description: "ORIN Core: Your personal AI assistant for travel, hospitality, and smart environments. Powered by Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
