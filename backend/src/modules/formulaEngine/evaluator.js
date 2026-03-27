const SAFE_EXPRESSION_REGEX = /^[A-Za-z0-9\s()+\-*/.%_]+$/;
const SAFE_CONDITION_REGEX = /^[A-Za-z0-9\s()><=!&|'"_.]+$/;

function validateFormula(formula) {
    if (!formula || typeof formula !== 'string') return true;
    
    // Safety guard: max length
    if (formula.length > 200) {
        throw new Error('Formula execution rejected: Exceeds 200 character complexity limit.');
    }
    
    // Safety guard: max loop/depth nesting
    if ((formula.match(/\(/g) || []).length > 5) {
        throw new Error('Formula execution rejected: Expressions cannot be nested more than 5 levels deep.');
    }

    const cleanFormula = formula.replace(/\s+/g, '');
    if (cleanFormula === '') return true;

    if (!SAFE_EXPRESSION_REGEX.test(cleanFormula)) {
        throw new Error('Formula contains invalid characters. Only numeric literals, variables, and math operators are allowed.');
    }

    const blacklist = ['require', 'process', 'eval', 'function', 'return', 'import', 'window', 'document', 'this', 'while', 'for', 'if', 'else', 'do', 'switch', 'class', 'yield', 'await', 'let', 'const', 'var', 'new'];
    for (const keyword of blacklist) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(formula)) {
            throw new Error(`Formula contains forbidden keyword: ${keyword}`);
        }
    }

    return true;
}

function evaluateFormula(formula, context = {}) {
    if (!formula || typeof formula !== 'string') return 0;
    
    try {
        validateFormula(formula);
    } catch (err) {
        console.warn(`[FormulaEngine] Security Rejection: "${formula}" ->`, err.message);
        throw err;
    }

    // Extract root variables
    const variablePattern = /(?<!\.)\b[A-Za-z_][A-Za-z0-9_]*\b/g;
    const tokens = new Set(formula.match(variablePattern) || []);
    
    // Enterprise Safe List: Only allow context variables and designated Math functions
    const safeMathProperties = new Set(['abs', 'ceil', 'floor', 'max', 'min', 'round', 'sqrt', 'pow', 'PI', 'E']);
    const reserved = new Set(['Math', 'Number', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
    
    const keys = Array.from(tokens).filter(k => !reserved.has(k));
    
    // Strict Allow-list Validation: Every variable must be in context
    const unauthorized = keys.filter(k => context[k] === undefined);
    if (unauthorized.length > 0) {
        const errorMsg = `Security Violation: Unauthorized variable(s) detected: ${unauthorized.join(', ')}`;
        throw new Error(errorMsg);
    }

    // Build the execution sandbox
    const sandboxKeys = [...keys, 'Math'];
    const sandboxValues = [
        ...keys.map(k => {
            const val = context[k];
            if (typeof val === 'object' && val !== null) return val;
            return Number(val) || 0;
        }),
        // Provide a restricted Math object
        Object.fromEntries(
            Object.getOwnPropertyNames(Math)
                .filter(p => safeMathProperties.has(p))
                .map(p => [p, Math[p]])
        )
    ];

    try {
        // use 'use strict' to further restrict the execution
        const evaluator = new Function(...sandboxKeys, `"use strict"; return ${formula};`);
        const result = evaluator(...sandboxValues);
        return isNaN(result) ? 0 : Number(result.toFixed(2));
    } catch (err) {
        console.error(`[FormulaEngine] Execution Fault: "${formula}" ->`, err.message);
        throw new Error(`Formula Execution Failed: ${err.message}`);
    }
}

function evaluateCondition(condition, context = {}) {
    if (!condition || typeof condition !== 'string') return true;

    if (!SAFE_CONDITION_REGEX.test(condition)) {
        throw new Error('Security Rejection: Condition contains invalid characters.');
    }

    // Replace single = with === for JS evaluation safety
    let safeCondition = condition.replace(/([^=!><])=([^=!><])/g, '$1==$2');

    // Extract root variables
    const variablePattern = /(?<!\.)\b[A-Za-z_][A-Za-z0-9_]*\b/g;
    const tokens = new Set(safeCondition.match(variablePattern) || []);
    
    const safeMathProperties = new Set(['abs', 'ceil', 'floor', 'max', 'min', 'round', 'sqrt', 'pow', 'PI', 'E']);
    const reserved = new Set(['true', 'false', 'and', 'or', 'null', 'undefined', 'Math', 'Number']);
    
    const keys = Array.from(tokens).filter(t => !reserved.has(t.toLowerCase()));
    
    // Strict Validation
    const unauthorized = keys.filter(k => context[k] === undefined);
    if (unauthorized.length > 0) {
        throw new Error(`Security Violation: Unauthorized variable(s) for condition: ${unauthorized.join(', ')}`);
    }

    // Build the execution sandbox
    const sandboxKeys = [...keys, 'Math'];
    const sandboxValues = [
        ...keys.map(k => context[k]),
        Object.fromEntries(
            Object.getOwnPropertyNames(Math)
                .filter(p => safeMathProperties.has(p))
                .map(p => [p, Math[p]])
        )
    ];

    // Support python/SQL style logically
    safeCondition = safeCondition.replace(/\band\b/gi, '&&').replace(/\bor\b/gi, '||');

    try {
        const evaluator = new Function(...sandboxKeys, `"use strict"; return Boolean(${safeCondition});`);
        return !!evaluator(...sandboxValues);
    } catch (err) {
        console.error(`[FormulaEngine] Condition error: "${condition}" ->`, err.message);
        throw new Error(`Condition Execution Failed: ${err.message}`);
    }
}

module.exports = {
    evaluateFormula,
    evaluateCondition,
    validateFormula
};
