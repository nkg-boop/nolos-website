const crypto = require('crypto');

const COOKIE_NAME = 'nolos_admin';
const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour, matching the previous express-session config.

// IMPORTANT TRADEOFF, stated plainly rather than left implicit:
//
// The previous version of this app used express-session, which keeps
// session state on the server and can be immediately and completely
// invalidated by calling session.destroy(). That relies on a long-lived
// server process with shared memory — something serverless functions on
// Vercel don't have (each invocation can be a fresh, isolated instance).
//
// This version instead uses a stateless, signed cookie: the cookie itself
// carries "this is a valid admin session, issued at time X" as a claim,
// cryptographically signed so it can't be forged or tampered with. This
// works correctly across serverless invocations with no shared server
// memory required, but it means the *server* has nothing to actively
// revoke. "Logging out" clears the cookie from the browser, which is
// effective against casual reuse, but if a signed cookie value were
// somehow captured before logout, it stays cryptographically valid until
// its expiry (max 1 hour) even after the user who issued it logs out —
// there's no server-side blocklist checked on each request.
//
// For a small business admin panel viewing enquiry data, a short (1 hour)
// expiry keeps this exposure window small. If a stronger guarantee is
// ever needed (immediate, provable revocation), the fix is to check each
// cookie against a small "revoked" list held in Redis — a few lines of
// code using the same Redis connection already set up in lib/redis.js —
// rather than a larger architectural change.

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ` +
        'and add it as an environment variable in your Vercel project settings.'
    );
  }
  return secret;
}

function sign(payloadBase64) {
  const secret = getSessionSecret();
  return crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');
}

// Creates a signed cookie value from a plain object. The object should
// contain no sensitive data beyond "this is an admin session" — it is
// base64-encoded, not encrypted, so it is readable (though not forgeable)
// by anyone who has the cookie. That's fine here, since the payload only
// ever contains { isAdmin: true, issuedAt: <timestamp> }, nothing secret.
function createSessionCookie(payload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

// Verifies a cookie value and returns the parsed payload, or null if the
// cookie is missing, malformed, expired, or has an invalid signature.
function verifySessionCookie(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return null;
  }

  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payloadBase64, providedSignature] = parts;

  let expectedSignature;
  try {
    expectedSignature = sign(payloadBase64);
  } catch (err) {
    return null; // SESSION_SECRET missing — fail closed, not open.
  }

  // Constant-time comparison — this is the actual security-relevant check
  // in this whole module, so it must not use === (which short-circuits on
  // the first differing byte and leaks timing information about how much
  // of the signature was correct).
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
  } catch (err) {
    return null;
  }

  const ageSeconds = (Date.now() - payload.issuedAt) / 1000;
  if (ageSeconds > SESSION_MAX_AGE_SECONDS) {
    return null; // Expired.
  }

  return payload;
}

// Parses the raw Cookie request header into a { name: value } object.
// Vercel's Node runtime doesn't include a cookie parser by default the
// way Express did with cookie-parser as middleware, so this is done
// directly here rather than pulling in another dependency for one job.
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });
  return cookies;
}

function buildSetCookieHeader(value, { clear = false } = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const attributes = [
    `${COOKIE_NAME}=${clear ? '' : value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    clear ? 'Max-Age=0' : `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  // Secure requires HTTPS to work at all — browsers silently drop Secure
  // cookies over plain http://, which is why this is conditional rather
  // than always-on (it would break local development over localhost:3000
  // otherwise, since that's typically plain HTTP).
  if (isProduction) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  verifySessionCookie,
  parseCookies,
  buildSetCookieHeader,
};
