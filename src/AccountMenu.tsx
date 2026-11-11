import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from './LocalizedLink';
import { useLocale } from './locales';
import { CharacterAvatar, type Character } from './PlayerCard';
import { CharacterSelection } from './CharacterSelection';
import { usePremadeQueueSession, useSoloQueueSession } from './SoloQueueSession';
import './AccountMenu.css';

function MenuIcon({ children }: { children: ReactNode }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const profileIcon = <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>;

export function AccountMenu({ accountId, displayName, onLogout }: {
  accountId: string; displayName: string; onLogout: () => Promise<void>;
}) {
  const { t } = useLocale();
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const soloQueue = useSoloQueueSession(), premadeQueue = usePremadeQueueSession();
  const selectionLocked = !!soloQueue?.active || !!premadeQueue?.active || !!soloQueue?.busy || !!premadeQueue?.busy
    || !!soloQueue && !soloQueue.status || !!premadeQueue && !premadeQueue.status;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    fetch('/api/v1/me/play-character', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Character unavailable');
        const text = await response.text();
        const selected = text ? JSON.parse(text) as { character?: Character | null } | null : null;
        if (!controller.signal.aborted) setCharacter(selected?.character ?? null);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => { controller.abort(); document.removeEventListener('pointerdown', dismiss); };
  }, [accountId, open]);

  return <><details ref={menu} className="account-menu" onToggle={event => setOpen(event.currentTarget.open)}
    onKeyDown={event => {
      if (event.key === 'Escape' && menu.current?.open) {
        event.preventDefault(); menu.current.open = false; menu.current.querySelector('summary')?.focus();
      }
    }}>
    <summary><span className="user-icon"><MenuIcon>{profileIcon}</MenuIcon></span><span>{displayName}</span></summary>
    <div className="account-menu-panel">
      <div className="account-menu-character" aria-busy={loading}>
        {loading ? <><span className="account-menu-avatar-skeleton skeleton-block" /><span className="account-menu-name-skeleton skeleton-block" /><span className="sr-only" role="status">{t('charactersLoading')}</span></>
          : <><button ref={avatarButton} type="button" className="account-menu-avatar-button" aria-label={t('charactersChange')}
              title={t('charactersChange')} aria-haspopup="dialog" disabled={selectionLocked} onClick={() => {
                if (menu.current) menu.current.open = false;
                setPickerOpen(true);
              }}>
              {character ? <CharacterAvatar character={character} /> : <span className="account-menu-avatar-empty"><MenuIcon>{profileIcon}</MenuIcon></span>}
              <span className="account-menu-avatar-edit" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16Z" /></svg></span>
            </button>
            <strong>{character?.name ?? displayName}</strong>
            {failed ? <span className="account-menu-character-hint" role="status">{t('charactersError')}</span>
              : !character && <Link className="account-menu-character-hint" to="/play">{t('playChooseCharacter')}</Link>}
          </>}
      </div>
      <div className="account-menu-links">
        <Link className="account-menu-item" to="/account"><MenuIcon>{profileIcon}</MenuIcon><span>{t('navigationProfile')}</span></Link>
        <Link className="account-menu-item" to="/match-history"><MenuIcon><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></MenuIcon><span>{t('navigationHistory')}</span></Link>
        <button type="button" className="account-menu-item" disabled>
          <MenuIcon><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M6 15h5m3-5h4m-4 4h4" /></MenuIcon>
          <span>{t('navigationCustomizeCard')}</span>
          <small className="coming-soon-label">{t('playComingSoon')}</small>
        </button>
        <Link className="account-menu-item" to="/settings"><MenuIcon><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" /></MenuIcon><span>{t('navigationSettings')}</span></Link>
      </div>
      <div className="account-menu-footer">
        <button type="button" className="account-menu-logout" disabled={loggingOut} onClick={async () => {
          setLoggingOut(true);
          try { await onLogout(); } finally { setLoggingOut(false); }
        }}><MenuIcon><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M9 12h12m-5-5 5 5-5 5" /></MenuIcon><span>{t('logout')}</span></button>
      </div>
    </div>
  </details>
    {pickerOpen && <CharacterSelection accountId={accountId} dialogOnly disabled={selectionLocked}
      onChange={value => { if (value) setCharacter(value); }} onPickerClose={() => {
        setPickerOpen(false);
        if (menu.current) menu.current.open = true;
        avatarButton.current?.focus();
      }} />}
  </>;
}
