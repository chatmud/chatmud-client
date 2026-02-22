// Configuration limits
export const LIMITS = {
  PERSISTENCE_TIMEOUT: {
    MIN: 0,        // 0 = disconnect immediately
    MAX: 43200000, // 12 hours in milliseconds
    DEFAULT: 600000 // 10 minutes
  },
  BUFFER_LINES: {
    MIN: 10,
    MAX: 10000,
    DEFAULT: 1000
  }
};

/**
 * Validate and clamp a numeric config value to its limits
 */
export function validateConfig(
  value: number,
  limits: { MIN: number; MAX: number; DEFAULT: number },
  name: string
): number {
  if (isNaN(value)) {
    console.warn(`[Config] Invalid ${name}, using default: ${limits.DEFAULT}`);
    return limits.DEFAULT;
  }

  if (value < limits.MIN) {
    console.warn(
      `[Config] ${name} (${value}) below minimum (${limits.MIN}), clamping to minimum`
    );
    return limits.MIN;
  }

  if (value > limits.MAX) {
    console.warn(
      `[Config] ${name} (${value}) above maximum (${limits.MAX}), clamping to maximum`
    );
    return limits.MAX;
  }

  return value;
}
