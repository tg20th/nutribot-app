import { MessageCircle, Sparkles } from 'lucide-react';

const sum = (list, key) => list.reduce((total, item) => total + Number(item[key] || 0), 0);

export default function MealPlanAssistant({ days: plannerDays = [], profile: communityUser = {} }) {
  if (!plannerDays.length) return null;
  const lowestProteinDay = plannerDays.reduce((worst, day) => {
    const ratio = day.proteinGoal ? day.proteinActual / day.proteinGoal : 0;
    const worstRatio = worst.proteinGoal ? worst.proteinActual / worst.proteinGoal : 0;
    return ratio < worstRatio ? day : worst;
  }, plannerDays[0]);
  const swappedEntry = (() => {
    for (const day of plannerDays) {
      const meal = day.meals.find((item) => item.swapped);
      if (meal) return { day, meal };
    }
    return null;
  })();
  const calorieGoal = sum(plannerDays, 'calorieGoal');
  const proteinGoal = sum(plannerDays, 'proteinGoal');
  const caloriePct = calorieGoal ? Math.round((sum(plannerDays, 'calorieActual') / calorieGoal) * 100) : 0;
  const proteinPct = proteinGoal ? Math.round((sum(plannerDays, 'proteinActual') / proteinGoal) * 100) : 0;
  const alignment = caloriePct >= 95 && caloriePct <= 105 ? 'On track' : caloriePct > 105 ? 'Slightly over target' : 'Slightly under target';

  return <aside className="community-right-rail planner-assistant">
    <div className="community-widget assistant-widget">
      <span className="assistant-title"><Sparkles size={15}/> Meal Plan Assistant</span>

      <div className="assistant-metric">
        <div className="assistant-metric-row"><span>Calories</span><b>{caloriePct}%</b></div>
        <div className="community-progress"><div style={{ width: `${Math.min(caloriePct, 100)}%` }}/></div>
      </div>
      <div className="assistant-metric">
        <div className="assistant-metric-row"><span>Protein</span><b>{proteinPct}%</b></div>
        <div className="community-progress"><div style={{ width: `${Math.min(proteinPct, 100)}%` }}/></div>
      </div>

      <p className="assistant-alignment">{alignment} for {(communityUser.goal ?? 'wellness').toLowerCase()}.</p>

      <ul className="assistant-notes">
        <li>{lowestProteinDay.label}&apos;s protein sits lowest this week. A scoop of tempeh or edamame at dinner would close the gap.</li>
        {swappedEntry && <li>{swappedEntry.day.label}&apos;s {swappedEntry.meal.slot.toLowerCase()} was swapped to {swappedEntry.meal.name}, already reflected above.</li>}
        <li>Use the empty meal slots to keep this plan practical instead of overfilling the week.</li>
      </ul>

      <button type="button" className="assistant-ask" onClick={() => window.dispatchEvent(new Event('open-nutribot-chat'))}>
        <MessageCircle size={14}/> Ask NutriBot to adjust this plan
      </button>
    </div>
  </aside>;
}
