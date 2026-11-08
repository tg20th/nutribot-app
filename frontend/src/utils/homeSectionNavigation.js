export const HOME_SECTION_IDS = {
  recipes: 'recipes',
  videos: 'videos',
  community: 'community-notes',
};

export function scrollToHomeSection(id) {
  const section = document.getElementById(id);
  if (!section) return false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

export function navigateToHomeSection(navigate, id) {
  if (window.location.pathname === '/' && scrollToHomeSection(id)) {
    window.history.replaceState({ ...window.history.state, homeSection: id }, '', `/#${id}`);
    return;
  }
  navigate({ pathname: '/', hash: `#${id}` }, { state: { scrollTarget: id } });
}
