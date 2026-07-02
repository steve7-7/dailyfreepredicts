/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export interface UserAuthResponse {
  isSubscribed: boolean;
  userId?: string;
  email?: string;
}

export interface SubscriptionVerifyResponse {
  token: string;
  isSubscribed: boolean;
  userId?: string;
  email?: string;
  expiresAt?: string;
}

/**
 * Error codes for API responses
 */
export enum ApiErrorCode {
  API_KEY_MISSING = "API_KEY_MISSING",
  API_AUTH_FAILED = "API_AUTH_FAILED",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR",
  FETCH_FAILED = "FETCH_FAILED",
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
}

/**
 * Standardized API error response
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: string;
  retryable: boolean;
  retryAfter?: number; // seconds, used for rate limiting
}
