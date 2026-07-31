import "server-only";
import type { AuditSignals } from "@/lib/research/types";

const USER_AGENT = "JARVIS-LeadResearch/1.0 (+personal research tool, single business owner; not a bulk crawler)";
const FETCH_TIMEOUT_MS = 10_000;

const BOOKING_FINGERPRINTS: Record<string, RegExp> = {
  Calendly: /calendly\.com/i,
  "Housecall Pro": /housecallpro\.com/i,
  Jobber: /getjobber\.com/i,
  ServiceTitan: /servicetitan\.com/i,
};

const CHAT_FINGERPRINTS: Record<string, RegExp> = {
  Intercom: /widget\.intercom\.io|intercomcdn\.com/i,
  Drift: /js\.driftt\.com/i,
  Tidio: /code\.tidio\.co/i,
  "Facebook Messenger": /connect\.facebook\.net\/.*\/sdk\/xfbml\.customerchat/i,
};

const FRAMEWORK_FINGERPRINTS: Record<string, RegExp> = {
  Wix: /static\.wixstatic\.com|wix\.com\/website-builder/i,
  GoDaddy: /godaddysites\.com/i,
  Squarespace: /squarespace\.com|static1\.squarespace\.com/i,
  WordPress: /wp-content|wp-includes/i,
  Shopify: /cdn\.shopify\.com/i,
};

const GENERIC_TITLE_PATTERNS = [/^home$/i, /^untitled/i, /^index of/i, /^welcome to /i, /^new website$/i];

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** One retry on top of the caller's own timeout — a single dropped packet shouldn't sink an otherwise-fine site. */
async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (!res.ok) return null;
      return { html: await res.text(), finalUrl: res.url };
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

/**
 * Deliberately simple — this is a homepage-scale audit tool, not a full
 * robots.txt parser. Only checks for a blanket `Disallow: /` in either a
 * `User-agent: *` group or one naming our UA substring.
 */
async function isDisallowedByRobots(origin: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, 5000);
    if (!res.ok) return false; // no robots.txt = allowed, the common convention
    const text = await res.text();
    const groups = text.split(/\n(?=user-agent:)/i);
    for (const group of groups) {
      const uaLine = group.match(/user-agent:\s*(.+)/i)?.[1]?.trim();
      if (!uaLine) continue;
      const appliesToUs = uaLine === "*" || USER_AGENT.toLowerCase().includes(uaLine.toLowerCase());
      if (!appliesToUs) continue;
      if (/disallow:\s*\/\s*$/im.test(group)) return true;
    }
    return false;
  } catch {
    return false; // robots.txt unreachable — don't block on an inconclusive check
  }
}

function extractEmail(html: string): string | null {
  const mailto = html.match(/mailto:([^"'?\s]+)/i)?.[1];
  if (mailto) return mailto.toLowerCase();
  // Visible-text fallback — deliberately conservative (common obfuscation
  // patterns like "name (at) domain (dot) com" are not attempted; if it's
  // not a plain address, we don't fabricate one).
  const visible = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  return visible ? visible.toLowerCase() : null;
}

function findSecondaryPageUrl(html: string, origin: string): string | null {
  const hrefMatches = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of hrefMatches) {
    const [, href, text] = m;
    if (/contact|about/i.test(text) || /contact|about/i.test(href)) {
      try {
        return new URL(href, origin).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

function countFingerprintMatches(html: string, fingerprints: Record<string, RegExp>): string[] {
  return Object.entries(fingerprints)
    .filter(([, pattern]) => pattern.test(html))
    .map(([name]) => name);
}

export async function auditWebsite(websiteUrl: string): Promise<AuditSignals> {
  const blocked = (reason: string): AuditSignals => ({
    auditBlocked: true,
    blockedReason: reason,
    https: websiteUrl.startsWith("https://"),
    hasViewportMeta: false,
    title: null,
    metaDescription: null,
    hasGenericTitle: false,
    ctas: { tel: false, mailto: false, form: false, bookingWords: false },
    bookingSystems: [],
    chatWidgets: [],
    footerCopyrightYear: null,
    framework: null,
    imageCount: 0,
    imagesWithAlt: 0,
    hasSocialLinks: false,
    hasTestimonials: false,
    extractedEmail: null,
  });

  let origin: string;
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return blocked("invalid website URL");
  }

  if (await isDisallowedByRobots(origin)) {
    return blocked("robots.txt disallows this crawler");
  }

  const fetched = await fetchHtml(websiteUrl);
  if (!fetched) {
    return blocked("homepage fetch failed or timed out");
  }
  const { html, finalUrl } = fetched;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null;
  const metaDescription = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || null;

  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  const imagesWithAlt = images.filter((m) => /alt=["'][^"']+["']/i.test(m[0])).length;

  const bodyText = html.replace(/<[^>]+>/g, " ");
  const emailOnHomepage = extractEmail(html);
  let extractedEmail = emailOnHomepage;
  if (!extractedEmail) {
    const secondaryUrl = findSecondaryPageUrl(html, finalUrl || origin);
    if (secondaryUrl) {
      const secondary = await fetchHtml(secondaryUrl);
      if (secondary) extractedEmail = extractEmail(secondary.html);
    }
  }

  return {
    auditBlocked: false,
    https: (finalUrl || websiteUrl).startsWith("https://"),
    hasViewportMeta: /<meta\s+name=["']viewport["']/i.test(html),
    title,
    metaDescription,
    hasGenericTitle: title ? GENERIC_TITLE_PATTERNS.some((p) => p.test(title)) : true,
    ctas: {
      tel: /href=["']tel:/i.test(html),
      mailto: /href=["']mailto:/i.test(html),
      form: /<form\b/i.test(html),
      bookingWords: /\b(book\s*(now|online|appointment)|get\s*a?\s*quote|free\s*estimate|schedule\s*(now|service))\b/i.test(bodyText),
    },
    bookingSystems: countFingerprintMatches(html, BOOKING_FINGERPRINTS),
    chatWidgets: countFingerprintMatches(html, CHAT_FINGERPRINTS),
    footerCopyrightYear: (() => {
      const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(\d{4})/gi)].map((m) => parseInt(m[1], 10));
      return years.length ? Math.max(...years) : null;
    })(),
    framework: countFingerprintMatches(html, FRAMEWORK_FINGERPRINTS)[0] ?? null,
    imageCount: images.length,
    imagesWithAlt,
    hasSocialLinks: /(facebook\.com|instagram\.com|linkedin\.com\/company|twitter\.com|x\.com)\/[a-z0-9_.-]+/i.test(html),
    hasTestimonials: /testimonial|client review|customer review|★{2,}|\bstars?\b.{0,20}\breview/i.test(bodyText),
    extractedEmail,
  };
}
