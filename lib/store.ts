export const GENERATION_PRICE = 10;

export type OrderStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "generating_image"
  | "completed"
  | "expired"
  | "failed";

export interface Order {
  id: string;
  prompt: string;
  taloPaymentId: string;
  externalId: string;
  status: OrderStatus;
  cvu: string;
  alias: string;
  paymentUrl: string;
  imageUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

type Subscriber = (order: Order) => void;

const orders = new Map<string, Order>();
const subscribers = new Map<string, Set<Subscriber>>();

// Index by externalId for webhook lookups
const externalIdIndex = new Map<string, string>();

export function createOrder(order: Order): void {
  orders.set(order.id, order);
  externalIdIndex.set(order.externalId, order.id);
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function getOrderByExternalId(externalId: string): Order | undefined {
  const id = externalIdIndex.get(externalId);
  if (!id) return undefined;
  return orders.get(id);
}

export function updateOrder(
  id: string,
  updates: Partial<Pick<Order, "status" | "imageUrl">>
): Order | undefined {
  const order = orders.get(id);
  if (!order) return undefined;

  const updated = { ...order, ...updates };
  orders.set(id, updated);

  // Notify SSE subscribers
  const subs = subscribers.get(id);
  if (subs) {
    for (const cb of subs) {
      cb(updated);
    }
  }

  return updated;
}

export function subscribe(orderId: string, cb: Subscriber): () => void {
  if (!subscribers.has(orderId)) {
    subscribers.set(orderId, new Set());
  }
  subscribers.get(orderId)!.add(cb);

  return () => {
    const subs = subscribers.get(orderId);
    if (subs) {
      subs.delete(cb);
      if (subs.size === 0) subscribers.delete(orderId);
    }
  };
}
