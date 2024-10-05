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

console.log("polygonCoords", polygonCoords);

export default function Map({ selectedLocation, onLocationChange, setError, isLocationAllowed }) {
  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = { lat, lng };

    if (isLocationAllowed(location)) {
      onLocationChange(location);
      setError(null);
    } else {
      setError("La ubicación seleccionada está fuera del área permitida.");
    }
  };

  const handleMarkerDragEnd = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = { lat, lng };

    if (isLocationAllowed(location)) {
      onLocationChange(location);
      setError(null);
    } else {
      setError("La ubicación seleccionada está fuera del área permitida.");
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
          {polygonCoords.length > 0 && (
            <Polygon
              paths={polygonCoords}
              options={{
                fillColor: "#00FF00", // Color de relleno verde brillante
                fillOpacity: 0.3,      // Opacidad del relleno
                strokeColor: "#0000FF", // Color de borde azul
                strokeOpacity: 0.8,     // Opacidad del borde
                strokeWeight: 2,        // Grosor del borde
                clickable: false,       // No clickeable
                draggable: false,       // No arrastrable
                editable: false,        // No editable
                geodesic: false,        // No geodésico
                zIndex: 1,               // Asegura que esté debajo de otros elementos
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
