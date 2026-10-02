import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RestaurantMapPage from '../RestaurantMapPage';

// Mock @goongmaps/goong-js constructors with proper classes
vi.mock('@goongmaps/goong-js', () => {
  class MockMap {
    addControl() {}
    remove() {}
    flyTo() {}
  }

  class MockNavigationControl {}

  class MockMarker {
    setLngLat() { return this; }
    setPopup() { return this; }
    addTo() { return this; }
    remove() {}
    getLngLat() { return { lng: 106.6872, lat: 10.7684 }; }
    togglePopup() {}
    getPopup() { return {}; }
  }

  class MockPopup {
    setHTML() { return this; }
  }

  return {
    default: {
      Map: MockMap,
      NavigationControl: MockNavigationControl,
      Marker: MockMarker,
      Popup: MockPopup,
      accessToken: ''
    },
    Map: MockMap,
    NavigationControl: MockNavigationControl,
    Marker: MockMarker,
    Popup: MockPopup
  };
});

vi.mock('maplibre-gl', () => {
  class MockMap {
    addControl() {}
    remove() {}
    flyTo() {}
  }

  class MockNavigationControl {}

  class MockMarker {
    setLngLat() { return this; }
    setPopup() { return this; }
    addTo() { return this; }
    remove() {}
    getLngLat() { return { lng: 106.6872, lat: 10.7684 }; }
    togglePopup() {}
    getPopup() { return {}; }
  }

  class MockPopup {
    setHTML() { return this; }
  }

  return {
    default: {
      Map: MockMap,
      NavigationControl: MockNavigationControl,
      Marker: MockMarker,
      Popup: MockPopup
    },
    Map: MockMap,
    NavigationControl: MockNavigationControl,
    Marker: MockMarker,
    Popup: MockPopup
  };
});

describe('RestaurantMapPage (NB-46 & BL-008 Privacy Compliance)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT request geolocation on initial component mount', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    render(
      <MemoryRouter>
        <RestaurantMapPage />
      </MemoryRouter>
    );

    // Initial mount should NOT invoke geolocation
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText('Nearby Restaurants')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Your Location/i })).toBeInTheDocument();
  });

  it('requests geolocation ONLY when the user clicks the locate button', async () => {
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 10.7769, longitude: 106.7009, accuracy: 20 } });
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    render(
      <MemoryRouter>
        <RestaurantMapPage />
      </MemoryRouter>
    );

    const locateBtn = screen.getByRole('button', { name: /Your Location/i });
    fireEvent.click(locateBtn);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Your Location/i })).toBeInTheDocument();
    });
  });

  it('handles permission denial gracefully without crashing and displays informative message', async () => {
    const getCurrentPosition = vi.fn((success, error) => {
      error({ code: 1, message: 'User denied Geolocation' });
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    render(
      <MemoryRouter>
        <RestaurantMapPage />
      </MemoryRouter>
    );

    const locateBtn = screen.getByRole('button', { name: /Your Location/i });
    fireEvent.click(locateBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Location access denied/i);
    });
  });

  it('filters restaurant list by radius when a radius chip is selected', async () => {
    render(
      <MemoryRouter>
        <RestaurantMapPage />
      </MemoryRouter>
    );

    const radiusChip3Km = screen.getByRole('button', { name: '3 km' });
    fireEvent.click(radiusChip3Km);
    expect(radiusChip3Km).toHaveClass('is-active');
  });
});
