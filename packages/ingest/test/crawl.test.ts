import { describe, expect, it } from 'vitest';
import { discover } from '../src/crawl';
import { HostQueue } from '../src/http';
import { parseRobots } from '../src/robots';

const source = { id: 'blog', name: 'Blog', url: 'https://blog.example' };
const queue = new HostQueue(0);

function responder(pages: Record<string, { status: number; text?: string }>) {
  return async (url: string) => ({ status: 404, url, text: '', ...pages[url] });
}

describe('Sitemap discovery', () => {
  it('says which sitemap failed, so a blocked site is not mistaken for a quiet one', async () => {
    const result = await discover(source, parseRobots(''), queue, responder({
      'https://blog.example/sitemap_index.xml': { status: 403 },
      'https://blog.example/wp-sitemap.xml': { status: 403 },
      'https://blog.example/sitemap.xml': { status: 403 }
    }));
    expect(result.entries).toEqual([]);
    expect(result.note).toContain('no sitemap entries');
    expect(result.note).toContain('https://blog.example/sitemap_index.xml HTTP 403');
    expect(result.note).toContain('https://blog.example/sitemap.xml HTTP 403');

    const many = await discover(source, parseRobots('Sitemap: https://blog.example/a.xml\nSitemap: https://blog.example/b.xml\nSitemap: https://blog.example/c.xml\nSitemap: https://blog.example/d.xml'), queue, responder({}));
    expect(many.note).toContain('and 1 more');
  });

  it('reports a sitemap that cannot be reached at all', async () => {
    const result = await discover(source, parseRobots(''), queue, async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    expect(result.entries).toEqual([]);
    expect(result.note).toContain('unreachable');
  });

  it('stays quiet when the sitemap answers and simply holds nothing', async () => {
    const empty = { status: 200, text: '<urlset></urlset>' };
    const result = await discover(source, parseRobots(''), queue, responder({
      'https://blog.example/sitemap_index.xml': empty,
      'https://blog.example/wp-sitemap.xml': empty,
      'https://blog.example/sitemap.xml': empty
    }));
    expect(result.entries).toEqual([]);
    expect(result.note).toBeUndefined();
  });

  it('reads the content sitemaps an index points at', async () => {
    const result = await discover(source, parseRobots(''), queue, responder({
      'https://blog.example/sitemap_index.xml': {
        status: 200,
        text: '<sitemapindex><sitemap><loc>https://blog.example/post-sitemap.xml</loc></sitemap></sitemapindex>'
      },
      'https://blog.example/post-sitemap.xml': {
        status: 200,
        text: '<urlset><url><loc>https://blog.example/soup/</loc></url></urlset>'
      }
    }));
    expect(result.entries.map((e) => e.url)).toEqual(['https://blog.example/soup/']);
    expect(result.note).toBeUndefined();
  });
});
