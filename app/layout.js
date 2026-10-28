import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./components/PostHogProvider";
import GlobalWidgets from "./components/GlobalWidgets";
import ErrorBoundary from "./components/ErrorBoundary";
import { SITES, shareCardFor } from "@/lib/siteMetadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ---------------------------------------------------------------------------
// THE DEFAULT CARD, AND WHO GETS IT
//
// Hire Power's, statically, for everything that does not answer for itself.
// Almost all of that is behind a login - the dashboard, the builder, the
// coaches - and a signed-in page is not a link anybody posts, so there is
// nothing to be gained by making the whole app read a header to find out
// which domain it is on.
//
// The pages that ARE posted do answer for themselves: /landing, /privacy,
// /terms and /brb-landing each read the request's Host and return the card for
// that domain. See lib/siteMetadata for why that is a per-page decision and
// what it costs.
//
// The Career Profile pages under /p/[slug] inherit this and are meant to: they
// had no image at all before, and a shared profile link previewed as a line of
// text. Nothing here is specific to a person, which is the right default for a
// page about one until there is a card made for them.
// ---------------------------------------------------------------------------
export const metadata = {
  title: SITES.hirePower.title,
  description: SITES.hirePower.description,
  ...shareCardFor(SITES.hirePower)
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light only" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
       <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Caveat:wght@400;700&family=DM+Mono:wght@400;500;700&family=Fraunces:ital,wght@0,300;0,400;0,700;0,900;1,300;1,700&family=DM+Sans:wght@300;400;500;600;700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Source+Serif+4:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>
          <PostHogProvider>
            {children}
            <GlobalWidgets />
          </PostHogProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}