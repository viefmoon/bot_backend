import React, { useState } from "react";
import Head from "next/head";
import AddressSearch from "../src/frontend/components/AddressSearch";
import Map from "../src/frontend/components/Map";
import AddressForm from "../src/frontend/components/AddressForm";

export default function AddressSelection() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");

  const handleLocationSelect = (location, address) => {
    try {
      setSelectedLocation(location);
      setAddress(address);
    } catch (error) {
      console.error("Error al seleccionar la ubicación:", error);
    }
  };

  return (
    <div>
      <Head>
        <title>Selección de Dirección - La Leña Pizza</title>
        <meta name="description" content="Selecciona tu dirección de entrega" />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Selecciona tu dirección</h1>
        <AddressSearch onSelect={handleLocationSelect} />
        {selectedLocation ? (
          <Map
            selectedLocation={selectedLocation}
            onLocationChange={handleLocationSelect}
          />
        ) : (
          <p>Selecciona una ubicación para mostrar el mapa</p>
        )}
        <AddressForm selectedLocation={selectedLocation} address={address} />
      </main>
    </div>
  );
}
