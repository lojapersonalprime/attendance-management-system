import { NextResponse } from "next/server";
import { MobileAttendanceError, mobileAttendanceErrorMessage } from "@/modules/mobile-attendance/application/errors";
import { createAttendanceCorrectionRequest } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const correction = await createAttendanceCorrectionRequest(await request.json());
    return NextResponse.json({ id: correction.id });
  } catch (error) {
    const known = error instanceof MobileAttendanceError;
    return NextResponse.json({ error: mobileAttendanceErrorMessage(error), code: known ? error.code : "UNAVAILABLE" }, { status: known && error.code === "UNAUTHORIZED" ? 401 : 400 });
  }
}
