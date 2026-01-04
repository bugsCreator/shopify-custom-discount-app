// @ts-check
import { ProductDiscountSelectionStrategy } from "../generated/api";

export function run(input) {
    const lines = input.cart.lines;
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

    // Parse config saved in metafield
    const config = JSON.parse(input?.shop?.metafield?.value || "{}") || {};
    const { products = [], minQty = 1, percentOff = 10 } = config;

    if (!products.length) {
        // No products configured → no discount
        return { operations: [] };
    }

    // Filter cart lines for only the products in config
    const eligibleLines = lines.filter(line => {
        const productId = line.merchandise.product.id;
        return products.some(p => p.id === productId);
    });

    // Check total quantity of eligible products
    const eligibleQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);

    if (eligibleQuantity >= minQty) {
        return {
            operations: [
                {
                    productDiscountsAdd: {
                        candidates: [
                            {
                                targets: eligibleLines.map(line => ({
                                    cartLine: { id: line.id }
                                })),
                                value: { percentage: { value: percentOff } },
                                message: `${percentOff}% OFF (Buy ${minQty}+) on selected products`,
                            }
                        ],
                        selectionStrategy: ProductDiscountSelectionStrategy.First,
                    }
                }
            ]
        };
    }

    return { operations: [] };
}
