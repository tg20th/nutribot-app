export default function CommunityFilters({ filters = [], active, onChange }) {
  return <div className="community-filters">
    {['All', ...filters].map((filter) => <button key={filter} className={filter === active ? 'is-active' : ''} onClick={() => onChange(filter)}>{filter}</button>)}
  </div>;
}
