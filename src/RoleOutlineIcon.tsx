export type RoleIcon = 'tank' | 'dps' | 'heal' | 'flag';

const outlines: Record<RoleIcon, string[]> = {
  tank: [
    'M16.5 16.5Q31 12.5 45.5 16.5L45 25Q42.5 39.5 31 48.5Q19.5 41 17.5 27Z',
    'M20 20Q31 17 41.5 20L41 26Q38.5 36.5 31 42Q23.5 36.5 21 27Z',
  ],
  dps: [
    'M24 32 37 18 43.5 16 43 21.5 28 35.5Z',
    'M25.5 33.5 40.5 19.5',
    'M20 28.5 23 29 23 31 30.5 38 31.5 39.5 30.5 41 28.5 38.5 22 33 20.5 33 20.5 30.5Z',
    'M22 35 24.5 37.5 20 41.5 17.5 39.5Z',
    'M17.5 39.5 20 41.5 19 44 16 44 15.5 41.5Z',
  ],
  heal: ['M26 16H36V25H45V35H36V44H26V35H17V25H26Z'],
  flag: [
    'M14.5 18.5 29.5 54.5',
    'M16 22Q24 24.5 29 22.5T37 20Q44 20 51.5 23Q42 23.5 38 28.5T31.5 38Q27 43 22.5 42Z',
    'M18 24Q22 31 23 39',
    'M13 17.5 14 17 16 18 15 20 13.5 19.5Z',
  ],
};

export function RoleOutlineIcon({ icon }: { icon: RoleIcon }) {
  return <svg className="role-outline" width="40" height="40" viewBox="0 0 63 63"
    fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
    strokeLinejoin="round" strokeDasharray=".1 3.5" aria-hidden="true">
    <circle cx="31.5" cy="31.5" r="28.5" />
    {outlines[icon].map((path, index) => <path key={index} d={path} />)}
  </svg>;
}
