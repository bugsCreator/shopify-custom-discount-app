import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";

import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (!url.searchParams.get("shop")) {
    url.searchParams.set("shop", "proveway-3.myshopify.com");
    return Response.redirect(url.toString());
  }

  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded>
      <PolarisAppProvider i18n={polarisTranslations}>
        <s-page>
          <Form method="post">
            <s-section heading="Log in">
              <s-text-field
                name="shop"
                label="Shop domain"
                details="example.myshopify.com"
                value={shop}
                onChange={(e) => setShop(e.currentTarget.value)}
                autocomplete="on"
                error={errors.shop}
              ></s-text-field>
              <s-button type="submit">Log in</s-button>
            </s-section>
          </Form>
        </s-page>
      </PolarisAppProvider>
    </AppProvider>
  );
}
