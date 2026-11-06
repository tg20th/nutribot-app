import { Leaf } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { HOME_SECTION_IDS, navigateToHomeSection } from '../utils/homeSectionNavigation';

export default function Footer({ onAuth }) {
  const navigate = useNavigate();
  const columns = [
    ['Explore', [['Recipes', HOME_SECTION_IDS.recipes], ['Videos', HOME_SECTION_IDS.videos], ['Community', HOME_SECTION_IDS.community]]],
    ['Information', [['Our Mission', '/our-mission'], ['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service']]],
    ['Support', [['Help Center', '/help-center']]],
  ];
  return <><section className="join"><Leaf className="join-leaf leaf-left"/><div><h2>Join our community<br/>for a healthier tomorrow</h2></div><p>Create a free account to save your favorite recipes, follow creators and get personalized recommendations.</p><div className="join-actions"><button className="button" onClick={() => onAuth?.('signup')}>Create Free Account</button><button className="footer-login" onClick={() => onAuth?.('login')}>Already a member? Log in</button></div><Leaf className="join-leaf leaf-right"/></section><footer><div className="footer-top"><div className="footer-brand"><b><span>Nutri</span>Bot</b><p>Good Food. Brighter You.</p></div>{columns.map(([title, items]) => <div className="footer-col" key={title}><b>{title}</b>{items.map(([item, to]) => <Link to={to === '/our-mission' || to === '/privacy-policy' || to === '/terms-of-service' || to === '/help-center' ? to : '#'} onClick={to === '/our-mission' || to === '/privacy-policy' || to === '/terms-of-service' || to === '/help-center' ? undefined : (event) => { event.preventDefault(); navigateToHomeSection(navigate, to); }} key={item}>{item}</Link>)}</div>)}</div><div className="footer-bottom"><span>NutriBot 2026. All rights reserved.</span><span>Good Food. A Better You.</span></div></footer></>;
}
