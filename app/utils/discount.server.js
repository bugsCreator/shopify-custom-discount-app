/**
 * Discount utility functions for server-side operations
 */

/**
 * Fetch shop metafield and discount configuration
 */
export async function fetchDiscountConfig(admin) {
    const response = await admin.graphql(
        `#graphql
      query GetInitialData {
        shop {
          id
          metafield(namespace: "volume_discount", key: "rules") {
            value
          }
        }
        discountNodes(first: 5, reverse: true) {
          nodes {
            id
            discount {
              ... on DiscountAutomaticApp {
                discountId
                title
              }
            }
          }
        }
      }`
    );

    const data = await response.json();
    return {
        shop: data.data.shop,
        discountNodes: data.data.discountNodes.nodes
    };
}

/**
 * Enrich product IDs with full product details
 */
export async function enrichProductDetails(admin, productIds) {
    if (!productIds || productIds.length === 0) {
        return [];
    }

    const response = await admin.graphql(
        `#graphql
      query GetProductDetails($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            featuredImage {
              url
            }
          }
        }
      }`,
        {
            variables: { ids: productIds }
        }
    );

    const data = await response.json();
    return data.data.nodes.map(node => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        image: node.featuredImage?.url || ""
    })).filter(Boolean);
}

/**
 * Get discount details by ID
 */
export async function getDiscountDetails(admin, discountId) {
    const response = await admin.graphql(
        `#graphql
      query GetDiscountBasic($id: ID!) {
        discountNode(id: $id) {
          discount {
            ... on DiscountAutomaticApp {
              title
              status
              discountId
            }
          }
        }
      }`,
        { variables: { id: discountId } }
    );

    const data = await response.json();
    return data.data.discountNode?.discount;
}

/**
 * Create a new discount
 */
export async function createDiscount(admin, { title, quantity, percentage, productIds }) {
    const functionId = process.env.SHOPIFY_VOLUME_DISCOUNT_ID || "019b8930-7d49-7741-ba32-edd9721a5722";

    const baseConfig = {
        quantity,
        percentage,
        productIds,
    };

    const response = await admin.graphql(
        `#graphql
      mutation CreateDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          userErrors {
            field
            message
          }
          automaticAppDiscount {
            discountId
            title
          }
        }
      }`,
        {
            variables: {
                automaticAppDiscount: {
                    title,
                    functionId,
                    startsAt: new Date().toISOString(),
                    metafields: [
                        {
                            namespace: "$app:volume-discount",
                            key: "function-configuration",
                            type: "json",
                            value: JSON.stringify(baseConfig),
                        },
                    ],
                },
            },
        }
    );

    const data = await response.json();
    return {
        errors: data.data.discountAutomaticAppCreate.userErrors,
        discount: data.data.discountAutomaticAppCreate.automaticAppDiscount
    };
}

/**
 * Update an existing discount
 */
export async function updateDiscount(admin, { id, title, quantity, percentage, productIds }) {
    const baseConfig = {
        quantity,
        percentage,
        productIds,
    };

    const response = await admin.graphql(
        `#graphql
      mutation UpdateDiscount($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
          userErrors {
            field
            message
          }
          automaticAppDiscount {
            discountId
            title
          }
        }
      }`,
        {
            variables: {
                id,
                automaticAppDiscount: {
                    title,
                    metafields: [
                        {
                            namespace: "$app:volume-discount",
                            key: "function-configuration",
                            type: "json",
                            value: JSON.stringify(baseConfig),
                        },
                    ],
                },
            },
        }
    );

    const data = await response.json();
    return {
        errors: data.data.discountAutomaticAppUpdate.userErrors
    };
}

/**
 * Save discount configuration to shop metafield
 */
export async function saveShopMetafield(admin, { shopId, products, minQty, percentOff }) {
    const metafieldData = {
        products,
        minQty,
        percentOff
    };

    const response = await admin.graphql(
        `#graphql
      mutation SetShopMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
        {
            variables: {
                metafields: [
                    {
                        ownerId: shopId,
                        namespace: "volume_discount",
                        key: "rules",
                        type: "json",
                        value: JSON.stringify(metafieldData)
                    }
                ]
            }
        }
    );

    const data = await response.json();
    return {
        errors: data.data.metafieldsSet.userErrors
    };
}

/**
 * Parse and normalize config from metafield
 */
export function parseConfig(shopMetafieldValue) {
    if (!shopMetafieldValue) {
        return {
            quantity: "2",
            percentage: "10",
            products: []
        };
    }

    return {
        quantity: String(shopMetafieldValue.minQty || "2"),
        percentage: String(shopMetafieldValue.percentOff || "10"),
        products: shopMetafieldValue.products || []
    };
}
