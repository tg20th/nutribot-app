import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RestaurantRecommendations from '../RestaurantRecommendations';

describe('RestaurantRecommendations component', () => {
  const sampleRestaurants = [
    { id: '1', name: 'Mãn Tự Chay', address: '201 Nguyễn Thị Minh Khai, Q1', distanceKm: 1.2, category: 'Buffet Chay' },
    { id: '2', name: 'Hum Vegetarian', address: '32 Võ Văn Tần, Q3', distanceKm: 2.5, category: 'Lounge & Restaurant' },
    { id: '3', name: 'Pi Bistro', address: '19 Võ Văn Tần, Q3', distanceKm: 2.8, category: 'Bistro Chay' },
    { id: '4', name: 'Bếp Xanh An Duyên', address: '10 Nguyễn Tri Phương, Q5', distanceKm: 4.1, category: 'Cơm Chay' },
    { id: '5', name: 'Rôu Restaurant', address: '567A Nguyễn Trãi, Q5', distanceKm: 4.5, category: 'Plant-based' },
    { id: '6', name: 'Ưu Đàm Chay', address: '55 Nguyễn Du, Hai Bà Trưng', distanceKm: 6.0, category: 'Nhà hàng Chay' },
  ];

  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders clean cards with NO images, NO stars, and NO emojis', async () => {
    render(<RestaurantRecommendations previewRestaurants={sampleRestaurants} />);

    expect(screen.getByText('You can enjoy vegetarian dishes at these restaurants.')).toBeInTheDocument();

    // Check that 6 restaurants are rendered
    const cards = screen.getAllByRole('button', { name: /Open .* on map/i });
    expect(cards).toHaveLength(6);

    // Verify absolutely NO <img> elements exist inside the recommendations
    const images = document.querySelectorAll('.restaurant-recommendation-card img');
    expect(images).toHaveLength(0);

    // Verify NO star elements exist
    const stars = document.querySelectorAll('svg.lucide-star');
    expect(stars).toHaveLength(0);

    // Verify cards contain restaurant names and distances
    expect(screen.getByText('Mãn Tự Chay')).toBeInTheDocument();
    expect(screen.getByText('1.2 km away')).toBeInTheDocument();
    expect(screen.getByText('Hum Vegetarian')).toBeInTheDocument();
  });

  it('opens Google Maps when clicking a restaurant card', async () => {
    render(<RestaurantRecommendations previewRestaurants={sampleRestaurants} />);

    const firstCard = screen.getByRole('button', { name: /Open Mãn Tự Chay on map/i });
    fireEvent.click(firstCard);

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps/search/?api=1&query='),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('strictly filters out non-vegetarian and meat places', async () => {
    const mixedRestaurants = [
      { id: '1', name: 'Quán Cơm Tấm Sườn Bì Chả', address: '123 CMT8', category: 'Cơm mặn' },
      { id: '2', name: 'GreenSQL - Học Lập Trình Online', address: '456 Lê Lợi', category: 'Tin học' },
      { id: '3', name: 'Phở Bò Tái Nạm', address: '789 NTMK', category: 'Phở' },
      { id: '4', name: 'Nhà Hàng Chay An Lạc', address: '10 Hai Bà Trưng', category: 'Buffet Chay' },
    ];

    render(<RestaurantRecommendations previewRestaurants={mixedRestaurants} />);

    expect(screen.queryByText('Quán Cơm Tấm Sườn Bì Chả')).not.toBeInTheDocument();
    expect(screen.queryByText('GreenSQL - Học Lập Trình Online')).not.toBeInTheDocument();
    expect(screen.queryByText('Phở Bò Tái Nạm')).not.toBeInTheDocument();
    expect(screen.getByText('Nhà Hàng Chay An Lạc')).toBeInTheDocument();
  });
});
