# Source-specific bug fix report

Source provided: `shopping-website-main.zip` (older v19 GitHub Pages site).

| Problem | What changed |
|---|---|
| `Save & Sync Now` merely stored URL/key in localStorage | Removed secret/key input; added Firebase authenticated connection status. |
| `Test Ping` used unauthenticated fetch and falsely implied the database worked | Replaced with authenticated owner UID/admin-record check. |
| Store products lived in static JSON / localStorage only | Added real-time `/catalog` listener. Explicit owner import; no destructive automatic overwrite. |
| Plaintext staff passwords and demo account | Removed from shipped script; old local account authentication retired. |
| Customer account data cached together on one device | Firebase-authenticated user profiles, orders, wishlists and carts now use `/customerProfiles/$uid`, `/orderRequests/$uid`, `/customerWishlists/$uid`, `/customerCarts/$uid`. |
| Wishlist onclick handler missing | Implemented account-specific toggleWishlist. |
| Store promised paid orders without a real payment service | Converts to explicitly unverified order *requests*. No stock deduction or paid invoice. |
| Local-only product edits | Owner-edited products are acknowledged by Firebase before the UI reports success. |
| Unverified POS sales | Unsafe finalization disabled pending server-side transaction/stock/payment integration. |
| Customer phone-only invoice lookup | Disabled pending verified invoices with authenticated customer access. |
| Sales reset deleted historical orders | Replaced with Firebase owner-only dashboard baseline timestamp (retains requests). |
| API gateway secrets entered in frontend | Disabled frontend secret storage; requires trusted backend. |
| GitHub Pages rules mismatch | Added `database.rules.json` implementing public catalog + private customer account scopes. |

**Not claimed:** This package is not a fully tested payment-processing system, carrier integration, end-to-end production application, or audited financial ledger. It is a significant verified-code repair to the uploaded static app with a limited secure cloud data model; real Firebase behavior requires deployment and live testing.
