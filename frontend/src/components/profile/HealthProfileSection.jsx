import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAllergyIngredients, getHealthProfile, updateHealthProfile } from '../../services/profileApi';

const EMPTY_HEALTH = {
  heightCm: '',
  weightKg: '',
  healthGoal: 'maintain',
  allergyIngredientIds: [],
};

const GOALS = [
  { value: 'lose_weight', title: 'Lose weight', copy: 'A steady, balanced calorie deficit.' },
  { value: 'maintain', title: 'Maintain health', copy: 'Keep your current rhythm and energy.' },
  { value: 'gain_muscle', title: 'Build muscle', copy: 'Support training with stronger nutrition.' },
];

const toFormHealth = (data = {}) => ({
  heightCm: data.heightCm == null ? '' : String(data.heightCm),
  weightKg: data.weightKg == null ? '' : String(data.weightKg),
  healthGoal: data.healthGoal || 'maintain',
  allergyIngredientIds: Array.isArray(data.allergyIngredientIds) ? data.allergyIngredientIds : [],
});

const calculateBmi = (heightCm, weightKg) => {
  const height = Number(heightCm);
  const weight = Number(weightKg);
  if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) return null;
  return Math.round((weight / ((height / 100) ** 2)) * 10) / 10;
};

const classifyBmi = (bmi) => {
  if (bmi == null) return { label: 'Add your metrics', tone: 'empty', copy: 'Your BMI preview will appear here.' };
  if (bmi < 18.5) return { label: 'Underweight', tone: 'low', copy: 'A nutrition professional can help you build a gradual plan.' };
  if (bmi < 25) return { label: 'Healthy range', tone: 'healthy', copy: 'Your current BMI sits within the general healthy range.' };
  if (bmi < 30) return { label: 'Overweight', tone: 'high', copy: 'Small, consistent changes can support a healthier range.' };
  return { label: 'High range', tone: 'very-high', copy: 'Consider discussing your goals with a qualified professional.' };
};

const validate = (health) => {
  const errors = {};
  const height = Number(health.heightCm);
  const weight = Number(health.weightKg);
  if (!health.heightCm) errors.heightCm = 'Enter your height.';
  else if (!Number.isFinite(height) || height < 80 || height > 250) errors.heightCm = 'Height must be between 80 and 250 cm.';
  if (!health.weightKg) errors.weightKg = 'Enter your weight.';
  else if (!Number.isFinite(weight) || weight < 20 || weight > 350) errors.weightKg = 'Weight must be between 20 and 350 kg.';
  return errors;
};

export default function HealthProfileSection() {
  const [health, setHealth] = useState(EMPTY_HEALTH);
  const [savedHealth, setSavedHealth] = useState(EMPTY_HEALTH);
  const [ingredients, setIngredients] = useState([]);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getHealthProfile(controller.signal), getAllergyIngredients(controller.signal)])
      .then(([profile, ingredientOptions]) => {
        const mapped = toFormHealth(profile);
        setHealth(mapped);
        setSavedHealth(mapped);
        setIngredients(Array.isArray(ingredientOptions) ? ingredientOptions : []);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setNotice({ type: 'error', message: error?.message || 'We could not load your health profile.' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const bmi = calculateBmi(health.heightCm, health.weightKg);
  const bmiStatus = classifyBmi(bmi);
  const bmiPosition = bmi == null ? 0 : Math.min(100, Math.max(0, ((bmi - 14) / 26) * 100));
  const isDirty = JSON.stringify(health) !== JSON.stringify(savedHealth);
  const selectedIds = useMemo(() => new Set(health.allergyIngredientIds), [health.allergyIngredientIds]);
  const selectedIngredients = useMemo(
    () => ingredients.filter(({ ingredientId }) => selectedIds.has(ingredientId)),
    [ingredients, selectedIds],
  );
  const visibleIngredients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    if (!normalized) return ingredients;
    return ingredients.filter(({ name, slug }) => `${name} ${slug}`.toLocaleLowerCase('vi').includes(normalized));
  }, [ingredients, query]);

  const updateMetric = (event) => {
    const { name, value } = event.target;
    setHealth((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    if (notice?.type === 'success') setNotice(null);
  };

  const toggleAllergy = (ingredientId) => {
    setHealth((current) => ({
      ...current,
      allergyIngredientIds: current.allergyIngredientIds.includes(ingredientId)
        ? current.allergyIngredientIds.filter((id) => id !== ingredientId)
        : [...current.allergyIngredientIds, ingredientId],
    }));
    if (notice?.type === 'success') setNotice(null);
  };

  const reset = () => {
    setHealth(savedHealth);
    setErrors({});
    setNotice(null);
    setQuery('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(health);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setNotice({ type: 'error', message: 'Review your body metrics before saving.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const updated = await updateHealthProfile({
        heightCm: Number(health.heightCm),
        weightKg: Number(health.weightKg),
        healthGoal: health.healthGoal,
        allergyIngredientIds: health.allergyIngredientIds,
      });
      const mapped = toFormHealth(updated);
      setHealth(mapped);
      setSavedHealth(mapped);
      setNotice({ type: 'success', message: 'Your health profile is now up to date.' });
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'We could not save your health profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="health-loading" role="status"><LoaderCircle className="health-spinner" size={26} /><span>Loading your health profile...</span></div>;
  }

  return (
    <form className="health-profile-section" onSubmit={submit} noValidate>
      {notice && (
        <div className={`health-notice health-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{notice.message}</span>
        </div>
      )}

      <div className="health-bento">
        <section className="health-card health-metrics-card" aria-labelledby="body-metrics-title">
          <header>
            <div><span>Body metrics</span><h2 id="body-metrics-title">A clearer view of your baseline</h2></div>
            <Activity size={23} />
          </header>
          <div className="health-metric-fields">
            <label>
              <span>Height</span>
              <div><input type="number" inputMode="decimal" name="heightCm" min="80" max="250" step="0.1" value={health.heightCm} onChange={updateMetric} placeholder="168" aria-invalid={Boolean(errors.heightCm)} /><b>cm</b></div>
              {errors.heightCm && <small>{errors.heightCm}</small>}
            </label>
            <label>
              <span>Weight</span>
              <div><input type="number" inputMode="decimal" name="weightKg" min="20" max="350" step="0.1" value={health.weightKg} onChange={updateMetric} placeholder="58" aria-invalid={Boolean(errors.weightKg)} /><b>kg</b></div>
              {errors.weightKg && <small>{errors.weightKg}</small>}
            </label>
          </div>
          <p>These values are stored securely and help NutriBot tailor meal guidance to your current needs.</p>
        </section>

        <aside className={`health-card health-bmi-card health-bmi-card--${bmiStatus.tone}`} aria-live="polite">
          <div className="health-bmi-head"><span>Live BMI</span><ShieldCheck size={20} /></div>
          <strong>{bmi ?? '—'}</strong>
          <h3>{bmiStatus.label}</h3>
          <p>{bmiStatus.copy}</p>
          <div className="health-bmi-scale" aria-label={bmi == null ? 'BMI has not been calculated' : `BMI ${bmi}, ${bmiStatus.label}`}>
            <div className="health-bmi-track">{bmi != null && <i style={{ left: `${bmiPosition}%` }} />}</div>
            <div><span>Under</span><span>Healthy</span><span>Over</span><span>High</span></div>
          </div>
        </aside>

        <section className="health-card health-goal-card" aria-labelledby="health-goal-title">
          <header><div><span>Your direction</span><h2 id="health-goal-title">Choose the goal that fits now</h2></div><Sparkles size={23} /></header>
          <div className="health-goals">
            {GOALS.map((goal) => (
              <button key={goal.value} type="button" className={health.healthGoal === goal.value ? 'is-selected' : ''} onClick={() => setHealth((current) => ({ ...current, healthGoal: goal.value }))} aria-pressed={health.healthGoal === goal.value}>
                <span>{health.healthGoal === goal.value ? <CheckCircle2 size={19} /> : <i />}</span>
                <b>{goal.title}</b>
                <small>{goal.copy}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="health-card health-allergy-card" aria-labelledby="allergy-title">
          <header>
            <div><span>Food safety</span><h2 id="allergy-title">Ingredients to keep out</h2></div>
            <b>{selectedIds.size} selected</b>
          </header>
          <p>Select any ingredient that causes an allergy or intolerance. NutriBot will use the exact database IDs when planning around them.</p>

          {selectedIngredients.length > 0 && (
            <div className="health-selected-allergies" aria-label="Selected allergies">
              {selectedIngredients.map(({ ingredientId, name }) => <button type="button" key={ingredientId} onClick={() => toggleAllergy(ingredientId)}>{name}<X size={13} /></button>)}
            </div>
          )}

          <label className="health-ingredient-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredients from the database" aria-label="Search allergy ingredients" />
            <ChevronDown size={16} />
          </label>

          <div className="health-ingredient-list" role="group" aria-label="Allergy ingredients">
            {visibleIngredients.map(({ ingredientId, name }) => {
              const selected = selectedIds.has(ingredientId);
              return <button type="button" key={ingredientId} className={selected ? 'is-selected' : ''} onClick={() => toggleAllergy(ingredientId)} aria-pressed={selected}><span>{selected && <Check size={13} />}</span>{name}</button>;
            })}
            {visibleIngredients.length === 0 && <p>No ingredients match your search.</p>}
          </div>
        </section>
      </div>

      <footer className="health-save-bar">
        <div><ShieldCheck size={18} /><span><b>Your choices stay private.</b><small>Only you and NutriBot personalization use this health data.</small></span></div>
        <div>
          <button type="button" className="health-button health-button--secondary" onClick={reset} disabled={!isDirty || isSaving}><RotateCcw size={16} /> Discard</button>
          <button type="submit" className="health-button health-button--primary" disabled={!isDirty || isSaving}>{isSaving ? <LoaderCircle className="health-spinner" size={17} /> : <Save size={17} />}{isSaving ? 'Saving...' : 'Save health profile'}</button>
        </div>
      </footer>
    </form>
  );
}
