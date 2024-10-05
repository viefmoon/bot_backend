import React from "react";
import { GoogleMap, Marker, Polygon } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "350px",
};

const center = {
  lat: 20.6534,
  lng: -103.3474,
};

const polygonCoords = JSON.parse(process.env.NEXT_PUBLIC_POLYGON_COORDS || '[]');

export default function Map({ selectedLocation, onLocationChange, setIsLocationValid, isLocationValid }) {
  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = new window.google.maps.LatLng(lat, lng);

    // Verificar si la ubicación está dentro del polígono
    if (window.google.maps.geometry.poly.containsLocation(location, new window.google.maps.Polygon({ paths: polygonCoords }))) {
      onLocationChange({ lat, lng });
      setIsLocationValid(true);
    } else {
      onLocationChange({ lat, lng });
      setIsLocationValid(false);
    }
  };

  const handleMarkerDragEnd = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = new window.google.maps.LatLng(lat, lng);

    // Verificar si la ubicación está dentro del polígono
    if (window.google.maps.geometry.poly.containsLocation(location, new window.google.maps.Polygon({ paths: polygonCoords }))) {
      onLocationChange({ lat, lng });
      setIsLocationValid(true);
    } else {
      onLocationChange({ lat, lng });
      setIsLocationValid(false);
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
          center={selectedLocation || center}
          zoom={15}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: false,
          }}
        >
          {/* Mostrar el polígono únicamente cuando la ubicación no es válida */}
          {!isLocationValid && (
            <Polygon 
              paths={polygonCoords} 
              options={{
                fillColor: "rgba(255, 0, 0, 0.3)", // Color rojo semitransparente
                strokeColor: "red",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          )}
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={window.google.maps.Animation.DROP}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
