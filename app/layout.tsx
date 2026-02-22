import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LevelUp Life — Gamify Your Existence",
  description: "Track your daily habits across Body, Wealth, Skill, Discipline, and Presence. Level up your life with data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0D0D1A] text-[#E8E8F0] min-h-screen">
        {children}
      </body>
    </html>
  );
}
