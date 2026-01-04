// @ts-check
import { ProductDiscountSelectionStrategy } from "../generated/api";

/**
 * Parse and validate configuration from shop metafield
 * @param {Object} input - The input object containing shop data
 * @returns {Object} Configuration with products, minQty, and percentOff
 */
function getConfiguration(input) {
    try {
        const config = JSON.parse(input?.shop?.metafield?.value || "{}");
        return {
            products: config.products || [],
            minQty: config.minQty || 1,
            percentOff: config.percentOff || 10
        };
    } catch (error) {
        console.error("Error parsing configuration:", error);
        return { products: [], minQty: 1, percentOff: 10 };
    }
}

/**
 * Filter cart lines to only include eligible products
 * @param {Array} lines - Cart lines
 * @param {Array} products - Configured products
 * @returns {Array} Eligible cart lines
 */
function getEligibleLines(lines, products) {
    if (!products || products.length === 0) {
        return [];
    }

    return lines.filter(line => {
        const productId = line.merchandise.product.id;
        return products.some(p => p.id === productId);
    });
}

/**
 * Calculate total quantity of eligible products
 * @param {Array} eligibleLines - Eligible cart lines
 * @returns {number} Total quantity
 */
function calculateEligibleQuantity(eligibleLines) {
    return eligibleLines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Create discount operation
 * @param {Array} eligibleLines - Eligible cart lines
 * @param {number} percentOff - Discount percentage
 * @param {number} minQty - Minimum quantity required
 * @returns {Object} Discount operation
 */
function createDiscountOperation(eligibleLines, percentOff, minQty) {
    return {
        productDiscountsAdd: {
            candidates: [
                {
                    targets: eligibleLines.map(line => ({
                        cartLine: { id: line.id }
                    })),
                    value: { percentage: { value: percentOff } },
                    message: `Buy ${minQty}, get ${percentOff}% off`,
                }
            ],
            selectionStrategy: ProductDiscountSelectionStrategy.First,
        }
    };
}

/**
 * Main discount function
 * @param {Object} input - Shopify Function input
 * @returns {Object} Discount operations
 */
export function run(input) {
    // Get configuration
    const { products, minQty, percentOff } = getConfiguration(input);

    // Early exit if no products configured
    if (products.length === 0) {
        return { operations: [] };
    }

    // Get eligible cart lines
    const eligibleLines = getEligibleLines(input.cart.lines, products);

    // Early exit if no eligible products in cart
    if (eligibleLines.length === 0) {
        return { operations: [] };
    }

    // Calculate total eligible quantity
    const eligibleQuantity = calculateEligibleQuantity(eligibleLines);

    // Apply discount if minimum quantity is met
    if (eligibleQuantity >= minQty) {
        return {
            operations: [createDiscountOperation(eligibleLines, percentOff, minQty)]
        };
    }

    return { operations: [] };
}
