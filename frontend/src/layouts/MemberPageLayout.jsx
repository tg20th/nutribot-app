import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';

export default function MemberPageLayout({ children, activePath, className = '' }) {
  return <div className="community-page">
    <CommunityTopBar activePath={activePath}/>
    <div className={className}>
      <div className="community-shell">
        <CommunitySideNav activePath={activePath}/>
        <span className="community-sidenav-spacer" aria-hidden="true"/>
        {children}
      </div>
    </div>
  </div>;
}
