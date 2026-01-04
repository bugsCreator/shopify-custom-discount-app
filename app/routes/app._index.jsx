import { useLoaderData, useNavigate } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { fetchDiscountConfig } from "../utils/discount.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Fetch current configuration status
  const { shop, discountNodes } = await fetchDiscountConfig(admin);

  const hasMetafield = !!shop.metafield?.value;
  const hasDiscount = discountNodes.some(node => node.discount?.discountId);

  return {
    hasConfiguration: hasMetafield,
    hasDiscount,
    shopId: shop.id
  };
};

export default function Index() {
  const loaderData = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page>
      <TitleBar title="Volume Discount App" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Welcome Section */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h1">
                  Welcome to Volume Discount
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure your volume discount settings and manage your discount rules to increase sales and reward bulk purchases.
                </Text>
              </BlockStack>
            </Card>

            {/* Configuration Cards */}
            <InlineStack gap="400" wrap={false}>
              {/* Configure Settings Card */}
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <InlineStack gap="300" blockAlign="center">
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: '#EBF5FA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          ⚙
                        </div>
                        <Text variant="headingMd" as="h2">
                          Configure Settings
                        </Text>
                      </InlineStack>
                      {loaderData.hasConfiguration && (
                        <Badge tone="success">Configured</Badge>
                      )}
                    </InlineStack>

                    <Text variant="bodyMd" as="p" tone="subdued">
                      Set up your Discounts and more.
                    </Text>

                    <div>
                      <Button
                        variant="primary"
                        onClick={() => navigate("/app/settings")}
                        fullWidth
                      >
                        {loaderData.hasConfiguration ? "Update Settings" : "Configure Settings"}
                      </Button>
                    </div>
                  </BlockStack>
                </Card>
              </div>

              {/* Configure Discount Card */}
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <InlineStack gap="300" blockAlign="center">
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: '#FFF4E5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          %
                        </div>
                        <Text variant="headingMd" as="h2">
                          Configure Discount
                        </Text>
                      </InlineStack>
                      {loaderData.hasDiscount && (
                        <Badge tone="success">Active</Badge>
                      )}
                    </InlineStack>

                    <Text variant="bodyMd" as="p" tone="subdued">
                      Create or edit your automatic discount function that will apply to your store based on the configured settings.
                    </Text>

                    <div>
                      <Button
                        variant="primary"
                        onClick={() => navigate("/app/discount")}
                        fullWidth
                      >
                        {loaderData.hasDiscount ? "Edit Discount" : "Create Discount"}
                      </Button>
                    </div>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>


          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
