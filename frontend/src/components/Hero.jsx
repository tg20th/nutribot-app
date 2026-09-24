import { ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';

const heroImage = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1600&q=90';

export default function Hero({ onSearch }) {
  const [query, setQuery] = useState('');
  const submit = (e) => { e.preventDefault(); onSearch(query); document.querySelector('#community')?.scrollIntoView({ behavior: 'smooth' }); };
  return <section className="hero" id="home"><div className="hero-copy">
    <p className="kicker">NUTRITION FOR EVERYDAY LIFE</p><h1>Eat with care.<br/><i>Feel at home.</i></h1>
    <p className="hero-intro">Wholesome recipes, thoughtful nutrition, and a community that makes eating well feel possible.</p>
    <form className="hero-search" onSubmit={submit}><Search size={19}/><input aria-label="Search recipes, blogs, videos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, blogs, videos..."/><button aria-label="Search"><ArrowRight size={20}/></button></form>
    <a className="quiet-link" href="#community">Explore the community <ArrowRight size={16}/></a>
  </div><div className="hero-visual"><div className="hero-image-frame"><img src={heroImage} alt="A colourful bowl of fresh, nourishing ingredients"/></div><div className="hero-image-detail" aria-hidden="true"/><span className="script script-one">Make a little room<br/>for nourishment.</span></div></section>;
}
