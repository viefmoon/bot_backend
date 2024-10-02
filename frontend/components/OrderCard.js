import React from "react";
import { useState } from "react";

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
        <div className="col-md-6 col-lg-4 mb-3">
            <div className="card order-card">
                <div className="card-body">
                    <h5 className="card-title">Pedido #{order.dailyOrderNumber}</h5>
                    <p className="card-text">Fecha de Pedido: {formatDateToMexicoTime(order.orderDate, true)}</p>
                    <p className="card-text">Tipo: {translateOrderType(order.orderType)}</p>
                    <p className="card-text">ID del Cliente: {order.clientId}</p>
                    <p className="card-text"><strong>Info de Entrega:</strong> {order.deliveryInfo || 'N/A'}</p>
                    <p className="card-text">Tiempo Estimado: {order.estimatedTime} minutos</p>
                    <p className="card-text"><strong>Total:</strong> ${order.totalCost.toFixed(2)}</p>
                    <p className="card-text">Estado: <span className={`badge bg-${getStatusColor(order.status)}`}>{translateStatus(order.status)}</span></p>
                    <p className="card-text">Pago: <span className={`badge bg-${getPaymentStatusColor(order.paymentStatus)}`}>{translatePaymentStatus(order.paymentStatus)}</span></p>
                    <p className="card-text"><small className="text-muted">Creado: {formatDateToMexicoTime(order.createdAt)}</small></p>
                    <p className="card-text"><small className="text-muted">Actualizado: {formatDateToMexicoTime(order.updatedAt)}</small></p>

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

                    <div className="btn-group mt-3">
                        <button 
                            className="btn btn-success" 
                            onClick={() => handleUpdateStatus('accepted')}
                            disabled={order.status === 'accepted' || isLoading}
                        >
                            Aceptar
                        </button>
                        <button 
                            className="btn btn-danger" 
                            onClick={() => handleUpdateStatus('canceled')}
                            disabled={order.status === 'canceled' || isLoading}
                        >
                            Rechazar
                        </button>
                    </div>
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