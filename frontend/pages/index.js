import { useEffect, useState } from "react";
import axios from "axios";
import OrderCard from "../components/OrderCard";
import CustomerCard from "../components/CustomerCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Home() {
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Otros estados existentes
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders(selectedDate);
      fetchCustomers();
      fetchMenu();
      fetchRestaurantConfig();
      fetchNotificationPhones();
      const interval = setInterval(() => {
        fetchOrders(selectedDate);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedStatus, isAuthenticated]);

  // Funciones de autenticación
  const handleLogin = (e) => {
    e.preventDefault();
    const envUsername = process.env.NEXT_PUBLIC_DEFAULT_USERNAME;
    const envPassword = process.env.NEXT_PUBLIC_DEFAULT_PASSWORD;

    if (username === envUsername && password === envPassword) {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Credenciales incorrectas. Por favor, inténtalo de nuevo.");
    }
  };

  // Renderizar formulario de login si no está autenticado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Iniciar Sesión
          </h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
                placeholder="Ingresa tu usuario"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="password" className="block text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
                placeholder="Ingresa tu contraseña"
              />
            </div>
            {loginError && (
              <div className="mb-4 text-red-500 text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-green-700 text-white py-2 rounded hover:bg-green-800 transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Funciones y lógica existentes después de la autenticación
  const fetchOrders = async (date) => {
    try {
      let url = "/api/orders";
      if (date) {
        const formattedDate = format(date, "yyyy-MM-dd"); // Formato de la fecha
        url += `?date=${formattedDate}`;
      }
      if (selectedStatus) {
        url += `${date ? "&" : "?"}status=${selectedStatus}`;
      }
      const response = await axios.get(url);
      setOrders(response.data);
    } catch (error) {
      console.error("Error al obtener órdenes:", error);
      setError(
        "No se pudieron obtener las órdenes. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get("/api/customers");
      setCustomers(response.data);
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
      await axios.post("/api/notification-phones", {
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

  const toggleItemAvailability = async (id, entityType) => {
    try {
      await axios.post("/api/menu", { id, entityType });
      fetchMenu();
    } catch (error) {
      console.error("Error al cambiar la disponibilidad:", error);
      setError(
        "No se pudo cambiar la disponibilidad. Por favor, inténtelo de nuevo."
      );
    }
  };

  const refreshAll = async () => {
    try {
      await Promise.all([
        fetchOrders(selectedDate),
        fetchCustomers(),
        fetchMenu(),
        fetchRestaurantConfig(),
        fetchNotificationPhones(),
      ]);
    } catch (error) {
      console.error("Error al refrescar datos:", error);
      setError(
        "No se pudieron refrescar los datos. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const handleUpdateStatus = (updatedOrder) => {
    fetchOrders(selectedDate);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-green-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl lg:text-2xl font-bold text-white">
                  La Leña
                </h1>{" "}
                {/* Aumentado solo en pantallas grandes */}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {[
                "orders",
                "customers",
                "notificationPhones",
                "restaurantConfig",
                "menu",
              ].map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`px-3 py-2 lg:px-4 lg:py-3 rounded-md text-sm lg:text-lg font-medium transition-colors duration-200 ${
                    // Aumentado solo en pantallas grandes
                    activeView === view
                      ? "bg-white text-blue-600"
                      : "text-white hover:bg-blue-500"
                  }`}
                >
                  {getViewTitle(view)}
                </button>
              ))}
              <button
                onClick={refreshAll}
                className="ml-4 px-3 py-2 lg:px-4 lg:py-3 rounded-md text-sm lg:text-lg font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors duration-200" // Aumentado solo en pantallas grandes
              >
                Refrescar Todo
              </button>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center justify-center p-2 lg:p-3 rounded-md text-white hover:text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" // Aumentado solo en pantallas grandes
              >
                <span className="sr-only">Abrir menú principal</span>
                {menuOpen ? (
                  <svg
                    className="block h-6 w-6 lg:h-8 lg:w-8" // Aumentado solo en pantallas grandes
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6 lg:h-8 lg:w-8" // Aumentado solo en pantallas grandes
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className={`${menuOpen ? "block" : "hidden"} sm:hidden`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {[
              "orders",
              "customers",
              "notificationPhones",
              "restaurantConfig",
              "menu",
            ].map((view) => (
              <button
                key={view}
                onClick={() => {
                  setActiveView(view);
                  setMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                  activeView === view
                    ? "bg-white text-blue-600"
                    : "text-white hover:bg-blue-500"
                }`}
              >
                {getViewTitle(view)}
              </button>
            ))}
            <button
              onClick={() => {
                refreshAll();
                setMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Refrescar Todo
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl lg:text-3xl font-bold mb-6 lg:mb-8 text-gray-800">
              {" "}
              {/* Aumentado solo en pantallas grandes */}
              {getViewTitle(activeView)}
            </h2>

            {activeView === "orders" && (
              <div>
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Filtrar órdenes
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <DatePicker
                      selected={selectedDate}
                      onChange={handleDateChange}
                      dateFormat="dd/MM/yyyy"
                      locale={es}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      wrapperClassName="w-full sm:w-auto"
                    />
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300"
                    >
                      Hoy
                    </button>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Todos los estados</option>
                      <option value="created">Creado</option>
                      <option value="accepted">Aceptado</option>
                      <option value="in_preparation">En preparación</option>
                      <option value="prepared">Preparado</option>
                      <option value="in_delivery">En entrega</option>
                      <option value="finished">Finalizado</option>
                      <option value="canceled">Cancelado</option>
                    </select>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <p className="text-center text-gray-500">
                      No se encontraron órdenes para la fecha seleccionada.
                    </p>
                  ) : (
                    orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeView === "customers" && (
              <div>
                {error && <div className="alert alert-danger">{error}</div>}
                <div id="customer-list">
                  {customers.length === 0 ? (
                    <p className="text-center">No se encontraron clientes.</p>
                  ) : (
                    customers.map((customer) => (
                      <CustomerCard key={customer.customerId} customer={customer} />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeView === "notificationPhones" && (
              <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 max-w-2xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800 text-center">
                  Teléfonos de Notificación
                </h2>

                <form onSubmit={addNotificationPhone} className="mb-6 sm:mb-8">
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <input
                      type="text"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      placeholder="Nuevo número de teléfono"
                      required
                      className="w-full sm:flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-300"
                    >
                      Agregar
                    </button>
                  </div>
                </form>

                {notificationPhones.length > 0 ? (
                  <ul className="space-y-4">
                    {notificationPhones.map((phone) => (
                      <li
                        key={phone.id}
                        className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg"
                      >
                        <span className="text-lg font-medium text-gray-700 mb-2 sm:mb-0">
                          {phone.phoneNumber}
                        </span>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                          <button
                            onClick={() =>
                              togglePhoneStatus(phone.id, phone.isActive)
                            }
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition duration-300 w-full sm:w-auto ${
                              phone.isActive
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-yellow-500 text-white hover:bg-yellow-600"
                            }`}
                          >
                            {phone.isActive ? "Activo" : "Inactivo"}
                          </button>
                          <button
                            onClick={() => deleteNotificationPhone(phone.id)}
                            className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition duration-300 w-full sm:w-auto"
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500">
                    No hay teléfonos de notificación registrados.
                  </p>
                )}
              </div>
            )}

            {activeView === "restaurantConfig" && (
              <div className="bg-white shadow-lg rounded-lg p-6 max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
                  Configuración del Restaurante
                </h2>
                {restaurantConfig ? (
                  <form onSubmit={updateRestaurantConfig} className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label
                        htmlFor="acceptingOrders"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Aceptando Pedidos:
                      </label>
                      <select
                        id="acceptingOrders"
                        name="acceptingOrders"
                        defaultValue={restaurantConfig.acceptingOrders?.toString()}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label
                        htmlFor="estimatedPickupTime"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Tiempo estimado de recogida (minutos):
                      </label>
                      <input
                        type="number"
                        id="estimatedPickupTime"
                        name="estimatedPickupTime"
                        defaultValue={restaurantConfig.estimatedPickupTime}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label
                        htmlFor="estimatedDeliveryTime"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Tiempo estimado de entrega (minutos):
                      </label>
                      <input
                        type="number"
                        id="estimatedDeliveryTime"
                        name="estimatedDeliveryTime"
                        defaultValue={restaurantConfig.estimatedDeliveryTime}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Actualizar Configuración
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-center text-gray-500">
                    Cargando configuración...
                  </p>
                )}
              </div>
            )}

            {activeView === "menu" && (
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Menú</h2>
                {error && (
                  <div
                    className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
                <div id="menu-list">
                  {menuItems.map((category) => (
                    <div key={category.id} className="mb-8">
                      <h3 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">
                        {category.name}
                      </h3>
                      {category.subcategories.map((subcategory) => (
                        <div key={subcategory.id} className="mb-6">
                          <h4 className="text-lg font-medium mb-3 text-gray-600">
                            {subcategory.name}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subcategory.products.map((item) => (
                              <div
                                key={item.id}
                                className="bg-gray-50 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300"
                              >
                                <h5 className="text-lg font-medium mb-2 text-gray-800">
                                  {item.name}
                                </h5>
                                <p className="text-sm text-gray-600 mb-2">
                                  Precio:{" "}
                                  {item.price
                                    ? `$${item.price.toFixed(2)}`
                                    : "Varía según la variante"}
                                </p>
                                <p className="text-sm mb-3">
                                  Disponible:
                                  <span
                                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                      item.pAv.available
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {item.pAv.available ? "Sí" : "No"}
                                  </span>
                                </p>

                                {item.productVariants &&
                                  item.productVariants.length > 0 && (
                                    <div className="mt-3">
                                      <h6 className="font-medium text-sm mb-2 text-gray-700">
                                        Variantes:
                                      </h6>
                                      <ul className="space-y-2">
                                        {item.productVariants.map((variant) => (
                                          <li
                                            key={variant.id}
                                            className="flex justify-between items-center text-sm"
                                          >
                                            <span>{variant.name}</span>
                                            <button
                                              onClick={() =>
                                                toggleItemAvailability(
                                                  variant.pvAv.id,
                                                  "productVariant"
                                                )
                                              }
                                              className={`px-2 py-1 rounded text-xs font-medium ${
                                                variant.pvAv.available
                                                  ? "bg-red-100 text-red-800 hover:bg-red-200"
                                                  : "bg-green-100 text-green-800 hover:bg-green-200"
                                              }`}
                                            >
                                              {variant.pvAv.available
                                                ? "Deshabilitar"
                                                : "Habilitar"}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                {item.pizzaIngredients &&
                                  item.pizzaIngredients.length > 0 && (
                                    <div className="mt-3">
                                      <h6 className="font-medium text-sm mb-2 text-gray-700">
                                        Ingredientes de Pizza:
                                      </h6>
                                      <ul className="space-y-2">
                                        {item.pizzaIngredients.map(
                                          (ingredient) => (
                                            <li
                                              key={ingredient.id}
                                              className="flex justify-between items-center text-sm"
                                            >
                                              <span>{ingredient.name}</span>
                                              <button
                                                onClick={() =>
                                                  toggleItemAvailability(
                                                    ingredient.piAv.id,
                                                    "pizzaIngredient"
                                                  )
                                                }
                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                  ingredient.piAv.available
                                                    ? "bg-red-100 text-red-800 hover:bg-red-200"
                                                    : "bg-green-100 text-green-800 hover:bg-green-200"
                                                }`}
                                              >
                                                {ingredient.piAv.available
                                                  ? "Deshabilitar"
                                                  : "Habilitar"}
                                              </button>
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                {item.modifierTypes &&
                                  item.modifierTypes.length > 0 && (
                                    <div className="mt-3">
                                      <h6 className="font-medium text-sm mb-2 text-gray-700">
                                        Modificadores:
                                      </h6>
                                      {item.modifierTypes.map(
                                        (modifierType) => (
                                          <div
                                            key={modifierType.id}
                                            className="mb-2"
                                          >
                                            <h6 className="text-xs font-medium text-gray-600 mb-1">
                                              {modifierType.name}:
                                            </h6>
                                            <ul className="space-y-2">
                                              {modifierType.modifiers.map(
                                                (modifier) => (
                                                  <li
                                                    key={modifier.id}
                                                    className="flex justify-between items-center text-sm"
                                                  >
                                                    <span>{modifier.name}</span>
                                                    <button
                                                      onClick={() =>
                                                        toggleItemAvailability(
                                                          modifier.mAv.id,
                                                          "modifier"
                                                        )
                                                      }
                                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                                        modifier.mAv.available
                                                          ? "bg-red-100 text-red-800 hover:bg-red-200"
                                                          : "bg-green-100 text-green-800 hover:bg-green-200"
                                                      }`}
                                                    >
                                                      {modifier.mAv.available
                                                        ? "Deshabilitar"
                                                        : "Habilitar"}
                                                    </button>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}

                                <button
                                  onClick={() =>
                                    toggleItemAvailability(item.pAv.id, "product")
                                  }
                                  className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium ${
                                    item.pAv.available
                                      ? "bg-red-500 text-white hover:bg-red-600"
                                      : "bg-green-500 text-white hover:bg-green-600"
                                  } transition-colors duration-300`}
                                >
                                  {item.pAv.available
                                    ? "Deshabilitar"
                                    : "Habilitar"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Función auxiliar para obtener el título de cada vista
function getViewTitle(view) {
  const titles = {
    orders: "Órdenes",
    customers: "Clientes",
    notificationPhones: "Teléfonos de Notificación",
    restaurantConfig: "Configuración del Restaurante",
    menu: "Menú",
  };
  return titles[view] || "Vista Desconocida";
}
