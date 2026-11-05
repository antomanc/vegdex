import { describe, expect, it } from 'vitest';
import { headScripts } from '../apps/web/head-scripts';

describe('headScripts', () => {
  it('adds nothing without settings', () => {
    expect(headScripts({})).toBe('');
    expect(headScripts({ CF_ANALYTICS_TOKEN: '', GOATCOUNTER_SITE: '' })).toBe('');
  });

  it('counts only events on GoatCounter, never page views', () => {
    const html = headScripts({ GOATCOUNTER_SITE: 'vegdex' });
    expect(html).toContain('data-goatcounter="https://vegdex.goatcounter.com/count"');
    expect(html).toContain(`data-goatcounter-settings='{"no_onload":true}'`);
    expect(html).toContain('src="https://gc.zgo.at/count.js"');
    expect(html).not.toContain('cloudflareinsights');
  });

  it('keeps the Cloudflare beacon beside GoatCounter', () => {
    const html = headScripts({ CF_ANALYTICS_TOKEN: 'abc-123', GOATCOUNTER_SITE: 'vegdex' });
    expect(html).toContain(`data-cf-beacon='{"token":"abc-123"}'`);
    expect(html).toContain('data-goatcounter=');
  });

  it.each(['a b', 'https://x', 'bad"code', 'Upper'])('refuses the site code %j', (site) => {
    expect(headScripts({ GOATCOUNTER_SITE: site })).toBe('');
  });
});
