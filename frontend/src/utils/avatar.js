export function getTrustedAvatarUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.toString() : '';
  } catch {
    return '';
  }
}

export function getProfileAvatarUrl(profile = {}) {
  return getTrustedAvatarUrl(profile.avatarUrl ?? profile.avatar ?? profile.profilePictureUrl);
}
