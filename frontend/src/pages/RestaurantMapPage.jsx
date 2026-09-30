import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  ExternalLink,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Star,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import {
  TRACKASIA_STYLE_URL,
  getUserCurrentPosition,
  searchNearbyRestaurants,
  calculateDistance
} from '../services/restaurantApi';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import '../styles/restaurant-map.css';

// Default initial coordinates: Center of Ho Chi Minh City (Notre-Dame Cathedral area)
const DEFAULT_CENTER = {
  lat: 10.7769,
  lng: 106.7009,
  city: 'TP. Hồ Chí Minh'
};

const CITIES = [
  { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7009 },
  { name: 'Hà Nội', lat: 21.0285, lng: 105.8542 },
  { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 }
];

export default function RestaurantMapPage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const activePopupRef = useRef(null);
  const latestLocationRequestIdRef = useRef(0);

  // States
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(5); // in km
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  // Initialize MapLibre GL instance with TrackAsia Streets style
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TRACKASIA_STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 13,
      pitch: 35,
      bearing: 0,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch restaurants whenever center or radius changes
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    searchNearbyRestaurants({
      lat: center.lat,
      lng: center.lng,
      radiusKm: selectedRadius,
      keyword: 'quán chay',
      signal: controller.signal
    })
      .then((items) => {
        if (!controller.signal.aborted) {
          setRestaurants(items);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load restaurants:', err);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [center.lat, center.lng, selectedRadius]);

  // Update restaurant markers on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old restaurant markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Filter restaurants based on search query
    const filtered = restaurants.filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.name?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });

    filtered.forEach((restaurant) => {
      if (!restaurant.lat || !restaurant.lng) return;

      // Custom DOM Element for marker
      const el = document.createElement('div');
      el.className = 'restaurant-pin-marker';
      el.innerHTML = `
        <div class="pin-bubble">
          <div class="pin-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
          </div>
        </div>
      `;

      // Custom Popup
      const popupContent = `
        <div class="map-popup-card">
          <h4>${restaurant.name}</h4>
          <p>${restaurant.address}</p>
          ${restaurant.distanceKm != null ? `<div class="popup-distance">Cách bạn: ~${restaurant.distanceKm} km</div>` : ''}
          <a href="${restaurant.googleMapUrl}" target="_blank" rel="noopener noreferrer" class="popup-btn">
            Chỉ đường trên Google Maps
          </a>
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: 28,
        closeButton: true,
        closeOnClick: false
      }).setHTML(popupContent);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedRestaurantId(restaurant.id);
        activePopupRef.current = popup;
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([restaurant.lng, restaurant.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [restaurants, searchQuery]);

  // Update or render User GPS Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-gps-marker';
      el.innerHTML = `
        <div class="user-gps-pulse"></div>
        <div class="user-gps-dot"></div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  // Explicit User Action: Request Geolocation (BL-008 Compliance)
  const handleRequestLocation = async () => {
    setIsLocating(true);
    setLocationError('');
    const currentRequestId = ++latestLocationRequestIdRef.current;

    try {
      const pos = await getUserCurrentPosition();

      // Guard against stale requests
      if (currentRequestId !== latestLocationRequestIdRef.current) return;

      setUserLocation({ lat: pos.lat, lng: pos.lng });
      setCenter({ lat: pos.lat, lng: pos.lng, city: 'Vị trí của bạn' });

      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [pos.lng, pos.lat],
          zoom: 14.5,
          pitch: 45,
          essential: true
        });
      }
    } catch (err) {
      if (currentRequestId !== latestLocationRequestIdRef.current) return;
      console.warn('Geolocation rejected/failed:', err.message);
      setLocationError(err.message || 'Không thể lấy vị trí hiện tại.');
    } finally {
      if (currentRequestId === latestLocationRequestIdRef.current) {
        setIsLocating(false);
      }
    }
  };

  // Card click: focus on map
  const handleSelectRestaurant = (restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    if (!mapRef.current || !restaurant.lat || !restaurant.lng) return;

    mapRef.current.flyTo({
      center: [restaurant.lng, restaurant.lat],
      zoom: 15.5,
      pitch: 45,
      essential: true
    });

    // Find and open popup
    const targetMarker = markersRef.current.find((m) => {
      const lngLat = m.getLngLat();
      return (
        Math.abs(lngLat.lng - restaurant.lng) < 0.0001 &&
        Math.abs(lngLat.lat - restaurant.lat) < 0.0001
      );
    });

    if (targetMarker) {
      targetMarker.togglePopup();
      activePopupRef.current = targetMarker.getPopup();
    }
  };

  // Switch City
  const handleCityChange = (city) => {
    setCenter(city);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [city.lng, city.lat],
        zoom: 13,
        pitch: 35,
        essential: true
      });
    }
  };

  // Filter restaurants by search query
  const filteredRestaurants = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.address?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="community-page restaurant-map-page">
      <CommunityTopBar hideSearch activePath="/restaurants/map" />
      <div className="community-shell">
        <CommunitySideNav activePath="/restaurants/map" />
        <span className="community-sidenav-spacer" aria-hidden="true" />
        
        <main className="map-workspace">
          <aside className="map-sidebar">
            <div className="map-sidebar-header">
              <div className="map-sidebar-title">
                <h2>Quán Ăn Xung Quanh</h2>
                <span className="results-count-badge">
                  {filteredRestaurants.length} địa điểm
                </span>
              </div>
              
              <div className="map-actions-row">
                <button
                  type="button"
                  className={`locate-me-btn ${userLocation ? 'is-active' : ''}`}
                  onClick={handleRequestLocation}
                  disabled={isLocating}
                  title="Định vị vị trí GPS của bạn"
                >
                  <Crosshair size={16} className={isLocating ? 'animate-spin' : ''} />
                  <span>{isLocating ? 'Đang định vị...' : 'Vị trí của bạn'}</span>
                </button>
                
                <select 
                  className="city-select" 
                  value={center.city === 'Vị trí của bạn' ? 'Vị trí của bạn' : center.city}
                  onChange={(e) => {
                    const city = CITIES.find(c => c.name === e.target.value);
                    if (city) handleCityChange(city);
                  }}
                >
                  <option value="Vị trí của bạn" disabled hidden>Vị trí của bạn</option>
                  {CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="map-sidebar-filters">
              <div className="drawer-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Tìm tên quán, địa chỉ, món chay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="radius-filter-row">
                <span>Bán kính:</span>
                {[1, 3, 5, 10, 20].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`radius-chip ${selectedRadius === r ? 'is-active' : ''}`}
                    onClick={() => setSelectedRadius(r)}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {locationError && (
              <div className="privacy-notice-bar" role="alert">
                <AlertTriangle size={15} />
                <div>{locationError}</div>
              </div>
            )}

            <div className="drawer-content-scroll">
              {isLoading ? (
                <div className="drawer-loading-indicator">
                  <div className="drawer-loading-spinner" />
                  <p>Đang tìm quán ăn dinh dưỡng xung quanh...</p>
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="drawer-empty-state">
                  <MapPin size={32} />
                  <p>Không tìm thấy quán chay nào trong bán kính {selectedRadius} km.</p>
                  <button
                    type="button"
                    className="radius-chip is-active"
                    onClick={() => setSelectedRadius(20)}
                  >
                    Mở rộng bán kính lên 20 km
                  </button>
                </div>
              ) : (
                filteredRestaurants.map((restaurant) => {
                  const isSelected = selectedRestaurantId === restaurant.id;
                  return (
                    <article
                      key={restaurant.id}
                      className={`restaurant-map-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectRestaurant(restaurant)}
                    >
                      <div className="card-top">
                        <h3>{restaurant.name}</h3>
                        <div className="card-rating-badge">
                          <Star size={12} fill="currentColor" />
                          <span>{restaurant.rating}</span>
                        </div>
                      </div>

                      <p className="card-address">
                        <MapPin size={14} />
                        <span>{restaurant.address}</span>
                      </p>

                      <div className="card-meta-row">
                        <div className="card-distance">
                          <Navigation size={13} />
                          <span>
                            {restaurant.distanceKm != null
                              ? `~${restaurant.distanceKm} km`
                              : 'Khu vực lân cận'}
                          </span>
                        </div>

                        <div className="card-actions">
                          <a
                            href={restaurant.googleMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-directions-btn"
                            onClick={(e) => e.stopPropagation()}
                            title="Mở chỉ đường trên Google Maps"
                          >
                            Chỉ đường <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </aside>

          <div className="map-canvas-wrapper">
            <div ref={mapContainerRef} className="map-canvas-container" />
          </div>
        </main>
      </div>
    </div>
  );
}
