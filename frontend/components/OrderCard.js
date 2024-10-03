import React, { useState } from "react";

const OrderCard = ({ order, onUpdateStatus }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleUpdateStatus = async (newStatus) => {
        setIsLoading(true);
        try {
            await onUpdateStatus(order.id, newStatus);
        } catch (error) {
            console.error('Error al actualizar el estado del pedido:', error);
            alert('No se pudo actualizar el estado del pedido. Por favor, inténtelo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4">
            <div className="p-4">
                <h5 className="text-xl font-semibold mb-2">Pedido #{order.dailyOrderNumber}</h5>
                <p className="text-gray-600 mb-1">Fecha de Pedido: {formatDateToMexicoTime(order.orderDate, true)}</p>
                <p className="text-gray-600 mb-1">Tipo: {translateOrderType(order.orderType)}</p>
                <p className="text-gray-600 mb-1">ID del Cliente: {order.clientId}</p>
                <p className="text-gray-600 mb-1"><strong>Info de Entrega:</strong> {order.deliveryInfo || 'N/A'}</p>
                <p className="text-gray-600 mb-1">Tiempo Estimado: {order.estimatedTime} minutos</p>
                <p className="text-gray-600 mb-1"><strong>Total:</strong> ${order.totalCost.toFixed(2)}</p>
                <p className="text-gray-600 mb-1">
                    Estado: 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getStatusColor(order.status)}`}>
                        {translateStatus(order.status)}
                    </span>
                </p>
                <p className="text-gray-600 mb-1">
                    Pago: 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {translatePaymentStatus(order.paymentStatus)}
                    </span>
                </p>
                
                {order.orderItems && order.orderItems.length > 0 && (
                    <div className="mt-3">
                        <h6>Elementos del pedido:</h6>
                        <ul className="list-group">
                            {order.orderItems.map((item, index) => (
                                <li key={index} className="list-group-item p-2">
                                    <strong>{item.Product.name} - {item.ProductVariant.name}</strong><br />
                                    Cantidad: {item.quantity}, Precio: ${item.price.toFixed(2)}
                                    {item.selectedPizzaIngredients && item.selectedPizzaIngredients.length > 0 && (
                                        <div>
                                            <strong>Ingredientes de pizza:</strong>
                                            {renderPizzaIngredients(item.selectedPizzaIngredients)}
                                        </div>
                                    )}
                                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                                        <div>
                                            <strong>Modificadores:</strong> {renderModifiers(item.selectedModifiers)}
                                        </div>
                                    )}
                                    {item.comments && (
                                        <div><strong>Comentarios:</strong> {item.comments}</div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-4 flex space-x-2">
                    <button 
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        onClick={() => handleUpdateStatus('accepted')}
                        disabled={order.status === 'accepted' || isLoading}
                    >
                        Aceptar
                    </button>
                    <button 
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        onClick={() => handleUpdateStatus('canceled')}
                        disabled={order.status === 'canceled' || isLoading}
                    >
                        Rechazar
                    </button>
                </div>
            </div>
        </div>
    );
};

const renderPizzaIngredients = (ingredients) => {
    const ingredientsByHalf = { left: [], right: [], full: [] };
    ingredients.forEach(ing => {
        ingredientsByHalf[ing.half].push(`${ing.PizzaIngredient.name} (${translateAction(ing.action)})`);
    });

    return Object.entries(ingredientsByHalf).map(([half, ings]) => 
        ings.length > 0 && (
            <div key={half}>
                <em>{translateHalf(half)}:</em> {ings.join(', ')}
            </div>
        )
    );
};

const renderModifiers = (modifiers) => {
    return modifiers.map(mod => `${mod.Modifier.name} (+$${mod.Modifier.price.toFixed(2)})`).join(', ');
};

const translateOrderType = (type) => {
    const translations = {
        'delivery': 'A domicilio',
        'pickup': 'Recolección',
    };
    return translations[type] || type;
};

const translateStatus = (status) => {
    const translations = {
        'created': 'Creado',
        'accepted': 'Aceptado',
        'in_preparation': 'En preparación',
        'prepared': 'Preparado',
        'in_delivery': 'En entrega',
        'finished': 'Finalizado',
        'canceled': 'Cancelado'
    };
    return translations[status] || status;
};

const translatePaymentStatus = (status) => {
    const translations = {
        'pending': 'Pendiente',
        'paid': 'Pagado',
        'failed': 'Fallido'
    };
    return translations[status] || status;
};

const translateHalf = (half) => {
    const translations = {
        'left': 'Izquierda',
        'right': 'Derecha',
        'full': 'Completa'
    };
    return translations[half] || half;
};

const translateAction = (action) => {
    const translations = {
        'add': 'Agregar',
        'remove': 'Quitar'
    };
    return translations[action] || action;
};

const getStatusColor = (status) => {
    const colors = {
        'created': 'primary',
        'accepted': 'success',
        'in_preparation': 'info',
        'prepared': 'secondary',
        'in_delivery': 'warning',
        'finished': 'success',
        'canceled': 'danger'
    };
    return colors[status] || 'light';
};

const getPaymentStatusColor = (status) => {
    const colors = {
        'pending': 'warning',
        'paid': 'success',
        'failed': 'danger'
    };
    return colors[status] || 'light';
};

const formatDateToMexicoTime = (dateString, dateOnly = false) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    const options = { 
        timeZone: 'America/Mexico_City',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    };
    if (!dateOnly) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
    }
    return date.toLocaleString('es-MX', options);
};

export default OrderCard;