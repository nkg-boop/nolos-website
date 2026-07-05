const crypto = require('crypto');
const { Ratelimit } = require('@upstash/ratelimit');
const { getRedis } = require('../lib/redis');
const { saveEnquiry, getAllEnquiries } = require('../lib/db');
const { withAdminAuth } = require('../lib/withAdminAuth');

const NOLOS_WHATSAPP_NUMBER = '27720971423';

const SERVICE_LABELS = {
  stayIn: 'Stay-in nanny placement',
  dayNanny: 'Day nanny placement',
  afterSchool: 'After-school nanny placement',
  sleepover: 'Sleepover / weekend care',
  holiday: 'Public holiday cover',
  fullDay: 'Day nanny placement',
};

// In-memory rate limiting (the previous express-rate-limit approach)
// doesn't work correctly across serverless invocations, since each
// invocation can be a fresh, isolated instance with no shared memory of
// previous requests. This uses the same Redis instance already set up
// for storage to track request counts instead, so limits are enforced
// correctly regardless of which serverless instance handles a request.
let enquiryRateLimiter = null;
function getEnquiryRateLimiter() {
  if (!enquiryRateLimiter) {
    enquiryRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 requests per 15 minutes, matching the previous config.
      prefix: 'ratelimit:enquiries',
    });
  }
  return enquiryRateLimiter;
}

function isNonEmptyString(value, maxLen) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLen;
}

function isPlausiblePhone(value) {
  if (typeof value !== 'string') return false;
  const digitsOnly = value.replace(/[\s\-()]/g, '');
  return /^\+?\d{9,13}$/.test(digitsOnly);
}

function isPlausibleEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateEnquiry(body) {
  const errors = [];

  if (!isNonEmptyString(body.name, 100)) {
    errors.push('Please enter your name.');
  }
  if (!isPlausiblePhone(body.phone)) {
    errors.push('Please enter a valid phone number.');
  }
  if (body.email && !isPlausibleEmail(body.email)) {
    errors.push("That email address doesn't look right.");
  }
  if (!Array.isArray(body.services) || body.services.length === 0) {
    errors.push('Please select at least one type of care.');
  } else {
    const invalidServices = body.services.filter((s) => !SERVICE_LABELS[s]);
    if (invalidServices.length > 0) {
      errors.push('One or more selected services are not recognized.');
    }
  }
  if (body.message && !isNonEmptyString(body.message, 1000)) {
    errors.push('Message is too long — please keep it under 1000 characters.');
  }

  return errors;
}

function buildWhatsAppMessage(enquiry) {
  const serviceList = enquiry.services.map((s) => SERVICE_LABELS[s]).join(', ');
  const lines = [
    `New consultation request via the Nolos Nanny Placement website`,
    `Name: ${enquiry.name}`,
    `Phone: ${enquiry.phone}`,
    enquiry.email ? `Email: ${enquiry.email}` : null,
    `Care needed: ${serviceList}`,
    enquiry.message ? `Notes: ${enquiry.message}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

// Best-effort client identifier for rate limiting. x-forwarded-for can be
// spoofed by a client directly, but Vercel's edge network sets this header
// itself based on the real connecting IP before the request reaches this
// function, so in Vercel's environment specifically this is trustworthy —
// it isn't user-suppliable in the way it would be on a self-hosted server
// sitting directly on the open internet without a trusted proxy in front.
function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

async function handlePost(req, res) {
  const identifier = getClientIdentifier(req);
  const { success } = await getEnquiryRateLimiter().limit(identifier);
  if (!success) {
    return res.status(429).json({ error: 'Too many enquiries from this connection. Please try again later or call us directly.' });
  }

  const errors = validateEnquiry(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const enquiry = {
    id: crypto.randomUUID(),
    name: req.body.name.trim(),
    phone: req.body.phone.trim(),
    email: req.body.email ? req.body.email.trim() : null,
    services: req.body.services,
    message: req.body.message ? req.body.message.trim() : null,
    submittedAt: new Date().toISOString(),
  };

  try {
    await saveEnquiry(enquiry);
  } catch (err) {
    console.error('Failed to save enquiry:', err);
    return res.status(500).json({ errors: ['We could not save your enquiry. Please try again or contact us directly.'] });
  }

  const whatsappText = encodeURIComponent(buildWhatsAppMessage(enquiry));
  const whatsappUrl = `https://wa.me/${NOLOS_WHATSAPP_NUMBER}?text=${whatsappText}`;

  return res.status(201).json({ id: enquiry.id, whatsappUrl });
}

async function handleGet(req, res) {
  try {
    const enquiries = await getAllEnquiries();
    return res.status(200).json({ enquiries });
  } catch (err) {
    console.error('Failed to load enquiries:', err);
    return res.status(500).json({ error: 'Could not load enquiries.' });
  }
}

// GET is wrapped in withAdminAuth (requires a valid signed session cookie);
// POST is public, since anyone submitting the contact form isn't logged in.
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  if (req.method === 'GET') {
    return withAdminAuth(handleGet)(req, res);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
};
