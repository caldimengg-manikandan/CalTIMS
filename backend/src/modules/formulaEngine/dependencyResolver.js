/**
 * Provides mathematical Topological Sorting of Payroll Components based on formula variables.
 * Ensures an execution pipeline won't fail due to referenced variables not existing yet.
 */

/**
 * Extracts dependency variable names from a formula string.
 * @param {string} text the raw formula or condition 
 * @param {Set<string>} availableNames set of component names in the current tier
 * @returns {Array<string>} list of matching token dependencies
 */
function extractDependencies(text, availableNames) {
    if (!text) return [];
    
    const variablePattern = /[A-Z_][A-Z0-9_]*/g;
    const tokens = text.toUpperCase().match(variablePattern) || [];
    
    // Filter only variables that refer to known component keys in this tier
    const deps = new Set();
    tokens.forEach(token => {
        if (availableNames.has(token)) {
            deps.add(token);
        }
    });
    
    return Array.from(deps);
}

/**
 * Normalizes a component name into a predictable context key.
 * Converts "Basic Salary" -> "BASIC_SALARY"
 */
function getCompKey(comp) {
    return (comp.name || '').toUpperCase().replace(/\s+/g, '_');
}

/**
 * Resolves the execution order of a list of components using Kahn's topological sort.
 * Will throw an Error if a cyclical dependency evaluates.
 * 
 * @param {Array<Object>} components Array of earnings or deductions
 * @returns {Array<Object>} Properly ordered execution queue
 */
function resolveExecutionOrder(components) {
    if (!components || !Array.isArray(components) || components.length === 0) {
        return [];
    }

    const availableNames = new Set(components.map(c => getCompKey(c)));
    
    // Adjacency List for Graph
    const graph = {};
    const inDegree = {};
    const compMap = {};

    // Initialize nodes
    components.forEach(comp => {
        const key = getCompKey(comp);
        graph[key] = [];
        inDegree[key] = 0;
        compMap[key] = comp;
    });

    // Build edges (dependencies)
    components.forEach(comp => {
        const key = getCompKey(comp);
        let aggStr = (comp.formula || '').toString() + ' ' + (comp.condition || '').toString();
        
        if (comp.calculationType === 'Percentage' && comp.value) {
            aggStr += ' ' + comp.value;
        }

        const deps = extractDependencies(aggStr, availableNames);
        
        deps.forEach(token => {
            if (token !== key) {
                // Dependency: token must execute BEFORE key. 
                // Edge goes from token -> key
                if (!graph[token].includes(key)) {
                    graph[token].push(key);
                    inDegree[key]++;
                }
            }
        });
    });

    // Topological Sort implementation
    const queue = [];
    const orderedKeys = [];

    // Push nodes with no dependencies (inDegree = 0)
    Object.keys(inDegree).forEach(key => {
        if (inDegree[key] === 0) {
            queue.push(key);
        }
    });

    while (queue.length > 0) {
        const current = queue.shift();
        orderedKeys.push(current);

        graph[current].forEach(neighbor => {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        });
    }

    // Circular Dependency Detection
    if (orderedKeys.length !== components.length) {
        const cycleNodes = Object.keys(inDegree).filter(k => inDegree[k] > 0);
        throw new Error(`Cyclical schema error: Circular dependency detected in payroll components: ${cycleNodes.join(', ')}. Please adjust the formulas bridging these components.`);
    }

    return orderedKeys.map(key => compMap[key]);
}

/**
 * Simple debug utility to explain the evaluation path.
 * @param {Array<Object>} components 
 * @returns {string} Text outline of the path, e.g. "BASIC_SALARY -> HRA -> PF"
 */
function explainExecutionOrder(components) {
    try {
        const ordered = resolveExecutionOrder(components);
        return ordered.map(c => getCompKey(c)).join(' -> ');
    } catch (err) {
        return `Graph Cycle Error: ${err.message}`;
    }
}

module.exports = {
    extractDependencies,
    resolveExecutionOrder,
    explainExecutionOrder
};
