import { createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { basePath } from './locale-routing';
import { useGroupLobby, type GroupLobby } from './GroupPage';
import { LobbyInvitationNotifications } from './LobbyInvitationNotifications';

const LobbySession = createContext<GroupLobby | null>(null);
export const useLobbySession = () => useContext(LobbySession);

export function AuthenticatedLobby({ accountId, children }: { accountId: string | null; children: ReactNode }) {
  return accountId ? <ConnectedLobby key={accountId} accountId={accountId}>{children}</ConnectedLobby> : children;
}

function ConnectedLobby({ accountId, children }: { accountId: string; children: ReactNode }) {
  const location = useLocation();
  const premade = basePath(location.pathname) === '/play' && new URLSearchParams(location.search).get('mode') === 'premade';
  const lobby = useGroupLobby(accountId, premade, true);
  return <LobbySession.Provider value={lobby}>{children}<LobbyInvitationNotifications lobby={lobby} /></LobbySession.Provider>;
}
