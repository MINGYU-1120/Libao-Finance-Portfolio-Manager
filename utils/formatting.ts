
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
    // Special handling for small values (e.g. Crypto)
    if (Math.abs(value) > 0 && Math.abs(value) < 1.0) {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Formats share counts.
 * Supports up to 6 decimal places for US/Crypto, removes trailing zeros.
 */
export const formatShares = (value: number, isPrivacyMode: boolean = false): string => {
    if (isPrivacyMode) return '****';

    // Remove unnecessary trailing zeros but keep up to 6 decimals
    const formatted = parseFloat(value.toFixed(6));
    return formatted.toLocaleString(undefined, { maximumFractionDigits: 6 });
};
