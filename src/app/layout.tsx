import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exam Proctoring Control Center",
  description: "MVP dashboard for automated exam proctoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <div className="flex min-h-screen flex-col bg-white">
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <span className="text-lg font-semibold">Exam Proctoring MVP</span>
              <span className="text-sm text-zinc-500">Primary navigation coming soon</span>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
