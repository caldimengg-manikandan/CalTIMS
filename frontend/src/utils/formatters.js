/**
 * Formats a number as currency in Indian Rupees (INR) with 2 decimal places.
 * @param {number|string} val - The value to format.
 * @returns {string} - The formatted currency string.
 */
export const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

export const getCurrencySymbol = (currencyCode = 'INR') => {
    const symbols = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
        AED: 'د.إ'
    };
    return symbols[currencyCode] || '₹';
};
