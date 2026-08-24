export type LocationStatus = "INSIDE_RADIUS" | "OUTSIDE_RADIUS" | "LOW_ACCURACY";
export type LocationPolicy = "ALLOW_AND_REVIEW" | "BLOCK";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationEvaluationInput extends Coordinates {
  accuracyMeters: number;
  authorizedLocation: Coordinates & {
    radiusMeters: number;
    maxAccuracyMeters: number;
    exceptionPolicy: LocationPolicy;
  };
}

export interface LocationEvaluation {
  distanceMeters: number;
  status: LocationStatus;
  reviewRequired: boolean;
  blocked: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

/** Haversine distance; all trust decisions happen on the server. */
export function haversineDistanceMeters(from: Coordinates, to: Coordinates) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateLocation(input: LocationEvaluationInput): LocationEvaluation {
  const distanceMeters = haversineDistanceMeters(input, input.authorizedLocation);
  const status: LocationStatus = input.accuracyMeters > input.authorizedLocation.maxAccuracyMeters
    ? "LOW_ACCURACY"
    : distanceMeters <= input.authorizedLocation.radiusMeters
      ? "INSIDE_RADIUS"
      : "OUTSIDE_RADIUS";
  const reviewRequired = status !== "INSIDE_RADIUS";
  return {
    distanceMeters,
    status,
    reviewRequired,
    blocked: reviewRequired && input.authorizedLocation.exceptionPolicy === "BLOCK",
  };
}

export function locationStatusLabel(status: LocationStatus) {
  return ({
    INSIDE_RADIUS: "Dentro da área autorizada",
    OUTSIDE_RADIUS: "Registro realizado fora da área habitual da unidade",
    LOW_ACCURACY: "Localização com baixa precisão",
  } as const)[status];
}
