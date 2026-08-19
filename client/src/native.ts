/**
 * Native-shell wiring. No-ops in a browser: every import is dynamic and
 * guarded, so the web bundle neither loads nor ships the Capacitor runtime.
 */
export async function initNative(): Promise<void> {
  if (!('Capacitor' in window)) return

  const { App } = await import('@capacitor/app')
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  const { SplashScreen } = await import('@capacitor/splash-screen')

  await StatusBar.setStyle({ style: Style.Dark })
  await SplashScreen.hide()

  // Without this the hardware back button closes the app from any screen.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.exitApp()
  })
}
