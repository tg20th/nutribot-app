import { Menu, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const links = [{ label: 'Home', target: 'home' }, { label: 'Explore', target: 'explore' }, { label: 'Recipes', target: 'recipes' }, { label: 'Videos', target: 'videos' }, { label: 'Community', target: 'community' }];

export default function Header({ onSearch, onAuth }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [active, setActive] = useState('Home');
  const header = useRef(null);
  const nav = useRef(null);
  const indicator = useRef(null);
  const linkRefs = useRef({});
  const searchInputRef = useRef(null);

  const moveIndicator = (label, immediate = false) => {
    const item = linkRefs.current[label];
    if (!item || !nav.current || !indicator.current) return;
    const navBox = nav.current.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    gsap.to(indicator.current, { x: itemBox.left - navBox.left, width: itemBox.width, duration: immediate ? 0 : .48, ease: 'power3.out', overwrite: true });
  };

  useGSAP(() => {
    const show = () => gsap.to(header.current, { yPercent: 0, duration: .38, ease: 'power3.out', overwrite: true });
    const hide = () => gsap.to(header.current, { yPercent: -118, duration: .38, ease: 'power3.inOut', overwrite: true });
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        header.current?.classList.toggle('is-scrolled', self.scroll() > 18);
        if (self.scroll() < 30 || self.direction === -1) show();
        else if (!open) hide();
      }
    });
    gsap.fromTo(header.current, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'power3.out' });
    return () => trigger.kill();
  }, [open]);

  useEffect(() => {
    const sections = links.map(({ label, target }) => ({ label, element: document.getElementById(target) })).filter(({ element }) => element);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(sections.find(({ element }) => element === visible.target)?.label ?? 'Home');
    }, { rootMargin: '-28% 0px -55% 0px', threshold: [0, .15, .4] });
    sections.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => { moveIndicator(active); const update = () => moveIndicator(active, true); window.addEventListener('resize', update); requestAnimationFrame(update); return () => window.removeEventListener('resize', update); }, [active]);

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value.trim())}`);
    } else {
      navigate('/search');
    }
    setOpen(false);
    if (onSearch) onSearch(value);
  };

  const navigateSection = (label) => {
    setActive(label);
    setOpen(false);
    moveIndicator(label);
    gsap.fromTo(header.current, { scale: .98 }, { scale: 1, duration: .42, ease: 'back.out(2)' });
  };

  return (
    <header ref={header} className="site-header">
      <div className="nav-wrap">
        <a className="brand" href="#home" onClick={() => navigateSection('Home')} aria-label="NutriBot home">
          <span>Nutri</span>Bot<small>Good Food. Brighter You.</small>
        </a>

        <nav ref={nav} className={open ? 'nav-links open' : 'nav-links'}>
          {links.map(({ label, target }) =>
            label === 'Community'
              ? <Link ref={(node) => { linkRefs.current[label] = node; }} key={label} to="/community" className={active === label ? 'active' : ''}>{label}</Link>
              : <a ref={(node) => { linkRefs.current[label] = node; }} key={label} onClick={() => navigateSection(label)} className={active === label ? 'active' : ''} href={`#${target}`}>{label}</a>
          )}
          <span ref={indicator} className="nav-indicator" aria-hidden="true"/>
        </nav>

        <form className="nav-search" onSubmit={submit}>
          <Search size={17}/>
          <input
            ref={searchInputRef}
            aria-label="Search content"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tìm kiếm công thức, bài viết..."
          />
        </form>

        <div className="account-actions">
          <button className="nav-login" onClick={() => onAuth('login')}>Log in</button>
          <button className="button button-small" onClick={() => onAuth('signup')}>Sign up</button>
        </div>

        <button className="menu-button" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          {open ? <X/> : <Menu/>}
        </button>
      </div>
    </header>
  );
}
