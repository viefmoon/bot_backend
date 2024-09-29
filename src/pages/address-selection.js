import React, { useState } from "react";
import Head from "next/head";
import AddressSearch from "../components/AddressSearch";
import Map from "../components/Map";
import AddressForm from "../components/AddressForm";

export default function AddressSelection() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");

  const handleLocationSelect = (location, address) => {
    setSelectedLocation(location);
    setAddress(address);
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
        <Map
          selectedLocation={selectedLocation}
          onLocationChange={handleLocationSelect}
        />
        <AddressForm selectedLocation={selectedLocation} address={address} />
      </main>
    </div>
  );
}
