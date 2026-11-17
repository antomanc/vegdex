/** Night mode: follows the system until the cook picks, then remembers the pick on this device. */
import { startVt } from './view-transition'

const KEY = 'vegdex:theme'
const system = matchMedia('(prefers-color-scheme: dark)')

function picked(): 'dark' | 'light' | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

export const theme = $state({ dark: (picked() ?? (system.matches ? 'dark' : 'light')) === 'dark' })

function apply() {
  document.documentElement.dataset.theme = theme.dark ? 'dark' : 'light'
}
apply()

system.addEventListener('change', (e) => {
  if (picked()) return
  theme.dark = e.matches
  apply()
})

export function toggleTheme() {
  theme.dark = !theme.dark
  try {
    localStorage.setItem(KEY, theme.dark ? 'dark' : 'light')
  } catch {}
  // Night drops like the market awning; day lifts it. Instant when motion is reduced or unsupported.
  document.documentElement.classList.add('theme-awning')
  const run = startVt(apply)
  if (run) void run.finished.finally(() => document.documentElement.classList.remove('theme-awning'))
  else document.documentElement.classList.remove('theme-awning')
}
