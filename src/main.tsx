import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './locales';
import { App } from './App';
import './styles.css';
import { localizedPath, pathLanguage } from './locale-routing';

const root = document.getElementById('root')!;
const app = <StrictMode><BrowserRouter><LanguageProvider><App /></LanguageProvider></BrowserRouter></StrictMode>;
const pathname = localizedPath(window.location.pathname, pathLanguage(window.location.pathname));
if (root.dataset.prerenderPath === pathname) hydrateRoot(root, app);
else createRoot(root).render(app);
