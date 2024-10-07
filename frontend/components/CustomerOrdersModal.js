import React, { useState, useEffect } from "react";
import {
  translateOrderType,
  translateStatus,
  getStatusColor,
} from "../utils/orderUtils";
import { formatDateToMexicoTime } from "../utils/dateUtils";
import axios from "axios";

const CustomerOrdersModal = ({ clientId, onClose }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientOrders = async () => {
      try {
        const response = await axios.get(
          `/api/customer_orders?clientId=${clientId}`
        );
        setOrders(response.data);
      } catch (error) {
        console.error("Error al obtener los pedidos del cliente:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientOrders();
  }, [clientId]);

  const renderPizzaIngredients = (ingredients) => {
    const ingredientsByHalf = { left: [], right: [], full: [] };
    ingredients.forEach((ing) => {
      const action = ing.action === "remove" ? "sin" : "";
      ingredientsByHalf[ing.half].push(`${action} ${ing.PizzaIngredient.name}`);
    });

    ingredientsByHalf.left = [
      ...ingredientsByHalf.left,
      ...ingredientsByHalf.full,
    ];
    ingredientsByHalf.right = [
      ...ingredientsByHalf.right,
      ...ingredientsByHalf.full,
    ];

    if (
      ingredientsByHalf.left.length === 0 &&
      ingredientsByHalf.right.length === 0
    ) {
      return null;
    }

    if (
      ingredientsByHalf.left.length === ingredientsByHalf.right.length &&
      ingredientsByHalf.left.every(
        (ing, i) => ing === ingredientsByHalf.right[i]
      )
    ) {
      return `(${ingredientsByHalf.left.join(", ")})`;
    }

    return `(${ingredientsByHalf.left.join(
      ", "
    )} / ${ingredientsByHalf.right.join(", ")})`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Pedidos del Cliente</h2>
        {isLoading ? (
          <p>Cargando pedidos...</p>
        ) : orders.length === 0 ? (
          <p>Este cliente no tiene pedidos.</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white shadow-md rounded-lg overflow-hidden mb-4 border border-gray-200"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <h5 className="text-lg font-bold text-gray-800 mr-4">
                      Pedido #{order.dailyOrderNumber}
                    </h5>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold text-white mr-2 ${
                        order.orderType === "delivery"
                          ? "bg-blue-400"
                          : "bg-purple-400"
                      }`}
                    >
                      {translateOrderType(order.orderType)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDateToMexicoTime(order.createdAt, true)}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {translateStatus(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div>
                    <p className="text-gray-600">Total:</p>
                    <p className="font-bold text-green-600">
                      ${order.totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Entrega a:</p>
                    <p className="font-medium">
                      {order.orderType === "delivery" && order.orderDeliveryInfo
                        ? `${order.orderDeliveryInfo.streetAddress}${
                            order.orderDeliveryInfo.additionalDetails
                              ? `, ${order.orderDeliveryInfo.additionalDetails}`
                              : ""
                          }`
                        : order.orderDeliveryInfo?.pickupName || "N/A"}
                    </p>
                  </div>
                </div>

                {order.orderItems && order.orderItems.length > 0 && (
                  <div className="mt-3">
                    <h6 className="text-sm font-semibold mb-2">
                      Elementos de la orden:
                    </h6>
                    <ul className="space-y-2">
                      {order.orderItems.map((item, index) => (
                        <li key={index} className="text-sm border-b pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {item.ProductVariant.name || item.Product.name}{" "}
                                (x{item.quantity})
                                {item.selectedPizzaIngredients &&
                                  item.selectedPizzaIngredients.length > 0 &&
                                  ` ${renderPizzaIngredients(
                                    item.selectedPizzaIngredients
                                  )}`}
                              </p>
                              <p className="text-gray-600">
                                Precio base: $
                                {(
                                  item.ProductVariant.price ||
                                  item.Product.price ||
                                  0
                                ).toFixed(2)}
                              </p>
                            </div>
                            <p className="font-bold">
                              Total: ${item.price.toFixed(2)}
                            </p>
                          </div>
                          {item.selectedModifiers &&
                            item.selectedModifiers.length > 0 && (
                              <div className="mt-1 text-gray-600">
                                <p className="font-medium">Modificadores:</p>
                                <ul className="list-disc list-inside pl-2">
                                  {item.selectedModifiers.map(
                                    (mod, modIndex) => (
                                      <li key={modIndex}>
                                        {mod.Modifier.name} (+$
                                        {mod.Modifier.price.toFixed(2)})
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          {item.comments && (
                            <p className="mt-1 text-gray-600">
                              <span className="font-medium">Comentarios:</span>{" "}
                              {item.comments}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default CustomerOrdersModal;
