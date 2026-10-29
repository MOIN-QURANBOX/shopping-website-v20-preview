/**
 * MOIN QURAN BOX - Multi-Branch Enterprise Controller v19.0 Professional Edition
 * Supreme Developer Admin Control, Automated CRM 360, & Full Expert Tool Suite
 */

const STORAGE_PREFIX = "mqb_v19_";
const KEY_CONFIG = STORAGE_PREFIX + "config";
const KEY_PRODUCTS = STORAGE_PREFIX + "products";
const KEY_USERS = STORAGE_PREFIX + "users";
const KEY_ORDERS = STORAGE_PREFIX + "orders";
const KEY_COUPONS = STORAGE_PREFIX + "coupons";
const KEY_CART = STORAGE_PREFIX + "cart";
const KEY_WISHLIST = STORAGE_PREFIX + "wishlist";
const KEY_SESSION = STORAGE_PREFIX + "session";
const KEY_AUDIT = STORAGE_PREFIX + "audit_logs";
const KEY_FIREBASE = STORAGE_PREFIX + "firebase_sync";

// State Configuration
let config = {};
let products = [];
let users = [];
let orders = [];
let coupons = [];
let cart = [];
let wishlist = [];
let compareList = [];
let recentlyViewed = [];
let auditLogs = [];
let firebaseSyncConfig = { url: "", key: "" };
let currentCurrency = { code: "INR", symbol: "₹", rate: 1 };
let currentUser = null;
let currentCategory = "All";
let posTicket = [];
let sessionTimerInterval = null;

// Default Admin Feature Controls
const DEFAULT_TOGGLES = {
  customerWishlist: true,
  customerWallet: true,
  customerSupportTickets: true,
  customerVouchers: true,
  customerReorder: true,
  customerWarranty: true,
  customerStatements: true,
  ownerInventoryEdit: true,
  ownerBranchEdit: true,
  ownerPosAccess: true,
  quickViewShopping: true,
  expressCheckout: true,
  compareTool: true,
  prayerTimes: true,
  currencyConverter: true,
  giftQuiz: true,
  flashDeals: true,
  wholesaleCalculator: true,
  wallpapers: true,
  pincodeChecker: true,
  autoStockAlerts: true,
  abandonedCartRecovery: true,
  aiSmartUpsell: true,
  loyaltyRewards: true,
  waDispatchSync: true,
  codFraudShield: true,
  seasonalAutoTheme: true,
  geofenceDelivery: true,
  staffAuditMode: true,
  b2bWholesalePortal: true
};

window.addEventListener("DOMContentLoaded", async () => {
  await loadInitialData();
  renderCategoryChips();
  renderProducts();
  renderBranchesOnStorefront();
  updateCartUI();
  syncLiveCmsUI();
  syncCustomerHeaderUI();
  checkWelcomeGreetingBanner();
  validateSessionPersistence();
  renderRecentlyViewed();
  window.mqbLive?.start?.();
});

// ==========================================
// 1. DATA INITIALIZATION & PERSISTENCE
// ==========================================
async function loadInitialData() {
  const savedConfig = localStorage.getItem(KEY_CONFIG);
  if (savedConfig) {
    config = JSON.parse(savedConfig);
  } else {
    try {
      const res = await fetch("data/config.json");
      config = await res.json();
    } catch {
      config = {
        brandName: "MOIN QURAN BOX",
        proprietor: "Shaik Moin Uddin & Shaik Muneer Uddin",
        address: "Madina Colony, Falaknuma, Hyderabad, Telangana 500053",
        phone1: "7893961313",
        phone2: "7337464501",
        whatsappPhone: "7337464501",
        ownerEmail: "moinquranbox@gmail.com",
        gst: "TEL-HYD-500053",
        upiId: "7337464501@ybl",
        merchantName: "MOIN QURAN BOX",
        bankName: "State Bank of India",
        accountNum: "392810482910",
        ifsc: "SBIN0020145",
        announcement: "Holy Quran Direct Manufacturer • Free Packaging Across Hyderabad • COD & Instant UPI Available",
        featureToggles: { ...DEFAULT_TOGGLES },
        autoSync: true,
        maintenanceMode: false,
        surgePricing: false,
        expressRouting: false,
        apiGateway: { whatsappWebhook: "", smsApiKey: "" },
        seo: {
          metaTitle: "MOIN QURAN BOX | Luxury Islamic Store & Manufacturer Hyderabad",
          metaDesc: "Direct manufacturer wholesale Holy Quran, velvet boxes, Rehal and Islamic essentials.",
          keywords: "quran, quran box, rehal, hyderabad, islamic store"
        },
        branches: [
          { id: "branch-1", name: "Falaknuma Head Showroom", address: "Madina Colony, Near Engine Bowli, Falaknuma, Hyderabad, Telangana 500053", phone: "7893961313", manager: "Shaik Moin Uddin & Shaik Muneer Uddin", enabled: true }
        ]
      };
    }
  }

  config.branches = [
    { id: "branch-1", name: "Falaknuma Head Showroom", address: "Madina Colony, Near Engine Bowli, Falaknuma, Hyderabad, Telangana 500053", phone: "7893961313", manager: "Shaik Moin Uddin & Shaik Muneer Uddin", enabled: true }
  ];

  if (!config.featureToggles) config.featureToggles = { ...DEFAULT_TOGGLES };
  else config.featureToggles = { ...DEFAULT_TOGGLES, ...config.featureToggles };

  localStorage.setItem(KEY_CONFIG, JSON.stringify(config));

  const savedProducts = localStorage.getItem(KEY_PRODUCTS);
  if (savedProducts) {
    products = JSON.parse(savedProducts);
  } else {
    try {
      const res = await fetch("data/products.json");
      products = await res.json();
    } catch {
      products = [];
    }
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  }

  // IMPORTANT: v19 local-password accounts have been retired.
  // Firebase Authentication now owns identities; no admin password is shipped in JS.
  users = [];

  orders = []; // Cloud order requests load only after Firebase identity verification.
  coupons = JSON.parse(localStorage.getItem(KEY_COUPONS)) || [
    { code: "RAMADAN50", discount: 50, type: "flat", minOrder: 500 },
    { code: "BARAKAH10", discount: 10, type: "percent", minOrder: 1000 }
  ];

  auditLogs = [
    { timestamp: new Date().toLocaleString(), event: "System Initialized", user: "System", type: "system" }
  ];

  // The old "secret/API key" popup stored credentials in localStorage.
  // It is no longer used. Remove the stale value so it cannot be reused.
  localStorage.removeItem(KEY_FIREBASE);
  localStorage.removeItem(KEY_SESSION);
  localStorage.removeItem(KEY_USERS);
  localStorage.removeItem(KEY_ORDERS);

  cart = JSON.parse(localStorage.getItem("mqb_v20_guest_cart") || "[]");
  wishlist = JSON.parse(localStorage.getItem("mqb_v20_guest_wishlist") || "[]");
  persist();
}

function ensureUserExists(){ /* Legacy browser-password accounts retired. */ }

function persist() {
  localStorage.setItem(KEY_CONFIG, JSON.stringify(config));
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  // Never persist Firebase user accounts/passwords in browser-local JSON.
  // Never persist customer order records globally in shared browser storage.
  localStorage.setItem(KEY_COUPONS, JSON.stringify(coupons));
  // No cross-account cart: Firebase user's cart is saved only in /customerCarts/<uid>.
  if (!window.mqbLive?.uid) {
    localStorage.setItem("mqb_v20_guest_cart", JSON.stringify(cart));
    localStorage.setItem("mqb_v20_guest_wishlist", JSON.stringify(wishlist));
  }
  // Legacy audit history stays session-local; cloud audit requires a trusted backend.
  window.mqbLive?.maybePersistSettings?.();
}

function logAuditEvent(event, user = "System", type = "general") {
  auditLogs.unshift({
    timestamp: new Date().toLocaleString(),
    event,
    user,
    type
  });
  if (auditLogs.length > 50) auditLogs.pop();
  persist();
}

// ==========================================
// 2. CURRENCY & SESSION MANAGEMENT
// ==========================================
function formatPrice(priceInInr) {
  const converted = Math.round(priceInInr * currentCurrency.rate);
  return `${currentCurrency.symbol}${converted.toLocaleString()}`;
}

function setCurrency(code, symbol, rate) {
  currentCurrency = { code, symbol, rate };
  const badge = document.getElementById("activeCurrencyBadge");
  if (badge) badge.textContent = `${code} (${symbol})`;
  closeCurrencyModal();
  renderProducts();
  updateCartUI();
}

function validateSessionPersistence(){ /* Firebase Auth owns sessions. */ }

function startSessionCountdownTimer(){ /* Firebase Auth owns sessions. */ }

function logoutCurrentUser(){ alert("Secure Firebase login is unavailable. Refresh the website."); }

function autoScrollTo(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
function scrollToProducts() { autoScrollTo("catalogTopAnchor"); }
function scrollToContact() { autoScrollTo("contactSectionAnchor"); }

function checkWelcomeGreetingBanner() {
  const dismissed = sessionStorage.getItem("mqb_greeting_dismissed");
  const el = document.getElementById("welcomeGreetingBanner");
  if (!dismissed && el) {
    el.classList.remove("hidden");
    const msg = document.getElementById("welcomeGreetingText");
    if (msg) msg.textContent = config.welcomeGreeting || "Assalamu Alaikum! Welcome to MOIN QURAN BOX.";
  }
}
function dismissGreetingBanner() {
  sessionStorage.setItem("mqb_greeting_dismissed", "true");
  document.getElementById("welcomeGreetingBanner")?.classList.add("hidden");
}

function handleSendMessageToOwner(e) {
  e.preventDefault();
  const name = document.getElementById("msgCustName")?.value.trim() || "";
  const phone = document.getElementById("msgCustPhone")?.value.trim() || "";
  const subject = document.getElementById("msgCustSubject")?.value.trim() || "";
  const message = document.getElementById("msgCustMessage")?.value.trim() || "";
  const channel = document.querySelector('input[name="msgChannel"]:checked')?.value || "whatsapp";

  const formattedMsg = `*NEW WEBSITE INQUIRY — ${config.brandName}*\n\n` +
    `*From:* ${name}\n` +
    `*Phone:* ${phone}\n` +
    `*Subject:* ${subject}\n\n` +
    `*Message:* ${message}`;

  if (channel === "whatsapp") {
    window.open(`https://wa.me/91${config.whatsappPhone}?text=${encodeURIComponent(formattedMsg)}`, "_blank");
  } else {
    window.location.href = `mailto:${encodeURIComponent(config.ownerEmail)}?subject=${encodeURIComponent("Website Inquiry: " + subject)}&body=${encodeURIComponent(formattedMsg)}`;
  }

  alert("Inquiry prepared! Transferring to your selected channel.");
  document.getElementById("custMessageForm")?.reset();
}

// ==========================================
// 3. STOREFRONT & PRODUCTS RENDERERS
// ==========================================
const CATEGORIES = ["All", "Tarjuma Qurans", "Quran Boxes & Rehal", "Janamaz", "Hajj & Umrah", "Namaz Caps & Tasbih"];
function storeCategories() {
  const extras=Array.isArray(config.customCategories)?config.customCategories:[];
  const used=products.map(p=>p.category).filter(Boolean);
  return [...new Set([...CATEGORIES, ...extras, ...used].filter(x=>typeof x==='string' && x.trim()))];
}
function renderCategoryChips() {
  const container=document.getElementById('categoryChips');if(!container)return;
  container.replaceChildren();
  for(const cat of storeCategories()) {
    const b=document.createElement('button');
    b.type='button'; b.textContent=cat;
    b.className='px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition '+
      (currentCategory===cat?'bg-brand-charcoal text-white shadow':'bg-white text-brand-charcoal border border-brand-border hover:bg-neutral-100');
    b.addEventListener('click',()=>filterCategory(cat));container.appendChild(b);
  }
}
function refreshProductCategoryOptions(selected) {
  const select=document.getElementById('editProductCategory');if(!select)return;
  const value=selected ?? select.value;
  select.replaceChildren();
  for(const cat of storeCategories().filter(c=>c!=='All')){
    const option=document.createElement('option');option.value=cat;option.textContent=cat;select.appendChild(option);
  }
  if(value && ![...select.options].some(o=>o.value===value)){
    const opt=new Option(value,value);select.add(opt);
  }
  if(value)select.value=value;
}

function filterCategory(cat) {
  currentCategory = cat;
  const heading = document.getElementById("currentCategoryHeading");
  if (heading) heading.textContent = cat === "All" ? "Our Bestsellers" : cat;
  renderCategoryChips();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const inStockOnly = document.getElementById("filterInStockOnly")?.checked;
  const sort = document.getElementById("filterSortOrder")?.value || "featured";

  let list = currentCategory === "All" ? [...products] : products.filter(p => p.category === currentCategory);
  if (inStockOnly) list = list.filter(p => p.stock > 0);

  if (sort === "low-to-high") list.sort((a, b) => a.salePrice - b.salePrice);
  else if (sort === "high-to-low") list.sort((a, b) => b.salePrice - a.salePrice);

  const canWishlist = config.featureToggles?.customerWishlist;
  const canQuickView = config.featureToggles?.quickViewShopping;
  const canCompare = config.featureToggles?.compareTool;
  const canExpress = config.featureToggles?.expressCheckout;

  grid.innerHTML = list.map(p => {
    const effectivePrice = p.salePrice; // Display the authoritative published price only.

    return `
      <div onclick="trackRecentlyViewed('${p.id}')" class="bg-white rounded-xl border border-brand-border overflow-hidden flex flex-col justify-between hover:shadow-md transition cursor-pointer">
        <div class="relative bg-neutral-100 pt-[100%] overflow-hidden group">
          <img src="${p.image}" alt="${p.title}" class="absolute inset-0 w-full h-full object-cover" />
          
          ${canWishlist ? `
            <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" class="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-xs hover:scale-110 transition shadow z-10">
              ${wishlist.includes(p.id) ? '❤️' : '🤍'}
            </button>
          ` : ''}
          
          ${canQuickView ? `
            <button onclick="event.stopPropagation(); openQuickView('${p.id}')" class="absolute top-10 right-2 p-1.5 bg-white/90 rounded-full text-[10px] font-bold hover:scale-110 transition shadow z-10" title="Quick View">
              👁️
            </button>
          ` : ''}
          
          ${canCompare ? `
            <button onclick="event.stopPropagation(); toggleCompare('${p.id}')" class="absolute top-[68px] right-2 p-1.5 bg-white/90 rounded-full text-[10px] font-bold hover:scale-110 transition shadow z-10" title="Compare">
              ${compareList.includes(p.id) ? '⚖️✓' : '⚖️'}
            </button>
          ` : ''}
          
          ${p.stock <= 5 && p.stock > 0 ? `<span class="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase z-10">Only ${p.stock} left</span>` : ''}
          ${p.stock <= 0 ? `<span class="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase z-10">Out of Stock</span>` : ''}
        </div>
        
        <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <span class="text-[10px] text-amber-700 font-bold block">${p.category}</span>
            <h4 class="font-serif font-bold text-xs sm:text-sm text-brand-charcoal line-clamp-2 leading-snug">${p.title}</h4>
          </div>
          <div>
            <div class="flex items-baseline gap-2 mb-2">
              ${Number(p.oldPrice)>Number(p.salePrice) ? `<span class="text-xs line-through text-neutral-400">${formatPrice(p.oldPrice)}</span>` : ''}
              <span class="text-sm sm:text-base font-bold text-brand-charcoal">${formatPrice(effectivePrice)}</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <button onclick="event.stopPropagation(); addToCart('${p.id}')" ${p.stock <= 0 || !window.mqbLive?.catalogPublished ? 'disabled' : ''} class="w-full py-1.5 bg-brand-charcoal hover:bg-neutral-800 text-white rounded text-[11px] font-bold uppercase transition disabled:opacity-40">
                Add to Cart
              </button>
              ${canExpress ? `
                <button onclick="event.stopPropagation(); expressBuyNow('${p.id}')" ${p.stock <= 0 || !window.mqbLive?.catalogPublished ? 'disabled' : ''} class="w-full py-1.5 bg-brand-gold hover:bg-brand-goldHover text-white rounded text-[11px] font-bold uppercase transition disabled:opacity-40">
                  Buy Now
                </button>
              ` : `
                <a href="https://wa.me/91${config.whatsappPhone}?text=${encodeURIComponent(`Salam, I want to order: ${p.title}`)}" target="_blank" onclick="event.stopPropagation();" class="w-full py-1.5 bg-brand-whatsapp text-white rounded text-[11px] font-bold uppercase text-center flex items-center justify-center shadow">
                  WhatsApp
                </a>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function trackRecentlyViewed(prodId) {
  if (!recentlyViewed.includes(prodId)) {
    recentlyViewed.unshift(prodId);
    if (recentlyViewed.length > 4) recentlyViewed.pop();
    renderRecentlyViewed();
  }
}

function renderRecentlyViewed() {
  const sec = document.getElementById("recentlyViewedSection");
  const grid = document.getElementById("recentlyViewedGrid");
  if (!sec || !grid || recentlyViewed.length === 0) return;
  sec.classList.remove("hidden");
  grid.innerHTML = recentlyViewed.map(id => {
    const p = products.find(x => x.id === id);
    if (!p) return '';
    return `
      <div class="bg-white p-2 rounded-xl border flex items-center gap-2 cursor-pointer hover:bg-neutral-50" onclick="openQuickView('${p.id}')">
        <img src="${p.image}" class="w-10 h-10 object-cover rounded" />
        <div class="truncate">
          <p class="font-bold truncate text-xs text-brand-charcoal">${p.title}</p>
          <span class="text-[11px] text-brand-gold font-bold">${formatPrice(p.salePrice)}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 4. EASY SHOPPING MODALS
// ==========================================
function openQuickView(prodId) {
  if (!config.featureToggles?.quickViewShopping) return alert("Quick View is currently disabled by Admin.");
  const p = products.find(x => x.id === prodId);
  if (!p) return;
  const content = document.getElementById("quickViewContent");
  if (!content) return;
  content.innerHTML = `
    <div><img src="${p.image}" class="w-full h-64 object-cover rounded-xl border" /></div>
    <div class="space-y-3 flex flex-col justify-between">
      <div>
        <span class="text-[10px] uppercase font-bold text-brand-gold">${p.category}</span>
        <h3 class="serif-title text-base font-bold text-brand-charcoal mt-1">${p.title}</h3>
        <p class="text-lg font-mono font-bold text-brand-darkgreen mt-2">${formatPrice(p.salePrice)}</p>
        <p class="text-neutral-600 mt-2 text-xs leading-relaxed">${p.desc || 'Direct manufacturer quality from Hyderabad. Handcrafted with devotion.'}</p>
        <p class="text-[11px] font-bold text-emerald-700 mt-2">Stock Availability: ${p.stock} units</p>
      </div>
      <div class="flex gap-2 pt-3 border-t">
        <button onclick="addToCart('${p.id}'); closeQuickViewModal();" ${p.stock <= 0 ? 'disabled' : ''} class="flex-1 py-2.5 bg-brand-charcoal text-white rounded text-xs font-bold uppercase disabled:opacity-50">Add to Cart</button>
        <button onclick="closeQuickViewModal()" class="px-4 py-2 bg-neutral-100 rounded text-xs font-semibold">Close</button>
      </div>
    </div>
  `;
  document.getElementById("quickViewModal")?.classList.remove("hidden");
}
function closeQuickViewModal() { document.getElementById("quickViewModal")?.classList.add("hidden"); }

function expressBuyNow(prodId) {
  if (!config.featureToggles?.expressCheckout) return alert("Express Checkout is currently disabled by Admin.");
  addToCart(prodId);
  startCheckout();
}

function toggleCompare(prodId) {
  if (!config.featureToggles?.compareTool) return alert("Comparison tool is disabled.");
  if (compareList.includes(prodId)) compareList = compareList.filter(id => id !== prodId);
  else {
    if (compareList.length >= 2) return alert("You can compare a maximum of 2 products side-by-side.");
    compareList.push(prodId);
  }
  const el = document.getElementById("compareCount");
  if (el) el.textContent = compareList.length;
  renderProducts();
}

function openCompareDrawer() {
  if (!config.featureToggles?.compareTool) return alert("Comparison tool is disabled.");
  if (compareList.length === 0) return alert("Select products to compare by clicking the ⚖️ icon.");
  const container = document.getElementById("compareGridContainer");
  if (!container) return;
  container.innerHTML = compareList.map(id => {
    const p = products.find(x => x.id === id);
    if (!p) return '';
    return `
      <div class="p-3 bg-brand-sand rounded-xl border space-y-2 flex flex-col h-full">
        <img src="${p.image}" class="w-full h-32 object-cover rounded" />
        <span class="text-[9px] uppercase font-bold text-brand-gold">${p.category}</span>
        <h5 class="font-bold text-xs flex-grow">${p.title}</h5>
        <div class="pt-2 border-t border-brand-border/50">
          <p class="font-mono font-bold text-brand-darkgreen">${formatPrice(p.salePrice)}</p>
          <p class="text-[10px] text-neutral-600 mt-1">${p.desc || 'Premium Islamic item.'}</p>
        </div>
        <button onclick="addToCart('${p.id}')" class="w-full py-1.5 mt-2 bg-brand-charcoal text-white rounded text-[10px] font-bold uppercase">Add to Cart</button>
      </div>
    `;
  }).join("");
  document.getElementById("compareModal")?.classList.remove("hidden");
}
function closeCompareModal() { document.getElementById("compareModal")?.classList.add("hidden"); }

function openSearchModal() { document.getElementById("searchModal")?.classList.remove("hidden"); document.getElementById("searchInput")?.focus(); }
function closeSearchModal() { document.getElementById("searchModal")?.classList.add("hidden"); }
function liveSearch(q) {
  const box = document.getElementById("searchResults");
  if (!box) return;
  const query = q.trim().toLowerCase();
  if (!query) { box.innerHTML = ""; return; }
  box.innerHTML = products.filter(p => p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)).map(m => `
    <div onclick="openQuickView('${m.id}'); closeSearchModal();" class="p-2 flex justify-between items-center cursor-pointer hover:bg-brand-sand rounded">
      <span>${m.title}</span><span class="font-bold">${formatPrice(m.salePrice)}</span>
    </div>
  `).join("");
}

function renderBranchesOnStorefront() {
  const container = document.getElementById("storefrontBranchesContainer");
  if (!container || !config.branches || config.branches.length === 0) return;
  const b = config.branches[0];
  container.innerHTML = `
    <div class="bg-brand-sand/70 p-4 rounded-xl border border-brand-border space-y-1.5 text-xs">
      <h5 class="font-bold text-brand-charcoal flex items-center gap-1.5 text-sm"><span>📍</span> ${b.name}</h5>
      <p class="text-neutral-600 leading-snug">${b.address}</p>
      <p class="text-[11px] font-mono text-brand-muted">📞 +91 ${b.phone} • Proprietors: ${b.manager}</p>
      <div class="pt-2 flex gap-2">
        <a href="https://wa.me/91${b.phone}?text=${encodeURIComponent(`Salam, I have an inquiry for ${b.name}`)}" target="_blank" class="px-2.5 py-1.5 bg-brand-whatsapp text-white rounded text-[11px] font-bold inline-flex items-center gap-1">WhatsApp Showroom</a>
        <a href="tel:${b.phone}" class="px-2.5 py-1.5 bg-white border border-brand-border rounded text-[11px] font-semibold text-brand-charcoal">Call Showroom</a>
      </div>
    </div>
  `;
}

// ==========================================
// 5. CART & CHECKOUT
// ==========================================
function addToCart(prodId) {
  if (config.maintenanceMode) return alert("Store is currently in maintenance mode. Orders are paused.");
  const p = products.find(x => x.id === prodId);
  if (!p) return;
  const exist = cart.find(x => x.id === prodId);
  if (exist) exist.qty += 1;
  else cart.push({ id: p.id, title: p.title, salePrice: p.salePrice, image: p.image, qty: 1 });
  persist();
  updateCartUI();
  toggleCart(true);
}
function updateCartQty(prodId, delta) {
  const it = cart.find(x => x.id === prodId);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) cart = cart.filter(x => x.id !== prodId);
  persist();
  updateCartUI();
}
function updateCartUI() {
  const count = cart.reduce((s, it) => s + it.qty, 0);
  const total = cart.reduce((s, it) => s + (it.salePrice * it.qty), 0);
  const badge = document.getElementById("cartCountBadge");
  const subtotal = document.getElementById("cartSubtotal");
  if (badge) badge.textContent = count;
  if (subtotal) subtotal.textContent = formatPrice(total);

  const box = document.getElementById("cartContainer");
  if (!box) return;
  if (cart.length === 0) { box.innerHTML = `<div class="py-12 text-center text-xs text-brand-muted">Your shopping bag is empty.</div>`; return; }
  box.innerHTML = cart.map(it => `
    <div class="flex items-center gap-3 py-3 border-b border-brand-border">
      <img src="${it.image}" class="w-12 h-12 object-cover rounded border" />
      <div class="flex-1">
        <h5 class="font-bold text-xs text-brand-charcoal line-clamp-1">${it.title}</h5>
        <span class="text-xs text-brand-muted">${formatPrice(it.salePrice)}</span>
        <div class="flex items-center gap-2 mt-1">
          <button onclick="updateCartQty('${it.id}', -1)" class="w-5 h-5 bg-neutral-200 rounded font-bold text-xs">-</button>
          <span class="text-xs font-semibold">${it.qty}</span>
          <button onclick="updateCartQty('${it.id}', 1)" class="w-5 h-5 bg-neutral-200 rounded font-bold text-xs">+</button>
        </div>
      </div>
      <span class="font-bold text-xs font-mono">${formatPrice(it.salePrice * it.qty)}</span>
    </div>
  `).join("");
}

function toggleCart(show) {
  const drawer = document.getElementById("cartDrawer");
  const backdrop = document.getElementById("cartBackdrop");
  if (!drawer || !backdrop) return;
  if (show) {
    drawer.classList.remove("pointer-events-none", "translate-x-full");
    backdrop.classList.add("opacity-100");
  } else {
    drawer.classList.add("translate-x-full");
    backdrop.classList.remove("opacity-100");
    setTimeout(() => drawer.classList.add("pointer-events-none"), 300);
  }
}

function toggleDrawer(show) {
  const drawer = document.getElementById("drawerMenu");
  const backdrop = document.getElementById("drawerBackdrop");
  if (!drawer || !backdrop) return;
  if (show) {
    drawer.classList.remove("pointer-events-none", "-translate-x-full");
    backdrop.classList.add("opacity-100");
  } else {
    drawer.classList.add("-translate-x-full");
    backdrop.classList.remove("opacity-100");
    setTimeout(() => drawer.classList.add("pointer-events-none"), 300);
  }
}
function navigateDrawer(cat) { filterCategory(cat); toggleDrawer(false); scrollToProducts(); }

function startCheckout() {
  if (config.maintenanceMode) return alert("Store is currently in maintenance mode. Orders are paused.");
  if (cart.length === 0) return alert("Your cart is empty!");
  toggleCart(false);
  const total = cart.reduce((s, it) => s + (it.salePrice * it.qty), 0);
  const payEl = document.getElementById("checkoutTotalAmount");
  if (payEl) payEl.textContent = formatPrice(total);

  if (currentUser && currentUser.role === "customer") {
    const elN = document.getElementById("chkName");
    const elP = document.getElementById("chkPhone");
    const elE = document.getElementById("chkEmail");
    const elA = document.getElementById("chkAddress");
    if (elN) elN.value = currentUser.name || "";
    if (elP) elP.value = currentUser.phone || "";
    if (elE) elE.value = currentUser.email || "";
    if (elA && currentUser.addresses && currentUser.addresses.length > 0) elA.value = currentUser.addresses[0];
  }
  document.getElementById("checkoutModal")?.classList.remove("hidden");
}
function closeCheckoutModal() { document.getElementById("checkoutModal")?.classList.add("hidden"); }

function handlePlaceOrder(e){e.preventDefault();alert("Order requests require Firebase. No order was placed.");}
function closeSuccessModal() { document.getElementById("orderSuccessModal")?.classList.add("hidden"); }

// ==========================================
// 6. INVOICE LOOKUP & PRINTING
// ==========================================
function openInvoiceLookupModal() { document.getElementById("invoiceLookupModal")?.classList.remove("hidden"); }
function closeInvoiceLookupModal() { document.getElementById("invoiceLookupModal")?.classList.add("hidden"); }
function handlePublicInvoiceLookup(e){e.preventDefault();alert("Invoices require owner verification.");}
function prepareAndPrintInvoice(){alert("Invoices require owner verification.");}
function openTrackingModal() { document.getElementById("trackingModal")?.classList.remove("hidden"); }
function closeTrackingModal() { document.getElementById("trackingModal")?.classList.add("hidden"); }
function trackOrderById(){alert("Tracking is available after Firebase sign-in.");}

// ==========================================
// 7. CUSTOMER AUTHENTICATION & PORTAL
// ==========================================
function openCustomerAuthModal(tab = 'login') {
  document.getElementById("customerAuthModal")?.classList.remove("hidden");
  switchCustomerAuthTab(tab);
}
function closeCustomerAuthModal() { document.getElementById("customerAuthModal")?.classList.add("hidden"); }
function switchCustomerAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById("cxLoginForm")?.classList.toggle("hidden", !isLogin);
  document.getElementById("cxRegisterForm")?.classList.toggle("hidden", isLogin);
}
function handleCustomerLoginSubmit(e){e.preventDefault();alert("Secure Firebase login unavailable.");}
function handleCustomerRegisterSubmit(e){e.preventDefault();alert("Secure Firebase registration unavailable.");}

function openCustomerProfileModal() {
  if (!currentUser || currentUser.role !== "customer") return;
  document.getElementById("customerProfileModal")?.classList.remove("hidden");
  const elName = document.getElementById("custProfName");
  const elContact = document.getElementById("custProfContact");
  if (elName) elName.textContent = currentUser.name;
  if (elContact) elContact.textContent = `${currentUser.email || ''} • 📞 ${currentUser.phone}`;
  renderCustProfileOrders();
}
function closeCustomerProfileModal() { document.getElementById("customerProfileModal")?.classList.add("hidden"); }

function renderCustProfileOrders() {
  const myOrders = orders.filter(o => o.customerPhone === currentUser.phone);
  const container = document.getElementById("custOrderList");
  if (!container) return;
  container.innerHTML = myOrders.length === 0 ? `<p class="text-xs text-neutral-400 py-4 text-center">No past orders.</p>` : myOrders.map(o => `
    <div class="p-3 border rounded-lg bg-brand-sand/50 text-xs space-y-1 ${o.status === 'Cancelled' ? 'opacity-75' : ''}">
      <div class="flex justify-between items-center font-bold">
        <span>${o.orderId}</span>
        <span class="${o.status === 'Cancelled' ? 'text-red-600' : 'text-emerald-700'}">${o.status}</span>
      </div>
      <p class="text-neutral-600">${o.items.map(it => `${it.title} (x${it.qty})`).join(', ')}</p>
      <div class="flex flex-wrap justify-between items-center pt-2 border-t font-semibold gap-2">
        <span>Total: ${formatPrice(o.total)}</span>
        <div class="flex gap-3 items-center">
          ${o.status === 'Processing' ? `<button onclick="cancelCustomerOrder('${o.orderId}')" class="text-red-600 hover:underline font-bold text-[10px] uppercase border border-red-200 px-2 py-1 rounded">Cancel Order</button>` : ''}
          <button onclick="prepareAndPrintInvoice('${o.orderId}')" class="text-brand-gold hover:underline font-bold">Print Invoice</button>
        </div>
      </div>
    </div>
  `).join("");
}

function cancelCustomerOrder(orderId) {
  if (!confirm("Are you sure you want to cancel this order? This action cannot be reversed.")) return;
  const o = orders.find(x => x.orderId === orderId);
  if (o && o.status === 'Processing') {
    o.status = 'Cancelled';
    o.items.forEach(item => {
      const p = products.find(x => x.id === item.id);
      if (p) p.stock += item.qty;
    });
    persist();
    logAuditEvent(`Customer cancelled order: ${orderId}`, currentUser.name, "order");
    renderCustProfileOrders();
    alert(`Order ${orderId} has been successfully cancelled.`);
  }
}

function syncCustomerHeaderUI() {
  const badge = document.getElementById("customerStatusDot");
  const navText = document.getElementById("navAccountLabel");
  if (currentUser && currentUser.role === "customer") {
    badge?.classList.remove("hidden");
    if (navText) navText.textContent = `Hi, ${currentUser.name.split(' ')[0]}`;
  } else {
    badge?.classList.add("hidden");
    if (navText) navText.textContent = "Customer Login";
  }
}

function handleUserIconClick() {
  if (currentUser) {
    if (currentUser.role === "admin" || currentUser.role === "owner") openAdminDashboardModal();
    else openCustomerProfileModal();
  } else openCustomerAuthModal('login');
}

// ==========================================
// 8. STAFF PORTAL & MASTER DEVELOPER ADMIN
// ==========================================
function openAdminLoginModal() {
  document.getElementById("portalLoginError")?.classList.add("hidden");
  document.getElementById("portalLoginForm")?.reset();
  document.getElementById("adminLoginModal")?.classList.remove("hidden");
}
function closeAdminLoginModal() { document.getElementById("adminLoginModal")?.classList.add("hidden"); }

function handlePortalLogin(e){e.preventDefault();alert("Secure Firebase staff login unavailable.");}

function openAdminDashboardModal() {
  const modal = document.getElementById("adminDashboardModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  const badge = document.getElementById("portalRoleBadge");
  const isMasterAdmin = currentUser?.role === "admin";

  if (badge) {
    if (isMasterAdmin) badge.textContent = "Developer Master Admin • Supreme Control";
    else badge.textContent = "Head Showroom Owner • Operational Access";
  }

  document.getElementById("adminTabBtn-salesmodifier")?.classList.toggle("hidden", !isMasterAdmin);
  document.getElementById("adminTabBtn-cms")?.classList.toggle("hidden", !isMasterAdmin);
  document.getElementById("adminTabBtn-customers")?.classList.toggle("hidden", !isMasterAdmin);
  document.getElementById("adminTabBtn-features")?.classList.toggle("hidden", !isMasterAdmin);
  document.getElementById("adminTabBtn-expert")?.classList.toggle("hidden", !isMasterAdmin);

  renderAdminOrders();
  renderAdminInventory();
  renderPosCatalog();
  renderCouponsTable();
  renderBranchesInDashboard();
  renderAdminFeatureToggles();
  renderAdminCustomers();
  updateAnalytics();

  switchAdminTab('hub');
}
function closeAdminDashboardModal() { document.getElementById("adminDashboardModal")?.classList.add("hidden"); }

// Universal Search
function handleUniversalSearch(query) {
  const q = query.trim().toLowerCase();
  const box = document.getElementById("universalSearchResults");
  if (!box) return;
  if (!q) { box.innerHTML = ""; return; }

  const matchedCustomers = users.filter(u => 
    u.role !== "admin" && 
    (u.phone.includes(q) || (u.email && u.email.toLowerCase().includes(q)) || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
  );
  
  const matchedOrders = orders.filter(o => 
    o.orderId.toLowerCase().includes(q) || o.customerPhone.includes(q) || o.customerName.toLowerCase().includes(q)
  );

  box.innerHTML = `
    <div class="space-y-3 pt-2">
      ${matchedCustomers.length > 0 ? `
        <div>
          <h5 class="font-bold text-[11px] uppercase tracking-wider text-brand-charcoal mb-1">Matched Accounts (${matchedCustomers.length})</h5>
          ${matchedCustomers.map(c => `
            <div class="p-2.5 bg-brand-sand border rounded-lg mb-1.5 flex justify-between items-center cursor-pointer hover:bg-neutral-200 transition" onclick="openManageUserModal('${c.id}')">
              <div>
                <strong>${c.name}</strong> • ${c.phone}
                <span class="text-[9px] uppercase font-bold ml-1.5 px-1.5 py-0.5 rounded ${c.role === 'owner' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-700'}">${c.role}</span>
                ${c.isBlocked ? '<span class="text-[9px] bg-red-100 text-red-700 px-1 rounded ml-1 font-bold">BLOCKED</span>' : ''}
              </div>
              <span class="text-[10px] font-bold text-brand-darkgreen">Manage Account →</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${matchedOrders.length > 0 ? `
        <div>
          <h5 class="font-bold text-[11px] uppercase tracking-wider text-brand-charcoal mb-1">Matched Orders (${matchedOrders.length})</h5>
          ${matchedOrders.map(o => `
            <div class="p-2 bg-white border rounded-lg flex justify-between items-center mb-1">
              <span><strong>${o.orderId}</strong> - ${o.customerName} (${o.customerPhone})</span>
              <button onclick="prepareAndPrintInvoice('${o.orderId}')" class="px-2 py-1 bg-brand-sand rounded font-bold hover:bg-brand-gold hover:text-white transition">Print</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${matchedCustomers.length === 0 && matchedOrders.length === 0 ? `<p class="text-xs text-neutral-400 py-2">No matching accounts or orders found.</p>` : ''}
    </div>
  `;
}

// ==========================================
// 9. EXPERT ADMINISTRATIVE TOOLS & FIREBASE SYNC
// ==========================================
function openFirebaseSyncModal() {
  const elUrl = document.getElementById("cfgFirebaseUrl");
  const elKey = document.getElementById("cfgFirebaseKey");
  if (elUrl) elUrl.value = firebaseSyncConfig.url || "";
  if (elKey) elKey.value = firebaseSyncConfig.key || "";
  document.getElementById("firebaseSyncModal")?.classList.remove("hidden");
}
function closeFirebaseSyncModal() { document.getElementById("firebaseSyncModal")?.classList.add("hidden"); }

function saveFirebaseSyncConfig(){alert("Never paste Firebase secrets into a public website.");}

async function testFirebaseConnection(){alert("Firebase authentication is required.");}

function toggleAutoSync(){alert("Firebase synchronization is handled by secure listeners.");}

function exportToCSV(type) {
  let rows = [];
  if (type === 'sales') {
    rows.push(["OrderID", "Date", "Customer", "Phone", "Status", "Total", "Channel", "PaymentMethod"]);
    orders.forEach(o => {
      rows.push([o.orderId, o.date, o.customerName, o.customerPhone, o.status, o.total, o.channel || 'Online', o.paymentMethod || 'Online']);
    });
  } else if (type === 'users') {
    rows.push(["ID", "Name", "Role", "Phone", "Email", "Status"]);
    users.filter(u => u.role !== 'admin').forEach(u => {
      rows.push([u.id, u.name, u.role, u.phone, u.email || '', u.isBlocked ? 'Blocked' : 'Active']);
    });
  } else if (type === 'inventory') {
    rows.push(["ID", "SKU", "Title", "Category", "Stock", "SalePrice"]);
    products.forEach(p => {
      rows.push([p.id, p.sku || p.id, p.title, p.category, p.stock, p.salePrice]);
    });
  }

  const csvBody = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\n");
  const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvBody);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `moin_quranbox_${type}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  logAuditEvent(`Exported ${type} dataset to CSV`, currentUser?.username || 'Admin', "export");
}

function downloadSystemBackup(){alert("Firebase owner login required for export.");}

function openAuditLogsModal() {
  const container = document.getElementById("auditLogsContainer");
  if (!container) return;
  container.innerHTML = auditLogs.map(l => `
    <div class="p-2 bg-white rounded border flex justify-between items-center text-[10px]">
      <div>
        <span class="text-neutral-400 block">${l.timestamp}</span>
        <strong class="text-brand-charcoal">${l.event}</strong>
      </div>
      <span class="px-1.5 py-0.5 rounded font-bold uppercase text-[9px] bg-neutral-100 text-neutral-700">${l.user}</span>
    </div>
  `).join("");
  document.getElementById("auditLogsModal")?.classList.remove("hidden");
}
function closeAuditLogsModal() { document.getElementById("auditLogsModal")?.classList.add("hidden"); }

function openApiGatewayModal() {
  const elW = document.getElementById("cfgWhatsAppWebhook");
  const elS = document.getElementById("cfgSmsApiKey");
  if (elW) elW.value = config.apiGateway?.whatsappWebhook || "";
  if (elS) elS.value = config.apiGateway?.smsApiKey || "";
  document.getElementById("apiGatewayModal")?.classList.remove("hidden");
}
function closeApiGatewayModal() { document.getElementById("apiGatewayModal")?.classList.add("hidden"); }
function saveApiGatewaySettings(){alert("API secrets must be configured on a trusted backend.");}

function toggleMaintenanceMode() {
  config.maintenanceMode = !config.maintenanceMode;
  persist();
  const btn = document.getElementById("btnMaintenanceToggle");
  if (btn) {
    btn.textContent = config.maintenanceMode ? "Unlock Storefront" : "Lock Storefront";
  }
  logAuditEvent(`Store Maintenance Mode set to ${config.maintenanceMode ? 'ACTIVE' : 'INACTIVE'}`, currentUser?.username || 'Admin', "system");
  alert(`Storefront Maintenance Mode is now ${config.maintenanceMode ? 'ENABLED. Checkouts paused.' : 'DISABLED. Storefront active.'}`);
}

function runAiDemandForecast() {
  const content = document.getElementById("aiForecastContent");
  if (!content) return;

  const totalSold = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0), 0);
  const lowStockItems = products.filter(p => p.stock <= 5);

  content.innerHTML = `
    <div class="space-y-2">
      <div class="p-2.5 bg-white rounded-lg border">
        <h5 class="font-bold text-brand-darkgreen uppercase text-[10px]">Overall Demand Velocity</h5>
        <p><strong>Total units sold:</strong> ${totalSold} items across Hyderabad.</p>
        <p><strong>Top Predicted Category:</strong> Tarjuma Qurans &amp; Handcrafted Velvet Boxes (High Seasonal Demand).</p>
      </div>
      <div class="p-2.5 bg-white rounded-lg border">
        <h5 class="font-bold text-amber-800 uppercase text-[10px]">Restock Recommendations</h5>
        ${lowStockItems.length > 0 ? `
          <ul class="list-disc pl-4 space-y-1 mt-1">
            ${lowStockItems.map(p => `<li><strong>${p.title}</strong> — only ${p.stock} left in showroom. Recommended re-order: +50 units.</li>`).join('')}
          </ul>
        ` : `<p class="text-emerald-700 font-bold">All inventory levels are optimal for current sales velocity.</p>`}
      </div>
    </div>
  `;
  document.getElementById("aiDemandForecastModal")?.classList.remove("hidden");
}
function closeAiForecastModal() { document.getElementById("aiDemandForecastModal")?.classList.add("hidden"); }

function openSeoManagerModal() {
  const elT = document.getElementById("seoMetaTitle");
  const elD = document.getElementById("seoMetaDesc");
  const elK = document.getElementById("seoMetaKeywords");
  if (elT) elT.value = config.seo?.metaTitle || document.title;
  if (elD) elD.value = config.seo?.metaDesc || "";
  if (elK) elK.value = config.seo?.keywords || "";
  document.getElementById("seoManagerModal")?.classList.remove("hidden");
}
function closeSeoManagerModal() { document.getElementById("seoManagerModal")?.classList.add("hidden"); }
function saveSeoMetadata() {
  if (!config.seo) config.seo = {};
  config.seo.metaTitle = document.getElementById("seoMetaTitle")?.value.trim() || "";
  config.seo.metaDesc = document.getElementById("seoMetaDesc")?.value.trim() || "";
  config.seo.keywords = document.getElementById("seoMetaKeywords")?.value.trim() || "";
  if (config.seo.metaTitle) document.title = config.seo.metaTitle;
  persist();
  closeSeoManagerModal();
  logAuditEvent("Global SEO metadata updated", currentUser?.username || 'Admin', "seo");
  alert("SEO Meta Tags successfully updated!");
}

function triggerAbandonedCartRecovery() {
  if (cart.length === 0) {
    alert("No items currently in active customer shopping bags to recover.");
    return;
  }
  const itemsText = cart.map(it => `• ${it.title} (x${it.qty})`).join("\n");
  const waUrl = `https://wa.me/91${config.whatsappPhone}?text=${encodeURIComponent(`Salam! You left sacred Quran items in your shopping bag at ${config.brandName}. Complete your order today for free Hyderabad packaging:\n${itemsText}`)}`;
  window.open(waUrl, "_blank");
  logAuditEvent("Abandoned Cart Recovery reminder dispatched", currentUser?.username || 'Admin', "marketing");
}

function toggleFeatureFlag(key, enabled) {
  if (currentUser?.role !== 'admin') return alert("Access Denied: Only Developer Master Admin can toggle features.");
  if (!config.featureToggles) config.featureToggles = {};
  config.featureToggles[key] = enabled;
  persist();
  renderProducts();
  logAuditEvent(`Feature toggle '${key}' set to ${enabled}`, currentUser.username, "toggles");
}

function switchAdminTab(tab) {
  const tabs = ['hub', 'expert', 'features', 'orders', 'inventory', 'branches', 'shipping', 'pos', 'analytics', 'coupons', 'customers', 'salesmodifier', 'cms', 'payments'];
  
  if (tab === 'pos' && currentUser?.role !== 'admin' && !config.featureToggles?.ownerPosAccess) {
    return alert("POS Terminal access has been restricted by Admin.");
  }
  
  tabs.forEach(t => {
    document.getElementById(`adminTab-${t}`)?.classList.toggle("hidden", t !== tab);
    const btn = document.getElementById(`adminTabBtn-${t}`);
    if (btn) btn.className = "px-4 py-3 border-b-2 font-bold whitespace-nowrap " + (t === tab ? "border-brand-charcoal text-brand-charcoal bg-white" : "border-transparent text-neutral-500 hover:text-black");
  });
}

function updateOrderStatus(){alert("Owner changes require Firebase confirmation.");}

function renderBranchesInDashboard() {
  const container = document.getElementById("adminBranchesList");
  if (!container || !config.branches || config.branches.length === 0) return;
  const b = config.branches[0];
  container.innerHTML = `
    <div class="bg-white p-4 rounded-xl border space-y-2 text-xs">
      <h5 class="font-bold text-brand-charcoal text-sm">${b.name}</h5>
      <p class="text-neutral-600">${b.address}</p>
      <p class="font-mono text-brand-muted">📞 +91 ${b.phone} • Head Manager: ${b.manager}</p>
    </div>
  `;
}

function updateAnalytics() {
  const totalRev = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const revStr = formatPrice(totalRev);
  const elAnaRev = document.getElementById("anaTotalRevenue");
  const elAnaOrd = document.getElementById("anaTotalOrders");
  const elHubRev = document.getElementById("hubTotalRevenue");
  const elHubOrd = document.getElementById("hubTotalOrders");
  if (elAnaRev) elAnaRev.textContent = revStr;
  if (elAnaOrd) elAnaOrd.textContent = orders.length;
  if (elHubRev) elHubRev.textContent = revStr;
  if (elHubOrd) elHubOrd.textContent = orders.length;
}

function resetAllSalesToZero(){alert("Verified Firebase owner access is required.");}

function handlePhotoFileInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const el = document.getElementById("editProductImage");
    if (el) el.value = e.target.result;
    const preview = document.getElementById("photoUploadPreview");
    if (preview) { preview.src = e.target.result; preview.classList.remove("hidden"); }
  };
  reader.readAsDataURL(file);
}

function openProductEditModal(id = null) {
  const canEdit = currentUser?.role === "admin" || config.featureToggles?.ownerInventoryEdit;
  if (!canEdit) return alert("Stock and Pricing editing is currently restricted by Developer Admin.");
  document.getElementById("productEditModal")?.classList.remove("hidden");
  
  const p = products.find(x => x.id === id);
  refreshProductCategoryOptions(p?.category);
  if (p) {
    document.getElementById("editProductId").value = p.id;
    document.getElementById("editProductTitle").value = p.title;
    document.getElementById("editProductCategory").value = p.category;
    document.getElementById("editProductStock").value = p.stock;
    document.getElementById("editProductSalePrice").value = p.salePrice;
    document.getElementById("editProductImage").value = p.image;
    
    const preview = document.getElementById("photoUploadPreview");
    if (preview) { preview.src = p.image; preview.classList.remove("hidden"); }
  } else {
    document.getElementById("editProductId").value = "";
    document.getElementById("editProductTitle").value = "";
    document.getElementById("editProductStock").value = "25";
    document.getElementById("editProductSalePrice").value = "";
    document.getElementById("editProductImage").value = "";
    document.getElementById("photoUploadPreview")?.classList.add("hidden");
  }
}
function closeProductEditModal() { document.getElementById("productEditModal")?.classList.add("hidden"); }

function handleProductFormSubmit(e){e.preventDefault();alert("Firebase not connected. Product not saved.");}

function handleManualShippingLabelPrint(e) {
  e.preventDefault();
  alert("Manual Label generated and sent to print buffer!");
}

// ==========================================
// 10. ADMIN: USER & STAFF MANAGEMENT
// ==========================================
function renderAdminCustomers() {
  const tbody = document.getElementById("adminCustomersTableBody");
  if (!tbody) return;
  
  const visibleUsers = currentUser?.role === 'admin' ? users : users.filter(u => u.role !== 'admin');

  tbody.innerHTML = visibleUsers.map(u => `
    <tr class="hover:bg-neutral-50 border-b ${u.isBlocked ? 'opacity-50' : ''}">
      <td class="p-3 font-bold">
        ${u.name}
        ${u.isBlocked ? '<span class="text-[9px] bg-red-100 text-red-700 px-1 rounded ml-1 font-bold">BLOCKED</span>' : ''}
      </td>
      <td class="p-3 uppercase text-[10px] font-bold"><span class="px-2 py-1 rounded bg-brand-sand">${u.role}</span></td>
      <td class="p-3 font-mono">${u.phone}</td>
      <td class="p-3">${u.email || 'N/A'}</td>
      <td class="p-3 font-bold ${u.isBlocked ? 'text-red-600' : 'text-emerald-700'}">${u.isBlocked ? 'Blocked' : 'Active'}</td>
      <td class="p-3 text-right">
        ${u.role === 'admin' ? `<span class="text-neutral-400 font-bold text-[10px]">Master Root</span>` : `
          <button onclick="openManageUserModal('${u.id}')" class="text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded">Manage</button>
        `}
      </td>
    </tr>
  `).join("");
}

function openManageUserModal(){alert("Manage credentials in Firebase Authentication.");}
function closeManageUserModal() { document.getElementById("manageUserModal")?.classList.add("hidden"); }

function saveUserManagement(){alert("Manage credentials in Firebase Authentication.");}

function deleteUserAccount(){alert("Manage credentials in Firebase Authentication.");}

function handleCmsSave(e) {
  e.preventDefault();
  config.brandName = document.getElementById("cmsBrandName")?.value.trim() || config.brandName;
  config.proprietor = document.getElementById("cmsProprietor")?.value.trim() || config.proprietor;
  config.address = document.getElementById("cmsAddress")?.value.trim() || config.address;
  persist();
  syncLiveCmsUI();
  logAuditEvent("Live storefront CMS details updated", currentUser.username, "cms");
  alert("Storefront details successfully saved live!");
}

function savePaymentSettings(e) {
  e.preventDefault();
  config.upiId = document.getElementById("cfgUpiId")?.value.trim() || config.upiId;
  config.merchantName = document.getElementById("cfgUpiName")?.value.trim() || config.merchantName;
  persist();
  logAuditEvent("Payment gateway & UPI configurations updated", currentUser.username, "finance");
  alert("Payment settings saved securely!");
}

function renderCouponsTable() {
  const tbody = document.getElementById("adminCouponsTableBody");
  if (!tbody) return;
  tbody.innerHTML = coupons.map((c, i) => `
    <tr class="hover:bg-neutral-50 border-b">
      <td class="p-3 font-bold font-mono text-brand-gold">${c.code}</td>
      <td class="p-3">₹${c.discount} OFF</td>
      <td class="p-3">₹${c.minOrder}</td>
      <td class="p-3 text-right"><button onclick="coupons.splice(${i},1);persist();renderCouponsTable();" class="text-red-600 font-bold">Delete</button></td>
    </tr>
  `).join("");
}

function promptCreateCoupon() {
  const code = prompt("Enter Promo Code (e.g., RAMADAN50):");
  if (!code) return;
  const discount = parseInt(prompt("Discount value in ₹:", "50")) || 50;
  const minOrder = parseInt(prompt("Minimum Order Value in ₹:", "500")) || 500;
  coupons.push({ code: code.trim().toUpperCase(), discount, type: "flat", minOrder });
  persist();
  logAuditEvent(`Created discount coupon: ${code.toUpperCase()}`, currentUser.username, "marketing");
  renderCouponsTable();
}

function syncLiveCmsUI() {
  const elBrand = document.getElementById("brandNavTitle");
  const elDrawerBrand = document.getElementById("drawerBrandName");
  const elFooterBrand = document.getElementById("footerBrandName");
  const elFooterProp = document.getElementById("footerProprietor");
  const elTicker = document.getElementById("announcementText");
  const waLink = document.getElementById("floatingWhatsAppLink");
  const elPhones = document.getElementById("footerPhonesText");
  const elEmail = document.getElementById("footerEmailText");

  if (elBrand) elBrand.textContent = config.brandName;
  if (elDrawerBrand) elDrawerBrand.textContent = config.brandName;
  if (elFooterBrand) elFooterBrand.textContent = config.brandName;
  if (elFooterProp) elFooterProp.textContent = config.proprietor;
  if (elTicker) elTicker.textContent = config.announcement;
  if (waLink) waLink.href = `https://wa.me/91${config.whatsappPhone}`;
  if (elPhones) elPhones.textContent = `+91 ${config.phone1} / +91 ${config.phone2}`;
  if (elEmail) elEmail.textContent = config.ownerEmail;
}

// ==========================================
// 11. MISSING RENDER COMPONENTS RESTORED
// ==========================================
function renderAdminOrders() {
  const tbody = document.getElementById("adminOrdersContainer");
  if (!tbody) return;
  tbody.innerHTML = orders.length === 0 ? `<p class="text-xs text-neutral-400 py-4">No active orders found.</p>` : orders.map(o => `
    <div class="p-3 border rounded-lg bg-white shadow-sm text-xs space-y-2">
      <div class="flex justify-between items-center font-bold">
        <span>${o.orderId}</span>
        <span class="${o.status === 'Cancelled' ? 'text-red-600' : 'text-emerald-700'}">${o.status}</span>
      </div>
      <p class="text-neutral-600"><strong>Customer:</strong> ${o.customerName} (${o.customerPhone})</p>
      <p class="text-neutral-500">${o.items.map(it => `${it.title} (x${it.qty})`).join(', ')}</p>
      <div class="flex justify-between items-center pt-2 border-t font-semibold">
        <span>Total: ${formatPrice(o.total)}</span>
        <select onchange="updateOrderStatus('${o.orderId}', this.value)" class="text-[10px] border p-1 rounded font-bold">
          <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
    </div>
  `).join("");
}

function renderAdminInventory() {
  const tbody = document.getElementById("adminInventoryTableBody");
  if (!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr class="border-b hover:bg-neutral-50 text-xs">
      <td class="p-3 flex items-center gap-2"><img src="${p.image}" class="w-8 h-8 rounded object-cover border" alt="${p.title}"> <span class="font-bold truncate w-32 md:w-auto">${p.title}</span></td>
      <td class="p-3">${p.category}</td>
      <td class="p-3 font-mono font-bold">${formatPrice(p.salePrice)}</td>
      <td class="p-3 font-bold ${p.stock <= 5 ? 'text-red-600' : 'text-emerald-700'}">${p.stock}</td>
      <td class="p-3 text-right"><button onclick="openProductEditModal('${p.id}')" class="text-blue-600 font-bold hover:underline bg-blue-50 px-2 py-1 rounded">Edit</button></td>
    </tr>
  `).join("");
}

function renderPosCatalog() {
  const grid = document.getElementById("posCatalogGrid");
  if (!grid) return;
  grid.innerHTML = products.map(p => `
    <div class="p-2 border rounded-lg bg-white cursor-pointer hover:bg-neutral-50 shadow-sm transition" onclick="posAddToCart('${p.id}')">
      <p class="text-[11px] font-bold text-brand-charcoal truncate">${p.title}</p>
      <p class="text-[11px] font-mono text-brand-gold mt-1">${formatPrice(p.salePrice)} <span class="text-[9px] text-neutral-400 ml-1">Stock: ${p.stock}</span></p>
    </div>
  `).join("");
}

function posAddToCart(prodId) {
  if(window.mqbPosBusy)return;
  const p=products.find(x=>x.id===prodId);
  if(!p||Number(p.stock)<=0)return alert('Product out of stock.');
  const existing=posTicket.find(x=>x.id===prodId);
  if(existing){if(existing.qty>=Number(p.stock))return alert('Cannot exceed available stock.');existing.qty++;}
  else posTicket.push({id:p.id,title:p.title,salePrice:p.salePrice,qty:1});
  renderPosTicketUI();
}
function posSetQuantity(prodId,quantity) {
  if(window.mqbPosBusy)return;
  const line=posTicket.find(x=>x.id===prodId);
  if(!line)return;
  const product=products.find(x=>x.id===prodId);
  if(!product){alert('This product is no longer available.');return;}
  const value=Number(quantity);
  if(!Number.isInteger(value)||value<0){alert('Enter a whole quantity of zero or more.');renderPosTicketUI();return;}
  if(value>Number(product.stock)){alert('Only '+product.stock+' currently available.');renderPosTicketUI();return;}
  if(value===0)posTicket=posTicket.filter(x=>x.id!==prodId);
  else line.qty=value;
  renderPosTicketUI();
}
function posChangeQuantity(prodId,delta){const line=posTicket.find(x=>x.id===prodId);if(line)posSetQuantity(prodId,line.qty+delta);}
function posRemoveItem(prodId){if(window.mqbPosBusy)return;posTicket=posTicket.filter(x=>x.id!==prodId);renderPosTicketUI();}
function posClearTicket(){if(window.mqbPosBusy)return;if(posTicket.length && !confirm('Clear all items from this POS bill?'))return;posTicket=[];renderPosTicketUI();}
function renderPosTicketUI() {
  const container=document.getElementById('posTicketItems'),totalEl=document.getElementById('posTicketTotal');
  if(!container||!totalEl)return;
  const total=posTicket.reduce((sum,it)=>sum+(Number(it.salePrice)||0)*it.qty,0);
  totalEl.textContent=formatPrice(total);
  container.replaceChildren();
  if(!posTicket.length){const empty=document.createElement('p');empty.className='py-3 text-neutral-500';empty.textContent='No items yet. Select products to build a bill.';container.appendChild(empty);return;}
  for(const it of posTicket){
    const row=document.createElement('div');row.className='py-2 border-b space-y-1';
    const heading=document.createElement('div');heading.className='flex justify-between items-start gap-2';
    const name=document.createElement('span');name.className='font-semibold break-words';name.textContent=it.title;
    const subtotal=document.createElement('strong');subtotal.className='whitespace-nowrap';subtotal.textContent=formatPrice(it.salePrice*it.qty);
    heading.append(name,subtotal);
    const ctrls=document.createElement('div');ctrls.className='flex items-center gap-1.5';
    const btn=(text,label,callback,extra='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.className='rounded border px-2 py-1 font-bold '+extra;b.addEventListener('click',callback);return b;};
    const qty=document.createElement('input');qty.type='number';qty.min='0';qty.max=String(products.find(x=>x.id===it.id)?.stock??it.qty);qty.step='1';qty.value=String(it.qty);
    qty.setAttribute('aria-label','Quantity for '+it.title);qty.className='w-16 border rounded p-1 text-center';
    qty.addEventListener('change',()=>posSetQuantity(it.id,qty.value));
    ctrls.append(btn('−','Decrease '+it.title,()=>posChangeQuantity(it.id,-1)),qty,
      btn('+','Increase '+it.title,()=>posChangeQuantity(it.id,1)),
      btn('Remove','Remove '+it.title,()=>posRemoveItem(it.id),'ml-auto text-red-700'));
    row.append(heading,ctrls);container.appendChild(row);
  }
}
function completePosSale(){alert('Secure POS server function is not yet deployed. Do not complete paid sales in the browser.');}

function formatFeatureName(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}

function renderAdminFeatureToggles() {
  const container = document.getElementById("adminTogglesContainer");
  if (!container) return;
  const flags = Object.keys(config.featureToggles || {});
  
  container.innerHTML = flags.map(key => `
    <div class="flex justify-between items-center p-3.5 hover:bg-neutral-50 transition">
      <div>
        <span class="font-bold text-brand-charcoal text-xs block">${formatFeatureName(key)}</span>
        <span class="text-[10px] text-brand-muted font-mono">${key}</span>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" class="sr-only peer" ${config.featureToggles[key] ? 'checked' : ''} onchange="toggleFeatureFlag('${key}', this.checked)">
        <div class="w-9 h-5 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
      </label>
    </div>
  `).join("");
}
