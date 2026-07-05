const { verifySessionCookie, parseCookies, COOKIE_NAME } = require('./auth');

// Wraps a handler so it only runs if the request carries a valid, signed
// admin session cookie. This replaces the Express requireAdmin middleware
// pattern — Vercel serverless functions don't chain middleware the way an
// Express app does, since each file under /api is its own independent
// function, so "requiring auth" means wrapping the handler function itself.
function withAdminAuth(handler) {
  return async (req, res) => {
    // req.cookies is provided by Vercel's Node.js runtime helpers, but
    // parse the raw header too as a fallback — being defensive here costs
    // nothing and protects against a runtime/helper behavior change.
    const cookies = req.cookies || parseCookies(req.headers.cookie);
    const session = verifySessionCookie(cookies[COOKIE_NAME]);

    if (!session || session.isAdmin !== true) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    return handler(req, res);
  };
}

module.exports = { withAdminAuth };
