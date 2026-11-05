/**
 * Third-party tags for built pages, each added only when its setting is valid:
 * Cloudflare Web Analytics counts visits; GoatCounter counts creator-link taps,
 * with no_onload so it never records page views.
 */
export function headScripts(env: { CF_ANALYTICS_TOKEN?: string; GOATCOUNTER_SITE?: string }): string {
  const token = env.CF_ANALYTICS_TOKEN?.trim()
  const site = env.GOATCOUNTER_SITE?.trim()
  const tags = [
    token && /^[\w-]+$/.test(token)
      ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`
      : '',
    site && /^[a-z0-9-]+$/.test(site)
      ? `<script data-goatcounter="https://${site}.goatcounter.com/count" data-goatcounter-settings='{"no_onload":true}' async src="https://gc.zgo.at/count.js"></script>`
      : ''
  ]
  return tags.filter(Boolean).map((tag) => `${tag}\n  `).join('')
}
