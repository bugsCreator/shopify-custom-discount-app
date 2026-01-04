import { useMemo, useState } from "react";
import { useActionData, useNavigation, useSubmit, useLoaderData, useNavigate } from "react-router";
import { useAppBridge, TitleBar } from "@shopify/app-bridge-react";
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
    Badge
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
    fetchDiscountConfig,
    getDiscountDetails,
    createDiscount,
    updateDiscount,
    parseConfig
} from "../utils/discount.server";

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);

    const { shop, discountNodes } = await fetchDiscountConfig(admin);
    const shopMetafieldValue = shop.metafield?.value ? JSON.parse(shop.metafield.value) : null;

    // Get configuration from metafield
    const config = parseConfig(shopMetafieldValue);

    // Check if discount exists
    const discountNode = discountNodes.find(node => node.discount?.discountId);

    let mode = "create";
    let title = "Volume Discount";
    let discountId = null;
    let nodeListId = null;
    let status = null;

    if (discountNode) {
        const { discountId: dId } = discountNode.discount;
        const discountDetails = await getDiscountDetails(admin, dId);

        if (discountDetails) {
            title = discountDetails.title;
            status = discountDetails.status;
            mode = "edit";
            discountId = discountDetails.discountId;
            nodeListId = discountNode.id;
        }
    }

    return {
        mode,
        title,
        status,
        config,
        discountId,
        id: nodeListId,
        shopId: shop.id,
        hasConfiguration: !!shopMetafieldValue
    };
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const id = formData.get("id");
    const title = formData.get("title");
    const quantity = parseInt(formData.get("quantity"));
    const percentage = parseFloat(formData.get("percentage"));
    const productDetails = JSON.parse(formData.get("productDetails") || "[]");

    const productIds = productDetails.map(p => p.id);

    if (id) {
        // Update existing discount
        const { errors } = await updateDiscount(admin, {
            id,
            title,
            quantity,
            percentage,
            productIds
        });

        if (errors.length > 0) return { errors };
        return { success: true, message: "Discount updated successfully" };
    } else {
        // Create new discount
        const { errors } = await createDiscount(admin, {
            title,
            quantity,
            percentage,
            productIds
        });

        if (errors.length > 0) return { errors };
        return { success: true, message: "Discount created successfully" };
    }
};

export default function Discount() {
    const submit = useSubmit();
    const navigate = useNavigate();
    const actionData = useActionData();
    const loaderData = useLoaderData();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    const emptyToast = useMemo(() => actionData?.success && shopify.toast.show(actionData.message), [actionData, shopify]);

    const [title, setTitle] = useState(loaderData.title);

    // Pre-populate from settings
    const quantity = loaderData.config.quantity;
    const percentage = loaderData.config.percentage;
    const selectedProducts = loaderData.config.products || [];

    const handleSave = () => {
        const data = {
            title,
            quantity,
            percentage,
            productDetails: JSON.stringify(selectedProducts),
        };

        if (loaderData.discountId) {
            data.id = loaderData.discountId;
        }

        submit(data, { method: "post" });
    };

    const errors = actionData?.errors || [];
    const isEditing = loaderData.mode === "edit";

    return (
        <Page
            backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
            title={isEditing ? "Edit Volume Discount" : "Create Volume Discount"}
        >
            <Layout>
                {!loaderData.hasConfiguration && (
                    <Layout.Section>
                        <Banner tone="warning">
                            <Text variant="bodyMd">
                                Please configure your settings first before creating a discount.{" "}
                                <Button variant="plain" onClick={() => navigate("/app/settings")}>
                                    Go to Settings
                                </Button>
                            </Text>
                        </Banner>
                    </Layout.Section>
                )}

                {actionData?.success && (
                    <Layout.Section>
                        <Banner tone="success">{actionData.message}</Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <BlockStack gap="500">
                            {/* General Info */}
                            <Card>
                                <BlockStack gap="400">
                                    <InlineStack align="space-between" blockAlign="start">
                                        <Text variant="headingMd" as="h2">General Information</Text>
                                        {isEditing && loaderData.status && (
                                            <Badge tone={loaderData.status === "ACTIVE" ? "success" : "info"}>
                                                {loaderData.status}
                                            </Badge>
                                        )}
                                    </InlineStack>

                                    <TextField
                                        label="Discount Title"
                                        value={title}
                                        onChange={setTitle}
                                        autoComplete="off"
                                        error={errors.find(e => e.field?.includes('title'))?.message}
                                        helpText="This title will be visible in your Shopify admin"
                                    />
                                </BlockStack>
                            </Card>

                            {/* Configuration Summary */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">Configuration Summary</Text>
                                    <Text variant="bodyMd" tone="subdued">
                                        These values are pulled from your settings. To change them, update your settings.
                                    </Text>

                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#F6F6F7',
                                        borderRadius: '8px'
                                    }}>
                                        <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" tone="subdued">Minimum Quantity:</Text>
                                                <Text variant="bodyMd" fontWeight="semibold">{quantity}</Text>
                                            </InlineStack>

                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" tone="subdued">Discount Percentage:</Text>
                                                <Text variant="bodyMd" fontWeight="semibold">{percentage}%</Text>
                                            </InlineStack>

                                            <InlineStack align="space-between">
                                                <Text variant="bodyMd" tone="subdued">Target Products:</Text>
                                                <Text variant="bodyMd" fontWeight="semibold">
                                                    {selectedProducts.length} product(s)
                                                </Text>
                                            </InlineStack>
                                        </BlockStack>
                                    </div>

                                    <Button onClick={() => navigate("/app/settings")} variant="plain">
                                        Update Settings
                                    </Button>
                                </BlockStack>
                            </Card>

                            {/* Actions */}
                            <InlineStack align="end" gap="300">
                                <Button onClick={() => navigate("/app")}>
                                    Cancel
                                </Button>
                                <Button
                                    submit
                                    variant="primary"
                                    loading={navigation.state === "submitting"}
                                    disabled={!loaderData.hasConfiguration || !title || selectedProducts.length === 0}
                                >
                                    {isEditing ? "Update Discount" : "Create Discount"}
                                </Button>
                            </InlineStack>
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
