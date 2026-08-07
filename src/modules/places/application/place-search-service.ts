import "server-only";

import { z } from "zod";
import { getPlaceSearchProvider } from "@/modules/places/infrastructure/google-places-provider";

const sessionToken = z.string().uuid();

export const placeSearchInputSchema = z.object({
  query: z.string().trim().min(3).max(160),
  sessionToken,
});

export const placeDetailsInputSchema = z.object({
  placeId: z.string().trim().min(6).max(255).regex(/^[A-Za-z0-9_-]+$/),
  sessionToken: sessionToken.optional(),
});

export async function searchPlaces(value: unknown) {
  return getPlaceSearchProvider().searchPlaces(placeSearchInputSchema.parse(value));
}

export async function getPlaceDetails(value: unknown) {
  return getPlaceSearchProvider().getPlaceDetails(placeDetailsInputSchema.parse(value));
}
