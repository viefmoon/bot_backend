import React from "react";
import { Autocomplete } from "@react-google-maps/api";

export default function AddressSearch({ onSelect }) {
  const onPlaceChanged = (autocomplete) => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const selectedLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        
        // Extraer más información de la dirección
        const addressComponents = place.address_components;
        const formattedAddress = place.formatted_address;
        
        const addressData = {
          streetAddress: formattedAddress,
          neighborhood: '',
          postalCode: '',
          city: '',
          state: '',
          country: '',
        };

        for (let component of addressComponents) {
          const componentType = component.types[0];
          switch (componentType) {
            case "sublocality_level_1":
              addressData.neighborhood = component.long_name;
              break;
            case "postal_code":
              addressData.postalCode = component.long_name;
              break;
            case "locality":
              addressData.city = component.long_name;
              break;
            case "administrative_area_level_1":
              addressData.state = component.long_name;
              break;
            case "country":
              addressData.country = component.long_name;
              break;
          }
        }

        onSelect(selectedLocation, addressData);
      }
    }
  };

  return (
    <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Busca tu dirección</h2>
      <Autocomplete
        onLoad={(autocomplete) =>
          autocomplete.addListener("place_changed", () => onPlaceChanged(autocomplete))
        }
      >
        <input
          type="text"
          placeholder="Ingresa tu dirección"
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        />
      </Autocomplete>
    </div>
  );
}
