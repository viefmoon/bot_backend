import { useState } from 'react';
import toast from 'react-hot-toast';
import customerService from '@/services/customer.service';

interface Address {
  id: number;
  street: string;
  number: string;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  references?: string | null;
  isDefault: boolean;
}

interface AddressManagerProps {
  addresses: Address[];
  customerId: string;
  otp: string;
  onAddressClick: (address: Address) => void;
  onAddNew: () => void;
  onAddressesChange: () => void;
}

export function AddressManager2({
  addresses,
  customerId: whatsappPhoneNumber,
  otp,
  onAddressClick,
  onAddNew,
  onAddressesChange,
}: AddressManagerProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, addressId: number) => {
    e.stopPropagation();
    
    if (!confirm('¿Estás seguro de que deseas eliminar esta dirección?')) {
      return;
    }

    setIsDeleting(addressId.toString());
    
    try {
      await customerService.deleteAddress(addressId, whatsappPhoneNumber, otp);
      toast.success('Dirección eliminada exitosamente');
      onAddressesChange();
    } catch (error: any) {
      console.error('Error deleting address:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar la dirección');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, addressId: number) => {
    e.stopPropagation();
    
    setIsSettingDefault(addressId.toString());
    
    try {
      await customerService.setDefaultAddress(addressId, whatsappPhoneNumber, otp);
      toast.success('Dirección principal actualizada');
      onAddressesChange();
    } catch (error: any) {
      console.error('Error setting default address:', error);
      toast.error(error.response?.data?.error || 'Error al establecer dirección principal');
    } finally {
      setIsSettingDefault(null);
    }
  };

  if (addresses.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-gray-600 mb-4">No tienes direcciones guardadas</p>
        <button
          onClick={onAddNew}
          className="bg-gradient-to-r from-orange-500 to-pink-600 text-white font-semibold px-6 py-3 rounded-lg hover:from-orange-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar mi primera dirección
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">📍 Mis direcciones</h3>
        <button
          onClick={onAddNew}
          className="bg-gradient-to-r from-orange-500 to-pink-600 text-white font-semibold px-4 py-2 rounded-lg hover:from-orange-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center text-sm transform hover:scale-105"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar nueva dirección
        </button>
      </div>

      <div className="space-y-3">
        {addresses.map((address) => (
          <div
            key={address.id}
            className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
            onClick={() => onAddressClick(address)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-800 truncate">
                    {address.street} {address.number}
                    {address.interiorNumber && ` Int. ${address.interiorNumber}`}
                  </h4>
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
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    Ref: {address.references}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {!address.isDefault && (
                  <button
                    onClick={(e) => handleSetDefault(e, address.id)}
                    disabled={isSettingDefault === address.id.toString()}
                    className="text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all p-3 rounded-lg border-2 border-transparent hover:border-green-200"
                    title="Establecer como principal"
                  >
                    {isSettingDefault === address.id.toString() ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium">Principal</span>
                      </div>
                    )}
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddressClick(address);
                  }}
                  className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all p-3 rounded-lg"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <button
                  onClick={(e) => handleDelete(e, address.id)}
                  disabled={isDeleting === address.id.toString()}
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all p-3 rounded-lg"
                  title="Eliminar"
                >
                  {isDeleting === address.id.toString() ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}