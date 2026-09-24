import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import communityMember from '../assets/community-member.jpg';
import colorfulPlate from '../assets/colorful-plate.jpg';
import freshProduce from '../assets/fresh-produce.jpg';
import heroBowl from '../assets/hero-bowl.jpg';
import nutribotHero from '../assets/nutribot-hero.png';

const defaultTopics = [
  { name: 'Balanced meals', image: heroBowl },
  { name: 'Everyday greens', image: freshProduce },
  { name: 'Plant-forward cooking', image: nutribotHero },
  { name: 'Bright breakfasts', image: communityMember },
  { name: 'Nutrition basics', image: colorfulPlate }
];

export function TopicAccordion({ topics = [] }) {
  const [active, setActive] = useState(0);
  const displayTopics = topics.length ? topics : defaultTopics;
  return <section className="accordion-section" id="explore"><div className="wide-heading"><p>Find your way in</p><h2>Start wherever you are.</h2></div><div className="topic-accordion">{displayTopics.slice(0, 5).map((topic, i) => <button onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} className={active === i ? 'active' : ''} key={topic.name} style={{ backgroundImage: `url(${topic.image})` }}><span>{topic.name}</span></button>)}</div></section>;
}

const notes = [
  ['“NutriBot helps me cook in a way that feels kind, easy, and completely my own.”', 'Mai, community member'],
  ['“The recipe collections make planning dinner feel less like a task and more like a small ritual.”', 'An, home cook'],
  ['“I come for the nutrition knowledge, then stay for the warm and useful ideas.”', 'Linh, NutriBot reader']
];
export function ReaderNotes() { const [index, setIndex] = useState(0); const [quote, name] = notes[index]; return <section className="reader-notes"><div className="reader-portrait"><img src={communityMember} alt="NutriBot community member"/></div><div className="reader-copy"><p>Community notes</p><blockquote>{quote}</blockquote><span>{name}</span><div><button onClick={() => setIndex((index + notes.length - 1) % notes.length)} aria-label="Previous note"><ArrowLeft size={18}/></button><button onClick={() => setIndex((index + 1) % notes.length)} aria-label="Next note"><ArrowRight size={18}/></button></div></div></section>; }
