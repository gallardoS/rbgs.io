export function ratingTier(rating?: number) {
  if (rating === undefined) return undefined;
  if (rating >= 2400) return 'legendary';
  if (rating >= 2200) return 'epic';
  if (rating >= 1900) return 'rare';
  if (rating >= 1700) return 'uncommon';
  if (rating >= 1500) return 'common';
  return 'poor';
}
