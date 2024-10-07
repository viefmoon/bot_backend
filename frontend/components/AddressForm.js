import React, { useEffect } from "react";

export default function AddressForm({
  selectedLocation,
  address,
  formData,
  setFormData,
  formErrors,
}) {
  useEffect(() => {
    if (selectedLocation && typeof address === "string") {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat?.toString() || prev.latitude,
        longitude: selectedLocation.lng?.toString() || prev.longitude,
        streetAddress: address || prev.streetAddress,
      }));
    }
  }, [selectedLocation, address, setFormData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fieldTranslations = {
    
    streetAddress: "Dirección",
    neighborhood: "Colonia",
    postalCode: "Código postal",
    city: "Ciudad",
    state: "Estado",
    country: "País",
  };

  return (
    <form className="space-y-4 bg-white p-4 rounded-lg shadow-md">
      <div className="grid grid-cols-1 gap-4">
        {/* Campo de Nombre del cliente */}
        <div>
          <label htmlFor="pickupName" className="block mb-1 text-sm font-medium text-gray-700">
            Nombre del cliente
          </label>
          <input
            type="text"
            id="pickupName"
            name="pickupName"
            value={formData.pickupName}
            onChange={handleChange}
            className="w-full p-2 text-sm border rounded-md border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ingrese el nombre del cliente"
          />
          {formErrors.pickupName && (
            <p className="mt-1 text-xs text-red-600">{formErrors.pickupName}</p>
          )}
        </div>

        {/* Campo de dirección completa */}
        <div>
          <label
            htmlFor="streetAddress"
            className="block mb-1 text-sm font-medium text-gray-700"
          >
            {fieldTranslations.streetAddress}
          </label>
          <input
            type="text"
            id="streetAddress"
            name="streetAddress"
            value={formData.streetAddress}
            onChange={handleChange}
            className="w-full p-2 text-sm border rounded-md border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            placeholder="Ingrese la dirección completa"
          />
          <p className="mt-1 text-xs text-red-600">
            Importante: Incluya la orientación de la calle si aplica (ej. Norte, Sur, etc.)
          </p>
        </div>

        {/* Campo de detalles adicionales */}
        <div>
          <label
            htmlFor="additionalDetails"
            className="block mb-1 text-sm font-medium text-gray-700"
          >
            Detalles adicionales
          </label>
          <textarea
            id="additionalDetails"
            name="additionalDetails"
            value={formData.additionalDetails}
            onChange={handleChange}
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            placeholder="ej. entre calles, puntos de referencia"
          ></textarea>
          <p className="mt-1 text-xs text-gray-600">
            Agregue información extra para ubicar su dirección más fácilmente
          </p>
        </div>

        {/* Campos agrupados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {["neighborhood", "postalCode", "city", "state", "country"].map(
            (field) => (
              <div key={field}>
                <label
                  htmlFor={field}
                  className="block mb-1 text-sm font-medium text-gray-700"
                >
                  {fieldTranslations[field]}
                </label>
                <input
                  type="text"
                  id={field}
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  className="w-full p-2 text-sm border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  readOnly
                />
              </div>
            )
          )}
        </div>
      </div>
    </form>
  );
}
