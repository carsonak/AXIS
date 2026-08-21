import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SketchWaterDrop, SketchCrop, SketchRain, SketchGear, SketchSun, SketchChart, SketchLock, SketchTarget, SketchMeter, SketchEdit } from '../components'

type Page = 'home' | 'features' | 'workflow' | 'about' | 'contact' | 'privacy';


export default function LandingPage() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [waterCount, setWaterCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const totalTarget = 420;
    const animationDuration = 1200;
    const runCounter = (currentTimestamp: number) => {
      if (!startTimestamp) startTimestamp = currentTimestamp;
      const progress = Math.min((currentTimestamp - startTimestamp) / animationDuration, 1);
      setWaterCount(Math.floor(progress * totalTarget));
      if (progress < 1) animationFrameId = window.requestAnimationFrame(runCounter);
    };
    animationFrameId = window.requestAnimationFrame(runCounter);
    return () => { if (animationFrameId) window.cancelAnimationFrame(animationFrameId); };
  }, []);

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enterApp = () => navigate('/app');

  return (
    <div className="axis-app">
      <header className="navbar-sticky">
        <div className="container nav-inner">
          <button onClick={() => navigateTo('home')} className="brand-logo-btn">
            <div className="brand-icon-circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 9 0 4.9-4 9-9 9z" />
              </svg>
            </div>
            <div className="brand-text-group">
              <span className="bold-brand">AXIS</span>
              <span className="brand-subtitle">Agricultural Excellence in Irrigation Schemes</span>
            </div>
          </button>

          <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation menu">
            {menuOpen ? '\u2715' : '\u2630'}
          </button>

          <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <button className={`nav-btn nav-features ${currentPage === 'features' ? 'active' : ''}`} onClick={() => navigateTo('features')}>Features</button>
            <button className={`nav-btn nav-workflow ${currentPage === 'workflow' ? 'active' : ''}`} onClick={() => navigateTo('workflow')}>How it Works</button>
            <button className={`nav-btn nav-about ${currentPage === 'about' ? 'active' : ''}`} onClick={() => navigateTo('about')}>About</button>
            <button className={`nav-btn nav-contact ${currentPage === 'contact' ? 'active' : ''}`} onClick={() => navigateTo('contact')}>Contact</button>
            <button className="btn btn-primary btn-nav-mobile" onClick={enterApp}>Get Started</button>
          </nav>

          <button className="btn btn-primary nav-cta-desktop" onClick={enterApp}>Get Started</button>
        </div>
      </header>

      <main className="main-content">
        {currentPage === 'home' && <HomePage navigateTo={navigateTo} waterCount={waterCount} enterApp={enterApp} />}
        {currentPage === 'features' && <FeaturesPage navigateTo={navigateTo} />}
        {currentPage === 'workflow' && <WorkflowPage navigateTo={navigateTo} />}
        {currentPage === 'about' && <AboutPage navigateTo={navigateTo} />}
        {currentPage === 'contact' && <ContactPage />}
        {currentPage === 'privacy' && <PrivacyPage />}
      </main>

      <footer className="footer colored-footer">
        <div className="container footer-grid">
          <div className="footer-brand-col">
            <div className="footer-logo">
              <div className="brand-icon-circle brand-icon-circle-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 9 0 4.9-4 9-9 9z" />
                </svg>
              </div>
              <span className="bold-brand footer-brand-text">AXIS</span>
            </div>
            <p className="footer-subtext">Agricultural Excellence in Irrigation Schemes</p>
          </div>
          <div className="footer-nav-links">
            <button onClick={() => navigateTo('about')}>About</button>
            <button onClick={() => navigateTo('features')}>Features</button>
            <button onClick={() => navigateTo('privacy')}>Privacy</button>
            <button onClick={() => navigateTo('contact')}>Contact</button>
          </div>
          <div className="footer-socials">
            <a href="#facebook" aria-label="Facebook"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
            <a href="#twitter" aria-label="Twitter"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg></a>
            <a href="#instagram" aria-label="Instagram"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---- Home Page ---- */
function HomePage({ navigateTo, waterCount, enterApp }: { navigateTo: (page: Page) => void; waterCount: number; enterApp: () => void }) {
  return (
    <>
      <section className="hero-section">
        <div className="container hero-container">
          <div className="hero-text-block">
            <h1 className="hero-title">
              Smart Irrigation.<br />
              Better Harvests.<br />
              <span className="gradient-text">Sustainable Future.</span>
            </h1>
            <p className="hero-description">
              Precision sensors and weather-driven recommendations help you apply the right amount of water at the right time.
            </p>
            <div className="hero-cta-group">
              <button className="btn btn-primary" onClick={enterApp}>Get Started</button>
              <button className="btn btn-secondary" onClick={() => navigateTo('workflow')}>Learn More</button>
            </div>
          </div>
          <div className="hero-graphic-block">
            <div className="hero-visual-outer">
              <img
                src="/assets/axis_hero_irrigation_crop.png"
                alt="AXIS Smart Precision Irrigation Scheme"
                className="hero-crop-img"
              />
              <div className="hero-water-card">
                <span className="water-card-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#2e7d32">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  </svg>
                </span>
                <div className="water-card-info">
                  <span className="water-card-label">Prescribed Today</span>
                  <strong className="water-card-value">{waterCount} Litres</strong>
                  <span className="water-card-sub">Best Window: 6:00 AM - 8:00 AM</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="features-section">
        <div className="container features-grid">
          <div className="feature-card interactive-card">
            <div className="f-icon green-bg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
            <h3>Smart<br />Recommendations</h3>
            <p className="feature-desc">Tailored watering plans driven by localized soil data.</p>
          </div>
          <div className="feature-card interactive-card">
            <div className="f-icon blue-bg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V10" />
                <path d="M12 14c-3-2.5-6-2.5-8 0 0-4.5 3.5-8 8-8s8 3.5 8 8c-2-2.5-5-2.5-8 0" fill="#bae6fd" />
              </svg>
            </div>
            <h3>Track Crop<br />Growth</h3>
            <p className="feature-desc">Monitor lifecycle stages and harvest timelines.</p>
          </div>
          <div className="feature-card interactive-card">
            <div className="f-icon amber-bg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 20h18" />
                <path d="M3 16l5-5 4 4 8-8" />
                <path d="M16 7h4v4" />
              </svg>
            </div>
            <h3>Save Water &<br />Increase Yields</h3>
            <p className="feature-desc">Minimize waste while boosting agricultural productivity.</p>
          </div>
          <div className="feature-card interactive-card">
            <div className="f-icon purple-bg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
              </svg>
            </div>
            <h3>Offline First<br />Experience</h3>
            <p className="feature-desc">Seamlessly operates in low-connectivity rural environments.</p>
          </div>
        </div>
      </section>

      <section className="workflow-section">
        <div className="container">
          <h2 className="section-title-centered">How It Works</h2>
          <div className="title-rule"></div>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-badge badge-green">1</div>
              <h3>Add Your Farm</h3>
              <p>Set up your farm, crops, soil type, and irrigation system.</p>
            </div>
            <div className="step-card">
              <div className="step-badge badge-blue">2</div>
              <h3>We Monitor</h3>
              <p>We use weather, soil and crop data to analyze conditions.</p>
            </div>
            <div className="step-card">
              <div className="step-badge badge-amber">3</div>
              <h3>Get Recommendations</h3>
              <p>Receive irrigation advice tailored to your crops.</p>
            </div>
            <div className="step-card">
              <div className="step-badge badge-purple">4</div>
              <h3>Track &amp; Improve</h3>
              <p>Track growth and water use to improve productivity.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="container">
          <div className="quote-card">
            <div className="quote-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#2e7d32" stroke="none">
                <path d="M10 11H6C6 7.686 8.686 5 12 5V3C7.582 3 4 6.582 4 11v7a2 2 0 002 2h4a2 2 0 002-2v-5a2 2 0 00-2-2zm10 0h-4c0-3.314 2.686-6 6-6V3c-4.418 0-8 3.582-8 8v7a2 2 0 002 2h4a2 2 0 002-2v-5a2 2 0 00-2-2z" />
              </svg>
            </div>
            <div className="quote-content">
              <p className="quote-text">Since I started using AXIS, I save water and get better yields. It has changed how I farm.</p>
              <span className="quote-author">Jane, Tomato Farmer, Kiambu</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ready-banner-section">
        <div className="container ready-inner">
          <div className="ready-text">
            <h2>Ready to Grow Smarter?</h2>
            <p>Join thousands of farmers optimizing water usage with AXIS.</p>
          </div>
          <button className="btn btn-primary btn-large" onClick={enterApp}>Get Started Now</button>
        </div>
      </section>
    </>
  );
}

/* ---- Features Page ---- */
function FeaturesPage({ navigateTo }: { navigateTo: (page: Page) => void }) {
  return (
    <div className="container page-padding">
      <div className="page-hero-banner">
        <h1 className="page-header">Platform Features</h1>
        <p className="page-lead">AXIS (Agricultural Excellence in Irrigation Schemes) combines stage-specific agronomy, satellite weather, and sensor data into actionable water advice.</p>
      </div>

      <div className="features-grid-detailed">
        <div className="feature-detail-card">
          <div className="f-icon green-bg"><SketchWaterDrop size={26} color="#1b5e20" /></div>
          <h3>Deterministic Water Engine</h3>
          <p>Calculates daily crop evapotranspiration (ET_c) using Hargreaves temperature formula, stage-specific basal crop coefficients (K_cb), and application efficiency correction.</p>
        </div>

        <div className="feature-detail-card">
          <div className="f-icon blue-bg"><SketchRain size={26} color="#1b5e20" /></div>
          <h3>Effective Rain Credit</h3>
          <p>Forecast rain at or above 40% probability and 2 mm automatically credits 80% towards daily crop water replacement, saving energy and pump fuel.</p>
        </div>

        <div className="feature-detail-card">
          <div className="f-icon amber-bg"><SketchLock size={26} color="#1b5e20" /></div>
          <h3>100% Offline Resilience</h3>
          <p>Built with IndexedDB local storage. Your recommendations, logs, sensor history, and crop stages remain accessible anywhere in the field without cellular data.</p>
        </div>

        <div className="feature-detail-card">
          <div className="f-icon purple-bg"><SketchCrop size={26} color="#1b5e20" /></div>
          <h3>Stage-Aware Crop Catalog</h3>
          <p>Tracks four distinct growth stages: establishing, developing, productive, and maturing. Provides accurate water depth recommendations tailored to crop maturity.</p>
        </div>
      </div>

      <div className="page-cta-wrapper">
        <button className="btn btn-primary" onClick={() => navigateTo('home')}>Back to Home</button>
      </div>
    </div>
  );
}

/* ---- Workflow Page (How It Works) ---- */
function WorkflowPage({ navigateTo }: { navigateTo: (page: Page) => void }) {
  const [activeStep, setActiveStep] = useState(1);

  const stepsData = [
    {
      num: 1,
      title: 'Configure Plot & Crop',
      icon: <SketchCrop size={24} color="#1b5e20" />,
      summary: 'Register your field area, crop variety, planting date, and irrigation system.',
      details: 'AXIS sets up stage-specific water parameters based on FAO-56 crop coefficient curves. Whether using drip lines or furrow channels, AXIS calculates the exact volumetric water requirement in litres.'
    },
    {
      num: 2,
      title: 'Ingest Localized Weather & Soil Context',
      icon: <SketchSun size={24} color="#1b5e20" />,
      summary: 'Automated retrieval of maximum/minimum temperatures, rainfall probability, and humidity.',
      details: 'AXIS connects to localized Kijani weather data sources with automatic memory caching and climatology fallbacks. Optional soil sensors provide contextual moisture readings to validate field status.'
    },
    {
      num: 3,
      title: 'Deterministic Engine Calculation',
      icon: <SketchGear size={24} color="#1b5e20" />,
      summary: 'Authoritative calculation of net daily replacement requirement.',
      details: 'The engine applies effective rainfall deductions (max(0, baseline - recommended)) and checks against the 1 mm gross requirement threshold to determine IRRIGATE, REDUCED, or SKIP decisions.'
    },
    {
      num: 4,
      title: 'Precision Actionable Advice',
      icon: <SketchWaterDrop size={24} color="#1b5e20" />,
      summary: 'Get exact litres, run duration in minutes, and optimal watering time window.',
      details: 'Recommendations are presented on your mobile dashboard with clear explanations of why the specific water volume was prescribed, including water avoided due to forecast rain.'
    },
    {
      num: 5,
      title: 'Log & Track Water Savings',
      icon: <SketchChart size={24} color="#1b5e20" />,
      summary: 'Log actual irrigation applied using flow meters or manual volume estimates.',
      details: 'Your device stores full history offline, providing weekly trends, usage breakdowns by crop, and verified volume logs for water scheme accountability.'
    }
  ];


  return (
    <div className="container page-padding">
      <div className="page-hero-banner text-center">
        <span className="eyebrow-pill">How It Works</span>
        <h1 className="page-header">5 Steps to Agricultural Excellence</h1>
        <p className="page-lead">How AXIS transforms raw weather and crop data into actionable, water-saving decisions for smallholder farmers.</p>
      </div>

      {/* Interactive Step Navigator */}
      <div className="workflow-stepper-container">
        <div className="workflow-step-pills">
          {stepsData.map(step => (
            <button
              key={step.num}
              className={`workflow-pill ${activeStep === step.num ? 'active' : ''}`}
              onClick={() => setActiveStep(step.num)}
            >
              <span className="step-num-badge">{step.num}</span>
              <span className="step-pill-title">{step.title}</span>
            </button>
          ))}
        </div>

        <div className="active-step-card">
          <div className="active-step-head">
            <div className="step-large-icon">{stepsData[activeStep - 1].icon}</div>
            <div>
              <span className="step-eyebrow">Step {activeStep} of 5</span>
              <h2>{stepsData[activeStep - 1].title}</h2>
            </div>
          </div>
          <p className="step-summary-bold">{stepsData[activeStep - 1].summary}</p>
          <p className="step-detail-text">{stepsData[activeStep - 1].details}</p>

          <div className="step-nav-buttons">
            <button
              className="btn btn-secondary compact"
              disabled={activeStep === 1}
              onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            >
              ← Previous Step
            </button>
            <button
              className="btn btn-primary compact"
              disabled={activeStep === 5}
              onClick={() => setActiveStep(prev => Math.min(5, prev + 1))}
            >
              Next Step →
            </button>
          </div>
        </div>
      </div>

      {/* Core Calculation Invariants Card */}
      <div className="invariants-banner-card">
        <div className="inv-head">
          <span className="inv-icon">🛡️</span>
          <div>
            <h3>Deterministic Engine Invariants</h3>
            <p>Guaranteed mathematical standards enforced across every calculation.</p>
          </div>
        </div>
        <div className="inv-grid">
          <div className="inv-item">
            <strong>1 mm × 1 m² = 1 Litre</strong>
            <span>Direct physical conversion with irrigation efficiency applied by division.</span>
          </div>
          <div className="inv-item">
            <strong>Effective Rain Credit</strong>
            <span>80% credit for forecast rain ≥ 2 mm and ≥ 40% probability.</span>
          </div>
          <div className="inv-item">
            <strong>Sub-Threshold Deficit</strong>
            <span>Requirements below 1 mm output SKIP while retaining deficit for the next cycle.</span>
          </div>
          <div className="inv-item">
            <strong>100% Offline First</strong>
            <span>IndexedDB device-local persistence ensuring complete functionality in remote fields.</span>
          </div>
        </div>
      </div>

      <div className="page-cta-wrapper">
        <button className="btn btn-primary btn-large" onClick={() => navigateTo('home')}>Back to Home</button>
      </div>
    </div>
  );
}

/* ---- About Page ---- */
function AboutPage({ navigateTo }: { navigateTo: (page: Page) => void }) {
  return (
    <div className="container page-padding">
      <div className="page-hero-banner text-center">
        <span className="eyebrow-pill">About AXIS</span>
        <h1 className="page-header">AXIS — Agricultural Excellence in Irrigation Schemes</h1>
        <p className="page-lead">Empowering smallholder farmers with deterministic, evidence-based agronomic intelligence to maximize crop yields while conserving water.</p>
      </div>

      <div className="about-sections-grid">
        <div className="about-card-box">
          <div className="about-card-icon">🌾</div>
          <h2>Our Mission</h2>
          <p>
            AXIS was created to bridge the gap between complex agronomic crop-water science and daily farm management. By providing localized, deterministic recommendations, AXIS helps farmers irrigate with confidence, protect soil health, and boost crop productivity across East Africa.
          </p>
        </div>

        <div className="about-card-box">
          <div className="about-card-icon">💧</div>
          <h2>Water Avoidance & Savings</h2>
          <p>
            Traditional irrigation often results in over-watering or irrigating immediately before rain. AXIS automatically factors in localized precipitation forecasts and soil moisture context to label exact litres saved ("Water avoided because rain was considered").
          </p>
        </div>

        <div className="about-card-box">
          <div className="about-card-icon">📱</div>
          <h2>Local-First Offline Architecture</h2>
          <p>
            Farmer plots, irrigation events, sensor readings, and recommendations are saved directly in your device’s IndexedDB. AXIS requires no server database or login authentication during daily use, ensuring total privacy and reliability even in zero-signal rural areas.
          </p>
        </div>

        <div className="about-card-box">
          <div className="about-card-icon">🤖</div>
          <h2>Authoritative Engine & AI Safeguards</h2>
          <p>
            The deterministic agronomy engine is authoritative. While optional AI models may explain or summarize calculation patterns for farmers, AI never calculates or alters water litres, watering windows, or IRRIGATE / SKIP decisions.
          </p>
        </div>
      </div>

      <div className="about-stats-banner">
        <div className="about-stat">
          <strong>100%</strong>
          <span>Offline Operation</span>
        </div>
        <div className="about-stat">
          <strong>4 Stages</strong>
          <span>Establishing to Maturing</span>
        </div>
        <div className="about-stat">
          <strong>0 Litres</strong>
          <span>Wasted on Sub-Threshold Rain</span>
        </div>
        <div className="about-stat">
          <strong>1 m² = 1 L</strong>
          <span>Physical Accuracy Standard</span>
        </div>
      </div>

      <div className="page-cta-wrapper">
        <button className="btn btn-primary btn-large" onClick={() => navigateTo('home')}>Back to Home</button>
      </div>
    </div>
  );
}

/* ---- Contact Page ---- */
function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    contact: '',
    location: '',
    cropType: 'Tomatoes',
    farmSize: '1-2 Acres',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="container page-padding">
      <div className="page-hero-banner text-center">
        <span className="eyebrow-pill">Get in Touch</span>
        <h1 className="page-header">Contact AXIS Team</h1>
        <p className="page-lead">Have questions about setting up your scheme, integrating flow meters, or optimizing crop water schedules? Reach out to our specialists.</p>
      </div>

      <div className="contact-dual-layout">
        {/* Contact Info & FAQs */}
        <div className="contact-info-panel">
          <div className="info-card">
            <h2>Contact Information</h2>
            <p className="info-intro">Our agronomists and support team are available Monday through Saturday.</p>

            <div className="contact-details-list">
              <div className="contact-detail-item">
                <span className="detail-icon">📍</span>
                <div>
                  <strong>Location</strong>
                  <p>AXIS Agricultural Hub, Kisumu / Nairobi, Kenya</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <span className="detail-icon">📞</span>
                <div>
                  <strong>Farmer Support Hotline</strong>
                  <p>+254 (0) 700 123 456 / +254 (0) 733 987 654</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <span className="detail-icon">✉️</span>
                <div>
                  <strong>Email Inquiry</strong>
                  <p>support@axis-irrigation.org</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <span className="detail-icon">🕒</span>
                <div>
                  <strong>Working Hours</strong>
                  <p>Mon - Sat: 8:00 AM – 6:00 PM EAT</p>
                </div>
              </div>
            </div>
          </div>

          <div className="info-faq-card">
            <h3>Frequently Asked Questions</h3>
            <div className="faq-item">
              <strong>Q: Does AXIS require an active internet connection?</strong>
              <p>No. All calculations, plot records, and irrigation logs run 100% offline in local browser storage.</p>
            </div>
            <div className="faq-item">
              <strong>Q: How do flow meter readings get logged?</strong>
              <p>You can enter start and end cumulative readings directly into the Log Irrigation modal for automatic volume validation.</p>
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="contact-form-panel">
          {submitted ? (
            <div className="success-card-banner">
              <div className="success-check-icon">✓</div>
              <h2>Message Received!</h2>
              <p>Thank you, <strong>{formData.fullName || 'Farmer'}</strong>. An AXIS agricultural specialist will contact you shortly regarding your <strong>{formData.cropType}</strong> plot in <strong>{formData.location || 'your area'}</strong>.</p>
              <button className="btn btn-secondary mt-4" onClick={() => setSubmitted(false)}>Send Another Message</button>
            </div>
          ) : (
            <form className="contact-modern-form" onSubmit={handleSubmit}>
              <h2>Send Us a Message</h2>
              <p className="form-sub-text">Fill out your farm details and our support team will get back to you.</p>

              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="e.g. John Ochieng"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="contact">Phone / Email</label>
                  <input
                    id="contact"
                    type="text"
                    required
                    placeholder="0712 345 678 or email"
                    value={formData.contact}
                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location / County</label>
                  <input
                    id="location"
                    type="text"
                    required
                    placeholder="e.g. Kisumu, Kenya"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label htmlFor="cropType">Primary Crop</label>
                  <select
                    id="cropType"
                    value={formData.cropType}
                    onChange={e => setFormData({ ...formData, cropType: e.target.value })}
                  >
                    <option value="Tomatoes">Tomatoes</option>
                    <option value="Maize">Maize</option>
                    <option value="Kales / Vegetables">Kales / Vegetables</option>
                    <option value="Rice">Rice</option>
                    <option value="Sugarcane">Sugarcane</option>
                    <option value="Other">Other Crop</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="farmSize">Farm Size</label>
                  <select
                    id="farmSize"
                    value={formData.farmSize}
                    onChange={e => setFormData({ ...formData, farmSize: e.target.value })}
                  >
                    <option value="Under 1 Acre">Under 1 Acre</option>
                    <option value="1-2 Acres">1 - 2 Acres</option>
                    <option value="3-5 Acres">3 - 5 Acres</option>
                    <option value="Over 5 Acres">Over 5 Acres</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message">How can we help you?</label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="Tell us about your irrigation scheme, water source, or questions..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary btn-large full-btn">
                Submit Inquiry
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Privacy Page ---- */
function PrivacyPage() {
  return (
    <div className="container page-padding">
      <div className="page-hero-banner text-center">
        <span className="eyebrow-pill">Security & Trust</span>
        <h1 className="page-header">Privacy & Local Storage Policy</h1>
        <p className="page-lead">AXIS prioritizes total farmer data ownership and local-first privacy standards.</p>
      </div>

      <div className="privacy-content-card">
        <h3>1. Device-Local IndexedDB Storage</h3>
        <p>All farmer plot dimensions, crop types, planting dates, irrigation history events, and sensor context remain stored strictly inside your browser’s IndexedDB database. AXIS does not upload farmer data to external persistent cloud databases.</p>

        <h3>2. Weather Data Ingestion</h3>
        <p>AXIS fetches localized temperature and precipitation probability forecasts from public weather providers (such as Kijani API) using location coordinates. Weather responses are cached locally on your device.</p>

        <h3>3. AI Advisory Labeling</h3>
        <p>Where AI features are enabled on local deployments, advice summaries are generated on request using calculated inputs. AI is purely advisory and never alters authoritative litres, minutes, or recommendation decisions.</p>
      </div>
    </div>
  );
}

