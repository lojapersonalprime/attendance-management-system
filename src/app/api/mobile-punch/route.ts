import { NextResponse } from "next/server";
import { MobileAttendanceError, mobileAttendanceErrorMessage } from "@/modules/mobile-attendance/application/errors";
import { registerMobilePunch } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await registerMobilePunch(await request.json());
    return NextResponse.json({
      receipt: {
        id: result.punch.id,
        registeredAt: result.punch.registeredAt.toISOString(),
        receiptCode: result.punch.receiptCode,
        locationStatus: result.punch.locationStatus,
        reviewRequired: result.punch.reviewRequired,
      },
      duplicate: result.duplicate,
      supportCode: result.supportCode,
    });
  } catch (error) {
    const known = error instanceof MobileAttendanceError;
    return NextResponse.json({
      error: mobileAttendanceErrorMessage(error),
      code: known ? error.code : "UNAVAILABLE",
      supportCode: known ? error.supportCode : undefined,
    }, { status: known && error.code === "UNAUTHORIZED" ? 401 : 400 });
  }
}
