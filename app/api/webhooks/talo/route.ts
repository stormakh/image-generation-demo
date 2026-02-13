import { getTalo } from "@/lib/talo";
import { getOrderByExternalId, updateOrder } from "@/lib/store";
import { generateImage } from "@/lib/generate";
import type { PaymentUpdatedWebhookEvent, PaymentResponse } from "talo-pay";

let _webhookHandler: (request: Request) => Promise<Response>;

function getWebhookHandler(): (request: Request) => Promise<Response> {
  if (!_webhookHandler) {
    _webhookHandler = getTalo().webhooks.handler({
      onPaymentUpdated: async ({
        event,
        payment,
      }: {
        event: PaymentUpdatedWebhookEvent;
        payment: PaymentResponse;
        request: Request;
      }) => {
        const order = getOrderByExternalId(event.externalId);
        if (!order) {
          console.warn(
            "Webhook received for unknown order:",
            event.externalId
          );
          return;
        }

        const status = payment.payment_status;

        if (status === "SUCCESS" || status === "OVERPAID") {
          // Idempotency guard: only process if still awaiting payment
          if (order.status !== "pending_payment") {
            return;
          }

          updateOrder(order.id, { status: "payment_confirmed" });

          generateImage(order.id, order.prompt).catch((err) => {
            console.error("Image generation failed:", err);
            updateOrder(order.id, { status: "failed" });
          });
        } else if (status === "EXPIRED") {
          if (order.status !== "pending_payment") {
            return;
          }
          updateOrder(order.id, { status: "expired" });
        } else if (status === "UNDERPAID") {
          console.warn("Underpaid order:", order.id);
        }
      },
    });
  }
  return _webhookHandler;
}

export async function POST(request: Request): Promise<Response> {
  return getWebhookHandler()(request);
}
