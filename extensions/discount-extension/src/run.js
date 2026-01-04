// @ts-check
import { ProductDiscountSelectionStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionResult} FunctionResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionResult}
 */
export function run(input) {
    const lines = input.cart.lines;
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

    if (totalQuantity >= 2) {
        return {
            operations: [
                {
                    productDiscountsAdd: {
                        candidates: [
                            {
                                targets: lines.map(line => ({
                                    cartLine: {
                                        id: line.id
                                    }
                                })),
                                value: {
                                    percentage: {
                                        value: 40
                                    }
                                },
                                message: "40% OFF (Buy 2+)"
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
