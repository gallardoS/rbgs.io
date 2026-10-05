import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { App } from './App';
import { LanguageProvider } from './locales';

export function render(path: string) {
  return renderToString(<LanguageProvider><StaticRouter location={path}><App /></StaticRouter></LanguageProvider>);
}
