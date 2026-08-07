import { NextResponse } from "next/server";
import { getActiveProfile } from "@/modules/auth/server/session";
import { getPlaceDetails } from "@/modules/places/application/place-search-service";
import { placeSearchErrorMessage } from "@/modules/places/domain/place-search";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const profile = await getActiveProfile();
  if (profile?.role !== "RH_ADMIN") {
    return NextResponse.json({ error: "Sua sessão não permite pesquisar locais." }, { status: 403 });
  }
  const { placeId } = await params;
  const { searchParams } = new URL(request.url);
  try {
    const place = await getPlaceDetails({ placeId, sessionToken: searchParams.get("sessionToken") ?? undefined });
    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json({ error: placeSearchErrorMessage(error) }, { status: 400 });
  }
}
