import React, { useEffect, useMemo } from "react";
import { useActionData, useNavigation, useSubmit, useParams } from "react-router";
import { useAppBridge, TitleBar } from "@shopify/app-bridge-react";
import {
    Box,
    Card,
    Layout,
    Page,
    Text,
    TextField,
    BlockStack,
    InlineStack,
    Button
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";


export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const action = async ({ request, params }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const title = formData.get("title");
    const quantity = parseInt(formData.get("quantity"));
    const percentage = parseFloat(formData.get("percentage"));
    // Product IDs are passed as a JSON string from the hidden input
    const productIds = JSON.parse(formData.get("productIds") || "[]");

    const functionId = params.functionId;

    const baseConfig = {
        quantity,
        percentage,
        productIds,
    };

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
                },
                metafieldsSetInput: [
                    {
                        namespace: "volume_discount",
                        key: "rules",
                        type: "json",
                        ownerId: `gid://shopify/Shop/${(await admin.graphql(`{ shop { id } }`).then(r => r.json())).data.shop.id.split('/').pop()}`,
                        value: JSON.stringify(baseConfig)
                    }
                ]
            },
        }
    );

    const responseJson = await response.json();
    const errors = responseJson.data.discountAutomaticAppCreate.userErrors;

    if (errors.length > 0) {
        return { errors };
    }

    // Redirect to the discount page in admin is handled by the extension config usually?
    // Or we redirect to the app's list?
    // Actually, standard practice: redirect to the newly created discount's URL in Shopify Admin.
    // But we are INSIDE the app iframe (embedded false?).
    // Wait, I reverted to EMBEDDED = TRUE.
    // So we should redirect to `shopify.toast.show("Created")` and maybe navigate to specific page.

    return { success: true, discount: responseJson.data.discountAutomaticAppCreate.automaticAppDiscount };
};

export default function VolumeDiscountNew() {
    const submit = useSubmit();
    const actionData = useActionData();
    const navigation = useNavigation();
    const shopify = useAppBridge();
    const { functionId } = useParams();

    const emptyToast = useMemo(() => actionData?.success && shopify.toast.show("Discount created"), [actionData, shopify]);

    // Form State
    const [title, setTitle] = React.useState("Volume Discount");
    const [quantity, setQuantity] = React.useState("2");
    const [percentage, setPercentage] = React.useState("10");
    const [selectedProducts, setSelectedProducts] = React.useState([]);

    async function selectProducts() {
        // In a real app, use the Resource Picker from App Bridge
        const result = await shopify.resourcePicker({
            type: "product",
            action: "select",
            multiple: true,
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
        submit(data, { method: "post" });
    };

    // Error handling
    const errors = actionData?.errors || [];

    return (
        <Page>
            <TitleBar title="Create Volume Discount" />
            <Layout>
                <Layout.Section>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <BlockStack gap="500">
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        General
                                    </Text>
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
                                    <Text variant="headingMd" as="h2">
                                        Volume Configuration
                                    </Text>
                                    <TextField
                                        label="Minimum Quantity"
                                        type="number"
                                        value={quantity}
                                        onChange={setQuantity}
                                        autoComplete="off"
                                        helpText="Minimum quantity of items to trigger discount."
                                    />
                                    <TextField
                                        label="Discount Percentage"
                                        type="number"
                                        value={percentage}
                                        onChange={setPercentage}
                                        autoComplete="off"
                                        suffix="%"
                                        helpText="Value between 1 and 80."
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
                                    <Text variant="headingMd" as="h2">TARGET PRODUCTS</Text>
                                    {selectedProducts.length > 0 ? (
                                        <BlockStack>
                                            {selectedProducts.map(p => (
                                                <Text key={p.id}>{p.title}</Text>
                                            ))}
                                        </BlockStack>
                                    ) : (
                                        <Text tone="subdued">No products selected.</Text>
                                    )}
                                    <Button onClick={selectProducts}>Select Products</Button>
                                </BlockStack>
                            </Card>

                            <Box paddingBlockEnd="500">
                                <Button
                                    submit
                                    variant="primary"
                                    loading={navigation.state === "submitting"}
                                    disabled={parseFloat(percentage) < 1 || parseFloat(percentage) > 80}
                                >
                                    Save Discount
                                </Button>
                            </Box>
                        </BlockStack>
                    </form>
                </Layout.Section>
            </Layout>
        </Page>
    );
}


