import type { NextRequest } from "next/server";
import { startApple } from "@/lib/apple-auth";

export async function GET(req: NextRequest) {
  return startApple(req);
}
