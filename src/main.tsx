import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { t } from './locales/en';
import './styles.css';

function Home() {
  return <main className="content"><h1>{t('heading')}</h1><p>{t('introduction')}</p></main>;
}

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
