/**
 * Native-shell wiring. No-ops in a browser: every import is dynamic and
 * guarded, so the web bundle neither loads nor ships the Capacitor runtime.
 *
 * Each step below is independently try/caught. The shell's SplashScreen
 * config has launchAutoHide off, so if SplashScreen.hide() is never reached
 * the splash stays up forever; if the back-button listener is never
 * registered, the hardware back button closes the app from any screen. A
 * rejection from one step (e.g. a StatusBar call the OEM skin doesn't like)
 * must not skip the ones after it.
 */
export async function initNative(): Promise<void> {
  if (!('Capacitor' in window)) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // The client's safe-area CSS only covers the desktop breakpoint, so on
    // the phone-sized viewport this app actually runs at, nothing pads for
    // the status bar. Fix it at the native layer instead: stop the webview
    // from drawing under the status bar at all, and colour the band to match
    // the shell's splash background so it isn't left unstyled.
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#0f172a' })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch (err) {
    console.error('[native] StatusBar setup failed', err)
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch (err) {
    console.error('[native] SplashScreen.hide failed', err)
  }

  try {
    const { App } = await import('@capacitor/app')
    // Without this the hardware back button closes the app from any screen.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else App.exitApp()
    })
  } catch (err) {
    console.error('[native] back-button listener registration failed', err)
  }
}
