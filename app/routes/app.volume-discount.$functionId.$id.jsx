import { useEffect, useMemo, useState } from "react";
import { useActionData, useNavigation, useSubmit, useLoaderData, useParams } from "react-router";
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


export const loader = async ({ request, params }) => {
    const { admin } = await authenticate.admin(request);
    const { id } = params;

    const response = await admin.graphql(
        `#graphql
      query GetDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
              startsAt
              endsAt
              status
              metafield(namespace: "$app:volume-discount", key: "function-configuration") {
                value
              }
            }
          }
        }
      }`,
        {
            variables: {
                id: `gid://shopify/DiscountNode/${id}`,
            },
        }
    );

    const responseJson = await response.json();
    const discountNode = responseJson.data.discountNode;

    if (!discountNode) {
        return { discount: null };
    }

    const { title, metafield } = discountNode.discount;
    const config = JSON.parse(metafield?.value || "{}");

    return {
        title,
        config: {
            quantity: config.quantity || "2",
            percentage: config.percentage || "10",
            productIds: config.productIds || []
        },
        discountId: discountNode.discount.discountId
    };
};

export const action = async ({ request, params }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    // id is route param, but the mutation needs the Discount ID (gid://shopify/DiscountAutomaticApp/...)
    // But wait, we update via `discountAutomaticAppUpdate` which takes the ID.
    // The route param `id` is usually the `DiscountNode` ID or `DiscountAutomaticApp` ID?
    // In the URL it's usually the `DiscountNode` ID (e.g. from the admin URL).
    // But `discountAutomaticAppUpdate` expects the `DiscountAutomaticApp` ID (usually).
    // Actually, usually app extensions route using the Discount ID.

    // Let's assume the param `id` is the Discount ID.
    const id = `gid://shopify/DiscountAutomaticApp/${params.id}`;

    const title = formData.get("title");
    const quantity = parseInt(formData.get("quantity"));
    const percentage = parseFloat(formData.get("percentage"));
    const productIds = JSON.parse(formData.get("productIds") || "[]");

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

    const responseJson = await response.json();
    const errors = responseJson.data.discountAutomaticAppUpdate.userErrors;

    if (errors.length > 0) {
        return { errors };
    }

    return { success: true, discount: responseJson.data.discountAutomaticAppUpdate.automaticAppDiscount };
};

export default function VolumeDiscountEdit() {
    const submit = useSubmit();
    const actionData = useActionData();
    const loaderData = useLoaderData();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    // If not found
    if (!loaderData?.config) {
        return (
            <Page>
                <Card>
                    <Text>Discount not found</Text>
                </Card>
            </Page>
        );
    }

    const emptyToast = useMemo(() => actionData?.success && shopify.toast.show("Discount updated"), [actionData, shopify]);

    const [title, setTitle] = useState(loaderData.title);
    const [quantity, setQuantity] = useState(loaderData.config.quantity);
    const [percentage, setPercentage] = useState(loaderData.config.percentage);
    const [selectedProducts, setSelectedProducts] = useState(
        // We only have IDs, so we can't show titles easily without fetching them.
        // For simplicity in this demo, we'll just show the count or "Loaded products".
        // Or we can fetch them using a resource picker "initialSelectionIds".
        // Let's just store the IDs and let the picker handle display if opened.
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
        submit(data, { method: "post" });
    };

    const errors = actionData?.errors || [];

    return (
        <Page>
            <TitleBar title="Edit Volume Discount" />
            <Layout>
                {actionData?.success && (
                    <Layout.Section>
                        <Banner tone="success">Discount updated successfully</Banner>
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
                                    Save Changes
                                </Button>
                            </Box>
                        </BlockStack>
                    </form>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
