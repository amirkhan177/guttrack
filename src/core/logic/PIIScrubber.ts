
/**
 * PIIScrubber utility to ensure sensitive user data is never sent to AI models.
 */
export class PIIScrubber {
  /**
   * Cleans a string by removing potential PII like email addresses, 
   * phone numbers, and common identifier patterns.
   */
  static scrubString(input: string): string {
    if (!input) return input;
    
    let scrubbed = input;
    
    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    scrubbed = scrubbed.replace(emailRegex, '[EMAIL]');
    
    // Phone number regex (basic)
    const phoneRegex = /(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
    scrubbed = scrubbed.replace(phoneRegex, '[PHONE]');
    
    // UUID / Identifier patterns
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
    scrubbed = scrubbed.replace(uuidRegex, '[ID]');

    return scrubbed;
  }

  /**
   * Sanitizes a metadata object to only include allowed health-related fields.
   */
  static scrubMetadata(meta: Record<string, unknown>): Record<string, unknown> {
    const allowedFields = ['age', 'ethnicity', 'height_cm', 'weight_unit', 'gender'];
    const sanitized: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (meta[field] !== undefined) {
        sanitized[field] = meta[field];
      }
    }
    
    return sanitized;
  }
}
