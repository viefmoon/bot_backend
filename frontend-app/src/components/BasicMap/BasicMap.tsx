import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/utils/loadGoogleMaps';
import { config } from '@/config';
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
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        console.log('Google Maps loaded successfully');
        setIsMapLoaded(true);
        
        if (mapRef.current && !map) {
          // Initialize map with custom styles
          const mapInstance = new google.maps.Map(mapRef.current, {
            center,
            zoom: config.maps.defaultZoom.initial,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            zoomControl: true,
            zoomControlOptions: {
              position: google.maps.ControlPosition.RIGHT_CENTER
            },
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              },
              {
                featureType: 'transit',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });

          // Add click listener
          mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              const location = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              };
              
              // Validate if location is inside polygon
              if (polygonCoords.length > 0 && !isPointInPolygon(location, polygonCoords)) {
                if (onLocationError) {
                  onLocationError('⚠️ Por favor selecciona una ubicación dentro de nuestra área de cobertura');
                }
                return;
              }
              
              onLocationSelect(location);
            }
          });

          // Draw polygon if provided
          if (polygonCoords.length > 0) {
            const polygon = new google.maps.Polygon({
              paths: polygonCoords,
              strokeColor: '#10B981',
              strokeOpacity: 0.9,
              strokeWeight: 3,
              fillColor: '#10B981',
              fillOpacity: 0.2,
              map: mapInstance,
            });

            // Add visual feedback on polygon hover
            polygon.addListener('mouseover', () => {
              polygon.setOptions({
                fillOpacity: 0.3,
                strokeWeight: 4,
              });
            });

            polygon.addListener('mouseout', () => {
              polygon.setOptions({
                fillOpacity: 0.2,
                strokeWeight: 3,
              });
            });

            // Fit map to polygon bounds
            const bounds = new google.maps.LatLngBounds();
            polygonCoords.forEach(coord => {
              bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });
            mapInstance.fitBounds(bounds);
            
            // Add some padding
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            mapInstance.fitBounds(bounds, padding);
          }

          setMap(mapInstance);

          // Initialize autocomplete
          if (searchBoxRef.current) {
            const autocomplete = new google.maps.places.Autocomplete(searchBoxRef.current, {
              componentRestrictions: { country: config.regional.countryCode },
              fields: ['geometry', 'formatted_address', 'name'],
              types: ['geocode', 'establishment']
            });

            // Bias results to current map bounds
            autocomplete.bindTo('bounds', mapInstance);

            // Listen for place selection
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              
              if (!place.geometry || !place.geometry.location) {
                console.log('No se encontró la ubicación');
                return;
              }

              const location = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };

              // Validate if location is inside polygon
              if (polygonCoords.length > 0 && !isPointInPolygon(location, polygonCoords)) {
                if (onLocationError) {
                  onLocationError('⚠️ La dirección seleccionada está fuera de nuestra área de cobertura');
                }
                // Clear the input
                if (searchBoxRef.current) {
                  searchBoxRef.current.value = '';
                }
                return;
              }

              onLocationSelect(location);
              mapInstance.panTo(location);
              mapInstance.setZoom(config.maps.defaultZoom.search);
            });
          }
        }
      })
      .catch((error) => {
        console.error('Error loading Google Maps:', error);
        setMapError('Error al cargar el mapa. Por favor, recarga la página.');
      });
  }, []);

  // Update marker when location changes
  useEffect(() => {
    if (map && selectedLocation) {
      // Remove old marker
      if (marker) {
        marker.setMap(null);
      }

      // Add new marker with custom style
      const newMarker = new google.maps.Marker({
        position: selectedLocation,
        map,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 10,
        }
      });

      setMarker(newMarker);
      map.panTo(selectedLocation);
      map.setZoom(16);
    }
  }, [map, selectedLocation]);

  if (mapError) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center text-red-600">
          <p>{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="relative">
        <input
          ref={searchBoxRef}
          type="text"
          placeholder="Busca tu dirección en México..."
          className="w-full px-4 py-3 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          disabled={!isMapLoaded}
        />
        <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[300px] sm:h-[400px] rounded-lg overflow-hidden shadow-md border-2 border-gray-200">
        <div ref={mapRef} className="w-full h-full" />
        
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Cargando mapa...</p>
            </div>
          </div>
        )}
        
        {/* Instructions overlay */}
        {isMapLoaded && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg shadow-lg p-2 sm:p-3 max-w-[200px] sm:max-w-xs z-10">
            <p className="text-xs text-gray-700">
              <span className="font-semibold">📍 Haz clic en el mapa</span> para seleccionar tu ubicación
            </p>
          </div>
        )}
      </div>
    </div>
  );
};