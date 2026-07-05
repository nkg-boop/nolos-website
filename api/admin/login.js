const bcrypt = require('bcryptjs');
const { Ratelimit } = require('@upstash/ratelimit');
const { getRedis } = require('../../lib/redis');
const { createSessionCookie, buildSetCookieHeader } = require('../../lib/auth');

// Login attempts are rate-limited more strictly than ordinary enquiry
// submissions (5 failed attempts per 15 minutes vs. 10 form submissions),
// since this endpoint is the one actually worth trying to brute-force.
// skipSuccessfulRequests isn't available on @upstash/ratelimit the way it
// was on express-rate-limit, so this only counts the attempt itself —
// meaning a legitimate user who mistypes their password a couple of times
// still consumes attempts. That's an acceptable, common trade for a small
// admin panel; document it rather than let it be a silent behavior change.
let loginRateLimiter = null;
function getLoginRateLimiter() {
  if (!loginRateLimiter) {
    loginRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'ratelimit:admin-login',
    });
  }
  return loginRateLimiter;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  const identifier = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const { success } = await getLoginRateLimiter().limit(identifier);
  if (!success) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
  }

  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUsername || !expectedHash) {
    console.error('ADMIN_USERNAME or ADMIN_PASSWORD_HASH is not set in the environment.');
    return res.status(500).json({ error: 'Admin login is not configured on this server.' });
  }

  // Always run bcrypt.compare regardless of whether the username already
  // matched, so response timing doesn't leak whether a given username is
  // correct (a wrong-username response would otherwise return faster than
  // a wrong-password response, since it would skip the compare entirely).
  const usernameMatches = username === expectedUsername;
  const passwordMatches = await bcrypt.compare(password, expectedHash).catch(() => false);

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const cookieValue = createSessionCookie({ isAdmin: true, issuedAt: Date.now() });
  res.setHeader('Set-Cookie', buildSetCookieHeader(cookieValue));
  return res.status(200).json({ success: true });
};
