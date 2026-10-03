import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { t } from './locales/en';
import './styles.css';

function Home() {
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

  return <main className="content"><h1>{t('heading')}</h1><p>{t('introduction')}</p>
    {loading ? <p role="status">{t('authChecking')}</p> : profile
      ? <section aria-label={t('accountHeading')}><h2>{t('accountHeading')}</h2>
          <p>{t('signedInAs')} <strong>{profile.displayName}</strong> ({profile.region})</p>
          <button type="button" onClick={() => void logout()}>{t('logout')}</button></section>
      : <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>}
    {authError && <p role="alert">{t('authError')}</p>}
  </main>;
}

type Profile = { id: string; displayName: string; region: string; role: string };

function Status() {
  const [message, setMessage] = useState<string>(t('statusChecking'));
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/health', { signal: controller.signal })
      .then((response) => {
        setMessage(t(response.ok ? 'statusAvailable' : 'statusUnavailable'));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessage(t('statusUnavailable'));
        }
      });
    return () => controller.abort();
  }, []);
  return <main className="content"><h1>{t('statusHeading')}</h1><p role="status">{message}</p></main>;
}

function NotFound() {
  return <main className="content"><h1>{t('notFoundHeading')}</h1><Link to="/">{t('notFoundAction')}</Link></main>;
}

function App() {
  return <div className="app-shell">
    <header className="header"><Link className="brand" to="/">{t('appName')}</Link>
      <nav aria-label="Main navigation"><Link to="/">{t('navigationHome')}</Link><Link to="/status">{t('navigationStatus')}</Link></nav>
    </header>
    <Routes><Route path="/" element={<Home />} /><Route path="/status" element={<Status />} /><Route path="*" element={<NotFound />} /></Routes>
  </div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>,
);
