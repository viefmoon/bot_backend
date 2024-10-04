import { useEffect, useState } from "react";
import axios from "axios";
import OrderCard from "../components/OrderCard";
import CustomerCard from "../components/CustomerCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Por defecto a la fecha actual
  const [activeView, setActiveView] = useState("orders"); // Nueva estado para controlar la vista activa
  const [notificationPhones, setNotificationPhones] = useState([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [restaurantConfig, setRestaurantConfig] = useState({
    acceptingOrders: false,
    estimatedPickupTime: 0,
    estimatedDeliveryTime: 0,
  });
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    fetchOrders(selectedDate);
    fetchClients();
    fetchMenu();
    fetchRestaurantConfig();
    fetchNotificationPhones();
    const interval = setInterval(() => {
      fetchOrders(selectedDate);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const fetchOrders = async (date) => {
    try {
      let url = "/api/orders";
      if (date) {
        const formattedDate = format(date, "yyyy-MM-dd"); // Formato de la fecha
        url += `?date=${formattedDate}`;
      }
      const response = await axios.get(url);
      setOrders(response.data);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setError(
        "No se pudieron obtener los pedidos. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get("/api/customers");
      setClients(response.data);
    } catch (error) {
      console.error("Error al obtener clientes:", error);
      setError(
        "No se pudieron obtener los clientes. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const fetchNotificationPhones = async () => {
    try {
      const response = await axios.get("/api/notification_phones");
      setNotificationPhones(response.data);
    } catch (error) {
      console.error("Error al obtener teléfonos de notificación:", error);
      setError(
        "No se pudieron obtener los teléfonos de notificación. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const addNotificationPhone = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/notification_phones", {
        phoneNumber: newPhoneNumber,
        isActive: true,
      });
      setNewPhoneNumber("");
      fetchNotificationPhones();
    } catch (error) {
      console.error("Error al agregar teléfono de notificación:", error);
      setError(
        "No se pudo agregar el teléfono de notificación. Por favor, inténtelo de nuevo."
      );
    }
  };

  const deleteNotificationPhone = async (phoneId) => {
    try {
      await axios.delete(`/api/notification_phones/${phoneId}`);
      fetchNotificationPhones();
    } catch (error) {
      console.error("Error al eliminar teléfono de notificación:", error);
      setError(
        "No se pudo eliminar el teléfono de notificación. Por favor, inténtelo de nuevo."
      );
    }
  };

  const togglePhoneStatus = async (phoneId, currentStatus) => {
    try {
      await axios.put(`/api/notification_phones/${phoneId}`, {
        isActive: !currentStatus,
      });
      fetchNotificationPhones();
    } catch (error) {
      console.error("Error al actualizar teléfono de notificación:", error);
      setError(
        "No se pudo actualizar el teléfono de notificación. Por favor, inténtelo de nuevo."
      );
    }
  };

  const fetchRestaurantConfig = async () => {
    try {
      const response = await axios.get("/api/restaurant_config");
      setRestaurantConfig(response.data);
    } catch (error) {
      console.error(
        "Error al obtener la configuración del restaurante:",
        error
      );
      setError(
        "No se pudo obtener la configuración del restaurante. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const updateRestaurantConfig = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const config = {
      acceptingOrders: formData.get("acceptingOrders") === "true",
      estimatedPickupTime: parseInt(formData.get("estimatedPickupTime")),
      estimatedDeliveryTime: parseInt(formData.get("estimatedDeliveryTime")),
    };

    try {
      const response = await axios.put("/api/restaurant_config", config);
      setRestaurantConfig(response.data.config);
      alert("Configuración actualizada exitosamente");
      fetchRestaurantConfig(); // Añadir esta línea para actualizar la configuración
    } catch (error) {
      console.error(
        "Error al actualizar la configuración del restaurante:",
        error
      );
      setError(
        "No se pudo actualizar la configuración del restaurante. Por favor, inténtelo de nuevo."
      );
    }
  };

  const fetchMenu = async () => {
    try {
      const response = await axios.get("/api/menu");
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error al obtener el menú:", error);
      setError(
        "No se pudo obtener el menú. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const toggleItemAvailability = async (id, type) => {
    try {
      await axios.post("/api/menu", { id, type });
      fetchMenu();
    } catch (error) {
      console.error("Error al cambiar la disponibilidad:", error);
      setError(
        "No se pudo cambiar la disponibilidad. Por favor, inténtelo de nuevo."
      );
    }
  };

  const groupMenuItemsByCategory = (menuItems) => {
    const groupedItems = {};
    menuItems.forEach((item) => {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    });
    return groupedItems;
  };

  const renderMenuItemCard = (item) => (
    <div
      key={item.id}
      className="bg-white rounded-lg shadow-md overflow-hidden mb-6"
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">{item.name}</h3>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              item.Availability.available
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {item.Availability.available ? "Disponible" : "No disponible"}
          </span>
        </div>
        <p className="text-gray-600 mb-2">Categoría: {item.category}</p>
        <p className="text-gray-600 mb-4">
          Precio:{" "}
          {item.price ? `$${item.price.toFixed(2)}` : "Varía según la variante"}
        </p>

        {item.productVariants && item.productVariants.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-2">Variantes:</h4>
            <div className="space-y-2">
              {item.productVariants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex justify-between items-center bg-gray-50 p-2 rounded"
                >
                  <span>{variant.name}</span>
                  <button
                    onClick={() =>
                      toggleItemAvailability(variant.id, "productVariant")
                    }
                    className={`px-3 py-1 rounded text-sm font-semibold ${
                      variant.Availability.available
                        ? "bg-red-500 text-white"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    {variant.Availability.available
                      ? "Deshabilitar"
                      : "Habilitar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secciones similares para modificadores e ingredientes de pizza */}

        <button
          onClick={() => toggleItemAvailability(item.id, "product")}
          className={`w-full mt-4 px-4 py-2 rounded font-semibold ${
            item.Availability.available
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
        >
          {item.Availability.available
            ? "Deshabilitar producto"
            : "Habilitar producto"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => setActiveView("orders")}
          className={`px-4 py-2 rounded-lg ${
            activeView === "orders"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          Ver Pedidos
        </button>
        <button
          onClick={() => setActiveView("clients")}
          className={`px-4 py-2 rounded-lg ${
            activeView === "clients"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          Ver Clientes
        </button>
        <button
          onClick={() => setActiveView("notificationPhones")}
          className={`px-4 py-2 rounded-lg ${
            activeView === "notificationPhones"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          Ver Teléfonos de Notificación
        </button>
        <button
          onClick={() => setActiveView("restaurantConfig")}
          className={`px-4 py-2 rounded-lg ${
            activeView === "restaurantConfig"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          Configuración del Restaurante
        </button>
        <button
          onClick={() => setActiveView("menu")}
          className={`px-4 py-2 rounded-lg ${
            activeView === "menu"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
        >
          Ver Menú
        </button>
      </div>

      {activeView === "orders" && (
        <div>
          <button
            onClick={() => fetchOrders(selectedDate)}
            className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Refrescar Pedidos
          </button>
          <div>
            <label>Selecciona una fecha: </label>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="yyyy-MM-dd"
              placeholderText="Selecciona una fecha"
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <div id="order-list">
            {orders.length === 0 ? (
              <p className="text-center">No se encontraron pedidos.</p>
            ) : (
              orders.map((order) => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        </div>
      )}

      {activeView === "clients" && (
        <div>
          <button
            onClick={fetchClients}
            className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Refrescar Clientes
          </button>
          {error && <div className="alert alert-danger">{error}</div>}
          <div id="client-list">
            {clients.length === 0 ? (
              <p className="text-center">No se encontraron clientes.</p>
            ) : (
              clients.map((client) => (
                <CustomerCard key={client.clientId} client={client} />
              ))
            )}
          </div>
        </div>
      )}

      {activeView === "notificationPhones" && (
        <div>
          <h2>Teléfonos de Notificación</h2>
          <form onSubmit={addNotificationPhone}>
            <input
              type="text"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
              placeholder="Nuevo número de teléfono"
              required
            />
            <button type="submit">Agregar Teléfono</button>
          </form>
          <ul>
            {notificationPhones.map((phone) => (
              <li key={phone.id}>
                {phone.phoneNumber}
                <button
                  onClick={() => togglePhoneStatus(phone.id, phone.isActive)}
                >
                  {phone.isActive ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => deleteNotificationPhone(phone.id)}>
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeView === "restaurantConfig" && (
        <div>
          <h2>Configuración del Restaurante</h2>
          {restaurantConfig ? (
            <form onSubmit={updateRestaurantConfig}>
              <div>
                <label htmlFor="acceptingOrders">Aceptando Pedidos:</label>
                <select
                  id="acceptingOrders"
                  name="acceptingOrders"
                  defaultValue={restaurantConfig.acceptingOrders?.toString()}
                >
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="estimatedPickupTime">
                  Tiempo estimado de recogida (minutos):
                </label>
                <input
                  type="number"
                  id="estimatedPickupTime"
                  name="estimatedPickupTime"
                  defaultValue={restaurantConfig.estimatedPickupTime}
                />
              </div>
              <div>
                <label htmlFor="estimatedDeliveryTime">
                  Tiempo estimado de entrega (minutos):
                </label>
                <input
                  type="number"
                  id="estimatedDeliveryTime"
                  name="estimatedDeliveryTime"
                  defaultValue={restaurantConfig.estimatedDeliveryTime}
                />
              </div>
              <button type="submit">Actualizar Configuración</button>
            </form>
          ) : (
            <p>Cargando configuración...</p>
          )}
        </div>
      )}

      {activeView === "menu" && (
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Menú</h2>
          <button
            onClick={fetchMenu}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            Refrescar Menú
          </button>
          {error && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
            >
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groupMenuItemsByCategory(menuItems)).map(
              ([category, items]) => (
                <div key={category} className="col-span-full">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4 capitalize">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => renderMenuItemCard(item))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
