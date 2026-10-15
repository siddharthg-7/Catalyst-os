/**
 * Central Backend Configuration
 */

import 'dotenv/config';

export * from './database';
export * from './configValidator';

export const PORT = Number(process.env.PORT) || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
export const JWT_SECRET = process.env.JWT_SECRET || 'catalyst_jwt_fallback_secret_development';
