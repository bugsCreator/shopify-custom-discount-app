import { useEffect } from "react";
import { useFetcher, useLoaderData, redirect } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        name
        email
        myshopifyDomain
        url
        plan {
          displayName
          partnerDevelopment
          shopifyPlus
        }
      }
    }`
  );

  const responseJson = await response.json();

  return redirect(`/app/volume-discount/bb2f00de-e779-90e3-7141-d67d5d765661b27f22c4/new`);
};

export const action = async ({ request }) => {
  return null;
};

export default function Index() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
