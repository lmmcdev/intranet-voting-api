export class DataCleaner {
  private static readonly COSMOS_METADATA_FIELDS = [
    '_rid',
    '_self',
    '_etag',
    '_attachments',
    '_ts'
  ];

  /**
   * Removes Cosmos DB metadata fields from an object
   */
  static cleanCosmosMetadata<T extends Record<string, any>>(obj: T): Omit<T, '_rid' | '_self' | '_etag' | '_attachments' | '_ts'> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const cleaned = { ...obj };

    this.COSMOS_METADATA_FIELDS.forEach(field => {
      delete cleaned[field];
    });

    return cleaned;
  }

  /**
   * Recursively cleans Cosmos DB metadata from an object or array
   */
  static deepCleanCosmosMetadata(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.deepCleanCosmosMetadata(item));
    }

    if (data && typeof data === 'object') {
      const cleaned = this.cleanCosmosMetadata(data);

      // Recursively clean nested objects
      Object.keys(cleaned).forEach(key => {
        if (cleaned[key] && typeof cleaned[key] === 'object') {
          cleaned[key] = this.deepCleanCosmosMetadata(cleaned[key]);
        }
      });

      return cleaned;
    }

    return data;
  }

  /**
   * Cleans data specifically for API responses
   */
  static cleanForApiResponse(data: any): any {
    return this.deepCleanCosmosMetadata(data);
  }
}