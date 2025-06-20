import React, { useEffect, useRef, useState, useCallback } from 'react';
import { isPointInPolygon } from '@/utils/polygonUtils';

interface Location {
  lat: number;
  lng: number;
}

interface BasicMapProps {
  center: Location;
  onLocationSelect: (location: Location) => void;
  selectedLocation: Location | null;
  polygonCoords?: Location[];
  onLocationError?: (error: string) => void;
}

export const BasicMap: React.FC<BasicMapProps> = ({
  center,
  onLocationSelect,
  selectedLocation,
  polygonCoords = [],
  onLocationError,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const searchBoxInstance = useRef<google.maps.places.SearchBox | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    setMap(mapInstance);

    // Draw delivery area polygon if coordinates are provided
    if (polygonCoords.length > 0) {
      const polygon = new google.maps.Polygon({
        paths: polygonCoords,
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
      });
      polygon.setMap(mapInstance);
      polygonRef.current = polygon;

      // Fit map to polygon bounds
      const bounds = new google.maps.LatLngBounds();
      polygonCoords.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      mapInstance.fitBounds(bounds);
    }

    // Add click listener
    mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const location = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        };
        handleLocationSelect(location);
      }
    });

    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
    };
  }, [center, polygonCoords]);

  // Initialize search box
  useEffect(() => {
    if (!searchBoxRef.current || !map || !window.google) return;

    const searchBox = new google.maps.places.SearchBox(searchBoxRef.current);
    searchBoxInstance.current = searchBox;

    // Bias search results to map viewport
    map.addListener('bounds_changed', () => {
      searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
    });

    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (!places || places.length === 0) return;

      const place = places[0];
      if (!place.geometry || !place.geometry.location) return;

      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      handleLocationSelect(location);
      
      // Center map on selected location
      map.setCenter(place.geometry.location);
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else {
        map.setZoom(17);
      }
    });
  }, [map]);

  const handleLocationSelect = useCallback((location: Location) => {
    // Check if location is within delivery area
    if (polygonCoords.length > 0) {
      const isInside = isPointInPolygon(location, polygonCoords);
      if (!isInside) {
        if (onLocationError) {
          onLocationError('La ubicación seleccionada está fuera del área de entrega');
        }
        return;
      }
    }

    onLocationSelect(location);
  }, [polygonCoords, onLocationSelect, onLocationError]);

  // Update marker when selected location changes
  useEffect(() => {
    if (!map || !selectedLocation) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // Create new marker
    const marker = new google.maps.Marker({
      position: selectedLocation,
      map,
      animation: google.maps.Animation.DROP,
    });
    markerRef.current = marker;

    // Center map on marker
    map.setCenter(selectedLocation);

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [map, selectedLocation]);

  return (
    <div className="space-y-2">
      <input
        ref={searchBoxRef}
        type="text"
        placeholder="Buscar dirección..."
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <div
        ref={mapRef}
        className="w-full h-96 rounded-lg border border-gray-300"
      />
      {polygonCoords.length > 0 && (
        <p className="text-sm text-gray-600">
          * El área roja muestra nuestra zona de entrega
        </p>
      )}
    </div>
  );
};

export default BasicMap;