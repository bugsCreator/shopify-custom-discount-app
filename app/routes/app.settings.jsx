import { useState } from "react";
import { useActionData, useNavigation, useSubmit, useLoaderData, useNavigate } from "react-router";
import {
    Card,
    Layout,
    Page,
    Text,
    TextField,
    BlockStack,
    Button,
    Banner,
    InlineStack,
    DataTable,
    Badge
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    // Fetch all Shopify Functions
    const functionsResponse = await admin.graphql(`
    #graphql
    query {
      shopifyFunctions(first: 25) {
        nodes {
          id
          apiType
          title
          apiVersion
        }
      }
    }
  `);

    const functionsData = await functionsResponse.json();
    const functions = functionsData.data.shopifyFunctions.nodes;

    // Fetch existing configuration
    const shopResponse = await admin.graphql(`
    #graphql
    query {
      shop {
        id
        metafield(namespace: "volume_discount", key: "function_id") {
          value
        }
      }
    }
  `);

    const shopData = await shopResponse.json();
    const existingFunctionId = shopData.data.shop.metafield?.value || "";

    return {
        functions,
        existingFunctionId,
        shopId: shopData.data.shop.id
    };
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const functionId = formData.get("functionId");

    if (!functionId) {
        return { errors: [{ message: "Function ID is required" }] };
    }

    // Get Shop ID
    const shopResponse = await admin.graphql(`query { shop { id } }`);
    const shopData = await shopResponse.json();
    const shopId = shopData.data.shop.id;

    // Default discount configuration
    const title = "Buy N, get X% off";
    const quantity = 2;
    const percentage = 10;
    const productIds = [];

    const baseConfig = {
        products: productIds,
        minQty: quantity,
        percentOff: percentage,
    };

    // Create discount and set shop metafield in one mutation
    const response = await admin.graphql(
        `#graphql
        mutation CreateDiscount($automaticAppDiscount: DiscountAutomaticAppInput!, $metafieldsSetInput: [MetafieldsSetInput!]!) {
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
            metafieldsSet(metafields: $metafieldsSetInput) {
                userErrors {
                    field
                    message
                }
            }
        }`,
        {
            variables: {
                automaticAppDiscount: {
                    title,
                    functionId,
                    startsAt: new Date(Date.now() - 3600000).toISOString(),
                    metafields: [
                        {
                            namespace: "$app:volume-discount",
                            key: "function-configuration",
                            type: "json",
                            value: JSON.stringify(baseConfig),
                        },
                    ],
                    discountClasses: ["PRODUCT"],
                },
                metafieldsSetInput: [
                    {
                        namespace: "volume_discount",
                        key: "function_id",
                        type: "single_line_text_field",
                        ownerId: shopId,
                        value: functionId
                    },
                    {
                        namespace: "volume_discount",
                        key: "rules",
                        type: "json",
                        ownerId: shopId,
                        value: JSON.stringify(baseConfig)
                    }
                ]
            },
        }
    );

    const responseJson = await response.json();
    console.log('Discount Creation Response:', JSON.stringify(responseJson, null, 2));

    const errors = responseJson.data.discountAutomaticAppCreate?.userErrors || [];
    const metafieldErrors = responseJson.data.metafieldsSet?.userErrors || [];

    if (errors.length > 0 || metafieldErrors.length > 0) {
        console.error("Errors:", { discountErrors: errors, metafieldErrors });
        return {
            errors: [...errors, ...metafieldErrors],
            message: "Failed to create discount. Please check the errors."
        };
    }

    return {
        success: true,
        message: "Function ID saved and discount created successfully! You can now edit it to add products.",
        discount: responseJson.data.discountAutomaticAppCreate.automaticAppDiscount
    };
};

export default function Settings() {
    const submit = useSubmit();
    const navigate = useNavigate();
    const actionData = useActionData();
    const loaderData = useLoaderData();
    const navigation = useNavigation();

    const [functionId, setFunctionId] = useState(loaderData.existingFunctionId);

    const handleSave = () => {
        submit({ functionId }, { method: "post" });
    };

    // Prepare data for the table
    const tableRows = loaderData.functions.map(func => [
        <Text key="id" variant="bodyMd" as="span" fontWeight="medium">{func.id}</Text>,
        <Text key="title" variant="bodyMd" as="span">{func.title}</Text>,
        <Badge key="api" tone="info">{func.apiType}</Badge>,
        <Text key="version" variant="bodySm" as="span" tone="subdued">{func.apiVersion}</Text>,
        <Button
            key="use"
            size="slim"
            onClick={() => setFunctionId(func.id)}
        >
            Use This
        </Button>
    ]);

    return (
        <Page
            backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
            title="Configure Settings"
        >
            <Layout>
                {actionData?.success && (
                    <Layout.Section>
                        <Banner tone="success">{actionData.message}</Banner>
                    </Layout.Section>
                )}

                {actionData?.errors && actionData.errors.length > 0 && (
                    <Layout.Section>
                        <Banner tone="critical">
                            {actionData.errors.map((error, index) => (
                                <Text key={index}>{error.message}</Text>
                            ))}
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <BlockStack gap="500">
                        {/* Section 1: List All Functions */}
                        <Card>
                            <BlockStack gap="400">
                                <BlockStack gap="200">
                                    <Text variant="headingMd" as="h2">Available Shopify Functions</Text>
                                    <Text variant="bodyMd" tone="subdued">
                                        Below are all Shopify Functions available in your store. Select one to use for volume discounts.
                                    </Text>
                                </BlockStack>

                                {loaderData.functions.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                                        headings={[
                                            <Text key="id-heading" variant="bodySm" fontWeight="semibold">Function ID</Text>,
                                            <Text key="title-heading" variant="bodySm" fontWeight="semibold">Title</Text>,
                                            <Text key="type-heading" variant="bodySm" fontWeight="semibold">API Type</Text>,
                                            <Text key="version-heading" variant="bodySm" fontWeight="semibold">Version</Text>,
                                            <Text key="action-heading" variant="bodySm" fontWeight="semibold">Action</Text>
                                        ]}
                                        rows={tableRows}
                                    />
                                ) : (
                                    <Banner tone="info">
                                        No Shopify Functions found. Please deploy your discount extension first.
                                    </Banner>
                                )}
                            </BlockStack>
                        </Card>

                        {/* Section 2: Create/Configure Discount Function */}
                        <Card>
                            <BlockStack gap="400">
                                <BlockStack gap="200">
                                    <Text variant="headingMd" as="h2">Configure Discount Function</Text>
                                    <Text variant="bodyMd" tone="subdued">
                                        Enter or select the Function ID that will be used for volume discounts. You can select one from the table above or paste your own.
                                    </Text>
                                </BlockStack>

                                <TextField
                                    label="Function ID"
                                    value={functionId}
                                    onChange={setFunctionId}
                                    autoComplete="off"
                                    placeholder="gid://shopify/Function/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                                    helpText="The unique identifier for your discount function"
                                />

                                {functionId && (
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: '#F6F6F7',
                                        borderRadius: '8px'
                                    }}>
                                        <BlockStack gap="200">
                                            <Text variant="bodyMd" fontWeight="semibold">Current Function ID:</Text>
                                            <Text variant="bodySm" tone="subdued" breakWord>{functionId}</Text>
                                        </BlockStack>
                                    </div>
                                )}

                                <InlineStack align="end" gap="300">
                                    <Button onClick={() => navigate("/app")}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleSave}
                                        loading={navigation.state === "submitting"}
                                        disabled={!functionId}
                                    >
                                        Save Function ID
                                    </Button>
                                </InlineStack>
                            </BlockStack>
                        </Card>

                        {/* Section 3: Create Discount */}
                        <Card>
                            <BlockStack gap="400">
                                <BlockStack gap="200">
                                    <Text variant="headingMd" as="h2">Create Discount</Text>
                                    <Text variant="bodyMd" tone="subdued">
                                        Once you've configured your function, create a discount to start offering volume discounts to your customers.
                                    </Text>
                                </BlockStack>

                                <InlineStack align="start" gap="300">
                                    <Button
                                        variant="primary"
                                        onClick={() => navigate("/app/discount")}
                                        disabled={!functionId}
                                    >
                                        Create Discount
                                    </Button>
                                    {!functionId && (
                                        <Text variant="bodySm" tone="subdued">
                                            Please save a Function ID first
                                        </Text>
                                    )}
                                </InlineStack>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
