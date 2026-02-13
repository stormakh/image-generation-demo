import { NextResponse } from "next/server";
import { getTalo } from "@/lib/talo";
import { createOrder } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt is required" },
        { status: 400 }
      );
    }

    const orderId = crypto.randomUUID();
    const externalId = `img_${orderId}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    console.log("TALO_USER_ID", process.env.TALO_USER_ID);
    console.log("TALO_CLIENT_ID", process.env.TALO_CLIENT_ID);
    console.log("TALO_CLIENT_SECRET", process.env.TALO_CLIENT_SECRET);

    const talo = getTalo();
    const payment = await talo.payments.create({
      user_id: process.env.TALO_USER_ID!,
      price: { amount: 100, currency: "ARS" },
      payment_options: ["transfer"],
      external_id: externalId,
      webhook_url: `${baseUrl}/api/webhooks/talo`,
      motive: `Image generation: ${prompt.slice(0, 100)}`,
    });

    const quote = payment.quotes?.[0];
    const cvu = quote?.cvu ?? "";
    const alias = quote?.alias ?? "";

    createOrder({
      id: orderId,
      prompt,
      taloPaymentId: payment.id,
      externalId,
      status: "pending_payment",
      cvu: String(cvu),
      alias: String(alias),
      paymentUrl: payment.payment_url ?? "",
      imageUrl: null,
      expiresAt: payment.expiration_timestamp ?? null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      orderId,
      cvu,
      alias,
      paymentUrl: payment.payment_url,
      expiresAt: payment.expiration_timestamp,
    });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
