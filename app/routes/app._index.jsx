import { useEffect, useMemo, useState } from "react";
import { useActionData, useNavigation, useSubmit, useLoaderData } from "react-router";
import { useAppBridge, TitleBar } from "@shopify/app-bridge-react";
import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  TextField,
  BlockStack,
  Button,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // 1. Fetch Shop details (for Metafields) and Discount info
  const responseInitial = await admin.graphql(
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

  const responseInitialJson = await responseInitial.json();
  const shop = responseInitialJson.data.shop;
  const discountNodes = responseInitialJson.data.discountNodes.nodes;

  const shopMetafieldValue = shop.metafield?.value ? JSON.parse(shop.metafield.value) : null;
  const discountNode = discountNodes.find(node => node.discount?.discountId);

  // Initial config from Shop Metafield (preferred)
  let config = {
    quantity: "2",
    percentage: "10",
    productIds: []
  };

  if (shopMetafieldValue) {
    config = {
      quantity: String(shopMetafieldValue.minQty || "2"),
      percentage: String(shopMetafieldValue.percentOff || "10"),
      productIds: shopMetafieldValue.products || []
    };
  } else if (discountNode) {
    // Fallback: If no shop metafield, try to load from Discount Metafield (Migration path)
    // We will fetch this in the next step if strictly necessary, but for now specific discount fetch is mainly for the ID/Title existence check
  }

  if (!discountNode) {
    return {
      mode: "create",
      title: "Volume Discount",
      config: config
    };
  }

  const { discountId } = discountNode.discount;

  // 2. Fetch full details for the discount (mostly to verify existence/status and get title)
  // We still fetch this to get the discount title and ID.
  const responseDiscount = await admin.graphql(
    `#graphql
      query GetDiscount($id: ID!) {
        discountAutomaticApp(id: $id) {
          title
          status
          discountId
          metafields(first: 2, namespace: "$app:volume-discount") {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      }`,
    {
      variables: {
        id: discountId
      }
    }
  );

  const responseDiscountJson = await responseDiscount.json();
  const discount = responseDiscountJson.data.discountAutomaticApp;

  if (!discount) {
    return {
      mode: "create",
      title: "Volume Discount",
      config: config
    };
  }

  // If Shop Metafield was empty, but Discount has config, use Discount config (Legacy/Fallback)
  if (!shopMetafieldValue) {
    const configEdge = discount.metafields.edges.find(edge => edge.node.key === "function-configuration");
    const legacyConfig = JSON.parse(configEdge?.node?.value || "{}");
    if (legacyConfig.quantity) config.quantity = legacyConfig.quantity;
    if (legacyConfig.percentage) config.percentage = legacyConfig.percentage;
    if (legacyConfig.productIds) config.productIds = legacyConfig.productIds;
  }

  return {
    mode: "edit",
    title: discount.title,
    config: config,
    discountId: discount.discountId,
    id: discountNode.id,
    shopId: shop.id
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const id = formData.get("id"); // Discount ID (if editing)
  const title = formData.get("title");
  const quantity = parseInt(formData.get("quantity"));
  const percentage = parseFloat(formData.get("percentage"));
  const productIds = JSON.parse(formData.get("productIds") || "[]");

  // Get Shop ID first (required for creating Shop-owned metafields)
  const shopResponse = await admin.graphql(`query { shop { id } }`);
  const shopResponseJson = await shopResponse.json();
  const shopId = shopResponseJson.data.shop.id;

  // 1. Save Config to Shop Metafield
  const metafieldData = {
    products: productIds,
    minQty: quantity,
    percentOff: percentage
  };

  const metafieldSetResponse = await admin.graphql(
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

  const metafieldResult = await metafieldSetResponse.json();
  if (metafieldResult.data.metafieldsSet.userErrors.length > 0) {
    console.error("Metafield Error:", metafieldResult.data.metafieldsSet.userErrors);
    return { errors: metafieldResult.data.metafieldsSet.userErrors };
  }

  const baseConfig = {
    quantity,
    percentage,
    productIds,
  };

  const functionId = "bb2f00de-e779-90e3-7141-d67d5d765661b27f22c4";

  if (id) {
    // UPDATE Existing Discount
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

    const responseJson = await response.json();
    const errors = responseJson.data.discountAutomaticAppUpdate.userErrors;

    if (errors.length > 0) return { errors };
    return { success: true, message: "Discount updated successfully" };

  } else {
    // CREATE New Discount
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

    const responseJson = await response.json();
    const errors = responseJson.data.discountAutomaticAppCreate.userErrors;

    if (errors.length > 0) return { errors };
    return { success: true, message: "Discount created successfully" };
  }
};

export default function Index() {
  const submit = useSubmit();
  const actionData = useActionData();
  const loaderData = useLoaderData();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const emptyToast = useMemo(() => actionData?.success && shopify.toast.show(actionData.message), [actionData, shopify]);

  const [title, setTitle] = useState(loaderData.title);
  const [quantity, setQuantity] = useState(loaderData.config.quantity);
  const [percentage, setPercentage] = useState(loaderData.config.percentage);
  const [selectedProducts, setSelectedProducts] = useState(
    loaderData.config.productIds.map(id => ({ id, title: "Product" }))
  );

  async function selectProducts() {
    const result = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: true,
      selectionIds: selectedProducts.map(p => ({ id: p.id })),
    });

    if (result) {
      setSelectedProducts(result.selection);
    }
  }

  const handleSave = () => {
    const productIds = selectedProducts.map(p => p.id);
    const data = {
      title,
      quantity,
      percentage,
      productIds: JSON.stringify(productIds),
    };

    if (loaderData.discountId) {
      data.id = loaderData.discountId;
    }

    submit(data, { method: "post" });
  };

  const errors = actionData?.errors || [];
  const isEditing = loaderData.mode === "edit";

  return (
    <Page>
      <TitleBar title={isEditing ? "Edit Volume Discount" : "Create Volume Discount"} />
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">{actionData.message}</Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">General</Text>
                  <TextField
                    label="Title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                    error={errors.find(e => e.field?.includes('title'))?.message}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Volume Configuration</Text>
                  <TextField
                    label="Minimum Quantity"
                    type="number"
                    value={String(quantity)}
                    onChange={setQuantity}
                    autoComplete="off"
                  />
                  <TextField
                    label="Discount Percentage"
                    type="number"
                    value={String(percentage)}
                    onChange={setPercentage}
                    autoComplete="off"
                    suffix="%"
                    error={
                      (parseFloat(percentage) < 1 || parseFloat(percentage) > 80)
                        ? "Must be between 1 and 80"
                        : undefined
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Target Products</Text>
                  <Text variant="bodyMd">
                    {selectedProducts.length} product(s) selected.
                  </Text>
                  <Button onClick={selectProducts}>Edit Selection</Button>
                </BlockStack>
              </Card>

              <Box paddingBlockEnd="500">
                <Button
                  submit
                  variant="primary"
                  loading={navigation.state === "submitting"}
                  disabled={parseFloat(percentage) < 1 || parseFloat(percentage) > 80}
                >
                  {isEditing ? "Save Changes" : "Create Discount"}
                </Button>
              </Box>
            </BlockStack>
          </form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
