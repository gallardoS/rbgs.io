import { useLocale } from './locales';
import { languageLocales } from './locale-routing';
import type { Conversation } from './match-history-api';

export function MatchConversation({ thread, moderator = false }: { thread: Conversation; moderator?: boolean }) {
  const { t, language } = useLocale();
  return <div className="match-conversation">
    <div className="mh-thread-state"><span className={`mh-tag is-${thread.status.toLowerCase()}`}>{t(thread.status === 'OPEN' ? 'historyDisputeOpen' : thread.status === 'WAITING_PLAYER' ? 'historyWaitingPlayer' : 'historyDisputeResolved')}</span></div>
    {thread.olderMessages && <p className="mh-muted">{t('historyRecentMessages')}</p>}
    <ol className="mh-messages">{thread.messages.map(message => <li key={message.id} className={`is-${message.author.toLowerCase()}`}>
      <div><strong>{t(message.author === 'PLAYER' ? moderator ? 'historyPlayer' : 'historyYou' : message.author === 'MODERATOR' ? 'historyModerator' : 'historyDecision')}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleString(languageLocales[language], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
      {message.kind === 'EVIDENCE_REQUEST' && <span className="mh-message-kind">{t('historyEvidenceRequested')}</span>}
      <p>{message.kind === 'CANCELLED' ? t('historyCancelledExplanation') : message.body}</p>
    </li>)}</ol>
  </div>;
}
