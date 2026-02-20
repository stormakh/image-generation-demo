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
  title: "Pixel Mint — Pay to Generate",
  description:
    "Transform a simple bank transfer into AI-generated art. Powered by Talo and Replicate.",
};

const TALO_SDK_URL = "https://github.com/stormakh/talo-sdk";
const DEMO_REPO_URL = "https://github.com/stormakh/image-generation-demo";
const EXAMPLES_BASE = `${TALO_SDK_URL}/tree/main/examples`;

const examples = [
  { label: "Elysia", href: `${EXAMPLES_BASE}/elysia` },
  { label: "Hono", href: `${EXAMPLES_BASE}/hono` },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-md">
          <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-6">
            <span className="text-sm font-medium text-white">Pixel Mint</span>
            <div className="flex items-center gap-6 text-sm text-zinc-400">
              {/* View Code */}
              <div className="group relative">
                <span className="cursor-default transition-colors group-hover:text-white">
                  View Code
                </span>
                <div className="absolute right-0 top-full hidden pt-2 group-hover:block">
                  <div className="flex min-w-[10rem] flex-col gap-0.5 rounded-xl border border-white/[0.08] bg-zinc-900 p-1.5 shadow-xl">
                    <a
                      href={DEMO_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      This Demo
                    </a>
                    <a
                      href={TALO_SDK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      Talo SDK
                    </a>
                  </div>
                </div>
              </div>

              {/* Examples */}
              <div className="group relative">
                <span className="cursor-default transition-colors group-hover:text-white">
                  Examples
                </span>
                <div className="absolute right-0 top-full hidden pt-2 group-hover:block">
                  <div className="flex min-w-[10rem] flex-col gap-0.5 rounded-xl border border-white/[0.08] bg-zinc-900 p-1.5 shadow-xl">
                    {examples.map(({ label, href }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="pt-12">{children}</div>
      </body>
    </html>
  );
}
