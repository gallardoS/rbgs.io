import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LanguageProvider, useLocale } from './locales';
import type { MessageKey } from './locales/en';
import { HeroBackground } from './HeroBackground';
import { Leaderboard } from './Leaderboard';
import { MatchJourney } from './MatchJourney';
import { BrandText } from './BrandText';
import { BackToTop } from './BackToTop';
import { LanguageMenu } from './LanguageMenu';
import './styles.css';

function useSession() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(new URLSearchParams(window.location.search).has('auth'));
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/auth/me', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (response.ok && response.status !== 204) setProfile(await response.json() as Profile);
        else if (response.status !== 204) setAuthError(true);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setAuthError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function logout() {
    const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=')[1];
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST', credentials: 'same-origin', headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
      });
      if (response.ok) setProfile(null);
      else setAuthError(true);
    } catch {
      setAuthError(true);
    }
  }

  return { profile, loading, authError, logout };
}

type Session = ReturnType<typeof useSession>;

function Home({ profile, loading, authError }: Session) {
  const { t } = useLocale();
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -bounds.top / (bounds.height * .85)));
      hero.style.setProperty('--hero-opacity', String(motion.matches ? 1 : 1 - progress));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    motion.addEventListener('change', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motion.removeEventListener('change', schedule);
    };
  }, []);
  return <main><section className="hero" ref={heroRef} aria-labelledby="hero-heading"><HeroBackground /><div className="hero-content">
    <img className="forever-icon" src="/wow-forever.svg" width="80" height="69" alt="" />
    <h1 id="hero-heading"><BrandText text={t('heroTitle')} /></h1><p className="hero-introduction"><BrandText text={t('heroSolution')} /></p>
    <p className="hero-features"><BrandText text={t('heroDescription')} /></p>
    <div className="hero-actions">
      {loading ? <p role="status">{t('authChecking')}</p> : profile
        ? <Link className="button hero-play" to="/play">{t('navigationPlay')}</Link>
        : <a className="button battle-net-button" href="/oauth2/authorization/battle-net"><img src="/battle-net.svg" width="24" height="24" alt="" />{t('login')}<span className="button-arrow" aria-hidden="true">↗</span></a>}
      {authError && <p role="alert">{t('authError')}</p>}
    </div>
  </div></section><MatchJourney /><Leaderboard preview /></main>;
}

type Profile = { id: string; displayName: string; region: string; role: string };

function Status() {
  const { t } = useLocale();
  const [message, setMessage] = useState<MessageKey>('statusChecking');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/health', { signal: controller.signal })
      .then((response) => {
        setMessage(response.ok ? 'statusAvailable' : 'statusUnavailable');
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessage('statusUnavailable');
        }
      });
    return () => controller.abort();
  }, []);
  return <main className="content"><h1>{t('statusHeading')}</h1><p role="status">{t(message)}</p></main>;
}

function NotFound() {
  const { t } = useLocale();
  return <main className="content"><h1>{t('notFoundHeading')}</h1><Link to="/">{t('notFoundAction')}</Link></main>;
}

function App() {
  const { t } = useLocale();
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (location.hash === '#how-it-works') {
        document.getElementById('how-it-works')?.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, location.key]);
  return <div className="app-shell">
    <header className="header"><Link className="brand" to="/">{t('appName')}</Link>
      <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{t('navigationMenu')}</button>
      <nav id="main-navigation" className={menuOpen ? 'main-navigation is-open' : 'main-navigation'} aria-label={t('navigationLabel')}>
        <NavLink to="/leaderboard">{t('navigationLeaderboard')}</NavLink>
        <NavLink to="/downloads">{t('navigationDownloads')}</NavLink>
        <Link to="/#how-it-works">{t('navigationGuide')}</Link>
        <NavLink className="nav-play" to="/play">{t('navigationPlay')}</NavLink>
        {session.loading ? <span role="status">{t('authChecking')}</span> : session.profile
          ? <details className="account-menu" key={location.pathname}><summary>
            <svg className="user-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
            <span>{session.profile.displayName}</span></summary><div>
              <Link to="/account">{t('navigationProfile')}</Link>
              <Link to="/match-history">{t('navigationHistory')}</Link>
              <Link to="/my-group">{t('navigationGroup')}</Link>
              <Link to="/settings">{t('navigationSettings')}</Link>
              <button onClick={() => void session.logout()}>{t('logout')}</button>
            </div></details>
          : <a className="nav-login" href="/oauth2/authorization/battle-net"><img src="/battle-net.svg" width="20" height="20" alt="" />{t('navigationLogin')}</a>}
      </nav>
      <LanguageMenu />
    </header>
    <Routes><Route path="/" element={<Home {...session} />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/downloads" element={<InfoPage heading="navigationDownloads" introduction="downloadsIntro"><div className="info-grid">
        <article><h2>{t('companionHeading')}</h2><p>{t('companionDescription')}</p><span className="availability">{t('releasePending')}</span></article>
        <article><h2>{t('addonHeading')}</h2><p>{t('addonDescription')}</p><span className="availability">{t('releasePending')}</span></article>
      </div><Link className="button" to="/#how-it-works">{t('navigationGuide')}</Link></InfoPage>} />
      <Route path="/how-it-works" element={<Navigate to="/#how-it-works" replace />} />
      <Route path="/play" element={<InfoPage heading="navigationPlay" introduction="playIntro"><div className="info-grid">
        <article><h2>{t('soloHeading')}</h2><p>{t('soloDescription')}</p></article><article><h2>{t('premadeHeading')}</h2><p>{t('premadeDescription')}</p></article>
      </div><p>{t('queuePending')}</p><Link className="button" to="/#how-it-works">{t('navigationGuide')}</Link></InfoPage>} />
      <Route path="/account" element={<InfoPage heading="navigationProfile" introduction="accountIntro">{session.loading ? <p role="status">{t('authChecking')}</p> : session.profile
        ? <><p>{t('signedInAs')} <strong>{session.profile.displayName}</strong></p><button onClick={() => void session.logout()}>{t('logout')}</button></>
        : <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>}{session.authError && <p role="alert">{t('authError')}</p>}</InfoPage>} />
      <Route path="/match-history" element={<InfoPage heading="navigationHistory" introduction="historyIntro"><p>{t('historyPending')}</p></InfoPage>} />
      <Route path="/my-group" element={<InfoPage heading="navigationGroup" introduction="groupIntro"><p>{t('groupPending')}</p></InfoPage>} />
      <Route path="/settings" element={<InfoPage heading="navigationSettings" introduction="settingsIntro"><p>{t('settingsPending')}</p></InfoPage>} />
      <Route path="/status" element={<Status />} /><Route path="*" element={<NotFound />} /></Routes>
    <footer className="footer"><span className="brand">{t('appName')}</span><Link to="/status">{t('navigationStatus')}</Link></footer>
    <BackToTop />
  </div>;
}

function InfoPage({ heading, introduction, children }: { heading: MessageKey; introduction?: MessageKey; children: React.ReactNode }) {
  const { t } = useLocale();
  return <main className="content info-page"><h1><BrandText text={t(heading)} /></h1>{introduction && <p className="page-introduction"><BrandText text={t(introduction)} /></p>}{children}</main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><LanguageProvider><BrowserRouter><App /></BrowserRouter></LanguageProvider></StrictMode>,
);
