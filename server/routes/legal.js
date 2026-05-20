const express = require('express');
const router  = express.Router();

function page(title, subtitle, body, opts = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — SphynxPlay</title>
<meta name="description" content="${subtitle}">
<meta name="robots" content="index, follow">
<link rel="icon" type="image/png" href="/SPHYNY_MOTION_FAV.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #08080A; color: #F0EDE8; line-height: 1.7; }
  a { color: #E61E24; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(8,8,10,.95); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,.06);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; height: 56px;
  }
  .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: #F0EDE8; }
  .nav-logo img { height: 24px; }
  .nav-links { display: flex; gap: 20px; font-size: 12px; color: #9A9096; }
  .nav-links a { color: #9A9096; }
  .nav-links a:hover { color: #F0EDE8; }

  .hero {
    background: linear-gradient(135deg, #1A0404 0%, #08080A 60%);
    border-bottom: 1px solid rgba(255,255,255,.06);
    padding: 48px 24px 40px;
    text-align: center;
  }
  .hero-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #E61E24; margin-bottom: 12px; }
  .hero-title { font-size: clamp(24px, 5vw, 40px); font-weight: 800; color: #F0EDE8; margin-bottom: 10px; line-height: 1.2; }
  .hero-sub { font-size: 14px; color: #9A9096; max-width: 560px; margin: 0 auto; }

  .body-wrap { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }

  .effective { font-size: 11px; color: #504040; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,.06); }

  h2 { font-size: 15px; font-weight: 700; color: #F0EDE8; margin: 28px 0 8px; }
  p, li { font-size: 13px; color: #9A9096; line-height: 1.85; }
  ul, ol { padding-left: 18px; margin: 8px 0; }
  li { margin-bottom: 4px; }
  strong { color: #C8C4C0; font-weight: 600; }
  em { color: #706868; font-style: normal; }

  .highlight-box {
    background: rgba(230,30,36,.07);
    border: 1px solid rgba(230,30,36,.2);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 16px 0;
    font-size: 12px;
    color: #9A9096;
    line-height: 1.7;
  }

  .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
  .contact-card {
    background: #130E0E; border: 1px solid rgba(255,255,255,.07); border-radius: 12px;
    padding: 16px; text-align: center;
  }
  .contact-card .icon { font-size: 24px; margin-bottom: 8px; }
  .contact-card .label { font-size: 12px; font-weight: 600; color: #F0EDE8; margin-bottom: 4px; }
  .contact-card .value { font-size: 11px; color: #9A9096; }

  .nav-pills {
    display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0;
  }
  .nav-pill {
    padding: 6px 14px; border-radius: 100px;
    background: #1A1010; border: 1px solid rgba(255,255,255,.08);
    font-size: 11px; color: #9A9096; font-weight: 500;
  }
  .nav-pill:hover { border-color: #E61E24; color: #E61E24; }
  .nav-pill.active { background: rgba(230,30,36,.12); border-color: rgba(230,30,36,.4); color: #E61E24; }

  .back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: #9A9096; margin-bottom: 24px;
  }
  .back-btn:hover { color: #F0EDE8; }

  .footer {
    border-top: 1px solid rgba(255,255,255,.06);
    padding: 24px;
    text-align: center;
    font-size: 11px;
    color: #504040;
  }
  .footer a { color: #706868; }

  @media (max-width: 600px) {
    .nav-links { display: none; }
    .body-wrap { padding: 32px 16px 60px; }
  }
</style>
</head>
<body>

<nav class="nav">
  <a class="nav-logo" href="/">
    <img src="/SPHYNXPLAY_LOGO_WHITE.png" alt="SphynxPlay" onerror="this.style.display='none'">
    SphynxPlay
  </a>
  <div class="nav-links">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/faq">FAQ</a>
    <a href="/support">Support</a>
  </div>
</nav>

<div class="hero">
  <div class="hero-eyebrow">Sphynx Motion (Pty) Ltd</div>
  <h1 class="hero-title">${title}</h1>
  <p class="hero-sub">${subtitle}</p>
</div>

<div class="body-wrap">
  <a class="back-btn" href="javascript:history.back()">← Back</a>
  ${body}

  <div class="nav-pills" style="margin-top:40px">
    ${[
      ['/privacy','Privacy Policy'],
      ['/terms','Terms of Use'],
      ['/content-policy','Content Policy'],
      ['/soul-token-terms','Soul Token Terms'],
      ['/faq','FAQ'],
      ['/support','Help & Support'],
      ['/delete-account','Delete Account'],
    ].map(([href, label]) => `<a href="${href}" class="nav-pill${opts.active === href ? ' active' : ''}">${label}</a>`).join('')}
  </div>
</div>

<footer class="footer">
  &copy; 2026 Sphynx Motion (Pty) Ltd · South Africa ·
  <a href="mailto:info@sphynxplay.com">info@sphynxplay.com</a>
</footer>

</body>
</html>`;
}

// ── /privacy ──────────────────────────────────────────────────────────────────
router.get('/privacy', (req, res) => res.send(page(
  'Privacy Policy',
  'How SphynxPlay collects, uses, and protects your personal information — POPIA & GDPR compliant.',
  `
  <p class="effective">Effective: 21 April 2026 &nbsp;·&nbsp; Sphynx Motion (Pty) Ltd &nbsp;·&nbsp; Governed by POPIA &amp; GDPR</p>

  <h2>1. Who We Are</h2>
  <p>Sphynx Motion (Pty) Ltd operates the SphynxPlay streaming platform — a vertical African drama service available on iOS, Android, and the web. By using the Service you agree to this policy.</p>

  <h2>2. Information We Collect</h2>
  <p><strong>You provide:</strong> name, email address, password, profile display name, and payment details. We never store card numbers — payments are processed entirely by Apple (App Store) or Google (Play Store).</p>
  <p><strong>Automatically collected:</strong> device type and OS, IP address (approximate location), session tokens, watch history and playback positions, in-app behaviour (clicks, screen views), Soul Token balance and transaction history.</p>

  <h2>3. How We Use Your Data</h2>
  <ul>
    <li>Authenticate and manage your account</li>
    <li>Personalise content recommendations and your For You feed</li>
    <li>Process Soul Token purchases and track balances</li>
    <li>Send transactional emails (password reset, purchase confirmations)</li>
    <li>Detect fraud and enforce our Terms of Use</li>
    <li>Comply with applicable law</li>
  </ul>
  <p>We do <strong>not</strong> sell, rent, or trade your personal information to third parties for marketing purposes.</p>

  <h2>4. Sharing Your Data</h2>
  <p>We share data only with:</p>
  <ul>
    <li><strong>Service providers</strong> — hosting (Supabase), video delivery (Mux), analytics — under strict confidentiality obligations</li>
    <li><strong>Platform stores</strong> — Apple and Google process all in-app purchases under their own privacy policies</li>
    <li><strong>Law enforcement</strong> — when required by valid legal process</li>
    <li><strong>Business successors</strong> — in a merger or acquisition, with 30 days prior notice</li>
  </ul>

  <h2>5. Data Retention</h2>
  <ul>
    <li>Account data: retained until deletion, then purged within 30 days</li>
    <li>Watch history: account lifetime + 6 months</li>
    <li>Payment records: 7 years (statutory requirement)</li>
    <li>Server logs: 12 months</li>
  </ul>

  <h2>6. Security</h2>
  <p>All data is encrypted in transit (TLS 1.2+) and at rest. Access is restricted by role-based controls. We conduct regular security reviews. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.</p>

  <h2>7. Cookies &amp; Tracking</h2>
  <ul>
    <li><strong>Essential:</strong> authentication session cookies — required for the service to function</li>
    <li><strong>Preference:</strong> language and playback settings stored in localStorage</li>
    <li><strong>Analytics:</strong> aggregated, anonymised usage data — no cross-site tracking</li>
  </ul>
  <p>You can clear cookies and localStorage in your browser or device settings at any time.</p>

  <h2>8. Soul Tokens</h2>
  <p>Soul Tokens are a virtual in-app currency with no monetary value. Purchases are processed exclusively via Apple IAP or Google Play Billing — not by SphynxPlay directly. Token balances are stored in your account and are non-refundable except as required by applicable platform policy.</p>

  <h2>9. Children's Privacy</h2>
  <p>The Service is intended for users aged 16 and older. We do not knowingly collect personal data from children under 16. If you believe a child has registered, contact <a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a> for immediate deletion.</p>

  <h2>10. Your Rights</h2>
  <p>Under POPIA (South Africa) and GDPR (where applicable) you have the right to:</p>
  <ul>
    <li>Access a copy of your personal data</li>
    <li>Correct inaccurate information</li>
    <li>Request deletion of your account and data</li>
    <li>Restrict or object to processing</li>
    <li>Data portability</li>
    <li>Opt out of marketing communications</li>
    <li>Lodge a complaint with the Information Regulator of South Africa</li>
  </ul>
  <p>To delete your account: open the app → Profile → Delete Account. Or email <a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a>.</p>

  <h2>11. International Data Transfers</h2>
  <p>Your data may be processed by providers outside South Africa. We ensure appropriate safeguards are in place (standard contractual clauses or equivalent) for all such transfers.</p>

  <h2>12. Policy Changes</h2>
  <p>Material changes will be notified by email and in-app notification at least 14 days before they take effect. Continued use of the Service constitutes acceptance of the updated policy.</p>

  <h2>13. Contact</h2>
  <div class="contact-grid">
    <div class="contact-card"><div class="icon">🔒</div><div class="label">Privacy Officer</div><div class="value"><a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a></div></div>
    <div class="contact-card"><div class="icon">📧</div><div class="label">General</div><div class="value"><a href="mailto:info@sphynxplay.com">info@sphynxplay.com</a></div></div>
    <div class="contact-card"><div class="icon">🏢</div><div class="label">Registered</div><div class="value">Sphynx Motion (Pty) Ltd · South Africa</div></div>
  </div>
  <p>We aim to respond to all privacy requests within 5 business days.</p>
  `,
  { active: '/privacy' }
)));

// ── /terms ────────────────────────────────────────────────────────────────────
router.get('/terms', (req, res) => res.send(page(
  'Terms of Use',
  'The rules and conditions governing your use of the SphynxPlay platform.',
  `
  <p class="effective">Effective: 1 April 2026 &nbsp;·&nbsp; Sphynx Motion (Pty) Ltd &nbsp;·&nbsp; Republic of South Africa</p>

  <h2>1. Acceptance</h2>
  <p>By accessing or using SphynxPlay — on the web, iOS app, or Android app — you agree to be bound by these Terms of Use and our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Service.</p>

  <h2>2. Eligibility</h2>
  <p>You must be at least 16 years old to create an account. Users under 18 must have verifiable parental or guardian consent. By registering, you confirm you meet these requirements.</p>

  <h2>3. Your Account</h2>
  <ul>
    <li>You are solely responsible for all activity under your account</li>
    <li>Keep your password confidential and do not share access</li>
    <li>Notify us immediately at <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> if you suspect unauthorised access</li>
    <li>One account per person — operating multiple accounts may result in suspension</li>
  </ul>

  <h2>4. Subscriptions &amp; Purchases</h2>
  <p>Soul Pass subscriptions and Soul Token purchases are processed exclusively through Apple App Store or Google Play. Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date through your store account settings. We do not issue refunds for unused subscription periods except where required by applicable law or platform policy.</p>

  <h2>5. Soul Tokens</h2>
  <p>Soul Tokens are a virtual in-app currency with no monetary value. They are non-transferable, cannot be exchanged for cash, and are forfeited upon account closure or termination. See the full <a href="/soul-token-terms">Soul Token Terms</a>.</p>

  <h2>6. Intellectual Property</h2>
  <p>All content on SphynxPlay — series, episodes, artwork, logos, software, and UI — is the property of Sphynx Motion (Pty) Ltd or its licensors and is protected by copyright and intellectual property law. You may not reproduce, redistribute, scrape, or resell any content without express written permission.</p>

  <h2>7. Acceptable Use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Use the Service for any unlawful purpose</li>
    <li>Attempt to circumvent geo-restrictions, DRM, or access controls</li>
    <li>Reverse-engineer or decompile the app</li>
    <li>Upload or transmit malware, spam, or harmful code</li>
    <li>Harass, threaten, or impersonate other users or staff</li>
    <li>Use automated tools (bots, scrapers) without written permission</li>
  </ul>

  <h2>8. Creator Content</h2>
  <p>If you apply as a creator and submit content, you grant SphynxPlay a worldwide, royalty-free licence to display, distribute, and promote your content within the platform. You retain ownership but warrant that you hold all necessary rights to the submitted material.</p>

  <h2>9. Termination</h2>
  <p>We reserve the right to suspend or permanently terminate your account at any time for violation of these Terms, without prior notice. You may delete your account at any time via Profile → Delete Account or by emailing <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a>.</p>

  <h2>10. Disclaimer of Warranties</h2>
  <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free access. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

  <h2>11. Governing Law &amp; Disputes</h2>
  <p>These Terms are governed by the laws of the Republic of South Africa. Any disputes will be subject to the exclusive jurisdiction of the courts of South Africa. If you are an EU consumer, you retain the right to bring proceedings in your country of residence.</p>

  <h2>12. Changes to These Terms</h2>
  <p>We may update these Terms from time to time. Material changes will be notified in-app and by email at least 14 days before taking effect. Continued use after changes constitutes acceptance.</p>

  <h2>13. Contact</h2>
  <p>Questions about these Terms? Email <a href="mailto:legal@sphynxplay.com">legal@sphynxplay.com</a> or <a href="mailto:info@sphynxplay.com">info@sphynxplay.com</a>.</p>
  `,
  { active: '/terms' }
)));

// ── /content-policy ───────────────────────────────────────────────────────────
router.get('/content-policy', (req, res) => res.send(page(
  'Content Policy',
  'SphynxPlay\'s standards for the content we publish and the behaviour we expect from creators and viewers.',
  `
  <p class="effective">Effective: 1 April 2026 &nbsp;·&nbsp; Sphynx Motion (Pty) Ltd</p>

  <h2>Our Commitment</h2>
  <p>SphynxPlay is dedicated to authentic African storytelling. We are committed to maintaining a platform that is safe, inclusive, and respectful for all viewers and creators. This policy describes what content we allow, what we prohibit, and how violations are handled.</p>

  <h2>Age Ratings</h2>
  <p>All series on SphynxPlay carry an age rating based on the Film and Publication Board (FPB) classification system:</p>
  <ul>
    <li><strong>All Ages</strong> — Suitable for all viewers</li>
    <li><strong>PG</strong> — Parental guidance recommended</li>
    <li><strong>13</strong> — Suitable for viewers 13 and older</li>
    <li><strong>16</strong> — Suitable for viewers 16 and older</li>
    <li><strong>18</strong> — Adults only. Viewer discretion required.</li>
  </ul>
  <p>Content rated 16+ or 18+ is clearly labelled and may be restricted based on account age verification settings.</p>

  <h2>Prohibited Content</h2>
  <p>SphynxPlay will never publish, and will immediately remove, content that:</p>
  <ul>
    <li>Contains hate speech targeting race, ethnicity, religion, gender, sexual orientation, disability, or nationality</li>
    <li>Depicts or promotes sexual exploitation or non-consensual acts</li>
    <li>Sexualises or endangers minors in any way</li>
    <li>Glorifies or incites real-world violence, terrorism, or self-harm</li>
    <li>Spreads demonstrably false information that could cause harm</li>
    <li>Constitutes harassment, stalking, or targeted abuse of individuals</li>
    <li>Infringes copyright or other intellectual property rights</li>
    <li>Violates applicable law in South Africa or the viewer's jurisdiction</li>
  </ul>

  <h2>Creator Standards</h2>
  <p>All creators who submit content to SphynxPlay agree to the following:</p>
  <ul>
    <li>You hold all necessary rights to submitted content (script, performance, music, footage)</li>
    <li>Content has been reviewed against this policy before submission</li>
    <li>Cast and crew were treated lawfully and paid fairly</li>
    <li>Content does not misrepresent real people or events in harmful ways</li>
  </ul>
  <p>All submissions are reviewed by the SphynxPlay moderation team before going live. We may request edits, apply age ratings, or decline submissions that do not meet our standards.</p>

  <h2>Reporting a Violation</h2>
  <p>If you encounter content that you believe violates this policy:</p>
  <ul>
    <li>Tap the <strong>⋯ menu</strong> on any content card and select <strong>Report</strong></li>
    <li>Or email <a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a> with details</li>
  </ul>
  <p>Our moderation team reviews all reports within 24 hours on business days.</p>

  <h2>Enforcement</h2>
  <p>Violations of this policy may result in:</p>
  <ul>
    <li>Content removal</li>
    <li>Account warning</li>
    <li>Temporary suspension</li>
    <li>Permanent account termination</li>
    <li>Referral to law enforcement where required</li>
  </ul>

  <h2>Appeals</h2>
  <p>Creators whose content has been removed may appeal the decision by emailing <a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a> within 14 days of the removal. Include your account email and the name of the affected content. We aim to respond to appeals within 5 business days.</p>

  <h2>Contact</h2>
  <p>Content policy questions: <a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a></p>
  `,
  { active: '/content-policy' }
)));

// ── /soul-token-terms ─────────────────────────────────────────────────────────
router.get('/soul-token-terms', (req, res) => res.send(page(
  'Soul Token Terms',
  'The rules governing Soul Tokens — SphynxPlay\'s in-app virtual currency.',
  `
  <p class="effective">Effective: 1 April 2026 &nbsp;·&nbsp; Sphynx Motion (Pty) Ltd</p>

  <div class="highlight-box">
    <strong>Important:</strong> Soul Tokens are a virtual in-app currency only. They have no monetary value, cannot be exchanged for cash, and are not redeemable outside of SphynxPlay. All Soul Token purchases are processed by Apple App Store or Google Play — not directly by SphynxPlay.
  </div>

  <h2>1. What are Soul Tokens?</h2>
  <p>Soul Tokens (styled "Soul ⚡" in the app) are a virtual currency used exclusively within the SphynxPlay platform. They function as an engagement and rewards system, allowing viewers to unlock content and participate in platform features.</p>

  <h2>2. Earning Soul Tokens</h2>
  <p>Soul Tokens can be earned free of charge through the following activities:</p>
  <ul>
    <li><strong>Daily Login Bonus</strong> — log in each day to earn Soul Tokens</li>
    <li><strong>Watching Episodes</strong> — earn tokens for completing episodes</li>
    <li><strong>Sharing Series</strong> — earn tokens when you share content externally</li>
    <li><strong>Platform Challenges</strong> — special events and milestones</li>
    <li><strong>Soul Pass Bonus</strong> — Soul Pass members earn enhanced daily token rewards</li>
  </ul>

  <h2>3. Purchasing Soul Tokens</h2>
  <p>Additional Soul Tokens may be purchased via in-app purchase through:</p>
  <ul>
    <li><strong>Apple App Store</strong> — purchases are subject to Apple's Media Services Terms and Conditions</li>
    <li><strong>Google Play</strong> — purchases are subject to Google Play's Terms of Service</li>
  </ul>
  <p>SphynxPlay does not process card payments directly for Soul Token purchases. All billing, receipts, and refund requests for purchases must be directed to the relevant platform store.</p>

  <h2>4. Using Soul Tokens</h2>
  <p>Soul Tokens may be spent within the app on:</p>
  <ul>
    <li>Unlocking premium episodes that require Soul Tokens to access</li>
    <li>Casting Echo Votes in interactive series</li>
    <li>Accessing exclusive digital content or bonuses</li>
  </ul>
  <p>Token costs are displayed clearly before any spend. Once spent, tokens cannot be recovered.</p>

  <h2>5. Non-Transferability</h2>
  <p>Soul Tokens are tied to your individual account and cannot be:</p>
  <ul>
    <li>Transferred to another user or account</li>
    <li>Sold, gifted, or traded outside the platform</li>
    <li>Combined across multiple accounts</li>
  </ul>

  <h2>6. No Cash Value</h2>
  <p>Soul Tokens have no monetary value at any time. They cannot be redeemed for cash, credit, or any form of monetary compensation by SphynxPlay or any third party.</p>

  <h2>7. Refunds</h2>
  <p>Earned Soul Tokens (from daily logins, watching, etc.) are not refundable. Purchased Soul Tokens are non-refundable by SphynxPlay except where required by applicable law or mandated by the platform store through which they were purchased. For purchased token refund requests, contact Apple Support or Google Play Support directly.</p>

  <h2>8. Expiry</h2>
  <p>Soul Tokens expire if your account remains inactive (no logins) for 12 consecutive months. You will receive an in-app notification before expiry. Tokens do not expire while your account is active.</p>

  <h2>9. Account Closure &amp; Termination</h2>
  <p>All Soul Tokens — both earned and purchased — are forfeited upon:</p>
  <ul>
    <li>Voluntary account deletion</li>
    <li>Account termination due to Terms of Use violations</li>
  </ul>
  <p>No compensation is provided for forfeited tokens except where required by applicable law.</p>

  <h2>10. Changes to the Soul Token System</h2>
  <p>Sphynx Motion (Pty) Ltd reserves the right to modify earning rates, spend costs, available rewards, or any other aspect of the Soul Token system at any time. Material changes will be communicated in-app with at least 14 days notice. Continued use of Soul Tokens after the change takes effect constitutes acceptance.</p>

  <h2>11. Contact</h2>
  <p>Questions about Soul Tokens: <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a></p>
  `,
  { active: '/soul-token-terms' }
)));

// ── /support ──────────────────────────────────────────────────────────────────
router.get('/support', (req, res) => res.send(page(
  'Help & Support',
  'Get help with your SphynxPlay account, subscriptions, Soul Tokens, and technical issues.',
  `
  <div class="contact-grid" style="margin-bottom:32px">
    <div class="contact-card">
      <div class="icon">📧</div>
      <div class="label">Email Support</div>
      <div class="value"><a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a><br><em style="font-size:10px">Reply within 48 hours</em></div>
    </div>
    <div class="contact-card">
      <div class="icon">🛡️</div>
      <div class="label">Content Moderation</div>
      <div class="value"><a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a><br><em style="font-size:10px">Reply within 24 hours</em></div>
    </div>
    <div class="contact-card">
      <div class="icon">🔒</div>
      <div class="label">Privacy Requests</div>
      <div class="value"><a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a><br><em style="font-size:10px">Reply within 5 business days</em></div>
    </div>
    <div class="contact-card">
      <div class="icon">⚖️</div>
      <div class="label">Legal</div>
      <div class="value"><a href="mailto:legal@sphynxplay.com">legal@sphynxplay.com</a></div>
    </div>
  </div>

  <h2>Account & Login</h2>
  <p><strong>I forgot my password.</strong><br>Open the app → Profile → Log In → tap <em>Forgot password?</em> → enter your email → check your inbox for a reset link.</p>
  <p><strong>My login is failing.</strong><br>Ensure you're using the correct email and password. If your account is new, check that you've confirmed your email address. Use "Forgot password?" to reset if unsure.</p>
  <p><strong>I want to change my email or display name.</strong><br>Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> — account detail changes require identity verification.</p>

  <h2>Subscriptions (Soul Pass)</h2>
  <p><strong>How do I cancel my Soul Pass subscription?</strong><br>
  Subscriptions are managed by the App Store or Google Play — not by SphynxPlay directly.</p>
  <ul>
    <li><strong>iOS:</strong> Settings → [Your Name] → Subscriptions → SphynxPlay → Cancel</li>
    <li><strong>Android:</strong> Google Play → Profile → Payments & subscriptions → Subscriptions → SphynxPlay → Cancel</li>
  </ul>
  <p>Cancellation takes effect at the end of the current billing period. You retain access until then.</p>

  <p><strong>I was charged but my subscription isn't active.</strong><br>Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> with your account email and a screenshot of the charge. We'll resolve it within 2 business days.</p>

  <h2>Soul Tokens</h2>
  <p><strong>My Soul Tokens are missing.</strong><br>Soul Tokens are tied to your account. If you're logged in to the correct account and your balance looks wrong, email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> with your account email.</p>
  <p><strong>Can I get a refund on purchased Soul Tokens?</strong><br>Soul Token purchases are processed by Apple or Google. Refund requests must be made directly through the store you purchased from. SphynxPlay cannot issue refunds for store purchases.</p>

  <h2>Video Playback</h2>
  <p><strong>Video won't play / buffering constantly.</strong><br>Check your internet connection. On mobile, switch from cellular to Wi-Fi. Close and reopen the app. If the problem persists, email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> with your device model and OS version.</p>
  <p><strong>Audio out of sync.</strong><br>Close and reopen the player. If the issue continues, report it with the episode name and your device details.</p>

  <h2>Reporting Content</h2>
  <p>To report a content violation: tap <strong>⋯</strong> on any content card → <strong>Report</strong>. Or email <a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a>. All reports are reviewed within 24 hours on business days.</p>

  <h2>Delete My Account</h2>
  <p>You can delete your account at any time. See the <a href="/delete-account">Account Deletion page</a> for full details and instructions.</p>

  <h2>Creator Support</h2>
  <p>Creator applications, content submissions, and partnership enquiries: <a href="mailto:creators@sphynxplay.com">creators@sphynxplay.com</a></p>
  `,
  { active: '/support' }
)));

// ── /delete-account ───────────────────────────────────────────────────────────
router.get('/delete-account', (req, res) => res.send(page(
  'Delete Your Account',
  'How to permanently delete your SphynxPlay account and all associated data.',
  `
  <div class="highlight-box">
    <strong>Account deletion is permanent.</strong> Once deleted, your Soul Tokens, watch history, Echo Votes, Soul Pass membership, and all profile data are permanently removed and cannot be recovered.
  </div>

  <h2>How to Delete Your Account</h2>
  <p>You can delete your account directly from the app at any time — no email required.</p>
  <ol>
    <li>Open the <strong>SphynxPlay</strong> app</li>
    <li>Tap <strong>Profile</strong> (bottom nav)</li>
    <li>Scroll down and tap <strong>Delete Account</strong></li>
    <li>Read the confirmation details</li>
    <li>Tap <strong>I Understand — Delete My Account</strong></li>
  </ol>
  <p>Your account will be deleted immediately. You will be signed out of all devices.</p>

  <h2>Delete by Email</h2>
  <p>If you cannot access the app, email <a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a> with:</p>
  <ul>
    <li>Subject: <strong>Account Deletion Request</strong></li>
    <li>Your registered email address</li>
    <li>A brief confirmation that you want your account permanently deleted</li>
  </ul>
  <p>We will process the deletion within 30 days and send a confirmation email.</p>

  <h2>What Gets Deleted</h2>
  <ul>
    <li>Your Supabase Auth account (email, password)</li>
    <li>Your profile (display name, preferences, language setting)</li>
    <li>Your Soul Token balance (non-refundable)</li>
    <li>Your watch history and playback positions</li>
    <li>Your Echo Votes and engagement history</li>
    <li>Your watchlist and saved series</li>
    <li>Your Soul Pass membership record (subscription itself must be cancelled in App Store / Google Play)</li>
    <li>All push notification subscriptions</li>
  </ul>

  <h2>What Is Retained</h2>
  <ul>
    <li><strong>Payment records</strong> — retained for 7 years for statutory compliance. These records do not contain card numbers and are not linked to an active account.</li>
    <li><strong>Moderation records</strong> — if your account was flagged or actioned for policy violations, those records are retained for legal compliance.</li>
    <li><strong>Aggregated analytics</strong> — anonymised, non-identifiable usage data may be retained.</li>
  </ul>

  <h2>Cancel Your Subscription First</h2>
  <p>Deleting your SphynxPlay account does <strong>not</strong> automatically cancel your App Store or Google Play subscription. To avoid future charges, cancel your subscription before deleting your account:</p>
  <ul>
    <li><strong>iOS:</strong> Settings → [Your Name] → Subscriptions → SphynxPlay → Cancel Subscription</li>
    <li><strong>Android:</strong> Google Play → Profile → Payments & subscriptions → Subscriptions → SphynxPlay → Cancel</li>
  </ul>

  <h2>Before You Go</h2>
  <p>If you're having a problem with the app, we'd love a chance to fix it. Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> — our team responds within 48 hours.</p>
  <p>You can also request a copy of your data before deletion by emailing <a href="mailto:privacy@sphynxplay.com">privacy@sphynxplay.com</a>.</p>
  `,
  { active: '/delete-account' }
)));

// ── /faq ──────────────────────────────────────────────────────────────────────
router.get('/faq', (req, res) => res.send(page(
  'Frequently Asked Questions',
  'Answers to the most common questions about SphynxPlay — accounts, subscriptions, Soul Tokens, and playback.',
  `
  <p class="effective">Last updated: May 2026 &nbsp;·&nbsp; Sphynx Motion (Pty) Ltd</p>

  <h2>Getting Started</h2>

  <p><strong>What is SphynxPlay?</strong><br>
  SphynxPlay is an African vertical drama streaming platform. We host original and curated African series in a short-form, mobile-first format. Watch on iOS, Android, or the web at <a href="https://app.sphynxplay.com">app.sphynxplay.com</a>.</p>

  <p><strong>Is SphynxPlay free?</strong><br>
  Yes — you can sign up for free and watch free episodes immediately. Premium episodes require Soul Tokens to unlock. A Soul Pass subscription grants enhanced daily token rewards and early access to new releases.</p>

  <p><strong>What devices is SphynxPlay available on?</strong><br>
  SphynxPlay is available on iPhone (iOS 16+), Android (8.0+), and any modern web browser. The experience is optimised for mobile in portrait orientation.</p>

  <p><strong>How do I create an account?</strong><br>
  Download the SphynxPlay app from the App Store or Google Play, tap <strong>Sign Up</strong>, enter your email and a password, and confirm your email address. Account creation is free.</p>

  <h2>Soul Tokens</h2>

  <p><strong>What are Soul Tokens?</strong><br>
  Soul Tokens (◈) are SphynxPlay's virtual in-app currency. They have no monetary value and cannot be exchanged for cash. You use them to unlock premium episodes and cast Echo Votes in interactive series.</p>

  <p><strong>How do I earn Soul Tokens?</strong><br>
  You earn Soul Tokens for free through:</p>
  <ul>
    <li>Logging in daily</li>
    <li>Completing episodes</li>
    <li>Sharing series with friends</li>
    <li>Participating in platform challenges and events</li>
    <li>Soul Pass members earn an enhanced daily bonus</li>
  </ul>

  <p><strong>How do I buy more Soul Tokens?</strong><br>
  On iOS, open <strong>Wallet</strong> → select a Soul Token package → purchase via Apple IAP. On Android, the same flow uses Google Play Billing. On the web, purchase via secure card checkout. SphynxPlay does not store your card details.</p>

  <p><strong>Can I transfer Soul Tokens to another account?</strong><br>
  No. Soul Tokens are non-transferable, tied to the account they were earned or purchased on, and cannot be moved between accounts.</p>

  <p><strong>Do Soul Tokens expire?</strong><br>
  Your tokens are safe as long as you use your account. Tokens expire only if your account is inactive (no logins) for 12 consecutive months. You will receive an in-app warning before expiry.</p>

  <p><strong>I bought tokens but they haven't appeared.</strong><br>
  Purchases can occasionally take a few minutes to process. Close and reopen the app. If tokens still haven't appeared after 30 minutes, email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> with your account email and proof of purchase.</p>

  <h2>Soul Pass Subscription</h2>

  <p><strong>What is Soul Pass?</strong><br>
  Soul Pass is a premium subscription that gives members an enhanced daily Soul Token bonus, early access to new episodes, and an exclusive Soul Pass badge on their profile.</p>

  <p><strong>How do I subscribe to Soul Pass?</strong><br>
  Open <strong>Wallet</strong> in the app → tap <strong>Soul Pass</strong> → complete the subscription through the App Store or Google Play.</p>

  <p><strong>How do I cancel Soul Pass?</strong><br>
  Subscriptions are managed by the App Store or Google Play — not directly by SphynxPlay.</p>
  <ul>
    <li><strong>iOS:</strong> Settings → [Your Name] → Subscriptions → SphynxPlay → Cancel Subscription</li>
    <li><strong>Android:</strong> Google Play → Profile → Payments &amp; subscriptions → Subscriptions → SphynxPlay → Cancel</li>
  </ul>
  <p>Cancellation takes effect at the end of your current billing period. You keep access until then.</p>

  <p><strong>Will I lose my Soul Tokens if I cancel?</strong><br>
  No. Your accumulated Soul Token balance is not affected by cancelling Soul Pass. Only the enhanced daily bonus stops at the end of the billing period.</p>

  <h2>Content &amp; Playback</h2>

  <p><strong>Why can't I play a video?</strong><br>
  Check your internet connection first. On mobile, Wi-Fi is recommended for HD playback. If the issue persists, close and reopen the app. Still stuck? Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> with your device model, OS version, and the episode name.</p>

  <p><strong>What video quality does SphynxPlay stream?</strong><br>
  SphynxPlay uses adaptive bitrate streaming (HLS). Quality adjusts automatically based on your connection speed — from 360p on slow connections up to 1080p on fast Wi-Fi.</p>

  <p><strong>Can I download episodes to watch offline?</strong><br>
  Offline downloads are not available at this time. All content requires an internet connection.</p>

  <p><strong>Why does an episode cost Soul Tokens?</strong><br>
  Some episodes are marked as premium content and require Soul Tokens to unlock. The cost is shown clearly before you confirm. Free episodes are always available at no token cost.</p>

  <p><strong>How do I report inappropriate content?</strong><br>
  Tap the <strong>⋯ menu</strong> on any content card and select <strong>Report</strong>. Or email <a href="mailto:moderation@sphynxplay.com">moderation@sphynxplay.com</a>. All reports are reviewed within 24 hours on business days.</p>

  <h2>Account &amp; Security</h2>

  <p><strong>I forgot my password.</strong><br>
  On the login screen, tap <strong>Forgot password?</strong>, enter your email address, and check your inbox for a reset link. The link expires after 60 minutes.</p>

  <p><strong>How do I change my display name?</strong><br>
  Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> from your registered email address with the new display name you'd like. We'll update it within 2 business days.</p>

  <p><strong>How do I delete my account?</strong><br>
  Open the app → <strong>Profile</strong> → <strong>Delete Account</strong>. Account deletion is permanent and immediate. See the full <a href="/delete-account">Account Deletion page</a> for details.</p>

  <p><strong>Is my data secure?</strong><br>
  All data is encrypted in transit (TLS 1.2+) and at rest. We do not sell your personal data. See our full <a href="/privacy">Privacy Policy</a> for details.</p>

  <h2>Still Need Help?</h2>
  <p>Email <a href="mailto:support@sphynxplay.com">support@sphynxplay.com</a> — our team responds within 48 hours on business days. For urgent account security issues, include <strong>URGENT</strong> in the subject line.</p>
  `,
  { active: '/faq' }
)));

module.exports = router;
