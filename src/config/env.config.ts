import dotenv from 'dotenv';

dotenv.config();

export const COSMOS_DB_ENDPOINT = process.env.COSMOS_DB_ENDPOINT || '';
export const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY || '';
export const COSMOS_DB_NAME = process.env.COSMOS_DB_NAME || 'nominations-db';

// Azure AD Configuration
export const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';
export const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
export const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';

// External employee directory (optional)
export const EMPLOYEE_DIRECTORY_CSV_PATH = process.env.EMPLOYEE_DIRECTORY_CSV_PATH || '';
