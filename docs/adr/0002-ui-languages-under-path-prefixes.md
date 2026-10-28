# UI languages live under path prefixes, translated with Paraglide

English stays at the root and every other UI language gets its own prefix (`/it/` first), built as a separate page with its own `lang`, reciprocal `hreflang`, manifest and sitemap entries. Google recommends separate URLs per language (see `docs/research/seo-guidance.md`), and URLs are hard to change once indexed. We never redirect from the browser language; an Italian browser gets a one-time, dismissible link to `/it/` instead. UI strings go through Paraglide JS 2, with one messages file per language and `en` as the source, so adding a language means adding a file and a registry entry. Query parameters stay English identifiers in every language, so a shared link opens the same filters anywhere.

Italian is the first of several languages: nothing may assume there is only one extra language.
