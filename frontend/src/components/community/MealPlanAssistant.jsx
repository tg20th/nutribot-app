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
  const incomplete = nutritionSummary?.status === 'PROFILE_INCOMPLETE';
  const empty = nutritionSummary?.status === 'EMPTY_MENU';
  const partial = nutritionSummary?.status === 'PARTIAL';
  const missingFields = nutritionSummary?.missingFields ?? [];

  return <aside className="community-right-rail planner-assistant">
    <div className="community-widget assistant-widget">
      <span className="assistant-title"><Sparkles size={15}/> Meal Plan Assistant</span>

      {METRICS.map(({ key, label, unit }) => {
        const actual = nutritionSummary?.actual?.[key];
        const target = nutritionSummary?.target?.[key];
        const percentage = nutritionSummary?.percentage?.[key];
        const hasActual = isFiniteNumber(actual);
        const hasTarget = isFiniteNumber(target) && target > 0;
        const hasPercentage = hasTarget && isFiniteNumber(percentage);
        const showProgress = !incomplete && hasActual && hasTarget && hasPercentage;
        const displayValue = showProgress
          ? `${percentage}%`
          : hasActual
            ? formatValue(actual, unit)
            : hasTarget
              ? `${formatValue(0, unit)} / ${formatValue(target, unit)}`
              : 'Unavailable';
        return <div className="assistant-metric" key={key}>
          <div className="assistant-metric-row"><span>{label}</span><b>{displayValue}</b></div>
          {showProgress
            ? <><div className="community-progress" aria-label={`${label}: ${percentage}%`}><div style={{ width: `${Math.min(percentage, 100)}%` }}/></div><small>{formatValue(actual, unit)} / {formatValue(target, unit)}</small></>
            : hasTarget
              ? hasActual
                ? <small>Add a Health Profile to receive personalized targets.</small>
                : <small>Target: {formatValue(target, unit)}/week · Add meals to start tracking</small>
              : hasActual
                ? <small>Add a Health Profile to receive personalized targets.</small>
                : <small>Nutrition data is unavailable.</small>}
        </div>;
      })}

      <p className="assistant-alignment">
        {incomplete
          ? `Complete your Health Profile${missingFields.length ? ` (${missingFields.join(', ')})` : ''} to receive personalized nutrition targets.`
          : empty
            ? 'Add meals to your plan to see weekly nutrition totals.'
            : partial
              ? `Some macros are not yet reported by the dish catalog${missingFields.length ? ` (${missingFields.join(', ')})` : ''}.`
              : 'Nutrition progress is based on your saved weekly menu.'}
      </p>
    </div>
  </aside>;
}
