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

// Employee sync configuration
export const SYNC_EXCLUDE_DOMAINS = process.env.SYNC_EXCLUDE_DOMAINS || 'burgosdental.com,testuser';
export const SYNC_EXCLUDE_PATTERNS = process.env.SYNC_EXCLUDE_PATTERNS || '';
export const SYNC_DEFAULT_EXCLUDE_FROM_SYNC = process.env.SYNC_DEFAULT_EXCLUDE_FROM_SYNC === 'true';

// Search configuration
export const SEARCH_CASE_SENSITIVE = process.env.SEARCH_CASE_SENSITIVE === 'true';
export const SEARCH_DEFAULT_LIMIT = parseInt(process.env.SEARCH_DEFAULT_LIMIT || '50');
export const SEARCH_MIN_QUERY_LENGTH = parseInt(process.env.SEARCH_MIN_QUERY_LENGTH || '2');

// Voting group configuration
export const VOTING_GROUP_STRATEGY = process.env.VOTING_GROUP_STRATEGY || 'location';
export const VOTING_GROUP_CUSTOM_MAPPINGS = process.env.VOTING_GROUP_CUSTOM_MAPPINGS || '';

// JWT Authentication configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
export const DEFAULT_INITIAL_PASSWORD = process.env.DEFAULT_INITIAL_PASSWORD || 'Welcome123!';
