import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Assessment Portal",
  description: "Passwordless email authentication with role-based access control"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
