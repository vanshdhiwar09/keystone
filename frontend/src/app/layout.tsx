import type { Metadata } from "next";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keystone Escrow Platform",
  description: "Immutable Structural Web3 Execution Ledger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-body">
      <body className="min-h-full flex flex-col bg-steel text-iron">
        {children}
      </body>
    </html>
  );
}
