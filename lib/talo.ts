import { TaloClient } from "talo-pay";

let _talo: TaloClient | null = null;

export function getTalo(): TaloClient {
  if (!_talo) {
    _talo = new TaloClient({
      clientId: process.env.TALO_CLIENT_ID!,
      clientSecret: process.env.TALO_CLIENT_SECRET!,
      userId: process.env.TALO_USER_ID!,
      environment: "production",
    });
  }
  return _talo;
}
