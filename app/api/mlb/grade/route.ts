import { NextResponse } from "next/server";
import { manuallyGradePick } from "@/app/mlb/lib/gradePicks";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { gameId, teams, market, pick, line, result } = body;

    if (!gameId || !teams || !market || !pick || !result) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    manuallyGradePick(
      {
        gameId,
        teams,
        market,
        pick,
        line,
      },
      result
    );

    return NextResponse.json({
      success: true,
      message: "MLB pick graded successfully",
    });
  } catch (error) {
    console.error("Error grading MLB pick:", error);

    return NextResponse.json(
      { error: "Failed to grade MLB pick" },
      { status: 500 }
    );
  }
}