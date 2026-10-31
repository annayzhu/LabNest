import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";
import { AIProviderError } from "./ai";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./ai-crypto";
import { prisma } from "./db";

/**
 * Sign in with ChatGPT for a LabNest that runs on the user's own computer: OAuth with PKCE against auth.openai.com, the
 * loopback callback OpenAI allows (http://127.0.0.1:<port>/auth/callback), and the plan-usage grant. The registration
 * (client ID and account) is stored encrypted in AIProvider.apiKeyEncrypted; the rotating tokens in AIProviderSession.
 * Server-only. https://developers.openai.com/siwc/token-sharing-open-source
 */

const CHATGPT_ISSUER = "https://auth.openai.com";
const CHATGPT_RESOURCE = "https://api.openai.com/v1";
export const CHATGPT_CALLBACK_PATH = "/auth/callback";
export const CHATGPT_PENDING_COOKIE = "labnest_chatgpt_sign_in";
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const PLAN_SCOPE = "chatgpt.tokens.use.direct";
const NEW_CLIENT = "dynamic_agent_client";
const PENDING_MS = 10 * 60_000;
/** Refresh a minute before the access token runs out, so a request never starts on a token about to expire. */
const REFRESH_MARGIN_MS = 60_000;

export type ChatGPTRegistration = { clientId: string; subject: string; email?: string; name?: string };
type ChatGPTTokens = { accessToken: string; refreshToken: string; idToken?: string; scopes: string[]; earliestRefreshAt?: number };
/** A model the account may use, with the reasoning efforts it takes (empty when the catalog gave none). */
export type ChatGPTModel = { slug: string; displayName: string; efforts?: ChatGPTEffort[]; defaultEffort?: ChatGPTEffort };
/** Efforts the Responses API accepts, lightest first; the catalog also lists "ultra", which the API refuses. */
export const chatGPTEfforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ChatGPTEffort = (typeof chatGPTEfforts)[number];
const isEffort = (value: unknown): value is ChatGPTEffort => chatGPTEfforts.includes(value as ChatGPTEffort);
/** A sign-in on its way through OpenAI, held in an encrypted cookie on the 127.0.0.1 origin. */
export type PendingSignIn = { state: string; nonce: string; verifier: string; redirectUri: string; clientId?: string; providerId?: string; loginHint?: string; returnTo: string; createdAt: number };

/** Why a sign-in stopped. */
type ChatGPTSignInReason = "access_denied" | "state" | "registration" | "plan_scope" | "identity" | "account_mismatch" | "network" | "encryption" | "failed";

/** What the AI page says after a sign-in or sign-out (`/ai?chatgpt=<outcome>`); `ok` outcomes are not failures. */
export const chatGPTSignInMessages: Record<ChatGPTSignInReason | "signed-in" | "signed-in-no-models" | "signed-out" | "signed-out-unconfirmed" | "models-updated" | "models-unavailable" | "loopback", { ok?: true; message: string }> = {
  "signed-in": { ok: true, message: "Signed in to ChatGPT. When no default AI service was chosen yet, it is now the default." },
  "signed-in-no-models": { ok: true, message: "Signed in to ChatGPT, but the account’s models could not be listed; sign in again to choose a model." },
  "signed-out": { ok: true, message: "Signed out of ChatGPT and removed the service." },
  "models-updated": { ok: true, message: "The ChatGPT model list is up to date." },
  "models-unavailable": { message: "ChatGPT did not list the account’s models; try again, or sign in again." },
  "signed-out-unconfirmed": { message: "Removed the service here, but OpenAI did not confirm the sign-out; disconnect LabNest under Apps in ChatGPT settings." },
  loopback: { message: "Sign in with ChatGPT works only on the computer that runs LabNest; open the AI page there." },
  access_denied: { message: "Sign-in was not completed. You can try again when you are ready." },
  state: { message: "The sign-in did not come back to the page that started it; start it again from the AI page." },
  registration: { message: "ChatGPT did not finish registering LabNest; sign in again." },
  plan_scope: { message: "Plan usage was not allowed. Sign in again and tick the box that lets LabNest use your ChatGPT plan." },
  identity: { message: "The ChatGPT identity could not be verified; sign in again." },
  account_mismatch: { message: "This sign-in returned a different ChatGPT account. Sign in with the original account, or sign out of it first." },
  network: { message: "LabNest could not reach ChatGPT sign-in; check the server’s network and try again." },
  encryption: { message: "Configure the server encryption key first to store API keys safely." },
  failed: { message: "ChatGPT sign-in did not complete; try again." },
};

export class ChatGPTSignInError extends Error {
  constructor(readonly reason: ChatGPTSignInReason, detail?: string) { super(detail ? `${chatGPTSignInMessages[reason].message} (${detail})` : chatGPTSignInMessages[reason].message); this.name = "ChatGPTSignInError"; }
}

const signInAgain = () => new AIProviderError("ChatGPT sign-in has expired; sign in again on the AI page.", 401, "chatgpt_sign_in");
const randomValue = () => randomBytes(32).toString("base64url");

// ---------------------------------------------------------------------------
// Where a sign-in may start and come back
// ---------------------------------------------------------------------------

/**
 * The port of a page opened on this computer (127.0.0.1, localhost or [::1]), else undefined: OpenAI returns only to
 * 127.0.0.1, so a page opened by LAN address or from a phone cannot complete a sign-in.
 */
export function loopbackPort(host: string | null | undefined): string | undefined {
  const match = host?.trim().toLowerCase().match(/^(?:127\.0\.0\.1|localhost|\[::1\])(?::(\d{1,5}))?$/);
  return match ? match[1] ?? "80" : undefined;
}

/** A stable ID for this LabNest installation, which OpenAI pairs with each account's registration. */
export function chatGPTHostId(): string {
  let database = "";
  try { database = new URL(process.env.DATABASE_URL ?? "").pathname; } catch { /* no database URL */ }
  const hex = createHash("sha256").update(`labnest-chatgpt-host\0${process.env.LABNEST_AI_ENCRYPTION_KEY ?? ""}\0${database}`).digest("hex");
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function sealPendingSignIn(pending: PendingSignIn): string {
  return encryptSecret(JSON.stringify(pending));
}

export function openPendingSignIn(sealed: string | undefined): PendingSignIn | undefined {
  if (!sealed || !isEncryptedSecret(sealed)) return undefined;
  try {
    const pending = JSON.parse(decryptSecret(sealed)) as PendingSignIn;
    return Date.now() - pending.createdAt < PENDING_MS ? pending : undefined;
  } catch { return undefined; }
}

// ---------------------------------------------------------------------------
// OpenAI endpoints
// ---------------------------------------------------------------------------

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; revocation_endpoint?: string; jwks_uri: string };
let discoveryPromise: Promise<Discovery> | undefined;
let jwksCache: { uri: string; keys: (JsonWebKey & { kid?: string })[]; at: number } | undefined;

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<{ response: Response; data: unknown }> {
  let response: Response;
  try { response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) }); }
  catch { throw new ChatGPTSignInError("network"); }
  let data: unknown;
  try { data = await response.json(); } catch { data = undefined; }
  return { response, data };
}

/** OpenAI's sign-in configuration, accepted only when every endpoint is on auth.openai.com. */
async function discovery(): Promise<Discovery> {
  discoveryPromise ??= (async () => {
    const { response, data } = await fetchJson(`${CHATGPT_ISSUER}/.well-known/openid-configuration`);
    const config = data as Partial<Discovery> | undefined;
    const sameOrigin = (value: unknown) => typeof value === "string" && new URL(value).origin === CHATGPT_ISSUER;
    if (!response.ok || config?.issuer !== CHATGPT_ISSUER || !sameOrigin(config.authorization_endpoint) || !sameOrigin(config.token_endpoint) || !sameOrigin(config.jwks_uri) || (config.revocation_endpoint !== undefined && !sameOrigin(config.revocation_endpoint))) {
      throw new ChatGPTSignInError("network");
    }
    return config as Discovery;
  })().catch(error => { discoveryPromise = undefined; throw error; });
  return discoveryPromise;
}

/** The error code in an OAuth (`{ error: "code" }`) or API (`{ error: { code } }`) failure. */
function errorCode(data: unknown): string | undefined {
  const body = data as { error?: unknown } | undefined;
  if (typeof body?.error === "string") return body.error;
  const nested = body?.error as { code?: unknown } | undefined;
  return typeof nested?.code === "string" ? nested.code : undefined;
}

class TokenRequestError extends Error {
  constructor(readonly code: string | undefined, readonly status: number) { super(`ChatGPT sign-in returned HTTP ${status}${code ? ` (${code})` : ""}.`); }
}

async function tokenRequest(body: URLSearchParams): Promise<Record<string, unknown>> {
  const config = await discovery();
  const { response, data } = await fetchJson(config.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  if (!response.ok) throw new TokenRequestError(errorCode(data), response.status);
  if (!data || typeof data !== "object") throw new TokenRequestError("invalid_token_response", response.status);
  return data as Record<string, unknown>;
}

/** Access and refresh tokens from a token response; a plan grant without both is no grant. */
function tokenFields(data: Record<string, unknown>, previousScopes?: string[]): { tokens: ChatGPTTokens; expiresAt: Date } {
  const scopes = typeof data.scope === "string" ? data.scope.split(/\s+/).filter(Boolean) : previousScopes ?? [];
  if (typeof data.access_token !== "string" || !data.access_token || typeof data.refresh_token !== "string" || !data.refresh_token
    || String(data.token_type).toLowerCase() !== "bearer" || typeof data.expires_in !== "number" || !(data.expires_in > 0)) {
    throw new ChatGPTSignInError("registration");
  }
  const earliest = data.earliest_refresh_at;
  const earliestRefreshAt = typeof earliest === "number" ? earliest * 1000 : typeof earliest === "string" ? Date.parse(earliest) : undefined;
  return {
    tokens: { accessToken: data.access_token, refreshToken: data.refresh_token, scopes, ...(typeof data.id_token === "string" ? { idToken: data.id_token } : {}), ...(earliestRefreshAt && Number.isFinite(earliestRefreshAt) ? { earliestRefreshAt } : {}) },
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function signingKeys(uri: string, refresh = false) {
  if (!refresh && jwksCache?.uri === uri && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const { response, data } = await fetchJson(uri);
  const keys = (data as { keys?: unknown } | undefined)?.keys;
  if (!response.ok || !Array.isArray(keys)) throw new ChatGPTSignInError("network");
  jwksCache = { uri, keys, at: Date.now() };
  return jwksCache.keys;
}

/** Checks an ID token's RS256 signature against OpenAI's published keys, then its issuer, audience, expiry and nonce. */
export async function verifyIdToken(idToken: string, clientId: string, nonce?: string, now = Date.now()): Promise<Omit<ChatGPTRegistration, "clientId">> {
  const invalid = () => new ChatGPTSignInError("identity");
  const [head, body, signature] = idToken.split(".");
  if (!head || !body || !signature) throw invalid();
  let header: { alg?: string; kid?: string }, payload: Record<string, unknown>;
  try { header = JSON.parse(Buffer.from(head, "base64url").toString("utf8")); payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); }
  catch { throw invalid(); }
  if (header.alg !== "RS256") throw invalid();
  const config = await discovery();
  let jwk = (await signingKeys(config.jwks_uri)).find(key => key.kid === header.kid);
  jwk ??= (await signingKeys(config.jwks_uri, true)).find(key => key.kid === header.kid);
  if (!jwk) throw invalid();
  let signed = false;
  try { signed = verify("RSA-SHA256", Buffer.from(`${head}.${body}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url")); }
  catch { throw invalid(); }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!signed || payload.iss !== config.issuer || !audiences.includes(clientId) || (audiences.length > 1 && payload.azp !== clientId)
    || (payload.azp !== undefined && payload.azp !== clientId) || typeof payload.exp !== "number" || payload.exp * 1000 < now - 5_000
    || typeof payload.iat !== "number" || typeof payload.sub !== "string" || !payload.sub || (nonce !== undefined && payload.nonce !== nonce)) {
    throw invalid();
  }
  return { subject: payload.sub, ...(typeof payload.email === "string" ? { email: payload.email } : {}), ...(typeof payload.name === "string" ? { name: payload.name } : {}) };
}

/** The models this account may use, in OpenAI's order. */
export async function listChatGPTModels(accessToken: string): Promise<ChatGPTModel[]> {
  const { response, data } = await fetchJson(`${CHATGPT_RESOURCE}/models`, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  const models = (data as { models?: unknown } | undefined)?.models;
  if (!response.ok || !Array.isArray(models)) throw new ChatGPTSignInError("network");
  return models.flatMap(model => {
    if (!model || typeof model !== "object" || model.visibility !== "list" || typeof model.slug !== "string" || !model.slug.trim()) return [];
    const levels = Array.isArray(model.supported_reasoning_levels) ? model.supported_reasoning_levels.map((level: { effort?: unknown }) => level?.effort) : [];
    const efforts = chatGPTEfforts.filter(effort => levels.includes(effort));
    return [{
      slug: model.slug.slice(0, 120),
      displayName: typeof model.display_name === "string" && model.display_name.trim() ? model.display_name.slice(0, 120) : model.slug.slice(0, 120),
      efforts,
      ...(isEffort(model.default_reasoning_level) && efforts.includes(model.default_reasoning_level) ? { defaultEffort: model.default_reasoning_level } : {}),
    }];
  });
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

/** A new sign-in (or a sign-in again for `existing`), and the OpenAI page to send the browser to. */
export async function beginChatGPTSignIn(port: string, returnTo: string, existing?: { providerId: string; registration: ChatGPTRegistration; idToken?: string }): Promise<{ pending: PendingSignIn; url: string }> {
  const pending: PendingSignIn = {
    state: randomValue(), nonce: randomValue(), verifier: randomValue(), redirectUri: `http://127.0.0.1:${port}${CHATGPT_CALLBACK_PATH}`, returnTo, createdAt: Date.now(),
    ...(existing ? { clientId: existing.registration.clientId, providerId: existing.providerId, ...(existing.registration.email ? { loginHint: existing.registration.email } : {}) } : {}),
  };
  const config = await discovery();
  const url = new URL(config.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: pending.clientId ?? NEW_CLIENT,
    response_type: "code",
    redirect_uri: pending.redirectUri,
    scope: SCOPES,
    resource: CHATGPT_RESOURCE,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
    ext_agent_host_id: chatGPTHostId(),
    ...(pending.clientId ? {} : { agent_name_hint: "LabNest" }),
    ...(pending.loginHint ? { login_hint: pending.loginHint } : {}),
    ...(existing?.idToken ? { id_token_hint: existing.idToken } : {}),
  }).toString();
  return { pending, url: url.toString() };
}

/** OpenAI's answer at the callback, checked against the pending sign-in, exchanged for tokens and the verified account. */
export async function finishChatGPTSignIn(params: URLSearchParams, pending: PendingSignIn | undefined, previous?: ChatGPTRegistration) {
  if (params.has("error")) {
    throw params.get("error") === "access_denied"
      ? new ChatGPTSignInError("access_denied")
      : new ChatGPTSignInError("failed");
  }
  const state = Buffer.from(params.get("state") ?? ""), expected = Buffer.from(pending?.state ?? "");
  if (!pending || params.getAll("state").length !== 1 || state.length !== expected.length || !timingSafeEqual(state, expected)) {
    throw new ChatGPTSignInError("state");
  }
  const code = params.get("code"), returned = params.get("client_id");
  const clientId = returned ?? pending.clientId;
  if (!code || params.getAll("code").length !== 1 || !clientId || clientId === NEW_CLIENT || !/^[A-Za-z0-9_-]{1,200}$/.test(clientId) || (pending.clientId && returned && returned !== pending.clientId)) {
    throw new ChatGPTSignInError("registration");
  }
  let data: Record<string, unknown>;
  try { data = await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: CHATGPT_RESOURCE })); }
  catch (error) {
    if (error instanceof TokenRequestError) throw new ChatGPTSignInError("registration", error.code ?? `HTTP ${error.status}`);
    throw error;
  }
  if (typeof data.scope !== "string" || !data.scope.split(/\s+/).includes(PLAN_SCOPE)) {
    throw new ChatGPTSignInError("plan_scope");
  }
  const { tokens, expiresAt } = tokenFields(data);
  if (!tokens.idToken) throw new ChatGPTSignInError("identity");
  const identity = await verifyIdToken(tokens.idToken, clientId, pending.nonce);
  if (previous && previous.subject !== identity.subject) {
    throw new ChatGPTSignInError("account_mismatch");
  }
  return { registration: { clientId, ...identity } satisfies ChatGPTRegistration, tokens, expiresAt };
}

/**
 * The model and effort to keep once the account's models are listed again: the chosen model while it is still offered,
 * else the first; the effort while that model still takes it, else the model's default. No list keeps both.
 */
export function keptChoice(models: ChatGPTModel[], model: string | null, effort: string | null) {
  if (!models.length) return { defaultModel: model, reasoningEffort: effort };
  const chosen = models.find(entry => entry.slug === model) ?? models[0];
  return { defaultModel: chosen.slug, reasoningEffort: effort && chosen.efforts?.includes(effort as ChatGPTEffort) ? effort : null };
}

/**
 * Saves a finished sign-in as the ChatGPT subscription service (a new one, or the one signed in again) with the account's
 * models, and says whether they could be listed. When no default AI service is chosen yet, this one becomes it; AI stays
 * on or off as it was.
 */
export async function storeChatGPTSignIn(result: Awaited<ReturnType<typeof finishChatGPTSignIn>>, providerId?: string): Promise<boolean> {
  let models: ChatGPTModel[] = [];
  try { models = await listChatGPTModels(result.tokens.accessToken); } catch { /* the service is saved; a model can be chosen after the next sign-in */ }
  const existing = providerId ? await prisma.aIProvider.findUnique({ where: { id: providerId } }) : null;
  const provider = {
    name: `ChatGPT · ${result.registration.email ?? result.registration.name ?? "subscription"}`.slice(0, 80),
    type: "chatgpt_subscription" as const,
    baseUrl: null,
    ...keptChoice(models, existing?.defaultModel ?? null, existing?.reasoningEffort ?? null),
    enabled: true,
    capabilitiesJson: ["text", "structured_output", "vision"],
    apiKeyEncrypted: encryptSecret(JSON.stringify(result.registration)),
  };
  const session = { tokensEncrypted: encryptSecret(JSON.stringify(result.tokens)), expiresAt: result.expiresAt, modelsJson: models };
  await prisma.$transaction(async tx => {
    const saved = existing
      ? await tx.aIProvider.update({ where: { id: existing.id }, data: provider })
      : await tx.aIProvider.create({ data: provider });
    await tx.aIProviderSession.upsert({ where: { providerId: saved.id }, create: { providerId: saved.id, ...session }, update: session });
    const settings = await tx.aISettings.findUnique({ where: { id: "default" } });
    if (!settings) await tx.aISettings.create({ data: { id: "default", defaultProviderId: saved.id } });
    else if (!settings.defaultProviderId) await tx.aISettings.update({ where: { id: "default" }, data: { defaultProviderId: saved.id } });
  });
  return models.length > 0;
}

export function readRegistration(apiKeyEncrypted: string | null): ChatGPTRegistration | undefined {
  if (!isEncryptedSecret(apiKeyEncrypted)) return undefined;
  try {
    const value = JSON.parse(decryptSecret(apiKeyEncrypted)) as ChatGPTRegistration;
    return typeof value.clientId === "string" && typeof value.subject === "string" ? value : undefined;
  } catch { return undefined; }
}

export function readTokens(tokensEncrypted: string): ChatGPTTokens | undefined {
  try {
    const value = JSON.parse(decryptSecret(tokensEncrypted)) as ChatGPTTokens;
    return typeof value.accessToken === "string" && typeof value.refreshToken === "string" ? value : undefined;
  } catch { return undefined; }
}

// ---------------------------------------------------------------------------
// Using and ending a sign-in
// ---------------------------------------------------------------------------

const reauthorizationCodes = ["invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"];

/**
 * The service's current access token, refreshed first when it is about to run out. Refreshes are serialized on the
 * session row, since every refresh rotates the refresh token. A refresh OpenAI refuses for good ends the sign-in (the
 * registration stays for the next one); a network failure keeps it.
 */
export async function chatGPTAccessToken(providerId: string): Promise<string> {
  const current = await prisma.aIProviderSession.findUnique({ where: { providerId } });
  const currentTokens = current && readTokens(current.tokensEncrypted);
  if (!current || !currentTokens) throw signInAgain();
  if (current.expiresAt.getTime() > Date.now() + REFRESH_MARGIN_MS) return currentTokens.accessToken;

  const outcome = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "providerId" FROM "AIProviderSession" WHERE "providerId" = ${providerId} FOR UPDATE`;
    const session = await tx.aIProviderSession.findUnique({ where: { providerId }, include: { provider: true } });
    const tokens = session && readTokens(session.tokensEncrypted);
    const registration = session && readRegistration(session.provider.apiKeyEncrypted);
    if (!session || !tokens || !registration) return { ended: true as const };
    const expiresAt = session.expiresAt.getTime();
    // Another request refreshed while this one waited, or OpenAI asked to wait before refreshing a token still valid.
    if (expiresAt > Date.now() + REFRESH_MARGIN_MS || (tokens.earliestRefreshAt && tokens.earliestRefreshAt > Date.now() && expiresAt > Date.now())) return { accessToken: tokens.accessToken };
    let data: Record<string, unknown>;
    try { data = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", client_id: registration.clientId, refresh_token: tokens.refreshToken, resource: CHATGPT_RESOURCE })); }
    catch (error) {
      if (error instanceof TokenRequestError && error.code && reauthorizationCodes.includes(error.code)) {
        await tx.aIProviderSession.delete({ where: { providerId } });
        return { ended: true as const };
      }
      if (error instanceof TokenRequestError && error.code === "invalid_client") throw new AIProviderError("ChatGPT no longer accepts this LabNest registration; sign out of ChatGPT on the AI page and sign in again.", 401, "chatgpt_sign_in");
      throw new AIProviderError("LabNest could not renew the ChatGPT sign-in; check the server’s network and try again.", 502, "network");
    }
    const refreshed = tokenFields(data, tokens.scopes);
    // The old refresh token is spent: store the new pair before anything else can fail.
    await tx.aIProviderSession.update({ where: { providerId }, data: { tokensEncrypted: encryptSecret(JSON.stringify({ ...refreshed.tokens, idToken: refreshed.tokens.idToken ?? tokens.idToken })), expiresAt: refreshed.expiresAt } });
    return { accessToken: refreshed.tokens.accessToken, idToken: refreshed.tokens.idToken, registration };
  }, { timeout: 45_000, maxWait: 30_000 });

  if ("ended" in outcome) throw signInAgain();
  if (outcome.idToken && outcome.registration) {
    let subject: string | undefined;
    try { subject = (await verifyIdToken(outcome.idToken, outcome.registration.clientId)).subject; }
    catch (error) { if (!(error instanceof ChatGPTSignInError && error.reason === "network")) subject = ""; }
    if (subject !== undefined && subject !== outcome.registration.subject) {
      await prisma.aIProviderSession.deleteMany({ where: { providerId } });
      throw signInAgain();
    }
  }
  return outcome.accessToken;
}

/** Revokes the refresh token at OpenAI; true when OpenAI confirmed it. The local sign-in is removed either way by the caller. */
export async function revokeChatGPTSignIn(providerId: string): Promise<boolean> {
  const session = await prisma.aIProviderSession.findUnique({ where: { providerId }, include: { provider: true } });
  const tokens = session && readTokens(session.tokensEncrypted);
  const registration = session && readRegistration(session.provider.apiKeyEncrypted);
  if (!session || !tokens || !registration) return true;
  try {
    const config = await discovery();
    if (!config.revocation_endpoint) return false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { response } = await fetchJson(config.revocation_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refreshToken, token_type_hint: "refresh_token", client_id: registration.clientId }) }, 10_000);
      if (response.status === 200) return true;
      if (response.status < 500) return false;
    }
  } catch { /* unconfirmed */ }
  return false;
}
