export type PasswordLinkFailureCode =
  | "INVITE_MISSING_PARAMETERS"
  | "INVITE_INVALID_OR_EXPIRED"
  | "INVITE_SESSION_FAILED"
  | "INVITE_USER_NOT_FOUND"
  | "INVITE_REDIRECT_MISCONFIGURED";

export type PasswordLinkDiagnosticCode = PasswordLinkFailureCode | "PASSWORD_SESSION_REQUIRED";

export type PasswordLinkTransport = "fragment" | "code" | "token_hash" | "existing_session" | "none";

type AuthResult = {
  error: unknown | null;
};

type AuthUserResult = AuthResult & {
  data: { user: unknown | null };
};

/** The minimal browser Auth contract used by the password-link landing pages. */
export type PasswordLinkAuthClient = {
  auth: {
    getUser: () => Promise<AuthUserResult>;
    setSession: (session: { access_token: string; refresh_token: string }) => Promise<AuthResult>;
    exchangeCodeForSession: (code: string) => Promise<AuthResult>;
    verifyOtp: (input: { token_hash: string; type: "invite" | "recovery" }) => Promise<AuthResult>;
  };
};

type PasswordLinkRedirect =
  | { kind: "fragment"; accessToken: string | null; refreshToken: string | null; shouldCleanUrl: true }
  | { kind: "code"; code: string; shouldCleanUrl: true }
  | { kind: "token_hash"; tokenHash: string; type: "invite" | "recovery" | null; shouldCleanUrl: true }
  | { kind: "provider_error"; code: PasswordLinkFailureCode; shouldCleanUrl: true }
  | { kind: "none"; shouldCleanUrl: false };

export type PasswordLinkSessionResult =
  | { status: "READY"; transport: Exclude<PasswordLinkTransport, "none"> }
  | { status: "ERROR"; code: PasswordLinkFailureCode; transport: PasswordLinkTransport };

const authQueryKeys = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "code",
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

function hasProviderError(parameters: URLSearchParams) {
  return Boolean(parameters.get("error") || parameters.get("error_code") || parameters.get("error_description"));
}

function isRedirectMisconfigured(parameters: URLSearchParams) {
  const value = `${parameters.get("error") ?? ""} ${parameters.get("error_code") ?? ""}`.toLowerCase();
  return value.includes("redirect") || value.includes("uri_mismatch");
}

function supportedTokenHashType(value: string | null): value is "invite" | "recovery" {
  return value === "invite" || value === "recovery";
}

/**
 * Reads the auth response before a Supabase SSR browser client is constructed.
 * The SSR client is fixed to PKCE; doing this first prevents it from rejecting an
 * implicit invitation fragment before `setSession` can persist it in cookies.
 */
export function readPasswordLinkRedirect(search: string, hash: string): PasswordLinkRedirect {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  if (hasProviderError(query) || hasProviderError(fragment)) {
    const parameters = hasProviderError(query) ? query : fragment;
    return { kind: "provider_error", code: isRedirectMisconfigured(parameters) ? "INVITE_REDIRECT_MISCONFIGURED" : "INVITE_INVALID_OR_EXPIRED", shouldCleanUrl: true };
  }

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken || refreshToken) return { kind: "fragment", accessToken, refreshToken, shouldCleanUrl: true };

  const code = query.get("code");
  if (code) return { kind: "code", code, shouldCleanUrl: true };

  const tokenHash = query.get("token_hash");
  if (tokenHash) {
    const type = query.get("type");
    return { kind: "token_hash", tokenHash, type: supportedTokenHashType(type) ? type : null, shouldCleanUrl: true };
  }

  return { kind: "none", shouldCleanUrl: false };
}

/** Removes one-time credentials from the visible browser URL without changing route or non-auth query state. */
export function passwordLinkUrlWithoutSecrets(pathname: string, search: string, hash: string) {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  authQueryKeys.forEach((key) => query.delete(key));
  authQueryKeys.forEach((key) => fragment.delete(key));
  const remainingQuery = query.toString();
  const remainingFragment = fragment.toString();
  return `${pathname}${remainingQuery ? `?${remainingQuery}` : ""}${remainingFragment ? `#${remainingFragment}` : ""}`;
}

function errorIsExpiredOrInvalid(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown; message?: unknown };
  if (candidate.status === 400 || candidate.status === 401 || candidate.status === 403) return true;
  const details = [candidate.code, candidate.name, candidate.message].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  return /expired|invalid|token.*not.*found|otp/.test(details);
}

function operationFailure(error: unknown, transport: PasswordLinkTransport): PasswordLinkSessionResult {
  return {
    status: "ERROR",
    code: errorIsExpiredOrInvalid(error) ? "INVITE_INVALID_OR_EXPIRED" : "INVITE_SESSION_FAILED",
    transport,
  };
}

async function requireAuthenticatedUser(client: PasswordLinkAuthClient, transport: Exclude<PasswordLinkTransport, "none">): Promise<PasswordLinkSessionResult> {
  const result = await client.auth.getUser();
  if (result.error) return operationFailure(result.error, transport);
  if (!result.data.user) return { status: "ERROR", code: "INVITE_USER_NOT_FOUND", transport };
  return { status: "READY", transport };
}

/**
 * Establishes a password-update session for Supabase invite, recovery and
 * token-hash links. It never falls back to an unrelated existing session when
 * the received link itself is invalid.
 */
export async function establishPasswordLinkSession(client: PasswordLinkAuthClient, redirect: PasswordLinkRedirect): Promise<PasswordLinkSessionResult> {
  if (redirect.kind === "provider_error") return { status: "ERROR", code: redirect.code, transport: "none" };

  if (redirect.kind === "fragment") {
    if (!redirect.accessToken || !redirect.refreshToken) return { status: "ERROR", code: "INVITE_MISSING_PARAMETERS", transport: "fragment" };
    const result = await client.auth.setSession({ access_token: redirect.accessToken, refresh_token: redirect.refreshToken });
    if (result.error) return operationFailure(result.error, "fragment");
    return requireAuthenticatedUser(client, "fragment");
  }

  if (redirect.kind === "code") {
    const result = await client.auth.exchangeCodeForSession(redirect.code);
    if (result.error) return operationFailure(result.error, "code");
    return requireAuthenticatedUser(client, "code");
  }

  if (redirect.kind === "token_hash") {
    if (!supportedTokenHashType(redirect.type)) return { status: "ERROR", code: "INVITE_MISSING_PARAMETERS", transport: "token_hash" };
    const result = await client.auth.verifyOtp({ token_hash: redirect.tokenHash, type: redirect.type });
    if (result.error) return operationFailure(result.error, "token_hash");
    return requireAuthenticatedUser(client, "token_hash");
  }

  const existing = await client.auth.getUser();
  if (existing.error || !existing.data.user) return { status: "ERROR", code: "INVITE_MISSING_PARAMETERS", transport: "none" };
  return { status: "READY", transport: "existing_session" };
}

/** Browser diagnostics deliberately contain only stable classifications, never tokens, URLs or passwords. */
export function logPasswordLinkDiagnostic(code: PasswordLinkDiagnosticCode, transport: PasswordLinkTransport) {
  console.warn("[password-link]", { code, transport });
}

export function logPasswordLinkFailure(result: Extract<PasswordLinkSessionResult, { status: "ERROR" }>) {
  logPasswordLinkDiagnostic(result.code, result.transport);
}
