# Nolos Nanny Placement — website

A multi-page site with a serverless backend for Nolos Nanny Placement, a division of Nolos Safe Kids Care (Pty) Ltd, a Tembisa-based nanny agency. Built to deploy on **Vercel**, using Vercel serverless functions and Upstash Redis (via the Vercel Marketplace integration) for storage.

**Legal name:** Nolos Safe Kids Care (Pty) Ltd
**Trading name:** Nolos Nanny Placement

## What changed in this version

This version was restructured specifically for Vercel deployment, plus a visual polish pass. If you're comparing against an earlier version of this project, the important structural changes are:

- **The old Express server (`server.js`, `routes/`, `middleware/`) has been removed.** Vercel serverless functions don't run a single long-lived server process the way Express does — each file under `/api` is its own independent function, invoked fresh (or from a warm instance with no guaranteed shared memory) per request. The backend has been rewritten around that model rather than adapted awkwardly on top of it.
- **Storage moved from a local JSON file to Upstash Redis.** Serverless functions have no persistent local disk between invocations — anything written to a file during one request is gone by the next. Enquiry data is still encrypted at rest (AES-256-GCM, same as before), just stored in Redis instead of a file.
- **Admin authentication moved from server-side sessions to a signed, stateless cookie.** Express-session relied on server memory to look up "is this session logged in?" — serverless functions don't have that shared memory. The replacement is a cookie that carries its own cryptographic proof of validity (HMAC-signed), verified fresh on every request. **Read the tradeoff this introduces** in `lib/auth.js` — the short version: there's no way to instantly and provably revoke a session server-side anymore, only a short (1 hour) expiry window. This is a reasonable tradeoff for a small business admin panel, but it's a real behavior change worth knowing about.
- **Rate limiting moved from in-memory (`express-rate-limit`) to Redis-backed (`@upstash/ratelimit`).** In-memory counters don't survive serverless cold starts or work across multiple concurrent instances — the counter would silently reset far more often than intended. The Redis-backed version enforces limits correctly regardless of which instance handles a given request.
- **Buttons, cards, and forms got a genuine interaction pass** — hover lift with shadow growth, a distinct (slightly quicker) press-down feel, scroll-triggered reveals on section content, and consistent easing across all of it. Details below.

## Before you deploy: two things only you can do

**1. Install the Upstash Redis integration.**
This project's storage and rate limiting depend on Redis. Note that Vercel's own "Vercel KV" product was deprecated and migrated to Upstash in December 2024 — new projects go through the Marketplace integration, not a "KV" tab in the dashboard.

- In your Vercel project dashboard, go to the **Storage** tab (or **Integrations** → **Browse Marketplace**).
- Find and install **Upstash** (Redis).
- Connect it to this project. This automatically sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as environment variables — you should not need to type these in by hand.

**2. Set the remaining environment variables.**
In Project Settings → Environment Variables, add:

| Variable | How to generate it |
|---|---|
| `SESSION_SECRET` | `npm run gen-secret` |
| `ENQUIRY_ENCRYPTION_KEY` | `npm run gen-secret` (a **different** value than `SESSION_SECRET` — see `.env.example` for why) |
| `ADMIN_USERNAME` | Whatever you'd like staff to log in with |
| `ADMIN_PASSWORD_HASH` | `npm run gen-password-hash` (prompts interactively, never writes the plaintext password anywhere) |

See `.env.example` for full detail on each of these.

## Local development

```bash
npm install
npm install -g vercel   # if you don't already have the Vercel CLI
vercel link              # links this folder to your Vercel project
vercel dev                # starts local dev, auto-pulling your Development env vars
```

`vercel dev` emulates the serverless environment (routing `/api/*` requests to the matching function file) and automatically downloads your project's Development environment variables — you generally don't need to run `vercel env pull` separately when using `vercel dev`.

Then visit `http://localhost:3000` for the public site, or `http://localhost:3000/admin.html` to log in and view enquiries.

**Immediately after your first `npm install`, run `npm run audit`.** This checks installed dependencies (including transitive ones) against known vulnerability databases — something that couldn't be checked from the environment this code was written in, since it has no network access to run a real install.

## Deploying

Push to a Git repository connected to your Vercel project (or run `vercel --prod` from the CLI). Vercel builds and deploys automatically; no build step is required for this project beyond installing dependencies, since it's static HTML/CSS/JS plus serverless functions.

## Project structure

```
nolos-website/
├── api/
│   ├── enquiries.js         # POST (public, rate-limited) + GET (admin-only) for enquiries
│   └── admin/
│       ├── login.js          # Verifies credentials, issues a signed session cookie
│       ├── logout.js         # Clears the session cookie
│       └── session.js        # Checks whether the current cookie is a valid admin session
├── lib/
│   ├── redis.js               # Shared Upstash Redis client
│   ├── crypto.js               # AES-256-GCM encrypt/decrypt for enquiry data
│   ├── db.js                    # Redis-backed encrypted datastore (one key per enquiry + an index set)
│   ├── auth.js                  # Signed, stateless session cookie helpers — READ THE TRADEOFF NOTED HERE
│   └── withAdminAuth.js          # Wraps a handler to require a valid admin session
├── scripts/
│   └── hash-password.js          # Interactive helper to generate ADMIN_PASSWORD_HASH
├── public/
│   ├── index.html, about.html, services.html, testimonials.html, contact.html, privacy.html, admin.html, 404.html
│   ├── css/style.css              # Shared design tokens, styles, and interaction/animation system
│   └── js/
│       ├── main.js                 # Mobile nav toggle
│       ├── contact-form.js         # Form submission + WhatsApp handoff
│       ├── admin.js                 # Admin login + enquiry viewer (escapes all rendered data — see below)
│       └── reveal.js                 # Scroll-reveal animations (progressive enhancement, see below)
├── vercel.json                # Explicit security headers (CSP, clickjacking, MIME-sniffing protections, etc.)
├── .env.example                # Documents required environment variables
└── package.json
```

## The interaction/polish pass

Buttons, service cards, the vetting trust-trail, and the testimonial card now have deliberate hover and press states — a lift with a growing shadow on hover, a quicker, more compressed feel on press, and a single consistent easing curve (`--ease-considered` in `style.css`) used everywhere something moves, rather than several different animation feels scattered across the site.

Major sections fade and rise into view on scroll (`data-reveal` attributes + `reveal.js`), but this is built as a genuine progressive enhancement, not a hide-and-hope-JS-arrives pattern:

- Content is visible by default in the CSS. Only once JS confirms it's running **and** the browser supports `IntersectionObserver` does a `js-reveal-enabled` class get added, which is what actually triggers the hide-then-reveal behavior.
- This means a failed script load, JS disabled, or an old browser all fail safe to "content is simply shown," never to "content is stuck invisible."
- `prefers-reduced-motion: reduce` is checked both in CSS (existing) and explicitly in JS (new) — a reduced-motion user gets everything shown immediately with no animation, not just a faster version of the same motion.
- The contact page's form section deliberately has **no** scroll-reveal — a form is the entire point of that page, and having it fade in (with a layout shift as it does) while someone is trying to interact with it would work against the page's purpose rather than polish it.

## Live verification status

- **Security headers: confirmed A+** via securityheaders.com against the live deployment (`https://nolos-website.vercel.app/`). This confirms `vercel.json`'s explicit header configuration is actually deploying and taking effect — worth stating plainly since an earlier version of this document incorrectly claimed Vercel applies HSTS automatically (it doesn't; see the correction under "Security posture" below). An A+ here covers HTTP response headers specifically — CSP, HSTS, clickjacking/MIME-sniffing protection, referrer policy. It does not cover TLS/certificate configuration (that's what SSL Labs tests) or anything below the header layer (auth behavior, encryption correctness, dependency vulnerabilities) — those remain separately worth checking, per the "still a genuine gap" list below.
- **Mobile responsiveness: fixed a real, concrete bug.** Several pages (`about.html`, `contact.html`, `testimonials.html`) previously defined two-column layouts as inline styles with no mobile breakpoint at all — on a phone, these squeezed both columns into unusably narrow strips instead of stacking to one column. This was very likely the main cause of "mobile doesn't look as good as desktop." Fixed by extracting these into proper CSS classes (`.split-grid` and variants, `.contact-teaser`) with real mobile behavior, plus a genuine two-tier responsive system (a tablet tier and a dedicated phone tier at 480px) replacing what was previously one flat breakpoint that left small phones inheriting tablet-sized spacing. See "Mobile responsiveness pass" below for full detail.

## Mobile responsiveness pass

**The core bug:** three pages had two-column grids defined as inline `style="display: grid; grid-template-columns: ..."` attributes directly in the HTML, with no responsive fallback at all. Inline styles can't respond to media queries without extra hacks — so these columns stayed side-by-side at every viewport width, squeezing into unusably narrow strips on phones. This was likely the single biggest contributor to a worse mobile experience. Fixed by moving this layout into real CSS classes (`.split-grid`, `.split-grid--form`, `.split-grid--cards`, `.contact-teaser`) that a media query can actually target.

**A related, sneakier version of the same bug:** two `.card` elements (the contact form card, the admin login card) had inline `style="padding: ..."` overrides. Inline styles have higher CSS specificity than a class selector, so even after adding a phone-tier rule reducing `.card` padding on small screens, these two specific cards would have silently ignored it — the mobile padding reduction would have looked correct in the stylesheet but done nothing on these two elements. Fixed the same way: extracted into `.card--form` and `.card--login` modifier classes that the media query can reach.

**The responsive system itself** went from one flat breakpoint (760px, covering everything from tablets down to the smallest phones with identical spacing) to two tiers: a tablet tier at 760px (mostly unchanged — nav collapses, multi-column layouts go to one column) and a genuine phone tier at 480px that actually reduces container padding, section spacing, heading size, and card padding, rather than reusing values sized for a much wider screen.

**The mobile nav dropdown** (`public/js/main.js`) previously positioned itself using hardcoded pixel guesses at the header height and container padding (`top: 64px`, `right: 24px`). Once container padding became responsive (16px on phones vs. 24px before), this hardcoded guess would have silently misaligned the dropdown from the button that opens it. Rewritten to compute its position from the toggle button's actual measured location instead, plus now closes when a nav link is clicked and re-positions on resize/rotation — neither of which the original did.

## Security posture

This carries forward the security work from the previous (Express-based) version, adapted for the serverless environment:

- Enquiry data is encrypted at rest (AES-256-GCM) regardless of whether it's sitting in a file or in Redis — the encryption key lives in an environment variable, never in code or alongside the data itself.
- The admin enquiry list requires a valid, signed session cookie (httpOnly, Secure in production, SameSite=Strict), verified via constant-time comparison (`crypto.timingSafeEqual`) to avoid timing side-channels.
- Login attempts are rate-limited more strictly (5 per 15 min) than ordinary enquiry submissions (10 per 15 min), since login is the endpoint worth actually trying to brute-force.
- Enquiry data rendered in the admin dashboard is HTML-escaped before display (`public/js/admin.js`) — enquiry names/phones/messages come from anonymous public visitors with no sanitization on the way in, so without escaping, a submitted name containing a script tag could execute in the admin's browser (stored XSS), which would undermine the login system entirely regardless of how well-built the auth itself is.
- Explicit security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are set in `vercel.json` for every route. **Correction from an earlier version of this document:** it previously stated that Vercel applies HSTS automatically. That was wrong — Vercel's own current documentation states plainly that Vercel does not add security headers by default, including HSTS. `vercel.json` is not a redundant backup on top of platform defaults; it is the only reason any of these headers exist on this site at all. If headers ever look wrong on a live scan, check `vercel.json` is being deployed and picked up correctly before assuming the platform is compensating for anything missing from it.

### What's still a genuine gap, and why

- **No live TLS/HTTPS scan has been run, because there is no live deployment from this environment.** Once deployed, run the site through [Mozilla Observatory](https://observatory.mozilla.org/) and [SSL Labs](https://www.ssllabs.com/ssltest/) to verify the actual live header and certificate configuration matches what's configured here.
- **`npm audit` has not been run**, for the same reason as before: this environment has no network access to perform a real `npm install`. Run it yourself immediately after your first install, and periodically afterward — this genuinely cannot be skipped for a site handling children's information. `@upstash/redis` and `@upstash/ratelimit` were checked individually against public sources as of this update (pinned at `1.38.0` and `2.0.8` respectively, both current as of the check), but that check did not and could not cover the deeper transitive dependency tree.
- **Session revocation is time-based, not instant**, per the auth model change described above. See `lib/auth.js` for the full reasoning; the practical upshot is a maximum 1-hour exposure window rather than a "logout" that provably kills the session the instant it's clicked.
- **`x-forwarded-for` is trusted for rate-limiting identification**, which is safe specifically because Vercel's edge network sets this header itself based on the real connecting IP before your function ever sees the request — this would NOT be a safe assumption on a different host where a client could set this header directly.
- **This has not been run end-to-end** in a live serverless environment, because this development environment has no network access to install dependencies or run `vercel dev` against real infrastructure. Every route has been traced by hand (frontend fetch targets against backend route files and mount paths, checkbox values against validation keys, HTML tag balance, JS syntax across every file) — but "traced by hand" is not the same guarantee as "actually run." Test thoroughly in a Vercel preview deployment before pointing real traffic at this.
- **The admin account is a single username/password**, with no per-staff accounts, no password reset flow, and no audit log of who viewed what. Reasonable for a small agency; worth revisiting if that changes.

## On cookies

This site sets no cookies at all for ordinary visitors browsing the public pages. The only cookie ever set is the signed admin session cookie, created only after a staff member logs in at `/admin.html`. See `/privacy.html` for the full, specific breakdown of that cookie's flags and contents — written so a visitor can verify each claim themselves using browser dev tools, rather than generic "we value your privacy" language.

No cookie consent banner is included, since nothing is tracked and the one cookie that exists is not a tracking cookie. If analytics or advertising scripts are added later, that is the point at which a real consent banner becomes necessary under POPIA.

## Before this goes live, in rough priority order

1. **Install the Upstash Redis integration and set all required environment variables** (see "Before you deploy" above) — the site will not function without these.
2. **Run `npm run audit`** immediately after your first `npm install`.
3. **Deploy to a Vercel preview first**, test the contact form and admin login thoroughly, then promote to production.
4. **Run Mozilla Observatory and SSL Labs** against the live URL once deployed, and address anything flagged that isn't already covered here.
5. **Replace the placeholder testimonial slots** with real, consented family quotes.
6. **Have the privacy policy reviewed** by someone qualified in POPIA.
7. **Consider a stronger session model** (e.g. a small Redis-backed revocation list, checked against the same Redis instance already in use) if instant, provable session revocation ever becomes a real requirement rather than a theoretical one.
