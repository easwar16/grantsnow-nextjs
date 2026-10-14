import { json } from "@/server/api/http";
export async function GET() {
  return json({ status: "ok" });
}
