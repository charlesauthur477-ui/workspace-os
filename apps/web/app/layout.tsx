import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Workspace OS",
  description: "Your personal operating system for every tool, RDP, and server you use.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
