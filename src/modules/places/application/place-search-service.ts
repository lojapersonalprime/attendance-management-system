import "server-only";

import { z } from "zod";
import { getPlaceSearchProvider } from "@/modules/places/infrastructure/place-search-provider";

const sessionToken = z.string().uuid();

export const placeSearchInputSchema = z.object({
  query: z.string().trim().min(3).max(160),
  sessionToken,
});

export const placeDetailsInputSchema = z.object({
  placeId: z.string().trim().min(3).max(255).regex(/^[A-Za-z0-9:_-]+$/),
  sessionToken: sessionToken.optional(),
  query: z.string().trim().min(3).max(160).optional(),
});

export async function searchPlaces(value: unknown) {
  return getPlaceSearchProvider().searchPlaces(placeSearchInputSchema.parse(value));
}

export async function getPlaceDetails(value: unknown) {
  return getPlaceSearchProvider().getPlaceDetails(placeDetailsInputSchema.parse(value));
}
