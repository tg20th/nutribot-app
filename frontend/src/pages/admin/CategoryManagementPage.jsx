import { CircleCheck, CircleX, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminToolbar, ConfirmDialog, EmptyState, LoadingState, PageHeader, SearchBox, Toast } from '../../components/admin/AdminUi';
import { adminApi } from '../../services/adminApi';
import { adminIngredientApi } from '../../services/adminIngredientApi';

const empty = { name: '', type: '', description: '' };

const getIngredientCounts = async (categories, signal) => {
  const foodCategories = categories.filter((category) => category.type === 'FOOD_TYPE');
  const results = await Promise.all(foodCategories.map(async (category) => {
    const page = await adminIngredientApi.getIngredients({ categoryId: category.id, page: 0, size: 1 }, signal);
    return [category.id, Number(page.totalElements ?? page.content?.length ?? 0)];
  }));
  return Object.fromEntries(results);
};

export default function CategoryManagementPage() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');
  const [contentCounts, setContentCounts] = useState(null);
  const [ingredientCounts, setIngredientCounts] = useState(null);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (signal) => {
    setLoading(true);
    const [categoriesResult, countsResult] = await Promise.allSettled([
      adminApi.getCategories(signal),
      adminApi.getCategoryContentCounts(signal),
    ]);
    if (signal?.aborted) return;

    if (categoriesResult.status === 'fulfilled') {
      setItems(categoriesResult.value);
      const ingredientCountsResult = await Promise.allSettled([
        getIngredientCounts(categoriesResult.value, signal),
      ]);
      if (!signal?.aborted) {
        setIngredientCounts(ingredientCountsResult[0].status === 'fulfilled' ? ingredientCountsResult[0].value : null);
      }
    } else {
      setItems([]);
      setIngredientCounts(null);
      setToast(categoriesResult.reason?.message || 'Could not load categories.');
    }
    setContentCounts(countsResult.status === 'fulfilled' ? countsResult.value : null);
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    if (!form.type) {
      setToast('Please select a category type.');
      return;
    }
    try {
      if (form.id) await adminApi.updateCategory(form.id, form);
      else await adminApi.createCategory(form);
      setForm(null);
      setToast(`Category ${form.id ? 'updated' : 'created'} successfully.`);
      load();
    } catch (error) {
      setToast(error.message || 'Could not save category.');
    }
  };

  const deactivate = async () => {
    try {
      await adminApi.deleteCategory(confirm.id);
      setConfirm(null);
      setToast('Category deactivated successfully.');
      load();
    } catch (error) {
      setToast(error.message || 'Could not deactivate category.');
    }
  };

  const restore = async (category) => {
    try {
      await adminApi.updateCategory(category.id, { ...category, active: true });
      setToast('Category reactivated successfully.');
      load();
    } catch (error) {
      setToast(error.message || 'Could not reactivate category.');
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const list = items.filter((item) => (
    (type === 'ALL' || item.type === type)
    && (!normalizedQuery || [item.name, item.description]
      .some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)))
  ));
  const selectedCounts = type === 'RECIPE_TYPE' ? contentCounts : ingredientCounts;
  const countLabel = type === 'RECIPE_TYPE' ? 'Published content' : type === 'FOOD_TYPE' ? 'Ingredients' : 'Count';
  const countForCategory = (item) => (item.type === 'RECIPE_TYPE' ? contentCounts : ingredientCounts);

  return <div className="category-admin-page">
    <PageHeader title="Categories" text="Shape how food and recipes are organized across NutriBot." />

    <AdminToolbar className="category-admin-toolbar" label="Category filters">
      <SearchBox value={query} onChange={setQuery} placeholder="Search name or description..." />
      <div className={`category-type-toggle is-${type}`} role="group" aria-label="Filter category type">
        <button type="button" className={type === 'ALL' ? 'is-active' : ''} onClick={() => setType('ALL')} aria-pressed={type === 'ALL'}>All</button>
        <button type="button" className={type === 'RECIPE_TYPE' ? 'is-active' : ''} onClick={() => setType('RECIPE_TYPE')} aria-pressed={type === 'RECIPE_TYPE'}>Recipe Type</button>
        <button type="button" className={type === 'FOOD_TYPE' ? 'is-active' : ''} onClick={() => setType('FOOD_TYPE')} aria-pressed={type === 'FOOD_TYPE'}>Food Type</button>
      </div>
      <button className="admin-btn primary admin-toolbar__action" onClick={() => setForm(empty)}><Plus size={19} /> Add Category</button>
    </AdminToolbar>

    <section className="admin-panel table-panel category-table-panel">
      {loading ? <LoadingState /> : list.length ? <table className="admin-table category-admin-table">
        <thead><tr>
          <th className="category-id-column">No.</th>
          <th>Category name</th>
          <th>Description</th>
          <th className="category-content-count"><span className="category-count-value">{countLabel}</span></th>
          <th aria-label="Actions" />
        </tr></thead>
        <tbody>{list.map((item, index) => <tr key={item.id}>
          <td className="category-id-column">{index + 1}</td>
          <td><b>{item.name}</b></td>
          <td>{item.description}</td>
          <td className="category-content-count" title={(type === 'ALL' ? countForCategory(item) : selectedCounts) === null ? `${countLabel} count is unavailable.` : undefined}>
            <span className="category-count-value">{(type === 'ALL' ? countForCategory(item) : selectedCounts) === null ? '-' : (type === 'ALL' ? countForCategory(item) : selectedCounts)[item.id] ?? 0}</span>
          </td>
          <td className="row-actions">
            <button onClick={() => setForm(item)} aria-label={`Edit ${item.name}`} title="Edit category"><Pencil size={19} /></button>
            {item.active ? <button
              className="category-status-toggle is-active"
              onClick={() => setConfirm({ id: item.id, title: 'Deactivate category?', text: 'The category will be hidden from public lists; existing references stay intact.', confirm: 'Deactivate' })}
              aria-label={`Deactivate ${item.name}`}
              title="Active - click to deactivate"
            ><CircleCheck size={20} /></button> : <button
              className="category-status-toggle is-inactive"
              onClick={() => restore(item)}
              aria-label={`Reactivate ${item.name}`}
              title="Inactive - click to reactivate"
            ><CircleX size={20} /></button>}
          </td>
        </tr>)}</tbody>
      </table> : <EmptyState title="No categories found." text="Try a different search term or category type." />}
    </section>

    {form && <div className="admin-modal-backdrop" onMouseDown={() => setForm(null)}>
      <form className="admin-dialog admin-form" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <p>CATEGORY</p>
        <h2>{form.id ? 'Edit category' : 'Add category'}</h2>
        <label>Category Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Category Type<select required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          <option value="">Select a category type</option>
          <option value="FOOD_TYPE">Food Type</option>
          <option value="RECIPE_TYPE">Recipe Type</option>
        </select></label>
        <label>Description <small>(optional)</small><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div>
          <button type="button" className="admin-btn secondary" onClick={() => setForm(null)}>Cancel</button>
          <button className="admin-btn primary">{form.id ? 'Save Changes' : 'Create Category'}</button>
        </div>
      </form>
    </div>}

    <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} onConfirm={deactivate} />
    <Toast message={toast} onDismiss={() => setToast('')} />
  </div>;
}
