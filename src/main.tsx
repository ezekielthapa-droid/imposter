import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

async function logPwaDiagnostics() {
  console.info('[PWA] Secure context and install state.', {
    secureContext: window.isSecureContext,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    installPromptStatus: window.__imposterInstallPromptStatus,
  })

  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!manifestLink) {
    console.error('[PWA] No web app manifest link is present in the document.')
  } else {
    try {
      const response = await fetch(manifestLink.href, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`Manifest request failed with HTTP ${response.status}.`)
      }

      const manifest = await response.json()
      const iconResults = await Promise.all(
        (manifest.icons ?? []).map(async (icon: { src: string; sizes?: string; type?: string }) => {
          try {
            const iconUrl = new URL(icon.src, manifestLink.href)
            const iconResponse = await fetch(iconUrl, { cache: 'no-cache' })
            if (!iconResponse.ok) {
              throw new Error(`Icon request failed with HTTP ${iconResponse.status}.`)
            }

            const blob = await iconResponse.blob()
            const imageUrl = URL.createObjectURL(blob)
            try {
              const image = new Image()
              image.src = imageUrl
              await image.decode()
              return {
                src: icon.src,
                status: iconResponse.status,
                contentType: iconResponse.headers.get('content-type'),
                width: image.naturalWidth,
                height: image.naturalHeight,
              }
            } finally {
              URL.revokeObjectURL(imageUrl)
            }
          } catch (error) {
            console.error('[PWA] Manifest icon failed to load or decode.', {
              src: icon.src,
              error,
            })
            return { src: icon.src, error }
          }
        }),
      )

      console.info('[PWA] Manifest loaded and parsed.', {
        url: manifestLink.href,
        status: response.status,
        id: manifest.id,
        startUrl: manifest.start_url,
        scope: manifest.scope,
        display: manifest.display,
        icons: iconResults,
      })
    } catch (error) {
      console.error('[PWA] Manifest failed to load or parse.', error)
    }
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers are not supported in this browser.')
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    console.info('[PWA] Service worker registration status.', {
      scope: registration?.scope ?? null,
      installing: registration?.installing?.state ?? null,
      waiting: registration?.waiting?.state ?? null,
      active: registration?.active?.state ?? null,
      pageController: navigator.serviceWorker.controller?.state ?? null,
    })

    void navigator.serviceWorker.ready
      .then((readyRegistration) => {
        console.info('[PWA] Active service worker is ready.', {
          scope: readyRegistration.scope,
          state: readyRegistration.active?.state ?? null,
        })
      })
      .catch((error: unknown) => {
        console.error('[PWA] Service worker did not become ready.', error)
      })
  } catch (error) {
    console.error('[PWA] Failed to inspect service worker registration.', error)
  }
}

void logPwaDiagnostics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
