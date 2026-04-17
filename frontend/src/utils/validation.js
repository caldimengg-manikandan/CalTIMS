/**
 * Reusable validation utility for form fields
 */

export const validateString = (value, rules = {}) => {
    const {
        name = 'Field',
        min = 0,
        max = Infinity,
        required = false,
        custom = null
    } = rules;

    const trimmedValue = value?.trim() || '';

    if (required && !trimmedValue) {
        return `${name} is required`;
    }

    if (trimmedValue.length > 0 && trimmedValue.length < min) {
        return `${name} must be at least ${min} characters`;
    }

    if (trimmedValue.length > max) {
        return `${name} cannot exceed ${max} characters`;
    }

    if (custom && typeof custom === 'function') {
        const customError = custom(value);
        if (customError) return customError;
    }

    return '';
};

export const isEmailValid = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const isPhoneValid = (phone) => {
    const re = /^\+?[\d\s-]{10,}$/;
    return re.test(phone);
};
