import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Brother",
  description:
    "Coordination for teams of Claude Code agents: stops duplicate work, repeated failures and conflicting changes.",
};

// Applied before paint so a saved theme never flashes the wrong one.
const themeBoot = `try{var t=localStorage.getItem("lb-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap"
          />
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, must run before paint */}
          <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        </head>
        <body>{children}</body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
