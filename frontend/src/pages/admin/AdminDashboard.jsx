import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { adminIngredientApi } from '../../services/adminIngredientApi';
import { ErrorState, LoadingState, PageHeader } from '../../components/admin/AdminUi';
import ErrorPage from '../../components/errors/ErrorPage';
import '../../styles/admin-dashboard.css';

const trendPeriods = {
  week: { days: 7, label: 'Last 7 days' },
  month: { days: 30, label: 'Last 30 days' },
  quarter: { days: 90, label: 'Last 90 days' },
};

const CATEGORY_CHART_COLORS = ['#54B88A', '#9AD6AC', '#83BCE6', '#F5B48C', '#B7A5E2', '#EF9696', '#E7C75C', '#929EE0', '#E6A4C7', '#E9A36B'];
const OTHERS_COLOR = '#D8DEDA';
const numberFormat = new Intl.NumberFormat('en-US');

const buildContentTrend = (content, periodKey) => {
  const period = trendPeriods[periodKey];
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - period.days + 1);
  const buckets = Array.from({ length: period.days }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index);
    return {
      label: bucketStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      start: bucketStart,
      value: 0,
    };
  });

  content.forEach((item) => {
    const publishedAt = new Date(item.publishedAt ?? item.createdAt ?? item.updatedAt);
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < start || publishedAt > now) return;
    const index = Math.min(period.days - 1, Math.floor((publishedAt - start) / 86400000));
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

const buildCategoryColors = (categories) => {
  const colorMap = {};
  categories.forEach((category) => {
    const key = categoryColorKey(category);
    colorMap[key] = category.isUncategorized ? OTHERS_COLOR : CATEGORY_CHART_COLORS[categoryHash(key) % CATEGORY_CHART_COLORS.length];
  });
  return colorMap;
};

const buildDisplayCategorySlices = (categories, limit = 10) => {
  const ranked = categories.filter((category) => category.countValid && category.value > 0);
  const top = ranked.slice(0, limit).map((category, index) => ({ ...category, chartColor: CATEGORY_CHART_COLORS[index] }));
  const remaining = ranked.slice(limit);
  if (!remaining.length) return { slices: top, others: null, remaining: [] };
  const others = {
    id: '__others__',
    label: 'Others',
    value: remaining.reduce((sum, category) => sum + category.value, 0),
    countValid: true,
    isOthers: true,
    chartColor: OTHERS_COLOR,
  };
  return { slices: [...top, others], others, remaining };
};

const donutBackground = (slices, colors) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return 'var(--sage)';
  let offset = 0;
  return `conic-gradient(${slices.map((slice, index) => {
    const next = offset + (slice.value / total) * 100;
    const color = slice.chartColor ?? colors[categoryColorKey(slice)] ?? (slice.isUncategorized ? OTHERS_COLOR : CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]);
    const separator = next < 100 ? Math.min(0.35, (next - offset) / 4) : 0;
    const segment = `${color} ${offset}% ${Math.max(offset, next - separator)}%, #fff ${Math.max(offset, next - separator)}% ${next}%`;
    offset = next;
    return segment;
  }).join(', ')})`;
};

const donutSlicePath = (startPercent, endPercent, innerRadius = 28, outerRadius = 50) => {
  const point = (percent, radius) => {
    const angle = (percent / 100) * Math.PI * 2 - Math.PI / 2;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  };
  const startOuter = point(startPercent, outerRadius);
  const endOuter = point(endPercent, outerRadius);
  const endInner = point(endPercent, innerRadius);
  const startInner = point(startPercent, innerRadius);
  const largeArc = endPercent - startPercent > 50 ? 1 : 0;
  return `M ${startOuter.join(' ')} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.join(' ')} L ${endInner.join(' ')} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.join(' ')} Z`;
};

export { CATEGORY_CHART_COLORS, OTHERS_COLOR, buildCategorySlices, buildDisplayCategorySlices, buildCategoryColors, categoryColorKey, donutBackground, buildContentTrend };

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
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [othersQuery, setOthersQuery] = useState('');
  const [othersSort, setOthersSort] = useState('count');
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      adminApi.getDashboard(controller.signal),
      adminIngredientApi.getIngredients({ page: 0, size: 1 }, controller.signal),
    ]).then(([dashboardData, ingredientPage]) => {
      setDashboard(dashboardData);
      setIngredientTotal(Number(ingredientPage.totalElements ?? 0));
    }).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError);
    });
    return () => controller.abort();
  }, [retryKey]);

  const trend = useMemo(() => buildContentTrend(dashboard?.content ?? [], trendPeriod), [dashboard, trendPeriod]);
  const allCategories = useMemo(() => buildCategorySlices(dashboard?.categories ?? []), [dashboard]);
  const chartCategories = useMemo(() => allCategories.filter((category) => category.countValid && category.value > 0), [allCategories]);
  const categoryDisplay = useMemo(() => buildDisplayCategorySlices(chartCategories), [chartCategories]);
  const displaySlices = categoryDisplay.slices;
  const categoryColors = useMemo(() => buildCategoryColors(displaySlices), [displaySlices]);
  const hasCategorizedContent = displaySlices.some((category) => !category.isUncategorized);
  const uncategorizedContent = allCategories.find((category) => category.isUncategorized)?.value ?? 0;
  const categoryTotal = displaySlices.reduce((sum, category) => sum + category.value, 0);
  const filteredOthers = useMemo(() => {
    const query = othersQuery.trim().toLowerCase();
    return [...(categoryDisplay.remaining ?? [])].filter((category) => category.label.toLowerCase().includes(query)).sort((left, right) => othersSort === 'name' ? left.label.localeCompare(right.label) : right.value - left.value || left.label.localeCompare(right.label));
  }, [categoryDisplay.remaining, othersQuery, othersSort]);
  const categoryLegend = <div className="dashboard-legend">{displaySlices.map((category) => { const percent = categoryTotal ? (category.value / categoryTotal) * 100 : 0; const clickable = category.isOthers; return <div className={`dashboard-legend__item${clickable ? ' dashboard-legend__item--interactive' : ''}`} key={category.id ?? category.label} onClick={clickable ? () => setOthersOpen(true) : undefined} onKeyDown={clickable ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOthersOpen(true); } } : undefined} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}><i style={{ background: category.chartColor }} /><span>{category.label}</span><strong>{numberFormat.format(category.value)} <small>{percent.toFixed(1)}%</small></strong></div>; })}</div>;
  const trendMax = Math.max(1, ...trend.map((bucket) => bucket.value));
  const adminReviewOutcomes = dashboard?.adminReviewOutcomes ?? null;
  const reviewTotal = adminReviewOutcomes?.total ?? 0;
  const reviewDonutBackground = adminReviewOutcomes?.total ? `conic-gradient(#54B88A 0 ${(adminReviewOutcomes.counts.approved / reviewTotal) * 100}%, #EF9696 ${(adminReviewOutcomes.counts.approved / reviewTotal) * 100}% 100%)` : 'var(--sage)';
  const growthAxisWidth = 44;
  const growthPlotWidth = growthAxisWidth + Math.max(trend.length - 1, 1) * 72;
  const growthChartHeight = 390;
  const growthPlotTop = 30;
  const growthBaseline = 340;
  const growthHeight = growthBaseline - growthPlotTop;
  const growthMidpoint = growthPlotTop + growthHeight / 2;
  const trendPoints = trend.map((bucket, index) => ({ ...bucket, x: growthAxisWidth + (trend.length === 1 ? 36 : index * 72), y: growthBaseline - ((bucket.value / trendMax) * growthHeight) }));
  const publishedPath = trendPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const hoveredPoint = hoveredTrendIndex == null ? null : trendPoints[hoveredTrendIndex];
  const hoveredDate = hoveredPoint?.start.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  if (error?.status === 503) return <ErrorPage status={503} onRetry={() => { setDashboard(null); setError(null); setRetryKey((key) => key + 1); }}/>;
  if (error) return <ErrorState message={error.message || 'Unable to load dashboard data.'} />;
  if (!dashboard) return <LoadingState label="Loading dashboard..." />;

  return (
    <main className="admin-dashboard">
      <PageHeader
        titleId="dashboard-title"
        eyebrow="ADMIN OVERVIEW"
        title="Dashboard overview"
        text="Monitor NutriBot activity, content publishing, and review workload."
        action={<div className="dashboard-filter-bar" aria-label="Dashboard filters">
          <label htmlFor="dashboard-period">
            <span>Growth range</span>
            <select id="dashboard-period" value={trendPeriod} onChange={(event) => setTrendPeriod(event.target.value)}>
              {Object.entries(trendPeriods).map(([key, period]) => <option key={key} value={key}>{period.label}</option>)}
            </select>
          </label>
        </div>}
      />

      <section className="admin-dashboard__metrics" aria-label="Key metrics">
        <Metric label="Total users" value={dashboard.metrics.totalUsers} to="/admin/users" description="Registered members" />
        <Metric label="Published content" value={dashboard.metrics.publishedContent} description="Live blogs and videos" />
        <Metric label="Pending reviews" value={dashboard.metrics.pendingModeration} to="/admin/moderation" description="Awaiting moderation" />
        <Metric label="Catalogue ingredients" value={ingredientTotal} to="/admin/ingredients" description="Available ingredients" />
      </section>

      <section className="dashboard-panel dashboard-panel--growth" aria-labelledby="growth-title">
        <div className="dashboard-panel__heading">
          <div><p className="dashboard-panel__eyebrow">PUBLISHING ACTIVITY</p><h2 id="growth-title">Publishing Activity</h2></div>
          <span className="dashboard-panel__note">Published content · selected range</span>
        </div>
        <div className="dashboard-growth-chart" role="img" aria-label={`Published posts over the last ${trendPeriods[trendPeriod].label}`}>
          <svg className="dashboard-growth-svg" viewBox={`0 0 ${growthPlotWidth} ${growthChartHeight}`} preserveAspectRatio="none" aria-hidden="true">
              <line className="dashboard-growth-svg__gridline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthPlotTop} y2={growthPlotTop} />
              <line className="dashboard-growth-svg__gridline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthMidpoint} y2={growthMidpoint} />
              <line className="dashboard-growth-svg__baseline" x1={growthAxisWidth} x2={growthPlotWidth} y1={growthBaseline} y2={growthBaseline} />
              <polyline className="dashboard-growth-svg__line" points={publishedPath}><title>Published posts</title></polyline>
              {trendPoints.map((point, index) => <g key={`${point.label}-${point.start.toISOString()}`} onMouseEnter={() => setHoveredTrendIndex(index)} onMouseLeave={() => setHoveredTrendIndex(null)} onFocus={() => setHoveredTrendIndex(index)} onBlur={() => setHoveredTrendIndex(null)} onClick={() => setHoveredTrendIndex(index)}>
                <circle className="dashboard-growth-svg__hit-area" cx={point.x} cy={point.y} r="16" tabIndex="0" role="button" aria-label={`${point.label}: ${point.value} published posts`} />
                <circle className={`dashboard-growth-svg__marker${hoveredTrendIndex === index ? ' is-active' : ''}`} cx={point.x} cy={point.y} r={hoveredTrendIndex === index ? 5 : 3} />
              </g>)}
          </svg>
          {hoveredPoint && <div className="dashboard-growth-tooltip" style={{ left: `${Math.min(Math.max((hoveredPoint.x / growthPlotWidth) * 100, 12), 88)}%`, top: `${Math.max(25, (hoveredPoint.y / growthChartHeight) * 100 - 5)}%` }} role="status">
            <div className="dashboard-growth-tooltip__date">{hoveredDate}</div>
            <div className="dashboard-growth-tooltip__row"><span><i aria-hidden="true" />Published posts</span><strong>{hoveredPoint.value}</strong></div>
          </div>}
          <div className="dashboard-growth-text-layer" aria-hidden="true">
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthPlotTop / growthChartHeight) * 100}%` }}>{trendMax}</span>
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthMidpoint / growthChartHeight) * 100}%` }}>{Math.ceil(trendMax / 2)}</span>
            <span className="dashboard-growth-text dashboard-growth-text--axis" style={{ left: `${((growthAxisWidth - 8) / growthPlotWidth) * 100}%`, top: `${(growthBaseline / growthChartHeight) * 100}%` }}>0</span>
            {trendPoints.filter((_, index) => trend.length <= 10 || index % Math.ceil(trend.length / 10) === 0).map((point) => <span className="dashboard-growth-text dashboard-growth-text--date" key={`${point.label}-date`} style={{ left: `${(point.x / growthPlotWidth) * 100}%`, top: `${(375 / growthChartHeight) * 100}%` }}>{point.label}</span>)}
          </div>
        </div>
      </section>

      <div className="dashboard-chart-grid">
        <section className="dashboard-panel dashboard-panel--distribution" aria-labelledby="distribution-title">
          <div className="dashboard-panel__heading">
            <div><p className="dashboard-panel__eyebrow">CONTENT MIX</p><h2 id="distribution-title">Content distribution</h2></div>
            <span className="dashboard-panel__note">Published content by recipe category</span>
          </div>
          {hasCategorizedContent ? <div className="dashboard-distribution"><div className="dashboard-donut" style={{ background: donutBackground(displaySlices, categoryColors) }} aria-label="Content distribution chart"><svg className="dashboard-donut-hit-target" viewBox="0 0 100 100" aria-hidden="true">{displaySlices.reduce((segments, category) => { const start = segments.offset; const end = start + (category.value / categoryTotal) * 100; segments.items.push(<path key={category.id ?? category.label} d={donutSlicePath(start, end)} onClick={category.isOthers ? () => setOthersOpen(true) : undefined} />); segments.offset = end; return segments; }, { offset: 0, items: [] }).items}</svg><span>{numberFormat.format(dashboard.metrics.publishedContent ?? 0)}</span></div>{categoryLegend}</div> : <div className="dashboard-empty"><p>No categorized published content is available yet.</p>{uncategorizedContent > 0 && <p>{numberFormat.format(uncategorizedContent)} published item{uncategorizedContent === 1 ? '' : 's'} have no category.</p>}{categoryLegend}</div>}
        </section>

        <section className="dashboard-panel dashboard-panel--status" aria-labelledby="status-title">
          <div className="dashboard-panel__heading">
            <div><p className="dashboard-panel__eyebrow">WORKFLOW</p><h2 id="status-title">Admin Review Outcomes</h2></div>
            <span className="dashboard-panel__note">Approval and rejection rates from admin decisions</span>
          </div>
          {adminReviewOutcomes?.total ? <div className="dashboard-review-performance"><div className="dashboard-review-donut" style={{ background: reviewDonutBackground }} role="img" aria-label={`${reviewTotal} admin review decisions`}><span>{numberFormat.format(reviewTotal)}<small>Decisions</small></span></div><div className="dashboard-review-legend">{adminReviewOutcomes.items.map((item) => <div key={item.label}><div><i style={{ background: item.color }} /><span>{item.label.replace('Admin ', '')}</span></div><strong>{((item.value / reviewTotal) * 100).toFixed(1)}% <small>· {numberFormat.format(item.value)}</small></strong></div>)}</div><p className="dashboard-review-note">ⓘ Based on recorded administrator approval and rejection decisions. AI-approved publications are excluded.</p></div> : <div className="dashboard-empty"><p>No admin review decisions are available for analysis.</p><small>Only recorded administrator APPROVE and REJECT decisions are included.</small><p className="dashboard-review-note">ⓘ Based on recorded administrator approval and rejection decisions. AI-approved publications are excluded.</p></div>}
        </section>
      </div>
      {othersOpen && categoryDisplay.others && <div className="dashboard-others-backdrop" role="presentation" onMouseDown={() => setOthersOpen(false)}><section className="dashboard-others-dialog" role="dialog" aria-modal="true" aria-labelledby="others-dialog-title" onMouseDown={(event) => event.stopPropagation()}><div className="dashboard-others-dialog__header"><div><p className="dashboard-panel__eyebrow">CONTENT MIX</p><h2 id="others-dialog-title">Other categories</h2><span>{numberFormat.format(categoryDisplay.others.value)} category usages · {categoryDisplay.remaining.length} categories</span></div><button type="button" onClick={() => setOthersOpen(false)} aria-label="Close other categories"><X size={18}/></button></div><div className="dashboard-others-controls"><label><Search size={15}/><input value={othersQuery} onChange={(event) => setOthersQuery(event.target.value)} placeholder="Search categories" aria-label="Search other categories"/></label><select value={othersSort} onChange={(event) => setOthersSort(event.target.value)} aria-label="Sort other categories"><option value="count">Highest count</option><option value="name">Category name</option></select></div><div className="dashboard-others-list">{filteredOthers.map((category) => <div key={category.id ?? category.label}><span>{category.label}</span><strong>{numberFormat.format(category.value)} <small>{((category.value / categoryDisplay.others.value) * 100).toFixed(1)}%</small></strong></div>)}{!filteredOthers.length && <p>No categories match this search.</p>}</div></section></div>}
    </main>
  );
}
