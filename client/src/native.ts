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
    // from drawing under the status bar at all, so content is never hidden
    // behind it, and set the status bar icons/text to a style that reads on
    // a light band (setBackgroundColor is deliberately not called here — on
    // API >= 35 it's a no-op unless the theme opts out of edge-to-edge, which
    // this app's theme does not).
    await StatusBar.setOverlaysWebView({ overlay: false })
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

/**
 * Writes a generated file to the device and hands it to the OS.
 *
 * Returns false in a browser, where the caller's anchor download already
 * works. Under Capacitor the anchor is a no-op — there is no download manager
 * behind https://localhost — so the bytes go to the cache directory and the
 * share sheet decides what opens them.
 */
export async function saveAndOpen(filename: string, blob: Blob): Promise<boolean> {
  if (!('Capacitor' in window)) return false

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error)
      // readAsDataURL gives "data:<mime>;base64,<data>" — Filesystem wants the tail.
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.readAsDataURL(blob)
    })

    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })

    await Share.share({ title: filename, url: written.uri })
    return true
  } catch (err) {
    console.error('[native] saveAndOpen failed', err)
    throw err
  }
}
