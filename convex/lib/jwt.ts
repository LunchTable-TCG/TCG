import { SignJWT, importPKCS8 } from "jose";

const JWT_ALGORITHM = "ES256" as const;

interface PublicJwk {
  [key: string]: unknown;
  kid?: string;
}

interface ActorAuthTokenInput {
  actorType: "bot" | "human";
  email: string;
  userId: string;
  username: string;
  walletAddress?: `0x${string}` | null;
}

let cachedPrivateKeyPromise: Promise<CryptoKey> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireMultilineEnv(name: string): string {
  return requireEnv(name).replace(/\\n/g, "\n");
}

function getJwtSettings() {
  return {
    audience: requireEnv("JWT_AUDIENCE"),
    issuer: requireEnv("JWT_ISSUER"),
    keyId: process.env.JWT_KEY_ID,
    publicJwkJson: requireEnv("JWT_PUBLIC_JWK_JSON"),
  };
}

async function getPrivateKey(): Promise<CryptoKey> {
  if (!cachedPrivateKeyPromise) {
    cachedPrivateKeyPromise = importPKCS8(
      requireMultilineEnv("JWT_PRIVATE_KEY_PKCS8"),
      JWT_ALGORITHM,
    );
  }
  return cachedPrivateKeyPromise;
}

export function buildJwksDataUri(): string {
  const settings = getJwtSettings();
  let parsed: unknown;
  try {
    parsed = JSON.parse(settings.publicJwkJson);
  } catch {
    throw new Error("JWT public JWK must be a JSON object");
  }
  if (!isPublicJwk(parsed)) {
    throw new Error("JWT public JWK must be a JSON object");
  }
  const jwk = parsed;
  if (settings.keyId && !jwk.kid) {
    jwk.kid = settings.keyId;
  }
  return `data:application/json,${encodeURIComponent(
    JSON.stringify({ keys: [jwk] }),
  )}`;
}

export async function issueActorAuthToken(
  input: ActorAuthTokenInput,
): Promise<string> {
  const settings = getJwtSettings();
  const privateKey = await getPrivateKey();
  const jwt = new SignJWT({
    actor_type: input.actorType,
    email: input.email,
    preferred_username: input.username,
    ...(input.walletAddress
      ? {
          chain_id: 56,
          wallet_address: input.walletAddress,
        }
      : {}),
  })
    .setProtectedHeader({
      alg: JWT_ALGORITHM,
      ...(settings.keyId ? { kid: settings.keyId } : {}),
    })
    .setAudience(settings.audience)
    .setExpirationTime("7d")
    .setIssuedAt()
    .setIssuer(settings.issuer)
    .setSubject(`user:${input.userId}`);

  return jwt.sign(privateKey);
}

export async function issueWalletAuthToken(
  input: Omit<ActorAuthTokenInput, "actorType"> & {
    walletAddress: `0x${string}`;
  },
) {
  return issueActorAuthToken({
    ...input,
    actorType: "human",
  });
}

function isPublicJwk(value: unknown): value is PublicJwk {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
