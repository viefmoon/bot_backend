import { Request, Response, NextFunction } from 'express';
import { OTPService } from '../../services/security/OTPService';
import { prisma } from '../../server';
import { ValidationError, NotFoundError, ErrorCode } from '../services/errors';
import { asyncHandler } from './errorHandler';

/**
 * Extended Request interface with authenticated customer
 */
export interface AuthenticatedRequest extends Request {
  customer: {
    id: string;
    whatsappPhoneNumber: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

/**
 * Middleware for OTP authentication
 * Verifies OTP and attaches customer information to the request
 * 
 * Looks for whatsappPhoneNumber and otp in:
 * 1. Request body (for POST/PUT/DELETE)
 * 2. Query parameters (for GET)
 */
export const otpAuthMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Extract whatsappPhoneNumber and otp from body or query
  let whatsappPhoneNumber: string | undefined;
  let otp: string | undefined;

  if (req.method === 'GET') {
    // For GET requests, check query parameters
    whatsappPhoneNumber = req.query.whatsappPhoneNumber as string;
    otp = req.query.otp as string;
  } else {
    // For other methods, check body
    whatsappPhoneNumber = req.body.whatsappPhoneNumber;
    otp = req.body.otp;
  }

  // Special case: if route has :customerId param that's actually a phone number
  if (!whatsappPhoneNumber && req.params.customerId && req.params.customerId.startsWith('+')) {
    whatsappPhoneNumber = req.params.customerId;
  }

  // Validate required fields
  if (!whatsappPhoneNumber || !otp) {
    throw new ValidationError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'whatsappPhoneNumber and otp are required'
    );
  }

  // Verify OTP
  const isValid = await OTPService.verifyOTP(whatsappPhoneNumber, otp);
  if (!isValid) {
    throw new ValidationError(
      ErrorCode.INVALID_OTP,
      'Invalid or expired OTP'
    );
  }

  // Get customer record
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber },
    select: {
      id: true,
      whatsappPhoneNumber: true,
      firstName: true,
      lastName: true
    }
  });

  if (!customer) {
    throw new NotFoundError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { whatsappPhoneNumber }
    );
  }

  // Attach customer to request
  (req as AuthenticatedRequest).customer = customer;
  
  next();
});