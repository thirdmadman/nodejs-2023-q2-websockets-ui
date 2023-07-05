// eslint-disable-next-line import/no-extraneous-dependencies
import dotenv from 'dotenv';

dotenv.config();

export const BACKEND_PORT = process.env.BACKEND_PORT || '3000';
export const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
export const FRONTEND_PORT = process.env.FRONTEND_PORT || '8000';
export const FRONTEND_HOST = process.env.FRONTEND_HOST || 'localhost';
export const NODE_ENV = process.env.NODE_ENV || 'production';
export const API_PREFIX = process.env.API_PREFIX || '/';
