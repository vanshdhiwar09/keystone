import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "../context/WalletContext";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dmsans",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Keystone Escrow Protocol",
  description: "Immutable Structural Web3 Execution Ledger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}>
      <body>
        <WalletProvider>
          {/* Architectural Blueprint Background Setup */}
          <div className="environment">
            <div className="blueprint-grid"></div>
            <div className="ambient-light"></div>
            <div className="tactile-noise"></div>
          </div>

          <div className="app-frame" id="main-app">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
