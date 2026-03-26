import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csv = [
    "examCode,className,setCode,answers",
    "EGKO,10,A,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D,A,B,C,D",
    "EGKO,10,B,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A,D,C,B,A",
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="answer_keys_sample.csv"',
    },
  });
}
