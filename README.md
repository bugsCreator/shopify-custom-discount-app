# Shopify Volume Discount App

A complete Shopify app that enables merchants to create volume-based discounts (e.g., "Buy 2, get 10% off") with automatic application at checkout and promotional widget display on the storefront.

## 🎯 Features

- **Automatic Volume Discounts**: Discounts automatically apply when customers meet quantity thresholds
- **Product-Specific Rules**: Target specific products for discount eligibility
- **Promotional Widget**: Display eligible products and discount information on your theme
- **Easy Management**: Intuitive admin interface to create and edit discounts
- **Real-time Updates**: Changes to discount rules are immediately reflected
- **Multi-Product Support**: Select multiple products for the same discount rule

## 📋 Prerequisites

- Node.js >= 20.19 < 22 OR >= 22.12
- npm or pnpm package manager
- Shopify Partner account
- Development store or Shopify store with app development enabled
- Shopify CLI installed globally:
  ```bash
  npm install -g @shopify/cli @shopify/app
  ```

## 🚀 Installation & Setup

### 1. Clone & Install Dependencies

```bash
cd discount-app
npm install
```

### 2. Connect to Shopify

Link your app to a Shopify Partner organization and store:

```bash
npm run config:link
```

Follow the prompts to:
- Select your Partner organization
- Choose or create a development store
- Name your app

### 3. Environment Variables

Create/verify your `.env` file with:

```env
SHOPIFY_API_KEY=<your-api-key>
SHOPIFY_API_SECRET=<your-api-secret>
SCOPES=write_discounts,read_products
SHOPIFY_APP_URL=<your-app-url>
```

### 4. Database Setup

Initialize the Prisma database:

```bash
npm run setup
```

This runs:
- `prisma generate` - Generates Prisma client
- `prisma migrate deploy` - Applies database migrations

### 5. Build & Deploy Extensions

The app includes two extensions that need to be deployed:

#### a. Discount Function Extension

```bash
cd extensions/discount-extension
npm run build
cd ../..
shopify app deploy
```

This deploys the discount logic that runs on Shopify's backend.

#### b. Theme Widget Extension

The volume discount widget is automatically included in the deployment.

After deployment, Shopify will provide you with a **Function ID** - save this for the next step!

### 6. Run Development Server

```bash
npm run dev
```

This starts:
- React Router dev server
- Shopify app tunnel
- Hot module reloading

The CLI will provide a URL to install your app on the development store.

## ⚙️ Configuration

### Step 1: Configure Function ID

1. Install the app on your store
2. Navigate to **Settings** page
3. Copy your deployed Function ID (from Step 5 above)
4. Paste it in the "Function ID" field
5. Click **Save Function ID**

**This will automatically:**
- Save the Function ID to your shop
- Create a default discount named "Buy N, get X% off"
- Set initial values (Buy 2, get 10% off, no products selected)

### Step 2: Configure Your Discount

1. Click **"Create Discount"** button or navigate to **Discount** page
2. Fill in discount details:
   - **Discount Title**: Display name in Shopify admin
   - **Minimum Quantity**: How many items needed for discount (default: 2)
   - **Discount Percentage**: Percentage off (1-80%)
   - **Target Products**: Select which products qualify

3. Click **"Select Products"** to choose eligible products
4. Click **"Update Discount"** or **"Create Discount"** to save

### Step 3: Enable Theme Widget

1. Go to your Shopify Admin → **Online Store** → **Themes**
2. Click **"Customize"** on your active theme
3. Navigate to the page where you want the discount banner
4. Click **"Add section"**
5. Find **"Volume Discount Banner"** under **Apps**
6. Add and position the section
7. **Save** your theme

## 📂 Project Structure

```
discount-app/
├── app/                          # Main application code
│   ├── routes/                   # Route handlers
│   │   ├── app._index.jsx       # Dashboard/Home page
│   │   ├── app.discount.jsx     # Discount create/edit page
│   │   ├── app.settings.jsx     # Settings & function configuration
│   │   └── auth.*.jsx           # Authentication routes
│   ├── utils/                    # Utility functions
│   │   └── discount.server.js   # Discount GraphQL operations
│   ├── db.server.js             # Prisma database client
│   └── shopify.server.js        # Shopify app configuration
│
├── extensions/                   # Shopify extensions
│   ├── discount-extension/      # Discount function (backend logic)
│   │   ├── src/
│   │   │   ├── run.js           # Main discount logic
│   │   │   └── run.graphql      # GraphQL query for cart data
│   │   └── shopify.extension.toml
│   │
│   └── volume-discount-widget/  # Theme widget (frontend display)
│       ├── blocks/
│       │   └── discount-widget.liquid
│       └── shopify.extension.toml
│
├── prisma/                       # Database schema
│   └── schema.prisma
│
├── vite.config.js               # Vite configuration
└── package.json                 # Dependencies & scripts
```

## 🔧 How It Works

### Architecture Overview

```
┌─────────────────┐
│  Admin Panel    │ → Configures discount rules
│  (React App)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Shop Metafields (volume_discount)      │
│  ├── function_id: Function ID           │
│  └── rules: {products, minQty, percentOff}│
└────────┬────────────────────────────────┘
         │
         ├──────────────────┬─────────────────┐
         ▼                  ▼                 ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────┐
│ Discount Node   │  │   Discount   │  │   Theme     │
│   Metafield     │  │   Function   │  │   Widget    │
│ (for editing)   │  │  (applies    │  │  (displays  │
│                 │  │  discount)   │  │  promo)     │
└─────────────────┘  └──────────────┘  └─────────────┘
```

### Data Flow

1. **Admin creates/edits discount** → saves to:
   - Discount Node metafield (`$app:volume-discount.function-configuration`)
   - Shop metafield (`volume_discount.rules`)

2. **Customer adds items to cart** → Discount Function:
   - Reads shop metafield (`volume_discount.rules`)
   - Checks cart items against eligible products
   - Applies discount if quantity threshold met

3. **Customer views storefront** → Theme Widget:
   - Reads shop metafield (`volume_discount.rules`)
   - Displays promotional banner with eligible products

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Shopify CLI |
| `npm run build` | Build production bundle |
| `npm run deploy` | Deploy app to Shopify |
| `npm run vite` | Run Vite dev server only |
| `npm run setup` | Run Prisma migrations |
| `npm run typecheck` | Type check with TypeScript |

## 📊 Metafield Structure

### Shop Metafield: `volume_discount.rules`
Used by: Discount Function & Theme Widget

```json
{
  "products": [
    {
      "id": "gid://shopify/Product/123",
      "title": "Product Name",
      "handle": "product-handle",
      "image": "https://cdn.shopify.com/..."
    }
  ],
  "minQty": 2,
  "percentOff": 10
}
```

### Discount Node Metafield: `$app:volume-discount.function-configuration`
Used by: Admin app for editing

```json
{
  "quantity": 2,
  "percentage": 10,
  "productIds": ["gid://shopify/Product/123"]
}
```

## 🐛 Troubleshooting

### Discount not applying at checkout

1. **Verify Function is deployed:**
   ```bash
   shopify app deploy
   ```

2. **Check Function ID is saved:**
   - Go to Settings page
   - Ensure Function ID field is filled
   - Click "Save Function ID"

3. **Verify discount is active:**
   - Go to Shopify Admin → Discounts
   - Check if discount status is "Active"

4. **Test with correct products:**
   - Ensure cart contains products selected in discount configuration
   - Meet minimum quantity threshold

### Widget not showing on theme

1. **Check widget is added to theme:**
   - Theme Customizer → Add Section → Volume Discount Banner

2. **Verify products are configured:**
   - At least one product must be selected in discount configuration

3. **Clear cache and reload**

### Products not displaying in widget

- Ensure you've updated/saved the discount after fixing the code
- Check browser console for image loading errors
- Verify `shop.metafield.volume_discount.rules` has `image` URLs

### App installation fails

1. **Check Scopes:**
   - `.env` must include `write_discounts,read_products`

2. **Reinstall app:**
   ```bash
   shopify app dev --reset
   ```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | App API key from Partner Dashboard | Yes |
| `SHOPIFY_API_SECRET` | App API secret | Yes |
| `SCOPES` | Required: `write_discounts,read_products` | Yes |
| `SHOPIFY_APP_URL` | App URL (auto-generated in dev) | Yes |
| `DATABASE_URL` | PostgreSQL connection (auto-generated) | Yes |

## 🔐 Required Shopify Scopes

- `write_discounts` - Create and manage discount codes
- `read_products` - Read product information for selection

## 🚢 Production Deployment

### 1. Build the app
```bash
npm run build
```

### 2. Deploy extensions
```bash
shopify app deploy
```

### 3. Submit for review
- Go to Shopify Partner Dashboard
- Select your app
- Submit for app store review (if publishing publicly)

### 4. Host your app
Host the built app on:
- Fly.io (recommended by Shopify)
- Heroku
- Vercel
- Custom server with Node.js

Configure production environment variables on your hosting platform.

## 📖 Additional Resources

- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [Shopify Functions Guide](https://shopify.dev/docs/apps/build/functions)
- [Discount Functions API](https://shopify.dev/docs/api/functions/reference/product-discounts)
- [Theme App Extensions](https://shopify.dev/docs/apps/build/online-store)

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

Created by hp

---

**Need Help?** Check the troubleshooting section above or refer to Shopify's documentation.
