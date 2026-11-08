export const localStandings = import.meta.env.DEV && import.meta.env.MODE === 'standings';
export const standingsEnabled = localStandings || import.meta.env.VITE_PUBLIC_LEADERBOARD === 'true';
export const standingsApi = localStandings ? '/api/v1/local/leaderboard' : '/api/v1/leaderboard';
