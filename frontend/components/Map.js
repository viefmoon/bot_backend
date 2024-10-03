import React from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "12px",
  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
  border: "2px solid #4299e1",
};

const center = {
  lat: 20.6534,
  lng: -103.3474,
};

export default function Map({ selectedLocation, onLocationChange }) {
  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    onLocationChange({ lat, lng });
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-indigo-700">Selecciona tu ubicación</h2>
      <div className="relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={selectedLocation || center}
          zoom={15}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
          }}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              animation={window.google.maps.Animation.DROP}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(50, 50),
              }}
            />
          )}
        </GoogleMap>
        <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-full shadow-md">
          <span className="text-sm font-medium text-gray-700">Haz clic para seleccionar</span>
        </div>
      </div>
    </div>
  );
}
