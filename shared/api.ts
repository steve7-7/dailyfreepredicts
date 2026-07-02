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
