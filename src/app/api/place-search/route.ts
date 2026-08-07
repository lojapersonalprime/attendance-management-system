import { NextResponse } from "next/server";
import { getActiveProfile } from "@/modules/auth/server/session";
import { placeSearchErrorMessage } from "@/modules/places/domain/place-search";
import { searchPlaces } from "@/modules/places/application/place-search-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const profile = await getActiveProfile();
  if (profile?.role !== "RH_ADMIN") {
    return NextResponse.json({ error: "Sua sessão não permite pesquisar locais." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  try {
    const places = await searchPlaces({ query: searchParams.get("query"), sessionToken: searchParams.get("sessionToken") });
    return NextResponse.json({ places });
  } catch (error) {
    return NextResponse.json({ error: placeSearchErrorMessage(error) }, { status: 400 });
  }
}
