import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function EditorialGallery({ posts = [] }) {
  const root = useRef(null);
  useGSAP(() => {
    const cards = gsap.utils.toArray('.journal-card');
    cards.forEach((card) => gsap.fromTo(card, { scale: .86, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 86%', end: 'center 48%', scrub: true } }));
    ScrollTrigger.create({ trigger: '.journal-title', start: 'top 20%', end: 'bottom 70%', pin: true, pinSpacing: false });
  }, { scope: root });
  return <section className="journal" ref={root}><div className="journal-title"><p>From our table</p><h2>Recipes and reflections to return to.</h2><a href="#community">Read what is new <ArrowRight size={17}/></a></div><div className="journal-list">{posts.slice(0, 3).map((post, index) => <article className={`journal-card card-${index} ${post.image ? '' : 'journal-card--text'}`} key={post.id}>{post.image ? <img src={post.image} alt=""/> : <div className="journal-no-image">NutriBot<br/>Journal</div>}<div><span>{post.type}</span><h3>{post.title}</h3><p>{post.description}</p><a href="#community">Read the story <ArrowRight size={15}/></a></div></article>)}</div></section>;
}
