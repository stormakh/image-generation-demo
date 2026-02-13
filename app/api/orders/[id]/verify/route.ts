import { NextResponse } from "next/server";
import { getTalo } from "@/lib/talo";
import { getOrder, updateOrder } from "@/lib/store";
import { generateImage } from "@/lib/generate";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = getOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only verify orders that are still waiting for payment
  if (order.status !== "pending_payment") {
    return NextResponse.json({
      status: order.status,
      imageUrl: order.imageUrl,
    });
  }

  try {
    const talo = getTalo();
    const payment = await talo.payments.get(order.taloPaymentId);
    const paymentStatus = payment.payment_status;

    if (paymentStatus === "SUCCESS" || paymentStatus === "OVERPAID") {
      // Re-read order in case webhook arrived concurrently
      const freshOrder = getOrder(id);
      if (!freshOrder || freshOrder.status !== "pending_payment") {
        return NextResponse.json({
          status: freshOrder?.status ?? "pending_payment",
          imageUrl: freshOrder?.imageUrl ?? null,
        });
      }

      updateOrder(order.id, { status: "payment_confirmed" });

      generateImage(order.id, order.prompt).catch((err) => {
        console.error("Image generation failed:", err);
        updateOrder(order.id, { status: "failed" });
      });

      return NextResponse.json({
        status: "payment_confirmed",
        imageUrl: null,
      });
    } else if (paymentStatus === "EXPIRED") {
      updateOrder(order.id, { status: "expired" });
      return NextResponse.json({ status: "expired", imageUrl: null });
    } else {
      // PENDING or UNDERPAID — no change
      return NextResponse.json({
        status: order.status,
        imageUrl: null,
      });
    }
  } catch (error) {
    console.error("Failed to verify payment:", error);
    return NextResponse.json(
      { error: "Failed to verify payment status" },
      { status: 502 }
    );
  }
}
