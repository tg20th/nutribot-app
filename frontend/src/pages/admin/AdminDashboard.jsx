import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { adminIngredientApi } from '../../services/adminIngredientApi';
import { ErrorState, LoadingState } from '../../components/admin/AdminUi';
import '../../styles/admin-dashboard.css';

const trendPeriods = {
  week: { days: 7, buckets: 7, label: 'Last 7 days' },
  month: { days: 30, buckets: 10, label: 'Last 30 days' },
  quarter: { days: 90, buckets: 10, label: 'Last 90 days' },
};

const chartColors = ['#315c2b', '#487548', '#5f8e62', '#779e70', '#8a9f5a', '#a5b86b', '#4b7d78', '#6b978d', '#8cae9a', '#6b7f54', '#9aab7c', '#b3c49a'];
const numberFormat = new Intl.NumberFormat('en-US');

const buildContentTrend = (content, periodKey) => {
  const period = trendPeriods[periodKey];
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - period.days + 1);
  const bucketSize = Math.max(1, Math.ceil(period.days / period.buckets));
  const buckets = Array.from({ length: period.buckets }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index * bucketSize);
    return {
      label: bucketStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      start: bucketStart,
      value: 0,
    };
  });

  content.forEach((item) => {
    const publishedAt = new Date(item.publishedAt ?? item.createdAt ?? item.updatedAt);
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < start || publishedAt > now) return;
    const index = Math.min(period.buckets - 1, Math.floor((publishedAt - start) / 86400000 / bucketSize));
    buckets[index].value += 1;
  });
  return buckets;
};

const buildCategorySlices = (categories) => {
  return categories
    .map((category) => {
      const rawCount = category.contentCount;
      const value = rawCount === '' || rawCount === null || rawCount === undefined ? null : Number(rawCount);
      const countValid = Number.isFinite(value) && value >= 0;
      return {
        id: category.id,
        label: category.name,
        value: countValid ? value : 0,
        countValid,
        isUncategorized: category.isUncategorized === true,
      };
    })
    .sort((left, right) => {
      if (left.countValid !== right.countValid) return left.countValid ? -1 : 1;
      return right.value - left.value || left.label.localeCompare(right.label) || String(left.id).localeCompare(String(right.id));
    });
};

const categoryColorKey = (category) => String(category.id ?? `label:${category.label}`);

const categoryHash = (key) => [...key].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);

const generatedBotanicalColor = (key, attempt = 0) => {
  const hue = 88 + ((categoryHash(`${key}:${attempt}`) * 137.508) % 185);
  const saturation = 32 + (categoryHash(`${key}:saturation`) % 14);
  const lightness = 36 + (categoryHash(`${key}:lightness`) % 18);
  return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
};

const buildCategoryColors = (categories) => {
  const colorMap = {};
  const usedColors = new Set();
  [...categories].sort((left, right) => categoryColorKey(left).localeCompare(categoryColorKey(right))).forEach((category) => {
    const key = categoryColorKey(category);
    const paletteStart = categoryHash(key) % chartColors.length;
    let color = null;
    for (let offset = 0; offset < chartColors.length; offset += 1) {
      const candidate = chartColors[(paletteStart + offset) % chartColors.length];
      if (!usedColors.has(candidate)) {
        color = candidate;
        break;
      }
    }
    let attempt = 0;
    while (!color || usedColors.has(color)) {
      color = generatedBotanicalColor(key, attempt);
      attempt += 1;
    }
    colorMap[key] = color;
    usedColors.add(color);
  });
  return colorMap;
};

const donutBackground = (slices, colors) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return 'var(--sage)';
  let offset = 0;
  return `conic-gradient(${slices.map((slice, index) => {
    const next = offset + (slice.value / total) * 100;
    const segment = `${colors[categoryColorKey(slice)] ?? chartColors[index % chartColors.length]} ${offset}% ${next}%`;
    offset = next;
    return segment;
  }).join(', ')})`;
};

export { buildCategorySlices, buildCategoryColors, categoryColorKey, donutBackground };

const Metric = ({ label, value, to, description }) => {
  const content = (
    <>
      <span className="dashboard-metric__label">{label}</span>
      <strong className="dashboard-metric__value">{numberFormat.format(value)}</strong>
      <span className="dashboard-metric__description">{description}</span>
    </>
  );
  return to ? <Link className="dashboard-metric" to={to}>{content}</Link> : <div className="dashboard-metric">{content}</div>;
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [ingredientTotal, setIngredientTotal] = useState(0);
  const [trendPeriod, setTrendPeriod] = useState('month');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      adminApi.getDashboard(controller.signal),
      adminIngredientApi.getIngredients({ page: 0, size: 1 }, controller.signal),
    ]).then(([dashboardData, ingredientPage]) => {
      setDashboard(dashboardData);
      setIngredientTotal(Number(ingredientPage.totalElements ?? 0));
    }).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message || 'Unable to load dashboard data.');
    });
    return () => controller.abort();
  }, []);

  const trend = useMemo(() => buildContentTrend(dashboard?.content ?? [], trendPeriod), [dashboard, trendPeriod]);
  const allCategories = useMemo(() => buildCategorySlices(dashboard?.categories ?? []), [dashboard]);
  const chartCategories = useMemo(() => allCategories.filter((category) => category.countValid && category.value > 0), [allCategories]);
  const categoryColors = useMemo(() => buildCategoryColors(chartCategories), [chartCategories]);
  const hasCategorizedContent = chartCategories.some((category) => !category.isUncategorized);
  const uncategorizedContent = allCategories.find((category) => category.isUncategorized)?.value ?? 0;
  const categoryLegend = <div className="dashboard-legend">{allCategories.map((category) => <div className={`dashboard-legend__item${category.value === 0 || !category.countValid ? ' is-zero' : ''}`} key={category.id ?? category.label}><i style={{ background: category.countValid && category.value > 0 ? categoryColors[categoryColorKey(category)] : 'var(--border)' }} /><span>{category.label}</span><strong>{category.countValid ? numberFormat.format(category.value) : '—'}</strong></div>)}</div>;
  const trendMax = Math.max(1, ...trend.map((bucket) => bucket.value));
  const workflowIndicators = [
    { label: 'Published content', description: 'Live blogs and videos', value: Number(dashboard?.metrics?.publishedContent ?? 0), color: 'var(--primary)', Icon: CheckCircle2 },
    { label: 'Pending moderation', description: 'Awaiting review', value: Number(dashboard?.metrics?.pendingModeration ?? 0), color: '#9aaf83', Icon: Clock3 },
  ];
  const workflowMax = Math.max(1, ...workflowIndicators.map((indicator) => indicator.value));
  const growthAxisWidth = 44;
  const growthPlotWidth = growthAxisWidth + trend.length * 72;
  const growthChartHeight = 390;
  const growthPlotTop = 30;
  const growthBaseline = 340;
  const growthHeight = growthBaseline - growthPlotTop;
  const growthMidpoint = growthPlotTop + growthHeight / 2;

  if (error) return <ErrorState message={error} />;
  if (!dashboard) return <LoadingState label="Loading dashboard..." />;

  return (
    <main className="admin-dashboard">
      <section className="admin-dashboard__heading" aria-labelledby="dashboard-title">
        <div className="admin-dashboard__heading-main">
          <p className="admin-dashboard__eyebrow">ADMIN OVERVIEW</p>
          <h1 id="dashboard-title">Dashboard overview</h1>
          <p>Monitor NutriBot activity, content publishing, and review workload.</p>
        </div>
        <div className="dashboard-filter-bar" aria-label="Dashboard filters">
          <label htmlFor="dashboard-period">
            <span>Growth range</span>
            <select id="dashboard-period" value={trendPeriod} onChange={(event) => setTrendPeriod(event.target.value)}>
              {Object.entries(trendPeriods).map(([key, period]) => <option key={key} value={key}>{period.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-dashboard__metrics" aria-label="Key metrics">
        <Metric label="Total users" value={dashboard.metrics.totalUsers} to="/admin/users" description="Registered members" />
        <Metric label="Published content" value={dashboard.metrics.publishedContent} description="Live blogs and videos" />
        <Metric label="Pending reviews" value={dashboard.metrics.pendingModeration} to="/admin/moderation" description="Awaiting moderation" />
        <Metric label="Catalogue ingredients" value={ingredientTotal} to="/admin/ingredients" description="Available ingredients" />
      </section>

      <section className="dashboard-panel dashboard-panel--growth" aria-labelledby="growth-title">
        <div className="dashboard-panel__heading">
          <div><p className="dashboard-panel__eyebrow">PUBLISHING ACTIVITY</p><h2 id="growth-title">Platform growth</h2></div>
          <span className="dashboard-panel__note">Published content · selected range</span>
        </div>
        <div className="dashboard-growth-chart" role="img" aria-label={`Published content over the last ${trendPeriods[trendPeriod].label}`}>
          <svg className="dashboard-growth-svg" viewBox={`0 0 ${growthPlotWidth} ${growthChartHeight}`} preserveAspectRatio="none" aria-hidden="true">
              <line className="dashboard-growth-svg__gridline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthPlotTop} y2={growthPlotTop} />
              <line className="dashboard-growth-svg__gridline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthMidpoint} y2={growthMidpoint} />
              <line className="dashboard-growth-svg__baseline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthBaseline} y2={growthBaseline} />
              {trend.map((bucket, index) => {
                const barHeight = (bucket.value / trendMax) * growthHeight;
                const x = growthAxisWidth + index * 72 + 16;
                const y = growthBaseline - barHeight;
                return (
                  <g key={`${bucket.label}-${bucket.start.toISOString()}`}>
                    <title>{`${bucket.label}: ${bucket.value} published content`}</title>
                    <rect className="dashboard-growth-svg__bar" x={x} y={barHeight ? y : growthBaseline} width="40" height={barHeight} rx="2" />
                  </g>
                );
              })}
          </svg>
          <div className="dashboard-growth-text-layer" aria-hidden="true">
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthPlotTop / growthChartHeight) * 100}%` }}>{trendMax}</span>
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthMidpoint / growthChartHeight) * 100}%` }}>{Math.ceil(trendMax / 2)}</span>
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthBaseline / growthChartHeight) * 100}%` }}>0</span>
            {trend.map((bucket, index) => {
              const barHeight = (bucket.value / trendMax) * growthHeight;
              const x = growthAxisWidth + index * 72 + 36;
              const y = growthBaseline - barHeight;
              return <span className="dashboard-growth-text dashboard-growth-text--value" key={`${bucket.label}-value`} style={{ left: `${(x / growthPlotWidth) * 100}%`, top: `${(Math.max(16, y - 9) / growthChartHeight) * 100}%` }}>{bucket.value}</span>;
            })}
            {trend.map((bucket, index) => {
              const x = growthAxisWidth + index * 72 + 36;
              return <span className="dashboard-growth-text dashboard-growth-text--date" key={`${bucket.label}-date`} style={{ left: `${(x / growthPlotWidth) * 100}%`, top: `${(375 / growthChartHeight) * 100}%` }}>{bucket.label}</span>;
            })}
          </div>
        </div>
      </section>

      <div className="dashboard-chart-grid">
        <section className="dashboard-panel dashboard-panel--distribution" aria-labelledby="distribution-title">
          <div className="dashboard-panel__heading">
            <div><p className="dashboard-panel__eyebrow">CONTENT MIX</p><h2 id="distribution-title">Content distribution</h2></div>
            <span className="dashboard-panel__note">Published content by recipe category</span>
          </div>
          {hasCategorizedContent ? <div className="dashboard-distribution"><div className="dashboard-donut" style={{ background: donutBackground(chartCategories, categoryColors) }} aria-label="Content distribution chart"><span>{numberFormat.format(chartCategories.reduce((sum, category) => sum + category.value, 0))}</span></div>{categoryLegend}</div> : <div className="dashboard-empty"><p>No categorized published content is available yet.</p>{uncategorizedContent > 0 && <p>{numberFormat.format(uncategorizedContent)} published item{uncategorizedContent === 1 ? '' : 's'} have no category.</p>}{categoryLegend}</div>}
        </section>

        <section className="dashboard-panel dashboard-panel--status" aria-labelledby="status-title">
          <div className="dashboard-panel__heading">
            <div><p className="dashboard-panel__eyebrow">WORKFLOW</p><h2 id="status-title">Review status</h2></div>
            <span className="dashboard-panel__note">Separate operational totals</span>
          </div>
          <div className="dashboard-status-scale">Relative scale: 0 to {numberFormat.format(workflowMax)}</div>
          <div className="dashboard-status-list">{workflowIndicators.map(({ Icon, ...indicator }) => <div className="dashboard-status" key={indicator.label}><div className="dashboard-status__label"><div className="dashboard-status__identity"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span><b>{indicator.label}</b><small>{indicator.description}</small></span></div><strong>{numberFormat.format(indicator.value)}</strong></div><div className="dashboard-status__track"><i style={{ width: `${(indicator.value / workflowMax) * 100}%`, background: indicator.color }} /></div></div>)}</div>
        </section>
      </div>
    </main>
  );
}
