/**
 * Pagination request parameters using Cosmos DB Continuation Tokens
 * This is more efficient than OFFSET/LIMIT as it doesn't require
 * Cosmos DB to read and skip documents.
 */
export interface PaginationParams {
  /**
   * Number of items per page (default: 10, max: 100)
   */
  limit?: number;

  /**
   * Continuation token from previous page response
   * Used to fetch the next page of results
   */
  continuationToken?: string;

  /**
   * Field to sort by (default: 'createdAt')
   */
  sortBy?: string;

  /**
   * Sort order: 'asc' or 'desc' (default: 'desc')
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /**
   * Number of items in current page
   */
  itemCount: number;

  /**
   * Number of items per page requested
   */
  itemsPerPage: number;

  /**
   * Continuation token for next page
   * null if this is the last page
   */
  continuationToken: string | null;

  /**
   * Whether there are more pages
   */
  hasNextPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Default pagination values
 */
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const DEFAULT_SORT_BY = 'createdAt';
export const DEFAULT_SORT_ORDER = 'desc';

/**
 * Utility to parse and validate pagination parameters
 */
export function parsePaginationParams(params: PaginationParams): Required<PaginationParams> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || DEFAULT_LIMIT));
  const continuationToken = params.continuationToken || '';
  const sortBy = params.sortBy || DEFAULT_SORT_BY;
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : DEFAULT_SORT_ORDER;

  return { limit, continuationToken, sortBy, sortOrder };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  itemCount: number,
  itemsPerPage: number,
  continuationToken: string | undefined,
  hasMoreResults?: boolean
): PaginationMeta {
  // Use hasMoreResults if provided (from Cosmos DB), otherwise fallback to checking continuationToken
  const hasNextPage = hasMoreResults !== undefined ? hasMoreResults : !!continuationToken;

  return {
    itemCount,
    itemsPerPage,
    continuationToken: continuationToken || null,
    hasNextPage,
  };
}

/**
 * Query result from Cosmos DB with continuation token
 */
export interface CosmosQueryResult<T> {
  resources: T[];
  continuationToken?: string;
  hasMoreResults: boolean;
}
