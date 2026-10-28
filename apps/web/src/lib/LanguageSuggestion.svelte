<script lang="ts">
  import { m, pageLocale } from './i18n'
  import { BASE_LOCALE, LOCALES } from './locales'
  import { isLocale } from '../paraglide/runtime'
  import Icon from './Icon.svelte'

  let { queryString }: { queryString: string } = $props()
  const preferred = navigator.language.split('-')[0]?.toLowerCase()
  const suggestion = pageLocale === BASE_LOCALE ? LOCALES.find((locale) => locale.code === preferred && locale !== pageLocale) : undefined
  const key = `vegdex:language-suggestion-dismissed:${suggestion?.code}`
  let dismissed = $state(false)
  try {
    dismissed = localStorage.getItem(key) === '1'
  } catch {}

  function dismiss() {
    dismissed = true
    try {
      localStorage.setItem(key, '1')
    } catch {}
  }
</script>

{#if suggestion && isLocale(suggestion.code) && !dismissed}
  <div class="language-suggestion">
    <a href="{import.meta.env.BASE_URL}{suggestion.prefix}/{queryString}" lang={suggestion.code} hreflang={suggestion.hreflang} onclick={dismiss}>{m.language_available({}, { locale: suggestion.code })}</a>
    <button class="text-btn" aria-label={m.dismiss_language_suggestion()} onclick={dismiss}><Icon name="close" size={16} /></button>
  </div>
{/if}

<style>
  .language-suggestion { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.88rem; }
  a { display: flex; align-items: center; min-height: 40px; color: var(--green); text-underline-offset: 3px; }
</style>
