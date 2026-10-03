export const messages = {
  appName: 'rbgs.io',
  navigationHome: 'Home',
  navigationStatus: 'Service status',
  heading: 'Competitive battlegrounds for WoW: Forever',
  introduction: 'The matchmaking platform is being built. Ranked queues will open after compatibility and match verification are validated.',
  authChecking: 'Checking your session…',
  accountHeading: 'Your account',
  signedInAs: 'Signed in as',
  login: 'Sign in with Battle.net',
  logout: 'Sign out',
  authError: 'Authentication is unavailable or was cancelled. Please try again.',
  statusHeading: 'Service status',
  statusChecking: 'Checking the API…',
  statusAvailable: 'The API is available.',
  statusUnavailable: 'The API is unavailable.',
  notFoundHeading: 'Page not found',
  notFoundAction: 'Return home',
} as const;

export type MessageKey = keyof typeof messages;
export function t(key: MessageKey): string {
  return messages[key];
}
