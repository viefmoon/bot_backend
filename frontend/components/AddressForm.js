import React, { useState, useEffect } from "react";
import axios from "axios";

export default function AddressForm({ clientId, selectedLocation, addressData }) {
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
    if (selectedLocation && addressData) {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        streetAddress: addressData.streetAddress,
        neighborhood: addressData.neighborhood,
        postalCode: addressData.postalCode,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
      }));
    }
  }, [selectedLocation, addressData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/create-customer-delivery-info",
        { ...formData, clientId }
      );
      console.log("CustomerDeliveryInfo created:", response.data);
    } catch (error) {
      console.error("Error creating CustomerDeliveryInfo:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Detalles de la dirección</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["streetAddress", "neighborhood", "postalCode", "city", "state", "country"].map((field) => (
          <div key={field}>
            <label htmlFor={field} className="block mb-1 font-medium text-gray-700">
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              id={field}
              name={field}
              value={formData[field]}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required={field === "streetAddress"}
            />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="additionalDetails" className="block mb-1 font-medium text-gray-700">
          Detalles adicionales
        </label>
        <textarea
          id="additionalDetails"
          name="additionalDetails"
          value={formData.additionalDetails}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows="3"
        ></textarea>
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition duration-300"
      >
        Guardar Dirección
      </button>
    </form>
  );
}