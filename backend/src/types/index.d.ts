declare module '../../database/entities' {
  export * from '@prisma/client';
}

declare module '../../whatsapp/utils/whatsapp.utils' {
  export * from '../services/whatsapp';
}

declare module '../utils/whatsapp.utils' {
  export * from '../services/whatsapp';
}

declare module '../../common/services/otp.service' {
  export * from '../services/otp';
}