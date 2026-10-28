# MOIN QURAN BOX — Actual GitHub repository repair and Firebase Realtime Database integration

This package is based on the **shopping-website-main.zip** you uploaded. It keeps the existing v19 store's `index.html`, styling, 10+ JSON products, navigation, product details, customer dialogs, management dashboard, catalog and shipping forms. It adds secure Firebase Realtime Database connections to the EXISTING store (not the separate test page).

## Before uploading: protect real customers and existing data

1. Back up your current GitHub repository and Firebase **Realtime Database → Data → Export JSON**. If you have products only in an older browser's local storage, keep that browser and make a local backup; the new admin page offers a separate **Import old browser products** action.
2. Do **not** put a service-account key, legacy database secret, or admin password into GitHub. The web `apiKey` is an identifier, not administrator authorization.
3. The legacy v19 script had hardcoded staff passwords and customer browser-local accounts. **Those old accounts are disabled**. Customers must register/sign in using Firebase Authentication Email/Password. The owner signs in using the existing Firebase account you already created; `/admins/<your UID> = true` must remain in the database.
4. **Replace the current Realtime Database rules** with the supplied `database.rules.json` (see the steps below). Your current admin-only root rules block public catalog reads and customer records, so uploading website files alone is not enough.
5. Launch to a **test copy** of the repository first if customers currently use your live site. Test on mobile and desktop, then deploy to the main site.

## A. Set up Firebase rules (required before the integrated site works)

Firebase Console → `moin-quran-box` → **Realtime Database** → **Rules**. Back up the current rule text. Copy the ENTIRE contents of `database.rules.json`, paste and **Publish**. Unlike the original broad admin rule, these grant **public read access only to `/catalog` and `/publicSettings`**, allow admin-only changes to shared business records, and keep private customer data scoped to each Firebase account.

**Do not publish** if the `admins` record is missing or if the Rules Playground denies your admin UID at `/admins/<your UID>`. The app does not grant or assign administrator privileges; only the data you already configured in the Firebase Console does.

Test in Rules Playground:

| Operation | User | Location | Expected |
| --- | --- | --- | --- |
| get | Not signed in | `/catalog` | Allowed |
| get | Not signed in | `/orderRequests` | Denied |
| get | Your authenticated UID | `/admins/<your UID>` | Allowed |
| set | Not signed in | `/catalog/product-1` | Denied |
| get | Another customer UID | `/customerProfiles/<someone else UID>` | Denied |

Do not allow all visitors `.write` access to any business or customer data.

## B. Deploy the files

Your uploaded repository has its GitHub Pages entry point at its root (`index.html`). **Extract the ZIP. Upload the contents of the `shopping-website-main` directory**, preserving the `css/`, `js/`, `data/`, `tests/` and root HTML files. Do **not** upload the ZIP as a single file. Make sure `js/firebase-live.js` is uploaded — the old `js/app.js` alone does not perform cloud syncing.

In GitHub: Repository → **Add file → Upload files** → commit. If GitHub Pages is set to deploy from the root of `main`, it publishes after a successful Pages build. Check **Settings → Pages** to confirm your actual published folder and **Actions** for deployment status. Then hard-refresh the site (`Ctrl+Shift+R`).

Do not mix `app.js` from other versions with this package.

## C. First owner login and product setup

1. On the site click **Staff Portal**, then sign in using your **Firebase account email and strong password**. The old 4-digit PINs will not work.
2. Firebase checks your UID at `/admins/<UID>`. A verified owner receives the full owner/developer dashboard (single account).
3. The lower-left owner controls can **Import missing JSON products** from `data/products.json`, or **Import old browser products** from that same device's old browser cache. Neither action overwrites an existing catalog entry. Verify prices, photos and stock BEFORE taking customer requests.
4. Existing products in `/catalog` (possibly added through the separate Firebase test page) display automatically. Products not yet published are shown as **preview only** and cannot be ordered.
5. Owner catalog changes save directly to Firebase and appear on open mobile/desktop pages via Realtime Database listeners. Images must be publicly accessible HTTPS URLs; Firebase Storage direct uploads require a separate implementation.

## D. Test as a customer

1. Sign out of the owner account. Register a **separate test customer** with an email and strong password. The owner and customer use separate Firebase users.
2. Save a product into the cart, sign in on a second device with that same test customer account, and verify cart updates. Switching to a DIFFERENT customer account must NOT show the previous account's cart or order history.
3. Complete the delivery address and submit an order **request**. The record appears under `/orderRequests/<customer UID>/...` and can be seen by the verified owner. It is NOT paid, and no courier is booked automatically.
4. Test the owner order status controls and repeat on mobile. Check real-time updates and the banner showing any permission or connection errors.

## Actual scope of this repair

**Cloud-connected:** published product catalog, public storefront settings, owner settings/coupons, customer login and registration, account-scoped carts/wishlists, customer profiles, unverified order requests and owner status updates, sales dashboard reset baseline (historic requests retained), and tested Super Admin verification logic.

**Intentionally not activated as paid production operations:** online payment collection, trusted server-side checkout/stock reservation, automated courier booking and live AWB tracking, instant customer invoice issuance, staff password resets, direct image upload to Firebase Storage, and final POS payment capture. These need dedicated server-side functions and provider credentials. The existing UI for some legacy expert/marketing modules is retained, but do not assume those modules provide cloud functionality until they are individually verified.

**The customer-provided source contained demo product images/prices.** Verify all before publishing them. The public cloud catalog is empty until you add a product or import. A test item you created earlier under `/catalog` might already be visible.

## Debugging

- **Items appear but Add to Cart is disabled:** no published `/catalog` record was received, or Realtime Database rules are still locked. Owner must import/verify catalog.
- **"Permission denied" on customer registration or orders:** publish `database.rules.json`; check Firebase Authentication → Email/Password is enabled and registered GitHub Pages domain is authorized.
- **Owner login rejected:** ensure you're using the Firebase Authentication email (not `Admin` and not a PIN) and `/admins/<UID>` is Boolean `true`.
- **No live Firebase connection:** check browser DevTools Console/Network for blocked `www.gstatic.com` SDK scripts; this site depends on Google Firebase web SDK loading.
- **Mobile shows older code:** perform a hard refresh; make sure GitHub Pages deployed the current commit.
- **Data not migrated automatically:** no Firebase script can read localStorage from a different user's phone. Import old browser products explicitly from the browser where they were stored; do not upload old plaintext password exports.

## Local code checks

From the project directory, with Node.js installed (no npm dependencies needed):

```bash
node tests/check.js
node tests/flows.js
```

These are static and MOCK database flow checks; they do **not** replace testing the real Firebase permissions, mobile sync, or end-to-end checkout in production.
