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
    parseConfig,
    enrichProductDetails,
    saveShopMetafield
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
    let metafieldId = null;

    if (discountNode) {
        const nodeListId = discountNode.id;
        const discountNodeDetails = await getDiscountDetails(admin, nodeListId);

        if (discountNodeDetails && discountNodeDetails.discount) {
            const { discount, metafield } = discountNodeDetails;
            title = discount.title;
            status = discount.status;
            mode = "edit";
            discountId = discount.discountId;
            metafieldId = metafield?.id || null;

            if (metafield?.value) {
                const dc = JSON.parse(metafield.value);
                config.quantity = String(dc.quantity || config.quantity);
                config.percentage = String(dc.percentage || config.percentage);
                if (dc.productIds && dc.productIds.length > 0) {
                    config.products = await enrichProductDetails(admin, dc.productIds);
                }
            }
        }
    }

    return {
        mode,
        title,
        status,
        config,
        discountId,
        id: nodeListId,
        metafieldId,
        shopId: shop.id,
        hasConfiguration: !!shopMetafieldValue
    };
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const id = formData.get("id");
    const metafieldId = formData.get("metafieldId");
    const title = formData.get("title");
    const quantity = parseInt(formData.get("quantity"));
    const percentage = parseFloat(formData.get("percentage"));
    const productDetails = JSON.parse(formData.get("productDetails") || "[]");

    const productIds = productDetails.map(p => p.id);

    // Save to shop metafield for discount function and widget
    const shopResponse = await admin.graphql(`query { shop { id } }`);
    const shopData = await shopResponse.json();
    const shopId = shopData.data.shop.id;

    const { errors: shopMetafieldErrors } = await saveShopMetafield(admin, {
        shopId,
        products: productDetails,
        minQty: quantity,
        percentOff: percentage
    });

    if (shopMetafieldErrors && shopMetafieldErrors.length > 0) {
        return { errors: shopMetafieldErrors };
    }

    if (id) {
        // Update existing discount
        const { errors } = await updateDiscount(admin, {
            id,
            metafieldId,
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
    // Pre-populate from settings (Variables now initialized in state)

    const [quantity, setQuantity] = useState(loaderData.config.quantity);
    const [percentage, setPercentage] = useState(loaderData.config.percentage);
    const [selectedProducts, setSelectedProducts] = useState(loaderData.config.products || []);
    const selectProducts = async () => {
        const selection = await shopify.resourcePicker({
            type: 'product',
            selectionIds: selectedProducts.map(p => ({ id: p.id })),
            action: 'select',
            multiple: true,
        });

        if (selection) {
            setSelectedProducts(selection);
        }
    };

    const handleSave = () => {
        const data = {
            title,
            quantity,
            percentage,
            productDetails: JSON.stringify(selectedProducts),
        };

        if (loaderData.discountId) {
            data.id = loaderData.discountId;
            if (loaderData.metafieldId) {
                data.metafieldId = loaderData.metafieldId;
            }
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

                            {/* Configuration */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">Discount Configuration</Text>

                                    <InlineStack gap="400">
                                        <TextField
                                            label="Minimum Quantity"
                                            type="number"
                                            value={quantity}
                                            onChange={setQuantity}
                                            autoComplete="off"
                                        />
                                        <TextField
                                            label="Discount Percentage"
                                            type="number"
                                            suffix="%"
                                            value={percentage}
                                            onChange={setPercentage}
                                            autoComplete="off"
                                            min={1}
                                            max={80}
                                            helpText="Enter a value between 1% and 80%"
                                        />
                                    </InlineStack>

                                    <BlockStack gap="200">
                                        <Text variant="headingSm" as="h3">Target Products</Text>
                                        <div style={{ padding: '12px', background: '#f6f6f7', borderRadius: '8px' }}>
                                            {selectedProducts.length > 0 ? (
                                                <BlockStack gap="200">
                                                    {selectedProducts.map((product) => (
                                                        <InlineStack key={product.id} align="space-between">
                                                            <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
                                                            <Button
                                                                variant="plain"
                                                                tone="critical"
                                                                onClick={() => setSelectedProducts(selectedProducts.filter(p => p.id !== product.id))}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </InlineStack>
                                                    ))}
                                                </BlockStack>
                                            ) : (
                                                <Text variant="bodyMd" tone="subdued">No products selected</Text>
                                            )}
                                        </div>

                                        <div>
                                            <Button onClick={selectProducts}>Select Products</Button>
                                        </div>
                                    </BlockStack>
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
            </Layout >
        </Page >
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
