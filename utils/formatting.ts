
/**
 * Formats a value as TWD (Taiwan Dollar).
 * Rounds to the nearest integer as per user request.
 * Handles privacy masking.
 */
export const formatTWD = (value: number, isPrivacyMode: boolean = false): string => {
    if (isPrivacyMode) return '****';
    // Use Math.round to ensure integer display
    return Math.round(value).toLocaleString();
};

/**
 * General currency formatter.
 * TWD -> Integer
 * USD -> 2 decimals
 */
export const formatCurrency = (value: number, currency: string, isPrivacyMode: boolean = false): string => {
    if (isPrivacyMode) return '****';

    if (currency === 'TWD' || currency === 'NTD') {
        return Math.round(value).toLocaleString();
    }

    // Default for USD or others: keep decimals
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
