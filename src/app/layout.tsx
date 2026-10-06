import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roadmap Rumble",
  description: "Rank your backlog by making features fight.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
