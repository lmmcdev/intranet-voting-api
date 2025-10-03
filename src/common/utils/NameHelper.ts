/**
 * Helper class for name normalization and formatting
 */
export class NameHelper {
  /**
   * Capitalizes the first letter of a string and lowercases the rest
   * @param name - The name to capitalize
   * @returns The capitalized name
   * @example
   * capitalize('JOHN') => 'John'
   * capitalize('john') => 'John'
   * capitalize('jOhN') => 'John'
   */
  static capitalize(name: string | undefined): string | undefined {
    if (!name) {
      return name;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  /**
   * Capitalizes the first letter of each word in a string
   * Useful for compound names like "MARIA DE LOS ANGELES" => "Maria De Los Angeles"
   * @param name - The name to capitalize
   * @returns The capitalized name
   * @example
   * capitalizeWords('MARIA DE LOS ANGELES') => 'Maria De Los Angeles'
   * capitalizeWords('van der berg') => 'Van Der Berg'
   */
  static capitalizeWords(name: string | undefined): string | undefined {
    if (!name) {
      return name;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }

    return trimmed
      .split(/\s+/)
      .map(word => this.capitalize(word))
      .join(' ');
  }

  /**
   * Normalizes a person's full name by capitalizing each word
   * @param firstName - First name
   * @param middleName - Middle name (optional)
   * @param lastName - Last name
   * @returns Normalized full name
   */
  static normalizeFullName(
    firstName?: string,
    middleName?: string,
    lastName?: string
  ): string {
    const parts: string[] = [];

    if (firstName) {
      parts.push(this.capitalizeWords(firstName) || '');
    }

    if (middleName) {
      parts.push(this.capitalizeWords(middleName) || '');
    }

    if (lastName) {
      parts.push(this.capitalizeWords(lastName) || '');
    }

    return parts.filter(part => part.length > 0).join(' ');
  }

  /**
   * Normalizes name fields in an object
   * @param obj - Object containing firstName, middleName, lastName, and/or fullName
   * @returns Object with normalized name fields
   */
  static normalizeNameFields<T extends {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
  }>(obj: T): T {
    const normalized = { ...obj };

    if (normalized.firstName) {
      normalized.firstName = this.capitalizeWords(normalized.firstName);
    }

    if (normalized.middleName) {
      normalized.middleName = this.capitalizeWords(normalized.middleName);
    }

    if (normalized.lastName) {
      normalized.lastName = this.capitalizeWords(normalized.lastName);
    }

    // Regenerate fullName if name parts exist
    if (normalized.firstName || normalized.middleName || normalized.lastName) {
      normalized.fullName = this.normalizeFullName(
        normalized.firstName,
        normalized.middleName,
        normalized.lastName
      );
    } else if (normalized.fullName) {
      // If only fullName exists, normalize it
      normalized.fullName = this.capitalizeWords(normalized.fullName);
    }

    return normalized;
  }
}
