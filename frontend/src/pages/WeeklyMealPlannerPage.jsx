import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, RefreshCw, Repeat2, ShoppingBasket, Sparkles } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import MealPlanAssistant from '../components/community/MealPlanAssistant';
import MealPlanMatrix from '../components/community/MealPlanMatrix';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { getMyProfile } from '../services/profileApi';
import { getCurrentWeeklyMenu } from '../services/weeklyMealApi';

gsap.registerPlugin(ScrollTrigger);

export default function WeeklyMealPlannerPage() {
  const page = useRef(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('daily');
  const [communityUser, setCommunityUser] = useState({}); const [menu, setMenu] = useState({ days: [], groceryList: {}, week: {} }); const plannerDays = menu.days ?? []; const groceryList = menu.groceryList ?? {}; const plannerWeek = menu.week ?? {};
  useEffect(() => { const controller = new AbortController(); Promise.all([getMyProfile(controller.signal), getCurrentWeeklyMenu(controller.signal)]).then(([profile, weeklyMenu]) => { setCommunityUser(profile); setMenu({ days: weeklyMenu.days ?? [], groceryList: weeklyMenu.groceryList ?? {}, week: weeklyMenu.week ?? weeklyMenu }); }).catch(() => {}); return () => controller.abort(); }, []);

  useGSAP(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro
      .from('.planner-hero-copy > *', { y: 24, opacity: 0, duration: .7, stagger: .1 })
      .from('.planner-hero-image', { scale: .9, opacity: 0, duration: .9 }, '-=.55')
      .from('.planner-overview > *', { y: 16, opacity: 0, duration: .5, stagger: .08 }, '-=.35');

    gsap.to('.planner-scrub-word', {
      opacity: 1,
      stagger: .08,
      ease: 'none',
      scrollTrigger: {
        trigger: '.planner-overview',
        start: 'top 85%',
        end: 'bottom 52%',
        scrub: true
      }
    });

    gsap.utils.toArray('.planner-day').forEach((card) => {
      gsap.fromTo(card,
        { scale: .97, opacity: .35 },
        {
          scale: 1,
          opacity: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: card, start: 'top 91%', end: 'top 48%', scrub: true }
        }
      );
    });
  }, { scope: page });

  return <div className="community-page planner-page" ref={page}>
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <div className="community-layout">
        <main className="community-feed planner-main overflow-x-hidden">
          <header className="planner-hero">
            <div className="planner-hero-copy">
              <div className="planner-person">
                {communityUser.avatarUrl && <img src={communityUser.avatarUrl} alt={communityUser.fullName}/>} 
                <span>Curated for {communityUser.fullName ?? communityUser.name}</span>
              </div>
              <h1>Plan a week that feels <span className="planner-inline-image" aria-hidden="true"/> good to keep.</h1>
              <p>Built around your {(communityUser.goal ?? 'wellness').toLowerCase()} goal, with enough flexibility for the meals you actually want to eat.</p>
              <div className="planner-top-actions">
                <button type="button" className="planner-btn-primary"><RefreshCw size={15}/> Refresh this week</button>
                <a className="planner-btn-ghost" href="#grocery"><ShoppingBasket size={15}/> Grocery list <span>{groceryList.itemCount ?? 0}</span></a>
              </div>
            </div>
            <div className="planner-hero-image" aria-hidden="true">
              {plannerDays[1]?.meals?.[1]?.image && <img src={plannerDays[1].meals[1].image} alt=""/>}
              <div><Sparkles size={15}/><span>Balanced, not rigid</span></div>
            </div>
          </header>

          <section className="planner-overview" aria-label="Week overview">
            <div className="planner-week-nav">
              <button type="button" aria-label="Previous week"><ChevronLeft size={15}/></button>
              <div><span>Your week</span><b>{plannerWeek.range ?? ''}</b></div>
              <button type="button" aria-label="Next week"><ChevronRight size={15}/></button>
            </div>
            <div className="planner-week-avg">
              <span>Daily rhythm</span>
              <p><b>{(plannerWeek.avgCalories ?? 0).toLocaleString()}</b> kcal <i/> <b>{plannerWeek.avgProtein ?? 0}g</b> protein</p>
            </div>
            <div className="planner-view-toggle">
              <button type="button" className={view === 'daily' ? 'is-active' : ''} onClick={() => setView('daily')}>Daily</button>
              <button type="button" className={view === 'matrix' ? 'is-active' : ''} onClick={() => setView('matrix')}>Matrix</button>
            </div>
          </section>

          <div className="planner-content-heading">
            <div>
              <span>Your menu</span>
              <h2>Meals with room to move.</h2>
            </div>
            <p>{['Swap', 'save', 'and make this plan yours.'].map((word) => <span className="planner-scrub-word" key={word}>{word} </span>)}</p>
          </div>

          {view === 'daily' ? <div className="planner-days">
            {plannerDays.map((day) => <article className={`planner-day${day.status === 'Today' ? ' is-today' : ''}`} key={day.label}>
              <header>
                <div className="planner-day-label">
                  <b>{day.label}</b><span>{day.date}</span>
                  {day.status === 'Today' && <em className="planner-badge">Today</em>}
                  {day.status && day.status !== 'Today' && <span className="planner-day-status">{day.status}</span>}
                </div>
                <div className="planner-day-meta">{day.calorieActual.toLocaleString()} / {day.calorieGoal.toLocaleString()} kcal &middot; {day.proteinActual} / {day.proteinGoal}g protein</div>
                <button className="community-icon-btn" type="button" aria-label={`Options for ${day.label}`}><MoreHorizontal size={16}/></button>
              </header>
              <div className="planner-meals">
                {day.meals.map((meal) => <div className="planner-meal" key={meal.slot}>
                  <img src={meal.image} alt={meal.name}/>
                  <div>
                    <span>{meal.slot}{meal.swapped && <em>Swapped</em>}</span>
                    <b>{meal.name}</b>
                    <small>{meal.kcal} kcal &middot; {meal.protein}g P</small>
                  </div>
                  <button className="planner-meal-swap" type="button" aria-label={`Swap ${meal.slot}`}><Repeat2 size={13}/></button>
                </div>)}
              </div>
            </article>)}
          </div> : <MealPlanMatrix days={plannerDays}/>}
          <footer className="planner-footer">
            <div><span>Ready when you are</span><b>Make this week yours.</b></div>
            <div>
              <button type="button" className="planner-btn-ghost"><Download size={15}/> Export plan</button>
              <button type="button" className="planner-btn-primary">Save plan</button>
            </div>
          </footer>
        </main>
        <MealPlanAssistant days={plannerDays} profile={communityUser}/>
      </div>
    </div>
    <ChatbotWidget/>
  </div>;
}
