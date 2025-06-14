import React from 'react';
import { GoogleMap, Marker, Polygon } from '@react-google-maps/api';
import type { Location } from '@/types/customer.types';

interface MapProps {
  selectedLocation: Location | null;
  onLocationChange: (location: Location) => void;
  setError: (error: string | null) => void;
  isLocationAllowed: (location: Location) => boolean;
  polygonCoords: Location[];
}

const containerStyle = {
  width: '100%',
  height: '350px',
};

const defaultCenter: Location = {
  lat: 20.54217,
  lng: -102.79222,
};

export const Map: React.FC<MapProps> = ({
  selectedLocation,
  onLocationChange,
  setError,
  isLocationAllowed,
  polygonCoords,
}) => {
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location: Location = { lat, lng };

    onLocationChange(location);
    
    if (!isLocationAllowed(location)) {
      setError('La ubicación seleccionada está fuera del área permitida.');
    } else {
      setError(null);
    }
  };

  const handleMarkerDragEnd = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location: Location = { lat, lng };

    onLocationChange(location);
    
    if (!isLocationAllowed(location)) {
      setError('La ubicación seleccionada está fuera del área permitida.');
    } else {
      setError(null);
    }
  };

  return (
    <div className="mb-2 p-2 bg-white rounded-lg shadow-md">
      <h2 className="text-base font-semibold mb-1 text-gray-800">
        Ajusta el cursor a la ubicación exacta
      </h2>
      <div className="rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={selectedLocation || defaultCenter}
          zoom={15}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: false,
          }}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={window.google.maps.Animation.DROP}
            />
          )}
          <Polygon
            paths={polygonCoords}
            options={{
              fillColor: 'rgba(255, 165, 0, 0.3)',
              strokeColor: 'green',
              strokeOpacity: 1,
              strokeWeight: 2,
            }}
          />
        </GoogleMap>
      </div>
    </div>
  );
};