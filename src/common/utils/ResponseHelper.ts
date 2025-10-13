import { HttpResponseInit } from '@azure/functions';
import { DataCleaner } from './DataCleaner';

export class ResponseHelper {
  static ok(data: any): HttpResponseInit {
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: DataCleaner.cleanForApiResponse(data)
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  static created(data: any): HttpResponseInit {
    return {
      status: 201,
      jsonBody: {
        success: true,
        data: DataCleaner.cleanForApiResponse(data)
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  static badRequest(message: string = 'Bad request'): HttpResponseInit {
    return {
      status: 400,
      jsonBody: {
        success: false,
        error: message
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  static notFound(message: string = 'Resource not found'): HttpResponseInit {
    return {
      status: 404,
      jsonBody: {
        success: false,
        error: message
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  static methodNotAllowed(): HttpResponseInit {
    return {
      status: 405,
      jsonBody: {
        success: false,
        error: 'Method not allowed'
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  static unauthorized(message: string = 'Unauthorized'): HttpResponseInit {
    return {
      status: 401,
      jsonBody: {
        success: false,
        error: message
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  static forbidden(message: string = 'Forbidden'): HttpResponseInit {
    return {
      status: 403,
      jsonBody: {
        success: false,
        error: message
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  static internalServerError(message: string = 'Internal server error'): HttpResponseInit {
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: message
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  /**
   * Special response for paginated data
   * Returns: { success: true, data: [...], meta: {...} }
   */
  static paginated(paginatedResult: { data: any[]; meta: any }): HttpResponseInit {
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: DataCleaner.cleanForApiResponse(paginatedResult.data),
        meta: paginatedResult.meta
      },
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }
}