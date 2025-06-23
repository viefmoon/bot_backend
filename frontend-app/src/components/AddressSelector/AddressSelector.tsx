import type { Address } from '@/types/customer.types';

interface AddressSelectorProps {
  addresses: Address[];
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string) => void;
  onAddNewAddress?: () => void;
}

export function AddressSelector({
  addresses,
  selectedAddressId,
  onAddressSelect,
  onAddNewAddress,
}: AddressSelectorProps) {
  if (addresses.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">No tienes direcciones guardadas</p>
        {onAddNewAddress && (
          <button
            onClick={onAddNewAddress}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Agregar dirección
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Selecciona una dirección de entrega</h3>
      
      {addresses.map((address) => (
        <label
          key={address.id}
          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
            selectedAddressId === address.id.toString()
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-start">
            <input
              type="radio"
              name="address"
              value={address.id}
              checked={selectedAddressId === address.id.toString()}
              onChange={() => onAddressSelect(address.id.toString())}
              className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-800">
                  {address.street} {address.number}
                  {address.interiorNumber && ` Int. ${address.interiorNumber}`}
                </p>
                {address.isDefault && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    Principal
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {address.neighborhood && `${address.neighborhood}, `}
                {address.city}, {address.state}
              </p>
              {address.references && (
                <p className="text-xs text-gray-500 mt-1">
                  Ref: {address.references}
                </p>
              )}
            </div>
          </div>
        </label>
      ))}
      
      {onAddNewAddress && (
        <button
          onClick={onAddNewAddress}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar nueva dirección
        </button>
      )}
    </div>
  );
}