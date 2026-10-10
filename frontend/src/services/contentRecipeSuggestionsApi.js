import { apiRequest, unwrapData } from './apiClient';

const basePath = '/api/v1/admin/content-recipe-suggestions';

const previewMode = () => import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === '1';

let previewSuggestions = [
  {
    suggestionId: 701, status: 'PENDING', createdAt: '2026-10-10T08:16:00Z', contentId: 82, contentType: 'BLOG', contentTitle: 'Bún gạo lứt rau củ cho bữa trưa nhẹ bụng', authorName: 'Bảo Trâm', viewCount: 1847, voteCount: 126,
    dish: { name: 'Bún gạo lứt rau củ', description: 'Bún gạo lứt với rau củ áp chảo, nước sốt gừng và mè rang.', servingSize: 1, servingUnit: 'bowl' },
    nutrition: { calories: 418, proteinG: 15.8, carbsG: 64.2, fatG: 11.6, fiberG: 9.4 },
    ingredients: [{ name: 'Bún gạo lứt', quantity: 90, unit: 'g' }, { name: 'Đậu hũ non', quantity: 120, unit: 'g' }, { name: 'Bông cải xanh', quantity: 80, unit: 'g' }, { name: 'Sốt gừng mè', quantity: 2, unit: 'tbsp' }],
    recipe: { title: 'Bún gạo lứt rau củ', description: 'Món trưa dễ chuẩn bị, phù hợp khi cần đủ chất nhưng vẫn nhẹ nhàng.', prepTimeMin: 12, cookTimeMin: 10, servings: 1, steps: ['Ngâm bún gạo lứt trong nước ấm.', 'Áp chảo đậu hũ và rau củ đến khi chín vừa.', 'Trộn bún với sốt gừng mè, sau đó thêm rau củ và đậu hũ.'] },
    restaurant: { name: 'Nhà Bếp Mộc', address: '42 Nguyễn Văn Trỗi, Phú Nhuận', reference: 'https://maps.google.com/?q=Nha+Bep+Moc' },
  },
  {
    suggestionId: 702, status: 'PENDING', createdAt: '2026-10-09T15:42:00Z', contentId: 76, contentType: 'VIDEO', contentTitle: 'Cá hồi áp chảo sốt chanh cho ngày tập luyện', authorName: 'Minh Quân', viewCount: 2934, voteCount: 211,
    dish: { name: 'Cá hồi áp chảo sốt chanh', description: 'Cá hồi áp chảo dùng cùng khoai lang và rau xanh.', servingSize: 1, servingUnit: 'plate' },
    nutrition: { calories: 536, proteinG: 38.5, carbsG: 42.1, fatG: 24.4, fiberG: 7.1 },
    ingredients: [{ name: 'Phi lê cá hồi', quantity: 160, unit: 'g' }, { name: 'Khoai lang', quantity: 180, unit: 'g' }, { name: 'Măng tây', quantity: 90, unit: 'g' }, { name: 'Chanh vàng', quantity: 1, unit: 'fruit' }],
    recipe: { title: 'Cá hồi áp chảo sốt chanh', description: 'Bữa chính giàu đạm với thời gian chế biến ngắn.', prepTimeMin: 8, cookTimeMin: 14, servings: 1, steps: ['Nướng khoai lang đến khi mềm.', 'Áp chảo cá hồi mặt da trước để tạo độ giòn.', 'Thêm nước cốt chanh và dùng cùng măng tây.'] },
    restaurant: {},
  },
  {
    suggestionId: 703, status: 'APPROVED', createdAt: '2026-10-08T04:20:00Z', reviewedAt: '2026-10-08T09:35:00Z', reviewerName: 'Ngọc An', contentId: 69, contentType: 'BLOG', contentTitle: 'Cháo yến mạch nấm cho buổi sáng mưa', authorName: 'Thuỳ Dương', viewCount: 1184, voteCount: 87,
    dish: { name: 'Cháo yến mạch nấm', description: 'Cháo yến mạch mặn với nấm và rau thơm.', servingSize: 1, servingUnit: 'bowl' },
    nutrition: { calories: 304, proteinG: 12.4, carbsG: 45.6, fatG: 8.7, fiberG: 8.2 },
    ingredients: [{ name: 'Yến mạch cán', quantity: 60, unit: 'g' }, { name: 'Nấm đùi gà', quantity: 100, unit: 'g' }],
    recipe: { title: 'Cháo yến mạch nấm', description: 'Công thức đã được liên kết với catalog.', prepTimeMin: 5, cookTimeMin: 18, servings: 1, steps: ['Nấu yến mạch với nước dùng rau củ.', 'Xào nấm và cho vào cháo trước khi dùng.'] },
    restaurant: {},
  },
  {
    suggestionId: 704, status: 'REJECTED', createdAt: '2026-10-07T11:05:00Z', reviewedAt: '2026-10-07T16:15:00Z', reviewerName: 'Ngọc An', contentId: 64, contentType: 'VIDEO', contentTitle: 'Nước ép xanh sau giờ làm', authorName: 'Hải Yến', viewCount: 924, voteCount: 52,
    dish: { name: 'Nước ép xanh cần tây', description: 'Nước ép cần tây, táo xanh và dưa leo.', servingSize: 1, servingUnit: 'glass' },
    nutrition: { calories: 108, proteinG: 1.7, carbsG: 24.5, fatG: 0.4, fiberG: 3.2 },
    ingredients: [{ name: 'Cần tây', quantity: 130, unit: 'g' }, { name: 'Táo xanh', quantity: 1, unit: 'fruit' }],
    recipe: { title: 'Nước ép xanh cần tây', description: 'Suggestion được giữ để đối chiếu lịch sử review.', prepTimeMin: 6, cookTimeMin: 0, servings: 1, steps: ['Rửa sạch nguyên liệu.', 'Ép lần lượt và dùng ngay.'] },
    restaurant: {},
  },
];

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const normalizeStatus = (value) => String(value ?? 'PENDING').trim().toUpperCase() || 'PENDING';

function mapNutrition(raw) {
  const value = asObject(raw);
  return {
    calories: value.calories ?? value.calorieKcal ?? value.energyKcal ?? null,
    proteinG: value.proteinG ?? value.protein ?? null,
    carbsG: value.carbsG ?? value.carbohydratesG ?? value.carbs ?? null,
    fatG: value.fatG ?? value.healthyFatsG ?? value.fat ?? null,
    fiberG: value.fiberG ?? value.fibreG ?? null,
  };
}

function mapSource(raw) {
  const source = asObject(raw.sourceContent ?? raw.content ?? raw.source);
  return {
    contentId: source.contentId ?? source.id ?? raw.contentId ?? null,
    contentType: String(source.contentType ?? source.type ?? raw.contentType ?? 'BLOG').toUpperCase(),
    title: source.title ?? raw.contentTitle ?? raw.title ?? 'Untitled content',
    authorName: source.authorName ?? source.authorUsername ?? source.author ?? raw.authorName ?? raw.authorUsername ?? raw.author ?? 'Author unavailable',
    viewCount: source.viewCount ?? raw.viewCount ?? 0,
    voteCount: source.voteCount ?? raw.voteCount ?? 0,
    createdAt: source.createdAt ?? raw.contentCreatedAt ?? raw.createdAt ?? null,
    url: source.url ?? source.contentUrl ?? raw.contentUrl ?? null,
  };
}

export function mapContentRecipeSuggestion(raw) {
  const item = asObject(raw);
  const dish = asObject(item.dish ?? item.suggestedDish ?? item.dishProposal);
  const recipe = asObject(item.recipe ?? item.suggestedRecipe ?? item.recipeProposal);
  const restaurant = asObject(item.restaurant ?? item.restaurantReference ?? item.suggestedRestaurant);
  const ingredients = asArray(item.ingredients ?? recipe.ingredients ?? dish.ingredients);
  const steps = asArray(item.recipeSteps ?? item.steps ?? recipe.steps ?? recipe.instructions);

  return {
    suggestionId: item.suggestionId ?? item.id,
    status: normalizeStatus(item.status),
    createdAt: item.createdAt ?? item.suggestedAt ?? null,
    reviewedAt: item.reviewedAt ?? null,
    reviewerName: item.reviewerName ?? item.reviewedByName ?? null,
    rejectionReason: item.rejectionReason ?? item.reviewReason ?? null,
    source: mapSource(item),
    dish: {
      name: dish.name ?? dish.title ?? item.dishName ?? item.proposedDishName ?? 'Dish name unavailable',
      description: dish.description ?? item.dishDescription ?? '',
      servingSize: dish.servingSize ?? item.servingSize ?? null,
      servingUnit: dish.servingUnit ?? item.servingUnit ?? null,
    },
    nutrition: mapNutrition(item.nutrition ?? dish.nutrition ?? recipe.nutrition),
    ingredients: ingredients.map((ingredient) => {
      const value = typeof ingredient === 'string' ? { name: ingredient } : asObject(ingredient);
      return {
        name: value.name ?? value.ingredientName ?? 'Ingredient unavailable',
        quantity: value.quantity ?? value.amount ?? null,
        unit: value.unit ?? null,
        notes: value.notes ?? '',
      };
    }),
    recipe: {
      title: recipe.title ?? item.recipeTitle ?? dish.name ?? item.dishName ?? 'Recipe details',
      description: recipe.description ?? item.recipeDescription ?? '',
      prepTimeMin: recipe.prepTimeMin ?? item.prepTimeMin ?? null,
      cookTimeMin: recipe.cookTimeMin ?? item.cookTimeMin ?? null,
      servings: recipe.servings ?? item.servings ?? null,
      steps: steps.map((step) => (typeof step === 'string' ? step : step.description ?? step.text ?? step.instruction ?? 'Step unavailable')),
    },
    restaurant: {
      name: restaurant.name ?? restaurant.restaurantName ?? null,
      address: restaurant.address ?? null,
      reference: restaurant.reference ?? restaurant.url ?? restaurant.mapUrl ?? null,
    },
  };
}

export const contentRecipeSuggestionsApi = {
  async list({ status = '', page = 0, size = 10 } = {}, signal) {
    if (previewMode()) {
      const filtered = previewSuggestions.filter((item) => !status || item.status === status);
      const start = page * size;
      return {
        content: filtered.slice(start, start + size).map(mapContentRecipeSuggestion),
        page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
      };
    }
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.set('status', status);
    const result = unwrapData(await apiRequest(`${basePath}?${params}`, { signal }), {});
    const items = asArray(result.content ?? result.items ?? result.results ?? result);
    return {
      content: items.map(mapContentRecipeSuggestion),
      page: Number(result.page ?? result.number ?? page),
      size: Number(result.size ?? size),
      totalElements: Number(result.totalElements ?? result.total ?? items.length),
      totalPages: Number(result.totalPages ?? (items.length ? 1 : 0)),
    };
  },

  async getById(suggestionId, signal) {
    if (previewMode()) {
      const preview = previewSuggestions.find((item) => item.suggestionId === Number(suggestionId));
      if (!preview) {
        const error = new Error('Suggestion not found.');
        error.status = 404;
        throw error;
      }
      return mapContentRecipeSuggestion(preview);
    }
    const item = unwrapData(await apiRequest(`${basePath}/${suggestionId}`, { signal }), {});
    return mapContentRecipeSuggestion(item);
  },

  async review(suggestionId, action, rejectionReason = '') {
    if (previewMode()) {
      const index = previewSuggestions.findIndex((item) => item.suggestionId === Number(suggestionId));
      const current = previewSuggestions[index];
      if (!current) { const error = new Error('Suggestion not found.'); error.status = 404; throw error; }
      if (current.status !== 'PENDING') { const error = new Error('This suggestion has already been reviewed.'); error.status = 409; throw error; }
      if (action === 'REJECT' && !rejectionReason.trim()) { const error = new Error('A rejection reason is required.'); error.status = 400; throw error; }
      previewSuggestions[index] = { ...current, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewedAt: new Date().toISOString(), reviewerName: 'Preview administrator', rejectionReason: rejectionReason.trim() || null };
      return mapContentRecipeSuggestion(previewSuggestions[index]);
    }
    const item = unwrapData(await apiRequest(`${basePath}/${suggestionId}/review`, {
      method: 'PUT', body: JSON.stringify({ action, rejectionReason: rejectionReason.trim() || null }),
    }), {});
    return mapContentRecipeSuggestion(item);
  },
};
