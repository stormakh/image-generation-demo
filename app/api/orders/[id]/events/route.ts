import { getOrder, subscribe } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = getOrder(id);

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Send current state immediately
      send("status", {
        status: order.status,
        imageUrl: order.imageUrl,
      });

      // If already in a terminal state, close the stream
      if (
        order.status === "completed" ||
        order.status === "expired" ||
        order.status === "failed"
      ) {
        controller.close();
        return;
      }

      // Subscribe to future updates
      const unsubscribe = subscribe(id, (updated) => {
        send("status", {
          status: updated.status,
          imageUrl: updated.imageUrl,
        });

        if (
          updated.status === "completed" ||
          updated.status === "expired" ||
          updated.status === "failed"
        ) {
          unsubscribe();
          controller.close();
        }
      });

      // Cleanup on client disconnect
      _request.signal.addEventListener("abort", () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
