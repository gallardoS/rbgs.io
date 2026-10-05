import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './locales';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root')!;
const app = <StrictMode><LanguageProvider><BrowserRouter><App /></BrowserRouter></LanguageProvider></StrictMode>;
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
if (root.dataset.prerenderPath === pathname) hydrateRoot(root, app);
else createRoot(root).render(app);
