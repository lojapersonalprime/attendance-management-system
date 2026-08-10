type PublicAppUrlEnvironment = {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_VERCEL_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

function environmentValue(value: string | undefined) {
  return value?.trim() || undefined;
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeOrigin(value: string, label: string, options: { allowLocalhost: boolean; vercelDeployment?: boolean }) {
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error(`${label} precisa conter uma URL válida.`);
  }
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label} não pode conter credenciais, parâmetros ou fragmentos.`);
  if (options.vercelDeployment && !url.hostname.endsWith(".vercel.app")) throw new Error(`${label} precisa apontar para um deployment Vercel válido.`);
  if (isLocalHost(url.hostname)) {
    if (!options.allowLocalhost || url.protocol !== "http:") throw new Error("localhost só pode ser usado em desenvolvimento local.");
  } else if (url.protocol !== "https:") {
    throw new Error(`${label} precisa usar HTTPS fora do desenvolvimento local.`);
  }
  return url.origin;
}

/**
 * Resolves the public origin without trusting request headers. Preview URLs come
 * exclusively from Vercel's deployment variables; production must declare its
 * canonical URL explicitly.
 */
export function resolvePublicAppUrl(environment: PublicAppUrlEnvironment = process.env) {
  const development = environment.NODE_ENV === "development";
  const siteUrl = environmentValue(environment.NEXT_PUBLIC_SITE_URL);
  if (siteUrl) return normalizeOrigin(siteUrl, "NEXT_PUBLIC_SITE_URL", { allowLocalhost: development });

  if (environment.VERCEL_ENV === "preview") {
    const deploymentUrl = environmentValue(environment.VERCEL_URL) ?? environmentValue(environment.NEXT_PUBLIC_VERCEL_URL);
    if (!deploymentUrl) throw new Error("Não foi possível determinar a URL pública deste Preview Vercel.");
    return normalizeOrigin(deploymentUrl, "VERCEL_URL", { allowLocalhost: false, vercelDeployment: true });
  }

  if (development) return "http://localhost:3000";
  throw new Error("Configure NEXT_PUBLIC_SITE_URL com a URL oficial antes de enviar convites de acesso.");
}

export function buildPublicAppRedirectUrl(path: `/${string}`, environment: PublicAppUrlEnvironment = process.env) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("O caminho de redirecionamento precisa permanecer na origem pública autorizada.");
  const origin = resolvePublicAppUrl(environment);
  const redirectUrl = new URL(path, origin);
  if (redirectUrl.origin !== origin) throw new Error("O caminho de redirecionamento precisa permanecer na origem pública autorizada.");
  return redirectUrl.toString();
}

/** The invite always completes on a fixed, public callback before entering the employee portal. */
export function getEmployeeInviteRedirectUrl(environment: PublicAppUrlEnvironment = process.env) {
  return buildPublicAppRedirectUrl("/auth/callback", environment);
}
