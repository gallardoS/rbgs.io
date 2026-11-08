const rotations = { up: 0, left: -90, right: 90 };

export function ArrowIcon({ direction = 'up' }: { direction?: keyof typeof rotations }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5m-7 7 7-7 7 7" transform={`rotate(${rotations[direction]} 12 12)`} />
  </svg>;
}
