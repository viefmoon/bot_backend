import React, { useState } from "react";
import { GoogleMap, LoadScript, Autocomplete } from "@react-google-maps/api";

const libraries = ["places"];

export default function AddressSearch({ onSelect }) {
  const [autocomplete, setAutocomplete] = useState(null);

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

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      libraries={libraries}
    >
      <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
        <input
          type="text"
          placeholder="Busca tu dirección"
          className="w-full p-2 border border-gray-300 rounded"
        />
      </Autocomplete>
    </LoadScript>
  );
}
