import { decodeEntities } from '@vegdex/core';

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

export interface ParsedSitemap {
  /** Child sitemaps when this is a sitemap index. */
  sitemaps: string[];
  urls: SitemapEntry[];
}

export function parseSitemap(xml: string): ParsedSitemap {
  const sitemaps: string[] = [];
  const urls: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)) {
    const loc = m[1]!.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1];
    if (loc) sitemaps.push(decodeEntities(loc));
  }
  for (const m of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const loc = m[1]!.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1];
    const lastmod = m[1]!.match(/<lastmod>\s*([^<\s]+)/i)?.[1] ?? null;
    if (loc) urls.push({ url: decodeEntities(loc), lastmod });
  }
  return { sitemaps, urls };
}

/** Child sitemaps that hold posts or recipes, not pages, tags or images. */
export function isContentSitemap(url: string): boolean {
  const name = url.split('/').pop()?.toLowerCase() ?? '';
  return !/(?:^|[-_])(?:page|category|categories|post_tag|tag|author|users?|attachment|taxonomies|product|web-?stor(?:y|ies)|wprm_[a-z]+|course|cuisine|keyword|ingredient|video|image|news|local)[-_.\d]/.test(name);
}

/**
 * A translated edition of a blog ("/de/", "/fr-ca/") duplicates recipes already
 * rendered in every UI language. New content languages come from original-language sources.
 */
export function isOtherLanguage(url: string, contentLanguage = 'en'): boolean {
  const prefix = /^\/([a-z]{2})(?:-[a-z]{2})?\//i.exec(new URL(url).pathname);
  return !!prefix && prefix[1]!.toLowerCase() !== contentLanguage.split('-')[0]!.toLowerCase();
}

/** Page URLs that are never recipes. */
export function isCandidateUrl(url: string, siteUrl: string, contentLanguage = 'en'): boolean {
  const u = new URL(url);
  if (u.hostname.replace(/^www\./, '') !== new URL(siteUrl).hostname.replace(/^www\./, '')) return false;
  if (u.pathname === '/' || u.pathname === '') return false;
  if (isOtherLanguage(url, contentLanguage)) return false;
  return !/\/(?:category|tag|author|page|wp-content|feed|about|contact|privacy|shop|cart|resources?|start-here|newsletter|recipes?\/?$|recipe-index)(?:\/|$)/i.test(u.pathname);
}
