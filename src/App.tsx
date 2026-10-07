import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Link, NavLink } from './LocalizedLink';
import { basePath, localizedPath } from './locale-routing';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import { HeroBackground } from './HeroBackground';
import { Leaderboard } from './Leaderboard';
import { MatchJourney } from './MatchJourney';
import { BrandText } from './BrandText';
import { BackToTop } from './BackToTop';
import { LanguageMenu } from './LanguageMenu';
import { CharacterSelection } from './CharacterSelection';
import { BattleNetLoginButton } from './BattleNetLoginButton';
import pageTitles from './page-titles.json';
import pageDescriptions from './page-descriptions.json';
import internalRoutes from './internal-routes.json';

function useSession() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('auth')) setAuthError(true);
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
    const scroller = document.getElementById('page-scroll');
    let frame = 0;
    let lastOpacity = '';
    const update = () => {
      frame = 0;
      let opacity = '1';
      if (!motion.matches) {
        const bounds = hero.getBoundingClientRect();
        const viewportTop = scroller?.getBoundingClientRect().top ?? 0;
        const progress = Math.max(0, Math.min(1, (viewportTop - bounds.top) / (bounds.height * .85)));
        opacity = String(1 - progress);
      }
      if (opacity !== lastOpacity) {
        hero.style.setProperty('--hero-opacity', opacity);
        lastOpacity = opacity;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    motion.addEventListener('change', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', schedule);
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
        : <BattleNetLoginButton />}
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

export function App() {
  const { t, language } = useLocale();
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const pathname = localizedPath(location.pathname, language);
    const homepage = localizedPath('/', language) as keyof typeof pageTitles;
    const isPublicPage = Object.hasOwn(pageTitles, pathname);
    const isKnownRoute = Object.hasOwn(pageTitles, pathname) || internalRoutes.includes(basePath(pathname)) || basePath(pathname) === '/how-it-works';
    const title = isKnownRoute ? pageTitles[pathname as keyof typeof pageTitles] ?? pageTitles[homepage] : `${t('notFoundHeading')} | rbgs.io`;
    document.title = title;
    document.querySelector('meta[name="robots"]')?.setAttribute('content', isPublicPage ? 'index, follow' : 'noindex, follow');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    const description = isKnownRoute ? pageDescriptions[pathname as keyof typeof pageDescriptions] ?? pageDescriptions[homepage] : t('notFoundHeading');
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', language === 'es' ? 'es_ES' : 'en_US');
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', description);
    }
    if (isPublicPage) {
      const url = new URL(pathname, 'https://rbgs.io').href;
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.append(canonical);
      }
      canonical.href = url;
      let socialUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (!socialUrl) {
        socialUrl = document.createElement('meta');
        socialUrl.setAttribute('property', 'og:url');
        document.head.append(socialUrl);
      }
      socialUrl.content = url;
      for (const [code, path] of [['en', localizedPath(pathname, 'en')], ['es', localizedPath(pathname, 'es')], ['x-default', localizedPath(pathname, 'en')]]) {
        const alternate = document.createElement('link');
        alternate.rel = 'alternate';
        alternate.hreflang = code;
        alternate.href = new URL(path, 'https://rbgs.io').href;
        document.head.append(alternate);
      }
    } else {
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [location.pathname, language]);
  useEffect(() => {
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (location.hash === '#how-it-works') {
        const scroller = document.getElementById('page-scroll');
        const target = document.getElementById('how-it-works');
        if (scroller && target) {
          const viewportTop = scroller.getBoundingClientRect().top;
          const destination = scroller.scrollTop + target.getBoundingClientRect().top - viewportTop;
          scroller.scrollTo({ top: destination, behavior: 'instant' });
        }
      } else {
        document.getElementById('page-scroll')?.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, location.key]);
  return <div className="app-shell">
    <header className="header"><Link className="brand" to="/">{t('appName')}</Link>
      <button type="button" className="menu-toggle" aria-label={t('navigationMenu')} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(open => !open)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      <nav id="main-navigation" className={menuOpen ? 'main-navigation is-open' : 'main-navigation'} aria-label={t('navigationLabel')}>
        <NavLink to="/leaderboard">{t('navigationLeaderboard')}</NavLink>
        <NavLink to="/downloads">{t('navigationDownloads')}</NavLink>
        <Link to="/#how-it-works">{t('navigationGuide')}</Link>
        <a className="nav-community" href="https://discord.gg/RfBgfszUPM" target="_blank" rel="noopener noreferrer">{t('navigationCommunity')}<img src="/external-link.svg" width="14" height="14" alt="" aria-hidden="true" /></a>
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
        <LanguageMenu />
      </nav>
    </header>
    <div id="page-scroll" className="page-scroll">
      <Routes location={{ ...location, pathname: basePath(location.pathname) }}><Route path="/" element={<Home {...session} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/downloads" element={<InfoPage heading="navigationDownloads" introduction="downloadsIntro"><div className="info-grid">
          <article><h2>{t('companionHeading')}</h2><p>{t('companionDescription')}</p><span className="availability">{t('releasePending')}</span></article>
          <article><h2>{t('addonHeading')}</h2><p>{t('addonDescription')}</p><span className="availability">{t('releasePending')}</span></article>
        </div><Link className="button" to="/#how-it-works">{t('navigationGuide')}</Link></InfoPage>} />
        <Route path="/how-it-works" element={<Navigate to={`${localizedPath('/', language)}#how-it-works`} replace />} />
        <Route path="/play" element={<main className="content play-page">
          <header className="play-heading"><h1>{t('navigationPlay')}</h1><p>{t('playIntro')}</p></header>
          <div className="play-lobby"><div className="play-character-stage">{session.loading ? <p role="status">{t('authChecking')}</p> : session.profile
            ? <CharacterSelection key={session.profile.id} accountId={session.profile.id} />
            : <BattleNetLoginButton />}
            {session.authError && <p role="alert">{t('authError')}</p>}
          </div>
            <div className="play-match-action"><button className="find-match" disabled aria-describedby="queue-availability">{t('findMatch')}</button>
              <p id="queue-availability" className="availability">{t('queuePending')}</p></div>
          </div><div className="play-mode-info">
            <details><summary>{t('soloHeading')}</summary><p>{t('soloDescription')}</p></details>
            <details><summary>{t('premadeHeading')}</summary><p>{t('premadeDescription')}</p></details>
          </div></main>} />
        <Route path="/account" element={<InfoPage heading="navigationProfile" introduction="profileIntro">{session.loading ? <p role="status">{t('authChecking')}</p> : session.profile
          ? <div className="profile-settings">
            <section className="profile-settings-section" aria-labelledby="profile-account-title">
              <div className="profile-section-heading"><h2 id="profile-account-title">{t('profileAccountHeading')}</h2><p>{t('profileAccountDescription')}</p></div>
              <dl className="profile-account-details"><div><dt>Battle.net</dt><dd>{session.profile.displayName}</dd></div><div><dt>{t('profileRegion')}</dt><dd>{session.profile.region.toUpperCase()}</dd></div></dl>
            </section>
            <section className="profile-settings-section" aria-labelledby="profile-session-title">
              <div className="profile-section-heading"><h2 id="profile-session-title">{t('profileSessionHeading')}</h2><p>{t('profileSessionDescription')}</p></div>
              <div><button onClick={() => void session.logout()}>{t('logout')}</button></div>
            </section>
          </div>
          : <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>}{session.authError && <p role="alert">{t('authError')}</p>}</InfoPage>} />
        <Route path="/match-history" element={<InfoPage heading="navigationHistory" introduction="historyIntro"><p>{t('historyPending')}</p></InfoPage>} />
        <Route path="/my-group" element={<InfoPage heading="navigationGroup" introduction="groupIntro"><p>{t('groupPending')}</p></InfoPage>} />
        <Route path="/settings" element={<InfoPage heading="navigationSettings" introduction="settingsIntro"><p>{t('settingsPending')}</p></InfoPage>} />
        <Route path="/status" element={<Status />} /><Route path="*" element={<NotFound />} /></Routes>
      <footer className="footer"><span className="brand">{t('appName')}</span><Link to="/status">{t('navigationStatus')}</Link></footer>
    </div>
    <BackToTop />
  </div>;
}

function InfoPage({ heading, introduction, children }: { heading: MessageKey; introduction?: MessageKey; children: React.ReactNode }) {
  const { t } = useLocale();
  return <main className="content info-page"><h1><BrandText text={t(heading)} /></h1>{introduction && <p className="page-introduction"><BrandText text={t(introduction)} /></p>}{children}</main>;
}

