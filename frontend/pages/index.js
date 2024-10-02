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
    fetchOrders(selectedDate); // Llamar con la fecha seleccionada o la actual
    fetchClients();
    fetchMenu();
    const interval = setInterval(() => {
      fetchOrders(selectedDate); // Asegurarse de usar siempre la fecha seleccionada
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]); // Actualiza el intervalo si la fecha seleccionada cambia

  useEffect(() => {
    fetchNotificationPhones();
    fetchRestaurantConfig();
  }, []);

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

  const createCompactIngredients = (ingredients) => {
    if (!ingredients || ingredients.length === 0) return "";
    const ingredientsByHalf = { left: [], right: [], full: [] };
    ingredients.forEach((ing) => {
      ingredientsByHalf[ing.half].push(
        `${ing.action === "add" ? "Con" : "Sin"} ${ing.PizzaIngredient.name}`
      );
    });
    let result = "<small><strong>Ingredientes:</strong> ";
    for (const [half, ings] of Object.entries(ingredientsByHalf)) {
      if (ings.length > 0) {
        result += `${translateHalf(half)}: ${ings.join(", ")}; `;
      }
    }
    return result.slice(0, -2) + "</small>";
  };

  const createCompactModifiers = (modifiers) => {
    if (!modifiers || modifiers.length === 0) return "";
    return (
      "<small><strong>Modificadores:</strong> " +
      modifiers
        .map(
          (mod) => `${mod.Modifier.name} (+$${mod.Modifier.price.toFixed(2)})`
        )
        .join(", ") +
      "</small>"
    );
  };

  const translateHalf = (half) => {
    switch (half) {
      case "left":
        return "Izquierda";
      case "right":
        return "Derecha";
      case "full":
        return "Completa";
      default:
        return half;
    }
  };

  return (
    <div>
      <div className="view-selector">
        <button
          onClick={() => setActiveView("orders")}
          className={activeView === "orders" ? "active" : ""}
        >
          Ver Pedidos
        </button>
        <button
          onClick={() => setActiveView("clients")}
          className={activeView === "clients" ? "active" : ""}
        >
          Ver Clientes
        </button>
        <button
          onClick={() => setActiveView("notificationPhones")}
          className={activeView === "notificationPhones" ? "active" : ""}
        >
          Ver Teléfonos de Notificación
        </button>
        <button
          onClick={() => setActiveView("restaurantConfig")}
          className={activeView === "restaurantConfig" ? "active" : ""}
        >
          Configuración del Restaurante
        </button>
        <button
          onClick={() => setActiveView("menu")}
          className={activeView === "menu" ? "active" : ""}
        >
          Ver Menú
        </button>
      </div>

      {activeView === "orders" && (
        <div>
          <button
            id="refreshOrdersButton"
            onClick={() => fetchOrders(selectedDate)}
            className="refresh-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="refresh-icon"
            >
              <path d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
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
            id="refreshClientsButton"
            onClick={fetchClients}
            className="refresh-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="refresh-icon"
            >
              <path d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
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
        <div>
          <h2>Menú</h2>
          <button onClick={fetchMenu} className="refresh-button">
            Refrescar Menú
          </button>
          {error && <div className="alert alert-danger">{error}</div>}
          <div id="menu-list">
            {Object.entries(groupMenuItemsByCategory(menuItems)).map(
              ([category, items]) => (
                <div key={category} className="col-12 mb-4">
                  <h3>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </h3>
                  <div className="row">
                    {items.map((item) => (
                      <div key={item.id} className="col-md-4 mb-3">
                        <div className="card h-100">
                          <div className="card-body">
                            <h5 className="card-title">{item.name}</h5>
                            <p className="card-text">
                              Categoría: {item.category}
                            </p>
                            <p className="card-text">
                              Precio:{" "}
                              {item.price
                                ? `$${item.price.toFixed(2)}`
                                : "Varía según la variante"}
                            </p>
                            <p className="card-text">
                              Disponible:{" "}
                              <span
                                className={`badge bg-${
                                  item.Availability.available
                                    ? "success"
                                    : "danger"
                                }`}
                              >
                                {item.Availability.available ? "Sí" : "No"}
                              </span>
                            </p>
                            {/* Aquí puedes agregar más detalles del menú si lo deseas */}
                            <button
                              onClick={() =>
                                toggleItemAvailability(item.id, "product")
                              }
                              className={`btn btn-${
                                item.Availability.available
                                  ? "danger"
                                  : "success"
                              } btn-sm`}
                            >
                              {item.Availability.available
                                ? "Deshabilitar"
                                : "Habilitar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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
