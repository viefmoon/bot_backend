import React from "react";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const libraries = ["places"];

export default function AddressSearch({ onSelect }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const onPlaceChanged = (autocomplete) => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const selectedLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        onSelect(selectedLocation, place.formatted_address);
      }
    }
  };

  if (loadError) {
    return <div className="text-red-500">Error al cargar Google Maps API</div>;
  }

  if (!isLoaded) return <div>Cargando...</div>;

  return (
    <Autocomplete onLoad={(autocomplete) => autocomplete.addListener("place_changed", () => onPlaceChanged(autocomplete))}>
      <input
        type="text"
        placeholder="Busca tu dirección"
        className="w-full p-2 border border-gray-300 rounded mb-4"
      />
    </Autocomplete>
  );
}
