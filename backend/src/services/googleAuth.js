const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let cachedKeys = {
  keysById: new Map(),
  expiresAt: 0,
};

function parseMaxAgeSeconds(cacheControl) {
  const match = cacheControl && /max-age=(\d+)/i.exec(cacheControl);
  return match ? parseInt(match[1], 10) : 3600;
}

/**
 * Fetches and caches Google's OAuth2 public signing keys (JWKS).
 * @param {boolean} forceRefresh Bypass cache when encountering an unknown key id.
 */
async function fetchGoogleKeys(forceRefresh = false) {
  if (!forceRefresh && cachedKeys.expiresAt > Date.now() && cachedKeys.keysById.size > 0) {
    return cachedKeys.keysById;
  }

  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google signing keys (${res.status})`);
  }

  const body = await res.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  const keysById = new Map();

  for (const jwk of keys) {
    if (jwk?.kid && jwk?.kty === 'RSA') {
      keysById.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    }
  }

  if (keysById.size === 0) {
    throw new Error('No valid Google RSA signing keys found');
  }

  const maxAgeMs = parseMaxAgeSeconds(res.headers.get('cache-control')) * 1000;
  cachedKeys = {
    keysById,
    expiresAt: Date.now() + maxAgeMs,
  };

  return keysById;
}

/**
 * Verifies a Google Identity Services ID token (JWT) against Google's JWKS and client id.
 * @param {string} idToken Credential JWT returned by Google Sign-In.
 * @param {string} [clientId] Expected Google OAuth Client ID.
 * @returns {Promise<{ googleId: string, email: string, name: string }>}
 */
async function verifyGoogleIdToken(idToken, clientId = process.env.GOOGLE_CLIENT_ID) {
  if (!clientId) {
    const err = new Error('Google Sign-In is not configured on the server');
    err.status = 503;
    throw err;
  }
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Google credential is required');
    err.status = 400;
    throw err;
  }

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;

  if (!kid || alg !== 'RS256') {
    const err = new Error('Invalid Google token header');
    err.status = 401;
    throw err;
  }

  let keysById = await fetchGoogleKeys(false);
  let publicKey = keysById.get(kid);

  if (!publicKey) {
    // Key may have rotated recently; refresh once before rejecting.
    keysById = await fetchGoogleKeys(true);
    publicKey = keysById.get(kid);
  }

  if (!publicKey) {
    const err = new Error('Unknown Google signing key');
    err.status = 401;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
    });
  } catch {
    const err = new Error('Invalid or expired Google credential');
    err.status = 401;
    throw err;
  }

  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    const err = new Error('Google account email is missing or unverified');
    err.status = 401;
    throw err;
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: (payload.name || payload.email.split('@')[0]).trim(),
  };
}

function resetGoogleKeyCache() {
  cachedKeys = { keysById: new Map(), expiresAt: 0 };
}

module.exports = {
  verifyGoogleIdToken,
  resetGoogleKeyCache,
};
