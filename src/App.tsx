import { useEffect, useState } from 'react'
import brandLogo from './assets/AgriMarket.svg'
import cropDetailsScreen from './assets/crop-details-page.jpg'
import buyerDashboard from './assets/buyer-dashboard.jpg'
import farmerDashboardScreen from './assets/farmer-dashboard.jpg'
import marketPageScreen from './assets/market-page.jpg'
import messagesScreen from './assets/messages.jpg'
import reservationSuccessScreen from './assets/reservation-success.jpg'
import WebRoute, { type WebPath } from './auth/WebRoute'
import { Toaster } from 'sonner'
import './App.css'

type StoryId = 'market' | 'details' | 'reserve' | 'guidance'

type Story = {
  id: StoryId
  step: string
  label: string
  title: string
  copy: string
  image: string
  imageAlt: string
}

const DOWNLOAD_URL = import.meta.env.VITE_APK_DOWNLOAD_URL?.trim()

const screenHeights: Record<string, number> = {
  [buyerDashboard]: 2375,
  [cropDetailsScreen]: 2372,
  [farmerDashboardScreen]: 2354,
  [marketPageScreen]: 2364,
  [messagesScreen]: 2276,
  [reservationSuccessScreen]: 2369,
}

const stories: Story[] = [
  {
    id: 'market',
    step: '01',
    label: 'Browse',
    title: 'See the crops available from local farmers.',
    copy: 'Browse produce listings and use the app’s search and category controls to narrow what you see.',
    image: marketPageScreen,
    imageAlt: 'AgriMarket marketplace screen showing produce listings',
  },
  {
    id: 'details',
    step: '02',
    label: 'Review',
    title: 'Check the details before you make a request.',
    copy: 'Review the listed price, available quantity, harvest information, and farmer details on the crop page.',
    image: cropDetailsScreen,
    imageAlt: 'AgriMarket crop details screen showing produce pricing and availability',
  },
  {
    id: 'reserve',
    step: '03',
    label: 'Request',
    title: 'Send the farmer a reservation request.',
    copy: 'Choose a quantity and submit your request. The confirmation screen keeps the request details easy to review.',
    image: reservationSuccessScreen,
    imageAlt: 'AgriMarket reservation request confirmation screen',
  },
  {
    id: 'guidance',
    step: '04',
    label: 'Get app guidance',
    title: 'Find help while using AgriMarket.',
    copy: 'Use the in-app assistant for guidance about browsing crops and working through the app.',
    image: messagesScreen,
    imageAlt: 'AgriMarket assistant screen with suggested questions',
  },
]

const journeyStories = stories.slice(0, 3)
const guidanceStory = stories[3]

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3v10m0 0 4.5-4.5M10 13 5.5 8.5M3.5 16.5h13" />
    </svg>
  )
}

function DownloadButton({ compact = false }: { compact?: boolean }) {
  const className = `button button-primary${compact ? ' button-compact' : ''}`

  if (!DOWNLOAD_URL) {
    return (
      <span className={`${className} is-disabled`} aria-disabled="true" role="status">
        <DownloadIcon />
        Download unavailable
      </span>
    )
  }

  return (
    <a className={className} href={DOWNLOAD_URL} download>
      <DownloadIcon />
      Download APK
    </a>
  )
}

function PhoneFrame({
  src,
  alt,
  priority = false,
  variant = 'default',
  tourIndex,
}: {
  src: string
  alt: string
  priority?: boolean
  variant?: 'default' | 'hero' | 'story' | 'farmer'
  tourIndex?: number
}) {
  return (
    <figure className={`phone-shell phone-shell-${variant}`}>
      <div className="phone-screen-container">
        {tourIndex === undefined ? (
          <img
            src={src}
            alt={alt}
            className="phone-screen-img"
            width={1167}
            height={screenHeights[src]}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        ) : journeyStories.map((story, index) => (
          <img
            key={story.id}
            src={story.image}
            alt={index === tourIndex ? story.imageAlt : ''}
            className="phone-screen-img tour-screen-img"
            data-active={index === tourIndex}
            width={1167}
            height={screenHeights[story.image]}
            loading="lazy"
          />
        ))}
      </div>
    </figure>
  )
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <a href="#benefits" onClick={onNavigate}>Why AgriMarket</a>
      <a href="#how-it-works" onClick={onNavigate}>How it works</a>
      <a href="#farmers" onClick={onNavigate}>For farmers</a>
      <a href="#install" onClick={onNavigate}>Install guide</a>
    </>
  )
}

function LandingPage() {
  const [tourIndex, setTourIndex] = useState(0)
  const [tourInstant, setTourInstant] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const downloadAvailable = Boolean(DOWNLOAD_URL)
  function selectStory(index: number, animate: boolean) {
    setTourInstant(!animate)
    setTourIndex(index)
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand-link" href="#top" aria-label="AgriMarket home">
            <img src={brandLogo} className="brand-logo" alt="AgriMarket" />
          </a>

          <nav className="site-nav" aria-label="Main navigation">
            <NavigationLinks />
          </nav>

          <div className="header-actions">
            <DownloadButton compact />
            <button
              className="menu-button"
              type="button"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span className="sr-only">{mobileNavOpen ? 'Close menu' : 'Open menu'}</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Mobile navigation"
          data-open={mobileNavOpen}
          inert={!mobileNavOpen}
        >
          <NavigationLinks onNavigate={() => setMobileNavOpen(false)} />
        </nav>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-container">
            <div className="hero-content">
              <p className="hero-context">Made for Cebu’s local produce community</p>
              <h1 id="hero-title" className="hero-headline">
                Find local harvests.<br />
                <em>Connect directly.</em>
              </h1>
              <p className="hero-description">
                AgriMarket helps buyers discover crops from approved local farmers, request a reservation, and coordinate the next step in one Android app.
              </p>
              <div className="hero-actions">
                <DownloadButton />
                <a className="button button-outline" href="#install">Install guide</a>
              </div>
              {!downloadAvailable && (
                <p className="availability-note">The APK link has not been published yet. The install guide is ready for when it is.</p>
              )}
            </div>

            <div className="hero-visual" aria-label="AgriMarket app preview">
              <div className="device-stage">
                <PhoneFrame
                  src={buyerDashboard}
                  alt="AgriMarket buyer dashboard showing local produce listings and navigation"
                  variant="hero"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="benefits-section" id="benefits" aria-labelledby="benefits-title">
          <div className="section-container benefits-layout">
            <div className="section-heading">
              <h2 id="benefits-title" className="section-title">The important details stay close to the crop.</h2>
              <p className="section-subtitle">A focused marketplace flow for discovering produce and making direct requests.</p>
            </div>

            <ul className="benefits-list">
              <li>
                <span className="benefit-number">01</span>
                <div><h3>Useful crop information</h3><p>See the listed price, quantity, harvest information, and farmer details together.</p></div>
              </li>
              <li>
                <span className="benefit-number">02</span>
                <div><h3>A clear reservation path</h3><p>Choose a quantity, send a request, and review the confirmation inside the app.</p></div>
              </li>
              <li>
                <span className="benefit-number">03</span>
                <div><h3>Tools for both sides</h3><p>Buyers can browse crops while approved farmers can publish listings and manage requests.</p></div>
              </li>
            </ul>
          </div>
        </section>

        <section className="how-it-works-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-container">
            <div className="section-heading walkthrough-heading">
              <p className="walkthrough-context">Buyer experience</p>
              <h2 id="how-title" className="section-title">From finding a crop to sending a request.</h2>
              <p className="section-subtitle">Follow the three steps a buyer takes in the app.</p>
            </div>

            <div className="buyer-tour" data-instant={tourInstant}>
              <div className="buyer-tour-content">
                <div className="buyer-tour-progress">
                  <span>{journeyStories[tourIndex].step} / 03</span>
                  <div className="buyer-tour-progress-track" aria-hidden="true">
                    <span style={{
                      transform: `scaleX(${(tourIndex + 1) / journeyStories.length})`,
                    }} />
                  </div>
                </div>
                <div className="buyer-tour-steps" aria-label="Buyer journey steps">
                  {journeyStories.map((story, index) => (
                    <button
                      key={story.id}
                      type="button"
                      aria-current={index === tourIndex ? 'step' : undefined}
                      onClick={(event) => selectStory(index, event.detail !== 0)}
                    >
                      <span>{story.step}</span>{story.label}
                    </button>
                  ))}
                </div>
                <div className="buyer-tour-description" aria-live="polite" aria-atomic="true">
                  {journeyStories.map((story, index) => (
                    <div key={story.id} className="buyer-tour-story" data-active={index === tourIndex} aria-hidden={index !== tourIndex}>
                      <h3>{story.title}</h3>
                      <p>{story.copy}</p>
                    </div>
                  ))}
                </div>
                <div className="buyer-tour-controls">
                  <button type="button" disabled={tourIndex === 0} onClick={(event) => selectStory(tourIndex - 1, event.detail !== 0)}>
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4-6 6 6 6M7 10h10" /></svg>
                    Previous
                  </button>
                  <button type="button" disabled={tourIndex === journeyStories.length - 1} onClick={(event) => selectStory(tourIndex + 1, event.detail !== 0)}>
                    Next
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4 6 6-6 6M13 10H3" /></svg>
                  </button>
                </div>
              </div>
              <div className="buyer-tour-phone">
                <PhoneFrame
                  src={journeyStories[tourIndex].image}
                  alt={journeyStories[tourIndex].imageAlt}
                  variant="story"
                  tourIndex={tourIndex}
                />
              </div>
            </div>

            <aside className="buyer-help" aria-labelledby="buyer-help-title">
              <div className="buyer-help-copy">
                <p className="walkthrough-context">When you need it</p>
                <h3 id="buyer-help-title">Need a hand?</h3>
                <p>{guidanceStory.copy}</p>
              </div>
              <PhoneFrame src={guidanceStory.image} alt={guidanceStory.imageAlt} variant="story" />
            </aside>
          </div>
        </section>

        <section className="farmers-section" id="farmers" aria-labelledby="farmers-heading">
          <div className="section-container farmers-layout">
            <div className="farmer-device-stage">
              <PhoneFrame
                src={farmerDashboardScreen}
                alt="Farmer dashboard showing listings and order activity"
                variant="farmer"
              />
            </div>

            <div className="farmers-content">
              <p className="farmers-context">For approved farmers</p>
              <h2 id="farmers-heading" className="farmers-title">Grow it. List it.<br /><em>Sell it locally.</em></h2>
              <p className="farmers-description">
                Farmers can use their own dashboard to add crops, maintain listing availability, and respond to buyer activity.
              </p>
              <ol className="farmer-steps">
                <li><span>01</span><div><h3>Add your harvest</h3><p>Enter the crop details, quantity, harvest date, and listed price.</p></div></li>
                <li><span>02</span><div><h3>Manage availability</h3><p>Keep listings current as crops become available or sell out.</p></div></li>
                <li><span>03</span><div><h3>Respond to buyers</h3><p>Review buyer activity and manage requests from the farmer dashboard.</p></div></li>
              </ol>
            </div>
          </div>
        </section>

        <section className="install-section" id="install" aria-labelledby="install-heading">
          <div className="section-container install-layout">
            <div className="install-intro">
              <h2 id="install-heading" className="section-title">Install AgriMarket on Android.</h2>
              <p className="section-subtitle">The app is distributed as an Android APK. Your device may ask you to approve installation from your browser or file manager.</p>
              <DownloadButton />
            </div>

            <ol className="install-steps-list">
              <li><span>01</span><div><h3>Download the APK</h3><p>Use the download button to save the AgriMarket installer to your Android device.</p></div></li>
              <li><span>02</span><div><h3>Allow installs if Android asks</h3><p>Follow the device prompt to allow installation from the browser or file manager you used.</p></div></li>
              <li><span>03</span><div><h3>Open the download and install</h3><p>Open the downloaded file, review the Android prompt, and choose Install.</p></div></li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src={brandLogo} alt="AgriMarket" className="footer-logo" />
            <p>Connecting Cebu’s local harvests with nearby buyers.</p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation"><NavigationLinks /></nav>
          <p className="footer-meta">© {new Date().getFullYear()} AgriMarket</p>
        </div>
      </footer>
    </div>
  )
}

function currentPathname() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

export default function App({ initialPath }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath ?? currentPathname)

  useEffect(() => {
    if (initialPath) return
    const syncPath = () => setPath(currentPathname())
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [initialPath])

  return <>
    {path === '/admin' || path === '/login' || path.startsWith('/event-manager') ? <WebRoute path={path as WebPath} /> : <LandingPage />}
    <Toaster position="top-right" richColors closeButton theme="light" />
  </>
}
