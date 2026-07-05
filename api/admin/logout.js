const { buildSetCookieHeader } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  // Clears the cookie from the browser. As noted in lib/auth.js, this is a
  // client-side clear, not a server-side revocation — there is no session
  // store to delete from, since the cookie itself is the entire session
  // state. See lib/auth.js for the full reasoning and tradeoff.
  res.setHeader('Set-Cookie', buildSetCookieHeader(null, { clear: true }));
  return res.status(200).json({ success: true });
};
