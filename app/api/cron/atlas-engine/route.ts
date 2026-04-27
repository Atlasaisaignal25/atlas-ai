import { NextResponse } from "next/server";
import { buildGlobalTopSignal } from "@/app/lib/globalTopSignal";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await buildGlobalTopSignal();

    return NextResponse.json({
      success: true,
      message: "Atlas engine executed",
    });
  } catch (error) {
    console.error("Cron error:", error);

    return NextResponse.json({
      success: false,
      error: "Execution failed",
    });
  }
}