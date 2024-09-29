import React, { useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Autocomplete,
} from "@react-google-maps/api";

const libraries = ["places"];

export default function AddressSearch({ onSelect }) {
  const [autocomplete, setAutocomplete] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const onLoad = (autocomplete) => {
    setAutocomplete(autocomplete);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        onSelect(
          {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
          place.formatted_address
        );
      }
    }
  };

  if (!isLoaded) return <div>Cargando...</div>;

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <input
        type="text"
        placeholder="Busca tu dirección"
        className="w-full p-2 border border-gray-300 rounded"
      />
    </Autocomplete>
  );
}
