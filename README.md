# Pixel Mint — Image Generation Demo

A demo app that lets users pay with a bank transfer (via [Talo SDK](https://github.com/stormakh/talo-sdk)) to generate an AI image (via [Replicate](https://replicate.com)). Once the payment is confirmed, the app automatically generates the image and streams the result back to the user in real time.

Built with Next.js 15 and Tailwind CSS.

---

## How it works

```
User enters prompt
      ↓
POST /api/orders  →  talo.payments.create()  →  returns CVU + alias
      ↓
User transfers $100 ARS to the CVU
      ↓
Talo sends webhook to POST /api/webhooks/talo
      ↓
talo.webhooks.handler() verifies + parses the event
      ↓
payment_status === "SUCCESS"  →  generateImage()  →  Replicate (flux-schnell)
      ↓
SSE stream (GET /api/orders/[id]/events) pushes status updates to the browser
      ↓
Image displayed to user
```

---

## Talo SDK integration

### 1. Initialize the client (`lib/talo.ts`)

```ts
import { TaloClient } from "talo-pay";

const talo = new TaloClient({
  clientId: process.env.TALO_CLIENT_ID!,
  clientSecret: process.env.TALO_CLIENT_SECRET!,
  userId: process.env.TALO_USER_ID!,
  environment: "production",
});
```

### 2. Create a payment order (`app/api/orders/route.ts`)

```ts
const payment = await talo.payments.create({
  user_id: process.env.TALO_USER_ID!,
  price: { amount: 100, currency: "ARS" },
  payment_options: ["transfer"],
  external_id: `img_${orderId}`,
  webhook_url: `${baseUrl}/api/webhooks/talo`,
  motive: `Image generation: ${prompt}`,
});
// payment.quotes[0].cvu and .alias are shown to the user to complete the transfer
```

### 3. Handle the webhook (`app/api/webhooks/talo/route.ts`)

```ts
const handler = talo.webhooks.handler({
  onPaymentUpdated: async ({ event, payment }) => {
    if (payment.payment_status === "SUCCESS") {
      // trigger image generation
      await generateImage(orderId, prompt);
    }
  },
});

export async function POST(request: Request) {
  return handler(request);
}
```

`talo.webhooks.handler()` takes care of signature verification and payload parsing. You only need to implement the callbacks.

---

## Project structure

```
app/
  page.tsx                   # Full UI — prompt input, payment steps, image display
  layout.tsx                 # Root layout + navbar
  api/
    orders/
      route.ts               # POST — create a Talo payment + store order
      [id]/
        verify/route.ts      # POST — manual payment status poll (fallback)
        events/route.ts      # GET  — SSE stream for real-time status updates
    webhooks/
      talo/route.ts          # POST — Talo webhook handler
lib/
  talo.ts                    # TaloClient singleton
  replicate.ts               # Replicate client singleton
  generate.ts                # Calls Replicate and updates order status
  store.ts                   # In-memory order store with subscriber pattern
```

---

## Getting started

### Prerequisites

- Node.js 18+ or [Bun](https://bun.sh)
- A [Talo](https://github.com/stormakh/talo-sdk) account with API credentials
- A [Replicate](https://replicate.com) API token

### Environment variables

Create `.env.local` in the `image-generation-demo/` directory:

```env
TALO_CLIENT_ID=your_client_id
TALO_CLIENT_SECRET=your_client_secret
TALO_USER_ID=your_user_id
REPLICATE_API_TOKEN=your_replicate_token
NEXT_PUBLIC_BASE_URL=https://your-domain.com   # used for the webhook URL; defaults to http://localhost:3000
```

> For local development you'll need to expose your local server to the internet (e.g. with [ngrok](https://ngrok.com)) so Talo can reach the webhook endpoint.

### Run locally

```bash
cd image-generation-demo
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## More examples

See the [talo-sdk repository](https://github.com/stormakh/talo-sdk) for examples using other frameworks (Hono, Elysia, and more).
