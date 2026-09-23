import { useRef, useState, type KeyboardEvent } from 'react'
import brandLogo from './assets/AgriMarket.svg'
import cropDetailsScreen from './assets/crop-details-page.jpg'
import buyerDashboard from './assets/buyer-dashboard.jpg'
import farmerDashboardScreen from './assets/farmer-dashboard.jpg'
import marketPageScreen from './assets/market-page.jpg'
import messagesScreen from './assets/messages.jpg'
import reservationSuccessScreen from './assets/reservation-success.jpg'
import AdminWorkspace from './admin/AdminWorkspace'
import './App.css'

type StoryId = 'market' | 'details' | 'reserve' | 'guidance'

type Story = {
  id: StoryId
  step: string
  label: string
  title: string
  copy: string
  highlights: string[]
  image: string
  imageAlt: string
}

const DOWNLOAD_URL = import.meta.env.VITE_APK_DOWNLOAD_URL?.trim()

const stories: Story[] = [
  {
    id: 'market',
    step: '01',
    label: 'Browse harvests',
    title: 'See the crops available from local farmers.',
    copy: 'Browse produce listings and use the app’s search and category controls to narrow what you see.',
    highlights: ['Crop listings in one place', 'Search and category controls', 'Farmer information on each listing'],
    image: marketPageScreen,
    imageAlt: 'AgriMarket marketplace screen showing produce listings',
  },
  {
    id: 'details',
    step: '02',
    label: 'Review crop details',
    title: 'Check the details before you make a request.',
    copy: 'Review the listed price, available quantity, harvest information, and farmer details on the crop page.',
    highlights: ['Listed price and quantity', 'Harvest information', 'Farmer and location details'],
    image: cropDetailsScreen,
    imageAlt: 'AgriMarket crop details screen showing produce pricing and availability',
  },
  {
    id: 'reserve',
    step: '03',
    label: 'Request a reservation',
    title: 'Send the farmer a reservation request.',
    copy: 'Choose a quantity and submit your request. The confirmation screen keeps the request details easy to review.',
    highlights: ['Choose the requested quantity', 'Review the reservation summary', 'Keep the request details together'],
    image: reservationSuccessScreen,
    imageAlt: 'AgriMarket reservation request confirmation screen',
  },
  {
    id: 'guidance',
    step: '04',
    label: 'Get app guidance',
    title: 'Find help while using AgriMarket.',
    copy: 'Use the in-app assistant for guidance about browsing crops and working through the app.',
    highlights: ['Guidance inside the app', 'Suggested questions to get started', 'A clear place to ask for help'],
    image: messagesScreen,
    imageAlt: 'AgriMarket assistant screen with suggested questions',
  },
]

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3v10m0 0 4.5-4.5M10 13 5.5 8.5M3.5 16.5h13" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="check-icon">
      <path d="M4 10.5 8 14.5 16 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
}: {
  src: string
  alt: string
  priority?: boolean
  variant?: 'default' | 'hero' | 'story' | 'farmer'
}) {
  return (
    <figure className={`phone-shell phone-shell-${variant}`}>
      <div className="phone-screen-container">
        <div className="phone-notch" aria-hidden="true">
          <span className="notch-speaker" />
          <span className="notch-camera" />
        </div>
        <img
          src={src}
          alt={alt}
          className="phone-screen-img"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
        <div className="phone-glass-glare" aria-hidden="true" />
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
  const [activeStoryId, setActiveStoryId] = useState<StoryId>('market')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const downloadAvailable = Boolean(DOWNLOAD_URL)
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? stories[0]

  function selectTab(index: number) {
    setActiveStoryId(stories[index].id)
    tabRefs.current[index]?.focus()
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    if (event.key === 'Home') return selectTab(0)
    if (event.key === 'End') return selectTab(stories.length - 1)

    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    selectTab((index + direction + stories.length) % stories.length)
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
              <span className="sr-only">Toggle navigation</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
            <NavigationLinks onNavigate={() => setMobileNavOpen(false)} />
          </nav>
        )}
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
                  alt="AgriMarket crop details screen showing produce pricing and availability"
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
              <h2 id="how-title" className="section-title">Explore the buyer journey.</h2>
              <p className="section-subtitle">The screens below come from the app and show the main path from browsing to getting help.</p>
            </div>

            <div className="interactive-story-grid">
              <div className="story-tabs-list" role="tablist" aria-label="AgriMarket buyer journey">
                {stories.map((story, index) => {
                  const isActive = story.id === activeStoryId
                  return (
                    <button
                      key={story.id}
                      id={`tab-${story.id}`}
                      ref={(element) => { tabRefs.current[index] = element }}
                      className={`story-tab-item${isActive ? ' is-active' : ''}`}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`panel-${story.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActiveStoryId(story.id)}
                      onKeyDown={(event) => handleTabKey(event, index)}
                      type="button"
                    >
                      <span className="tab-step-tag">{story.step}</span>
                      <span className="tab-title">{story.label}</span>
                    </button>
                  )
                })}
              </div>

              <div
                key={activeStory.id}
                id={`panel-${activeStory.id}`}
                className="story-panel-showcase"
                role="tabpanel"
                aria-labelledby={`tab-${activeStory.id}`}
                tabIndex={0}
              >
                <div className="showcase-details">
                  <p className="showcase-step">Step {activeStory.step}</p>
                  <h3>{activeStory.title}</h3>
                  <p className="showcase-copy">{activeStory.copy}</p>
                  <ul className="showcase-highlights">
                    {activeStory.highlights.map((item) => (
                      <li key={item}><CheckIcon /><span>{item}</span></li>
                    ))}
                  </ul>
                </div>

                <div className="showcase-device-stage">
                  <PhoneFrame src={activeStory.image} alt={activeStory.imageAlt} variant="story" />
                </div>
              </div>
            </div>
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
  const path = initialPath ?? currentPathname()

  if (path === '/admin') return <AdminWorkspace />

  return <LandingPage />
}
