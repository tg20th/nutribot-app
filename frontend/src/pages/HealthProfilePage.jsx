import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import HealthProfileSection from '../components/profile/HealthProfileSection';
import colorfulPlate from '../assets/colorful-plate.jpg';
import '../styles/health-profile.css';

gsap.registerPlugin(ScrollTrigger);

export default function HealthProfilePage() {
  const pageRef = useRef(null);
  const [query, setQuery] = useState('');

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const scopedTargets = (selector) => pageRef.current?.querySelectorAll(selector) ?? [];
      const heroCopy = scopedTargets('.health-hero-copy > *');
      const heroImage = scopedTargets('.health-hero-visual img');
      const hero = scopedTargets('.health-hero');
      const healthCards = scopedTargets('.health-bento > *');

      if (heroCopy.length) gsap.from(heroCopy, { y: 22, opacity: 0, duration: 0.72, stagger: 0.08, ease: 'power3.out' });
      if (heroImage.length && hero.length) {
        gsap.fromTo(heroImage, { scale: 0.88, opacity: 0.72 }, { scale: 1.04, opacity: 0.56, ease: 'none', scrollTrigger: { trigger: hero[0], start: 'top top+=76', end: 'bottom top+=76', scrub: true } });
      }
      if (healthCards.length) gsap.from(healthCards, { y: 46, opacity: 0, scale: 0.97, duration: 0.7, stagger: 0.11, ease: 'power3.out', delay: 0.22 });
    });
    return () => media.revert();
  }, { scope: pageRef });

  return (
    <div className="community-page health-profile-page" ref={pageRef}>
      <CommunityTopBar query={query} onQueryChange={setQuery} activePath="/profile/health" />
      <div className="community-shell">
        <CommunitySideNav activePath="/profile/health" />
        <span className="community-sidenav-spacer" aria-hidden="true" />
        <main className="health-main">
          <section className="health-hero" aria-labelledby="health-page-title">
            <div className="health-hero-copy">
              <p>Health, in context</p>
              <h1 id="health-page-title">Know your <span className="health-title-image" aria-hidden="true" /> body. Feed your goals.</h1>
              <span>Give NutriBot a clearer baseline for guidance that feels safer, simpler and genuinely yours.</span>
              <div className="health-hero-actions">
                <button type="button" onClick={() => document.querySelector('.health-profile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Shape my baseline <ArrowDown size={16} /></button>
                <Link to="/profile">Personal details <ArrowRight size={16} /></Link>
              </div>
            </div>
            <div className="health-hero-visual">
              <img src={colorfulPlate} alt="A person holding a colorful plant-based bowl" />
            </div>
          </section>
          <HealthProfileSection />
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
