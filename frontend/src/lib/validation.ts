/**
 * Centralized Form and Input Validation Utility
 */

/**
 * Validates a numeric XLM or milestone amount.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateAmount(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) {
        return "Amount is required.";
    }

    // Reject invalid characters like letters, symbols, e, E, signs (+ or -)
    if (/[eE+\-]/.test(trimmed)) {
        return "Only positive numeric values are allowed.";
    }

    // Verify format: digits followed by at most one optional dot and digits
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        return "Please enter a valid numeric amount.";
    }

    const num = parseFloat(trimmed);
    if (isNaN(num)) {
        return "Please enter a valid numeric amount.";
    }

    if (num <= 0) {
        return "Amount must be greater than zero.";
    }

    return null;
}

/**
 * Validates text inputs enforcing basic length and whitespace constraints.
 */
export function validateRequiredText(
    val: string,
    fieldName: string,
    minLen: number = 1,
    maxLen: number = 5000
): string | null {
    const trimmed = val.trim();
    if (!trimmed) {
        return `${fieldName} is required.`;
    }
    if (trimmed.length < minLen) {
        return `${fieldName} must be at least ${minLen} characters long.`;
    }
    if (trimmed.length > maxLen) {
        return `${fieldName} cannot exceed ${maxLen} characters.`;
    }
    return null;
}

/**
 * Validates project title.
 */
export function validateProjectTitle(val: string): string | null {
    return validateRequiredText(val, "Project title", 3, 100);
}

/**
 * Validates project description.
 */
export function validateDescription(val: string): string | null {
    return validateRequiredText(val, "Project description", 10, 1000);
}
