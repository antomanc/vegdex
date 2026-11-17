/** Whether the browser currently reports a network connection. */
export function onlineStatus() {
  let on = $state(navigator.onLine)
  $effect(() => {
    const sync = () => {
      on = navigator.onLine
    }
    addEventListener('online', sync)
    addEventListener('offline', sync)
    return () => {
      removeEventListener('online', sync)
      removeEventListener('offline', sync)
    }
  })
  return {
    get online() {
      return on
    }
  }
}
