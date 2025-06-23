export interface ApiResponse<T> {
  data: T;
  success?: boolean;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: unknown;
}