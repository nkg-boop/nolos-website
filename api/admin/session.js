const { verifySessionCookie, parseCookies, COOKIE_NAME } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const session = verifySessionCookie(cookies[COOKIE_NAME]);

  return res.status(200).json({ isAdmin: Boolean(session && session.isAdmin) });
};
