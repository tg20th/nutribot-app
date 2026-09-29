import { Sparkles } from 'lucide-react';

const METRICS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'healthyFatsG', label: 'Healthy fats', unit: 'g' }
];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const formatValue = (value, unit) => `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;

export default function MealPlanAssistant({ nutritionSummary }) {
  const unavailable = !nutritionSummary || nutritionSummary.status === 'PROFILE_INCOMPLETE';
  const missingFields = nutritionSummary?.missingFields ?? [];

  return <aside className="community-right-rail planner-assistant">
    <div className="community-widget assistant-widget">
      <span className="assistant-title"><Sparkles size={15}/> Meal Plan Assistant</span>

      {METRICS.map(({ key, label, unit }) => {
        const actual = nutritionSummary?.actual?.[key];
        const target = nutritionSummary?.target?.[key];
        const percentage = nutritionSummary?.percentage?.[key];
        const available = !unavailable && isFiniteNumber(actual) && isFiniteNumber(target)
          && target > 0 && isFiniteNumber(percentage);
        return <div className="assistant-metric" key={key}>
          <div className="assistant-metric-row"><span>{label}</span><b>{available ? `${percentage}%` : 'Unavailable'}</b></div>
          {available
            ? <><div className="community-progress" aria-label={`${label}: ${percentage}%`}><div style={{ width: `${Math.min(percentage, 100)}%` }}/></div><small>{formatValue(actual, unit)} / {formatValue(target, unit)}</small></>
            : <small>Nutrition data is unavailable.</small>}
        </div>;
      })}

      <p className="assistant-alignment">
        {unavailable
          ? `Complete your Health Profile${missingFields.length ? ` (${missingFields.join(', ')})` : ''} to receive personalized nutrition targets.`
          : 'Nutrition progress is based on your saved weekly menu.'}
      </p>
    </div>
  </aside>;
}
