import React, { useState, useEffect } from "react";
import axios from "axios";

export default function AddressForm({ selectedLocation, address }) {
  const [formData, setFormData] = useState({
    streetAddress: "",
    neighborhood: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
    latitude: "",
    longitude: "",
    additionalDetails: "",
  });

  useEffect(() => {
    if (selectedLocation) {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        streetAddress: address,
      }));
    }
  }, [selectedLocation, address]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/create-customer-delivery-info",
        formData
      );
      console.log("CustomerDeliveryInfo created:", response.data);
      // Aquí puedes agregar lógica adicional, como redireccionar al usuario o mostrar un mensaje de éxito
    } catch (error) {
      console.error("Error creating CustomerDeliveryInfo:", error);
      // Aquí puedes manejar el error, como mostrar un mensaje al usuario
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="mb-4">
        <label htmlFor="streetAddress" className="block mb-2">
          Dirección
        </label>
        <input
          type="text"
          id="streetAddress"
          name="streetAddress"
          value={formData.streetAddress}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="neighborhood" className="block mb-2">
          Barrio
        </label>
        <input
          type="text"
          id="neighborhood"
          name="neighborhood"
          value={formData.neighborhood}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="postalCode" className="block mb-2">
          Código Postal
        </label>
        <input
          type="text"
          id="postalCode"
          name="postalCode"
          value={formData.postalCode}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="city" className="block mb-2">
          Ciudad
        </label>
        <input
          type="text"
          id="city"
          name="city"
          value={formData.city}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="state" className="block mb-2">
          Estado/Provincia
        </label>
        <input
          type="text"
          id="state"
          name="state"
          value={formData.state}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="country" className="block mb-2">
          País
        </label>
        <input
          type="text"
          id="country"
          name="country"
          value={formData.country}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="additionalDetails" className="block mb-2">
          Detalles Adicionales
        </label>
        <textarea
          id="additionalDetails"
          name="additionalDetails"
          value={formData.additionalDetails}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded"
          rows="3"
        ></textarea>
      </div>
      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Guardar Dirección
      </button>
    </form>
  );
}
