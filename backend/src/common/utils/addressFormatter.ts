/**
 * Utility functions for formatting addresses consistently across the application
 */

export function formatAddressFull(address: any): string {
  const parts = [];
  
  if (address.name) {
    parts.push(`*${address.name}*`);
  }
  
  if (address.street && address.number) {
    let streetLine = `${address.street} ${address.number}`;
    if (address.interiorNumber) {
      streetLine += ` Int. ${address.interiorNumber}`;
    }
    parts.push(streetLine);
  }
  
  if (address.neighborhood) parts.push(address.neighborhood);
  
  if (address.city && address.state) {
    parts.push(`${address.city}, ${address.state}`);
  }
  
  if (address.deliveryInstructions) {
    parts.push(`Referencias: ${address.deliveryInstructions}`);
  }
  
  return parts.join('\n');
}

export function formatAddressShort(address: any): string {
  const parts = [];
  if (address.name) parts.push(`*${address.name}*`);
  parts.push(`${address.street} ${address.number}${address.interiorNumber ? ` Int. ${address.interiorNumber}` : ''}`);
  if (address.neighborhood) parts.push(address.neighborhood);
  parts.push(`${address.city}, ${address.state}`);
  return parts.join('\n');
}

export function formatAddressDescription(address: any): string {
  const parts = [];
  if (address.street && address.number) {
    parts.push(`${address.street} ${address.number}`);
  }
  if (address.neighborhood) parts.push(address.neighborhood);
  if (address.city) parts.push(address.city);
  if (address.isDefault) parts.push('(Principal)');
  return parts.join(', ');
}