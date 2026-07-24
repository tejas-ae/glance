import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./capture.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glance — look, listen, explain",
  description:
    "A live meeting co-pilot that explains the screen in conversational context.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
