import { replicate } from "@/lib/replicate";
import { updateOrder } from "@/lib/store";

export async function generateImage(orderId: string, prompt: string) {
  updateOrder(orderId, { status: "generating_image" });

  const [output] = (await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt,
      num_outputs: 1,
    },
  })) as Array<{ url: () => string }>;

  const imageUrl = output.url();
  updateOrder(orderId, { status: "completed", imageUrl });
}
