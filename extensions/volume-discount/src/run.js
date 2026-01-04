// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}"
  );

  console.error("Input:", JSON.stringify(input));
  console.error("Configuration:", JSON.stringify(configuration));

  const minQuantity = parseInt(configuration.quantity) || 0;
  const percentage = parseFloat(configuration.percentage) || 0;
  // productIds is an array of strings e.g. ["gid://shopify/Product/123"]
  const validProductIds = configuration.productIds || [];

  // Basic Validation
  if (percentage <= 0 || percentage > 80 || minQuantity <= 0) {
    return EMPTY_DISCOUNT;
  }

  const targets = input.cart.lines
    .filter((line) => {
      // Check quantity
      if (line.quantity < minQuantity) {
        return false;
      }

      // Check product eligibility
      if (validProductIds.length > 0) {
        const variant = line.merchandise;
        if (variant?.__typename !== "ProductVariant") return false;

        const productId = variant.product.id;
        if (!validProductIds.includes(productId)) return false;
      }

      return true;
    })
    .map((line) => ({
      productVariant: {
        id: line.merchandise.id
      }
    }));

  if (targets.length === 0) {
    return EMPTY_DISCOUNT;
  }

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        targets: targets,
        value: {
          percentage: {
            value: percentage.toString() // API expects string? decimal? Usually Decimal but printed as string or number? TS def says Decimal (string)
          }
        },
        message: `${percentage}% Volume Discount`
      }
    ]
  };
}