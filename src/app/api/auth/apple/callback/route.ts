import type { NextRequest } from "next/server";
import { finishApple } from "@/lib/apple-auth";

/** Apple posts the sign-in result here (response_mode=form_post). */
export async function POST(req: NextRequest) {
  return finishApple(req);
}
