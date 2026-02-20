"use client";

import { GENERATION_PRICE } from "@/lib/store";
import { useState, useEffect, useRef, useCallback } from "react";

type Status =
  | "pending_payment"
  | "payment_confirmed"
  | "generating_image"
  | "completed"
  | "expired"
  | "failed";

interface OrderData {
  orderId: string;
  cvu: string;
  alias: string;
  paymentUrl: string;
  expiresAt: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [status, setStatus] = useState<Status>("pending_payment");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!order?.expiresAt) return;
    if (status !== "pending_payment") return;

    const tick = () => {
      const now = Date.now();
      const expires = new Date(order.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order?.expiresAt, status]);

  // SSE connection
  useEffect(() => {
    if (!order?.orderId) return;

    const es = new EventSource(`/api/orders/${order.orderId}/events`);
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status);
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [order?.orderId]);

  // Fallback polling: silently verify every 30s while waiting for payment
  useEffect(() => {
    if (!order?.orderId || status !== "pending_payment") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.orderId}/verify`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== "pending_payment") {
            setStatus(data.status);
            if (data.imageUrl) setImageUrl(data.imageUrl);
          }
        }
      } catch {
        // Silent — SSE is the primary channel
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [order?.orderId, status]);

  const handleCreate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const data: OrderData = await res.json();
      setOrder(data);
      setStatus("pending_payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsCreating(false);
    }
  }, [prompt]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!order?.orderId || isVerifying) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/orders/${order.orderId}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== status) {
          setStatus(data.status);
          if (data.imageUrl) {
            setImageUrl(data.imageUrl);
          }
        }
      }
    } catch {
      // Silent — SSE is the primary channel
    } finally {
      setIsVerifying(false);
    }
  }, [order?.orderId, isVerifying, status]);

  const handleReset = useCallback(() => {
    eventSourceRef.current?.close();
    setPrompt("");
    setOrder(null);
    setStatus("pending_payment");
    setImageUrl(null);
    setError(null);
    setTimeLeft("");
  }, []);

  const isTerminal =
    status === "completed" || status === "expired" || status === "failed";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 40%, rgba(167,139,250,0.06) 0%, rgba(236,72,153,0.03) 40%, transparent 70%)",
        }}
      />

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <header className="mb-12 text-center animate-fade-in-up">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs tracking-wide text-zinc-500">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, #a78bfa, #ec4899)",
              }}
            />
            Powered by{" "}
            <a
              href="https://github.com/stormakh/talo-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-zinc-300"
            >
              Talo SDK
            </a>{" "}
            + Replicate
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Pixel Mint
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Describe an image. Transfer to create it.
          </p>
        </header>

        {/* Step 1: Prompt Input */}
        {!order && (
          <div className="animate-fade-in-up delay-100">
            <div className="gradient-border rounded-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A surreal landscape with floating crystals above a misty lake at dawn..."
                rows={4}
                className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-[15px] leading-relaxed text-white placeholder-zinc-600 outline-none transition-colors focus:border-transparent focus:bg-white/[0.03]"
                disabled={isCreating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) handleCreate();
                }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                Cost:{" "}
                <span className="font-medium text-zinc-400">${GENERATION_PRICE} ARS</span>
              </span>

              <button
                onClick={handleCreate}
                disabled={!prompt.trim() || isCreating}
                className="relative overflow-hidden rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.97]"
                style={{
                  background:
                    "linear-gradient(135deg, #a78bfa, #ec4899, #f97316)",
                  backgroundSize: "200% 200%",
                }}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.25"
                      />
                      <path
                        d="M12 2a10 10 0 0 1 10 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Generate"
                )}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-rose-400 animate-fade-in">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Payment Details */}
        {order && status === "pending_payment" && (
          <div className="animate-fade-in-up space-y-5">
            {/* Timer */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-600">
                Expires in
              </p>
              <p className="mt-1 font-mono text-2xl font-light tracking-wider text-white tabular-nums">
                {timeLeft}
              </p>
            </div>

            {/* Payment card */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
              <p className="mb-4 text-sm text-zinc-400">
                Transfer{" "}
                <span className="font-semibold text-white">${GENERATION_PRICE} ARS</span>{" "}
                to the following account. Once confirmed, your image will be
                generated automatically.
              </p>

              {/* CVU */}
              <div className="mb-3">
                <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-zinc-600">
                  Amount
                </label>
                <button
                  onClick={() => handleCopy(GENERATION_PRICE.toString(), "amount")}
                  className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-sm tracking-wider text-zinc-300">
                    {GENERATION_PRICE} ARS
                  </span>
                  <span className="text-xs text-zinc-600 transition-colors group-hover:text-zinc-400">
                    {copied === "amount" ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>

              {/* Alias */}
              <div className="mb-5">
                <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-zinc-600">
                  Alias
                </label>
                <button
                  onClick={() => handleCopy(order.alias, "alias")}
                  className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-sm tracking-wider text-zinc-300">
                    {order.alias}
                  </span>
                  <span className="text-xs text-zinc-600 transition-colors group-hover:text-zinc-400">
                    {copied === "alias" ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>

              {/* Payment link */}
              {order.paymentUrl && (
                <a
                  href={order.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-3 text-sm text-zinc-400 transition-colors hover:border-white/[0.12] hover:text-white"
                >
                  Open payment page
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-3 text-sm text-zinc-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
              </span>
              Listening for payment confirmation...
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex items-center gap-2 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <svg
                      className="h-3 w-3 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.25"
                      />
                      <path
                        d="M12 2a10 10 0 0 1 10 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Checking...
                  </>
                ) : (
                  "Already transferred? Check status"
                )}
              </button>

              <button
                onClick={handleReset}
                className="text-xs text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3a: Payment Confirmed */}
        {order && status === "payment_confirmed" && (
          <div className="animate-fade-in-up text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <svg
                className="h-6 w-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-white">Payment received</p>
            <p className="mt-1 text-sm text-zinc-500">
              Starting image generation...
            </p>
          </div>
        )}

        {/* Step 3b: Generating Image */}
        {order && status === "generating_image" && (
          <div className="animate-fade-in flex flex-col items-center py-8">
            {/* Morphing orb */}
            <div className="relative mb-8 h-32 w-32">
              <div
                className="absolute inset-0 animate-morph opacity-60 blur-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #a78bfa, #ec4899, #f97316)",
                }}
              />
              <div
                className="absolute inset-4 animate-morph opacity-80 blur-md"
                style={{
                  background:
                    "linear-gradient(225deg, #f97316, #ec4899, #a78bfa)",
                  animationDelay: "-2s",
                }}
              />
              <div
                className="absolute inset-8 animate-morph"
                style={{
                  background:
                    "linear-gradient(180deg, #a78bfa, #ec4899)",
                  animationDelay: "-4s",
                }}
              />
            </div>
            <p className="text-lg font-medium text-white">
              Generating your image
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              This usually takes 10-30 seconds...
            </p>
          </div>
        )}

        {/* Step 4: Completed */}
        {order && status === "completed" && imageUrl && (
          <div className="animate-fade-in-up space-y-6">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={prompt}
                className="w-full animate-fade-in"
              />
            </div>
            <p className="text-center text-sm text-zinc-500 italic">
              &ldquo;{prompt}&rdquo;
            </p>
            <button
              onClick={handleReset}
              className="mx-auto flex items-center gap-2 rounded-full border border-white/[0.08] px-5 py-2.5 text-sm text-zinc-400 transition-colors hover:border-white/[0.15] hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Generate another
            </button>
          </div>
        )}

        {/* Expired state */}
        {order && status === "expired" && (
          <div className="animate-fade-in-up text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <svg
                className="h-6 w-6 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-white">Payment expired</p>
            <p className="mt-1 text-sm text-zinc-500">
              The transfer window has closed.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 rounded-full border border-white/[0.08] px-5 py-2.5 text-sm text-zinc-400 transition-colors hover:border-white/[0.15] hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Failed state */}
        {order && status === "failed" && (
          <div className="animate-fade-in-up text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
              <svg
                className="h-6 w-6 text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-white">
              Something went wrong
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Image generation failed. Your payment has been recorded.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 rounded-full border border-white/[0.08] px-5 py-2.5 text-sm text-zinc-400 transition-colors hover:border-white/[0.15] hover:text-white"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
