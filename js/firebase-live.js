/*
 * MOIN QURAN BOX — secure Firebase Realtime Database bridge (v20).
 * Public GitHub Pages JS: ONLY Firebase public web config belongs here.
 * Never put Firebase service account keys, database secrets or admin PINs here.
 * The Firebase Database security rules are the actual authorization boundary.
 */
(() => {
  'use strict';
  const FB = {
    apiKey: 'AIzaSyBcqj1WRGKYYgG3hONHjh3bfgXOwyUuyVM',
    authDomain: 'moin-quran-box.firebaseapp.com',
    projectId: 'moin-quran-box',
    databaseURL: 'https://moin-quran-box-default-rtdb.firebaseio.com',
    appId: '1:623897373952:web:0514b4f11bcc977da3d7e5',
    messagingSenderId: '623897373952',
    storageBucket: 'moin-quran-box.firebasestorage.app'
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textError = error => String(error?.message || error || 'Unknown error').slice(0,220);
  const safeTrackingUrl = src => {
    if (!src) return '';
    try {
      const url = new URL(String(src).trim());
      return url.protocol === 'https:' && !url.username && !url.password && url.hostname ? url.href : '';
    } catch { return ''; }
  };
  const SHIP_STATUSES = ['Requested','Confirmed','Processing','Packed','Shipped','In Transit','Out for Delivery','Delivered','Returned','Cancelled'];
  const shipmentFor = o => {
    const s=o?.shipping && typeof o.shipping==='object' ? o.shipping : {};
    return {
      carrier:String(s.carrier ?? o?.courierName ?? '').slice(0,100),
      trackingNumber:String(s.trackingNumber ?? o?.awb ?? '').slice(0,120),
      trackingUrl:safeTrackingUrl(s.trackingUrl ?? o?.trackingUrl ?? ''),
      dispatchDate:String(s.dispatchDate||'').slice(0,10),
      eta:String(s.eta||'').slice(0,10),
      deliveredDate:String(s.deliveredDate||'').slice(0,10),
      notes:String(s.notes||'').slice(0,500)
    };
  };
  const safeImage = src => {
    try { const u = new URL(src); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
  };
  const price = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
  const publicKeys = ['brandName','urduSubtitle','proprietor','address','phone1','phone2','whatsappPhone','announcement','maintenanceMode'];
  const publicConfig = () => Object.fromEntries(publicKeys.map(k => [k, config[k] ?? '']));
  const cleanSettings = () => {
    const copy = JSON.parse(JSON.stringify(config));
    delete copy.apiGateway; // never put SMS keys/webhook secrets into web database
    return { config: copy, coupons: coupons.map(c => ({code:c.code,type:c.type,discount:c.discount,minOrder:c.minOrder})) };
  };
  const isAdmin = () => currentUser?.role === 'admin' && live.verifiedAdmin && !!live.uid;
  const ensureAdmin = () => { if (!isAdmin()) { alert('Sign in using your verified Firebase Super Admin account.'); return false; } return true; };
  const live = {
    uid: null, verifiedAdmin: false, catalogPublished: false, db: null, auth: null,
    applying: false, settingsReady: false, lastSettings: '', saveTimer: null,
    unsubs: [], started: false, profiles: {}, salesResetAt: 0,
    guestMessage: 'No confirmed cloud catalog yet. Sample collection shown for preview only.',
    setStatus(message, state='waiting') {
      const el=$('liveSyncBanner'); if (!el) return;
      el.textContent=message;
      el.style.background=state==='ok'?'#e1f5e8':state==='bad'?'#ffe3e0':'#fcf5dc';
      el.style.color=state==='ok'?'#185b37':state==='bad'?'#922828':'#5d481b';
    },
    on(path, fn, fallback) {
      const reference=this.db.ref(path);
      const handler=snap=>fn(snap.val());
      reference.on('value',handler, error=> {
        this.setStatus('Firebase read error: '+textError(error),'bad');
        if(fallback) fallback(error);
      });
      this.unsubs.push(()=>reference.off('value',handler));
    },
    stopPrivate() { for(const unsubscribe of this.unsubs.splice(2)) unsubscribe(); },
    start() {
      if(this.started) return;
      this.started=true;
      localStorage.removeItem('mqb_v19_session');
      // This legacy store used insecure local username/password records.
      // They are NOT imported into Firebase or used for authorization.
      if(!window.firebase?.auth || !window.firebase?.database) {
        this.setStatus('Firebase SDK could not load. Browsing previews only; secure orders unavailable.','bad');
        return;
      }
      try {
        const app=firebase.apps.length ? firebase.app() : firebase.initializeApp(FB);
        this.db=app.database(); this.auth=app.auth();
        this.setStatus('Connecting to live Islamic catalog…');
        this.on('catalog', data => {
          const entries=Object.entries(data || {});
          this.catalogPublished=entries.length>0;
          if(entries.length) {
            products=entries.filter(([,v])=>v&&typeof v.title==='string').map(([id,v]) => ({
              id, title:v.title, category:v.category||'Islamic Products',
              salePrice:price(v.salePrice ?? v.price), oldPrice:price(v.oldPrice),
              wholesalePrice:price(v.wholesalePrice), stock:Math.max(0,Number(v.stock)||0),
              image:safeImage(v.image), desc:String(v.desc ?? v.description ?? '').slice(0,600),
              sku:v.sku || id
            }));
          } else {
            // Static JSON remains visible in preview mode, but cannot be ordered.
            this.setStatus(this.guestMessage,'waiting');
          }
          renderCategoryChips(); renderProducts();
          renderAdminInventory(); renderPosCatalog();
          const counter=$('cloudAdminCatalogInfo');
          if(counter) counter.textContent=entries.length+' cloud products. Import missing items from data/products.json only after checking existing inventory.';
          if(entries.length) this.setStatus('✓ Live product catalog connected · Updates appear automatically','ok');
        });
        this.on('publicSettings', data => {
          if(!data || typeof data!=='object') return;
          for(const k of publicKeys) if(Object.prototype.hasOwnProperty.call(data,k)) config[k]=data[k];
          syncLiveCmsUI(); renderProducts();
        });
        this.auth.onAuthStateChanged(u=>{
          if(u && this.uid===u.uid && this.appliedUserUID===u.uid) return;
          this.applySession(u).catch(err=>this.setStatus('Login state error: '+textError(err),'bad'));
        });
      } catch(err) { this.setStatus('Firebase initialization failed: '+textError(err),'bad'); }
    },
    async applySession(u) {
      const epoch=this.sessionEpoch=(this.sessionEpoch||0)+1;
      const prev=this.uid;
      this.stopPrivate(); this.uid=null; this.appliedUserUID=null; this.verifiedAdmin=false;
      this.settingsReady=false; this.lastSettings='';
      // NEVER show the previous account's cart or order data in a new session.
      cart=[]; wishlist=[]; orders=[]; currentUser=null; users=[];
      this.profiles={}; posTicket=[]; selectedAdminCustomerUID='';
      // Clear prior admin-only DOM when switching accounts (prevents stale private records).
      for(const id of ['adminOrdersContainer','adminCustomersTableBody','adminOrderHistoryCount','adminCustomerSearchCount','custOrderList','custOrderCount','custProfContact','custProfName','trackingResultBox','shippingOrderSummary']) {
        const node=$(id);if(node)node.textContent='';
      }
      if($('adminOrderHistorySearch'))$('adminOrderHistorySearch').value='';
      if($('adminCustomerSearch'))$('adminCustomerSearch').value='';
      closeAdminDashboardModal(); closeCustomerProfileModal();
      $('staffLogoutNavBtn')?.classList.add('hidden');
      $('staffLoginNavBtn')?.classList.remove('hidden');
      $('cloudAdminQuickActions')?.classList.add('hidden');
      if(!u) {
        this.uid=null;
        cart=JSON.parse(localStorage.getItem('mqb_v20_guest_cart')||'[]');
        wishlist=JSON.parse(localStorage.getItem('mqb_v20_guest_wishlist')||'[]');
        updateCartUI(); syncCustomerHeaderUI();
        return;
      }
      this.uid=u.uid;
      // The admin record was manually created in Firebase; the client cannot create it.
      const adminSnap=await this.db.ref('admins/'+u.uid).once('value');
      if(this.uid!==u.uid || epoch!==this.sessionEpoch) return;
      this.verifiedAdmin=adminSnap.val()===true;
      if(this.verifiedAdmin) {
        currentUser={id:u.uid,uid:u.uid,username:'Admin',email:u.email,name:u.displayName||'Owner & Developer',role:'admin'};
        $('staffLogoutNavBtn')?.classList.remove('hidden');
        $('staffLoginNavBtn')?.classList.add('hidden');
        $('cloudAdminQuickActions')?.classList.remove('hidden');
        this.on('orderRequests', record=>{
          if(!isAdmin()) return;
          const all=[];
          for(const [ownerUid,items] of Object.entries(record||{})) for(const [key,value] of Object.entries(items||{})) {
            if(value&&typeof value==='object') all.push({...value, __uid:ownerUid,__key:key,orderId:value.orderId||key});
          }
          this.customerOrdersForAdmin=all;
          this.updateAdminOrders();
        });
        this.on('adminData/posSales', record=>{
          this.posSales=Object.entries(record||{}).map(([key,v])=>({...v,__key:key,channel:'Showroom POS'}));
          this.updateAdminOrders();
        });
        this.on('customerProfiles', record=>{this.profiles=record||{};renderAdminCustomers();renderAdminOrders();});
        this.on('adminData/settings', data=>{
          if(data && typeof data==='object') {
            this.applying=true;
            if(data.config) config={...config,...data.config,featureToggles:{...config.featureToggles,...data.config.featureToggles}};
            if(Array.isArray(data.coupons)) coupons=data.coupons;
            this.applying=false;
            syncLiveCmsUI();renderProducts();renderCouponsTable();
          }
          this.settingsReady=true;
          this.lastSettings=JSON.stringify(cleanSettings());
        });
        this.on('adminData/salesResetAt',data=>{this.salesResetAt=Number(data)||0;updateAnalytics();});
        this.setStatus('✓ Firebase verified Super Admin · Shared store data online','ok');
      } else {
        currentUser={id:u.uid,uid:u.uid,username:u.email,email:u.email,phone:'',name:u.displayName||u.email||'Customer',role:'customer',addresses:[]};
        this.on('customerProfiles/'+u.uid, profile=>{
          if(this.uid!==u.uid || !profile) return;
          currentUser={...currentUser,...profile,role:'customer',id:u.uid,uid:u.uid,username:u.email,email:u.email};
          syncCustomerHeaderUI();
        });
        this.on('customerCarts/'+u.uid,items=>{
          if(this.uid!==u.uid) return;
          cart=Array.isArray(items)?items:[]; updateCartUI();
        });
        this.on('customerWishlists/'+u.uid,items=>{
          if(this.uid!==u.uid) return;
          wishlist=Array.isArray(items)?items:[];renderProducts();
        });
        this.on('orderRequests/'+u.uid,record=>{
          if(this.uid!==u.uid) return;
          orders=Object.entries(record||{}).filter(([,v])=>v&&typeof v==='object').map(([key,v])=>({...v,__uid:u.uid,__key:key,orderId:v.orderId||key})).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
          if(!$('customerProfileModal')?.classList.contains('hidden')) renderCustProfileOrders();
        });
        this.setStatus('✓ Signed in · Your cart and orders are account-specific','ok');
      }
      this.appliedUserUID=u.uid;
      updateCartUI();syncCustomerHeaderUI();
    },
    updateAdminOrders() {
      orders=[...(this.customerOrdersForAdmin||[]),...(this.posSales||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      renderAdminOrders(); updateAnalytics();
    },
    async signIn(email,password,adminOnly=false) {
      if(!this.auth) throw Error('Firebase is not available. Check your network.');
      if(!email?.includes('@')) throw Error('Use your Firebase account EMAIL, not a four-digit PIN or phone number.');
      const response=await this.auth.signInWithEmailAndPassword(email.trim(),password);
      if(adminOnly) {
        const snap=await this.db.ref('admins/'+response.user.uid).once('value');
        if(snap.val()!==true) throw Error('This account is not authorized for the owner dashboard.');
        await this.applySession(response.user);
      }
      return response;
    },
    async sendPasswordReset(email) {
      if (!this.auth) throw Error('Firebase Authentication is unavailable. Please try again later.');
      const address=String(email||'').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length>254) throw Error('Enter a valid registered email address.');
      // Firebase sends the secure email. Never handle or store customer passwords ourselves.
      // Do not expose whether an account exists.
      await this.auth.sendPasswordResetEmail(address);
    },
    async register({name,phone,email,password}) {
      if(!this.auth) throw Error('Firebase connection unavailable.');
      if(!email || !email.includes('@')) throw Error('A real email address is required.');
      if(password.length<8) throw Error('Use at least 8 characters for your password.');
      const response=await this.auth.createUserWithEmailAndPassword(email,password);
      const p={name:name.slice(0,120), phone:phone.slice(0,18), email:response.user.email, createdAt:firebase.database.ServerValue.TIMESTAMP};
      await this.db.ref('customerProfiles/'+response.user.uid).set(p);
      return response;
    },
    async signOut() {
      await this.auth?.signOut();
      if(!this.auth){currentUser=null;cart=[];wishlist=[];updateCartUI();}
    },
    saveCart() {
      if(this.uid) this.db.ref('customerCarts/'+this.uid).set(cart).catch(e=>this.setStatus('Cart not saved: '+textError(e),'bad'));
      else localStorage.setItem('mqb_v20_guest_cart',JSON.stringify(cart));
    },
    saveWishlist() {
      if(this.uid) this.db.ref('customerWishlists/'+this.uid).set(wishlist).catch(e=>this.setStatus('Wishlist not saved: '+textError(e),'bad'));
      else localStorage.setItem('mqb_v20_guest_wishlist',JSON.stringify(wishlist));
    },
    async saveProduct(product) {
      if(!isAdmin()) throw Error('Firebase owner access required');
      const photo=safeImage(product.image);
      if(product.image && !photo) throw Error('Use an HTTPS product image URL, not a large embedded photo.');
      if(!product.title || price(product.salePrice)<=0 || !Number.isInteger(Number(product.stock)) || Number(product.stock)<0) throw Error('Check title, price and stock.');
      const id=String(product.id || this.db.ref('catalog').push().key);
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('Invalid product ID.');
      const clean={title:product.title.slice(0,120),category:String(product.category).slice(0,90),
        salePrice:price(product.salePrice),oldPrice:price(product.oldPrice),
        stock:Number(product.stock),sku:String(product.sku||id).slice(0,100),
        image:photo,desc:String(product.desc||'').slice(0,600),
        updatedAt:firebase.database.ServerValue.TIMESTAMP};
      await this.db.ref('catalog/'+id).set(clean);
      this.setStatus('✓ Product saved to Firebase. Devices updating…','ok');
    },
    async publishBrowserCatalog() {
      if(!ensureAdmin()) return;
      let data; try{data=JSON.parse(localStorage.getItem('mqb_v19_products')||'[]');}catch{data=[];}
      if(!Array.isArray(data)||!data.length) return alert('No legacy browser products found on this device.');
      if(!confirm('Import '+data.length+' previously saved browser products that do not exist in Firebase? Cloud products will not be overwritten.')) return;
      try {
        const existing=(await this.db.ref('catalog').once('value')).val()||{};
        let added=0;
        for(const p of data) if(p.id && !existing[p.id] && price(p.salePrice)>0) {await this.saveProduct(p);added++;}
        alert(added+' browser products imported. Review all stock and prices.');
      }catch(e){alert('Import failed: '+textError(e));}
    },
    async publishSampleCatalog() {
      if(!ensureAdmin()) return;
      if(!confirm('Import only missing products from data/products.json into Firebase? Existing cloud products and prices will be preserved. Check stock before accepting orders.')) return;
      try {
        const r=await fetch('data/products.json',{cache:'no-store'});
        if(!r.ok) throw Error('Could not fetch data/products.json (HTTP '+r.status+')');
        const sample=await r.json();
        const current=(await this.db.ref('catalog').once('value')).val()||{};
        let count=0;
        for(const p of sample) {
          if(!p.id || current[p.id]) continue;
          await this.saveProduct({...p, image:safeImage(p.image)}); count++;
        }
        alert(count+' missing catalog products imported. Existing Firebase products were not replaced.');
      }catch(e){alert('Catalog import failed: '+textError(e));}
    },
    async sendOrder(form) {
      if(!this.uid || currentUser?.role!=='customer') throw Error('Sign in as a customer to submit an order request.');
      if(!this.catalogPublished) throw Error('No live cloud catalog has been published.');
      const cartItems=cart.map(item=>({id:item.id,qty:Math.max(1,Math.floor(Number(item.qty)||1))}));
      if(!cartItems.length) throw Error('Your bag is empty.');
      if(!/^[0-9]{6}$/.test(form.postalCode)) throw Error('Please enter a valid six-digit postal code.');
      if(!/^[0-9+() -]{10,18}$/.test(form.customerPhone)) throw Error('Please enter a valid mobile number.');
      const all=(await this.db.ref('catalog').once('value')).val()||{};
      const summary=[]; let estimate=0;
      for(const item of cartItems) {
        const p=all[item.id];
        if(!p || price(p.salePrice??p.price)<=0 || Number(p.stock)<item.qty) throw Error('Product stock or price changed. Update your cart before continuing.');
        const unit=price(p.salePrice??p.price);
        summary.push({id:item.id, title:String(p.title).slice(0,120), salePrice:unit,qty:item.qty});
        estimate+=unit*item.qty;
      }
      const orderId='MQB-REQ-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      const request={...form, uid:this.uid,orderId,items:summary,total:estimate,
        status:'Requested',paymentStatus:'unverified',date:new Date().toISOString(),
        channel:'Website request',courierName:'Not assigned',awb:'',
        note:'Estimate only. Owner confirms stock, delivery, price and payment.'};
      await this.db.ref('orderRequests/'+this.uid).push(request);
      cart=[];await this.db.ref('customerCarts/'+this.uid).set([]);
      return request;
    },
    maybePersistSettings() {
      if(this.applying || !this.settingsReady || !isAdmin()) return;
      const fingerprint=JSON.stringify(cleanSettings());
      if(fingerprint===this.lastSettings) return;
      clearTimeout(this.saveTimer);
      this.saveTimer=setTimeout(async()=>{
        const snapshot=cleanSettings();
        try {
          await this.db.ref('adminData/settings').set(snapshot);
          await this.db.ref('publicSettings').set(publicConfig());
          this.lastSettings=JSON.stringify(snapshot);
          this.setStatus('✓ Store settings saved in Firebase','ok');
        } catch(error) { this.setStatus('⚠ Changes are local; Firebase rejected save: '+textError(error),'bad'); }
      },700);
    }
  };
  window.mqbLive=live;
  // Repaired v19 missing handlers: these buttons previously did nothing.
  window.toggleTheme=()=>{
    const dark=document.documentElement.classList.toggle('dark');
    try{localStorage.setItem('mqb_theme',dark?'dark':'light');}catch{}
  };
  window.openContactModal=()=>$('contactModal')?.classList.remove('hidden');
  window.closeContactModal=()=>$('contactModal')?.classList.add('hidden');
  try{if(localStorage.getItem('mqb_theme')==='dark') document.documentElement.classList.add('dark');}catch{}


  // --- Firebase password recovery (does not modify user data or account roles) ---
  let resetReturnTo='customer';
  window.openPasswordResetModal=(from='customer')=>{
    resetReturnTo=from==='admin'?'admin':'customer';
    const address=resetReturnTo==='admin'?$('portalUsername')?.value:$('cxLoginId')?.value;
    $('customerAuthModal')?.classList.add('hidden');
    $('adminLoginModal')?.classList.add('hidden');
    const email=$('passwordResetEmail'); if(email) email.value=address?.trim()||'';
    const notice=$('passwordResetMessage');if(notice){notice.textContent='';notice.classList.add('hidden');}
    $('passwordResetSendBtn').disabled=false;
    $('passwordResetModal')?.classList.remove('hidden');
    email?.focus();
  };
  window.closePasswordResetModal=()=>{
    $('passwordResetModal')?.classList.add('hidden');
    if(resetReturnTo==='admin') $('adminLoginModal')?.classList.remove('hidden');
    else openCustomerAuthModal('login');
  };
  window.handlePasswordResetSubmit=async e=>{
    e.preventDefault();
    const notice=$('passwordResetMessage');const button=$('passwordResetSendBtn');
    const email=$('passwordResetEmail')?.value.trim()||'';
    if(button) button.disabled=true;
    try {
      await live.sendPasswordReset(email);
      if(notice){notice.textContent='If this email belongs to a Firebase account, a password-reset link will be sent. Check your inbox and spam folder. The link may expire.';notice.className='rounded-lg p-3 leading-relaxed bg-emerald-50 text-emerald-900';}
    } catch(err) {
      const code=err?.code||'';
      if(notice){
        // Firebase projects vary in enumeration-protection settings; avoid disclosing account existence.
        notice.textContent=(code==='auth/user-not-found'||code==='auth/email-already-in-use')
          ? 'If this email belongs to a Firebase account, a password-reset link will be sent.'
          : 'Could not request a reset email: '+(code==='auth/too-many-requests'?'Too many attempts. Please try again later.':textError(err));
        notice.className='rounded-lg p-3 leading-relaxed bg-amber-50 text-amber-900';
      }
    } finally {if(button) button.disabled=false;}
  };

  // --- Firebase sign-in replaces localStorage password and PIN authentication ---
  window.validateSessionPersistence=()=>{};
  window.startSessionCountdownTimer=()=>{};
  window.handleCustomerLoginSubmit=async e=>{
    e.preventDefault();
    try {
      await live.signIn($('cxLoginId').value,$('cxLoginPass').value);
      $('cxLoginPass').value='';closeCustomerAuthModal();
      // Auth-state handler will open the account-specific orders/cart automatically.
      alert('Signed in securely with Firebase.');
    }catch(err){alert('Login failed: '+textError(err));}
  };
  window.handleCustomerRegisterSubmit=async e=>{
    e.preventDefault();
    try {
      await live.register({name:$('cxRegName').value.trim(),phone:$('cxRegPhone').value.trim(),email:$('cxRegEmail').value.trim(),password:$('cxRegPass').value});
      $('cxRegPass').value='';closeCustomerAuthModal();
      alert('Customer account created securely in Firebase.');
    }catch(err){alert('Registration failed: '+textError(err));}
  };
  window.handlePortalLogin=async e=>{
    e.preventDefault();
    const errorEl=$('portalLoginError'); if(errorEl) errorEl.classList.add('hidden');
    try {
      await live.signIn($('portalUsername').value.trim(),$('portalPassword').value,true);
      $('portalPassword').value='';closeAdminLoginModal();openAdminDashboardModal();
    }catch(err) { alert('Owner login failed: '+textError(err)); if(errorEl){errorEl.textContent=textError(err);errorEl.classList.remove('hidden');} }
  };
  window.openAdminDashboardModal=(()=>{
    const original=window.openAdminDashboardModal;
    return ()=>{ if(!ensureAdmin()) return; original(); };
  })();
  window.logoutCurrentUser=async()=>{
    try { await live.signOut(); closeAdminDashboardModal();closeCustomerProfileModal(); }
    catch(e) { alert('Logout failed: '+textError(e)); }
  };
  window.openFirebaseSyncModal=()=>{
    const el=$('firebaseSyncModalStatus');
    if(el) el.textContent=live.verifiedAdmin ? 'Firebase Super Admin connected. The API key is a public app identifier; no database secret is needed.' : 'Sign in as your verified Firebase Super Admin to manage the cloud database.';
    $('firebaseSyncModal')?.classList.remove('hidden');
  };
  window.saveFirebaseSyncConfig=()=>alert('No database secret is required or accepted. Use Firebase email/password sign-in.');
  window.testFirebaseConnection=async()=>{
    try {
      if(!live.uid) throw Error('Sign in to Firebase first.');
      const snap=await live.db.ref('admins/'+live.uid).once('value');
      alert(snap.val()===true?'✓ Firebase verified your Super Admin access.':'Firebase account connected, but does not have administrator permission.');
    }catch(err){alert('Firebase check failed: '+textError(err));}
  };
  window.toggleAutoSync=()=>alert('Firebase catalog subscriptions are automatic whenever connected. Data is saved only after Firebase confirms; no fake local sync switch.');

  // --- Real-time account-specific cart and wishlist ---
  window.toggleWishlist=id=>{
    if(!products.some(p=>p.id===id))return;
    wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];
    live.saveWishlist();renderProducts();
  };
  window.addToCart=(id)=>{
    if(!live.catalogPublished) return alert('Products shown are previews. Please publish real inventory first.');
    const p=products.find(x=>x.id===id);
    if(!p || !p.stock) return alert('This product is unavailable.');
    if(config.maintenanceMode) return alert('Ordering is temporarily paused.');
    const existing=cart.find(x=>x.id===id);
    if(existing){if(existing.qty>=p.stock)return alert('Only '+p.stock+' available.');existing.qty++;}
    else cart.push({id:p.id,title:p.title,salePrice:p.salePrice,image:p.image,qty:1});
    updateCartUI(); live.saveCart();toggleCart(true);
  };
  window.updateCartQty=(id,delta)=>{
    const existing=cart.find(x=>x.id===id);if(!existing)return;
    const stock=products.find(p=>p.id===id)?.stock||0;
    if(delta>0 && existing.qty>=stock) return alert('Maximum available stock reached.');
    existing.qty+=delta;if(existing.qty<=0) cart=cart.filter(x=>x.id!==id);
    updateCartUI();live.saveCart();
  };
  window.startCheckout=(()=>{const original=window.startCheckout;return ()=>{
    if(!live.catalogPublished) return alert('Store cloud catalog is not yet published.');
    if(!live.uid||currentUser?.role!=='customer'){toggleCart(false);openCustomerAuthModal('login');return alert('Please sign in to your customer account to send an order request.');}
    original();
  };})();
  window.handlePlaceOrder=async e=>{
    e.preventDefault();
    const form={customerName:$('chkName')?.value.trim()||'',customerPhone:$('chkPhone')?.value.trim()||'',
      customerEmail:live.auth?.currentUser?.email||'',address:$('chkAddress')?.value.trim()||'',postalCode:$('chkPostalCode')?.value.trim()||'',
      paymentMethod:document.querySelector('input[name="chkPaymentMethod"]:checked')?.value||'To be arranged',
      deliveryChoice:$('chkDeliveryChoice')?.value||'Standard delivery',
      deliveryNote:$('chkDeliveryNote')?.value.trim().slice(0,240)||''};
    if(!form.customerName||!form.customerPhone||!form.address||!form.postalCode) return alert('Please complete your shipping address.');
    const btn=e.target.querySelector('button[type=submit]');if(btn)btn.disabled=true;
    try {
      const result=await live.sendOrder(form);
      updateCartUI();closeCheckoutModal();
      if($('successOrderIdDisplay'))$('successOrderIdDisplay').textContent=result.orderId+' · Pending owner confirmation';
      const link=$('successWhatsAppOrderBtn');
      if(link) link.href='https://wa.me/91'+(config.whatsappPhone||'')+'?text='+encodeURIComponent('Assalamu Alaikum, I submitted order request '+result.orderId+'. Please confirm availability and shipping.');
      $('orderSuccessModal')?.classList.remove('hidden');
      live.setStatus('✓ Order request saved to Firebase. Await owner confirmation.','ok');
    }catch(err){alert('Order request not saved: '+textError(err));}
    finally{if(btn)btn.disabled=false;}
  };
  window.cancelCustomerOrder=()=>alert('Please contact the owner using WhatsApp to request cancellation. Changes require owner review.');
  // Invoice is generated ONLY from orders already authorized and read by Firebase.
  // A guessed order ID and phone number are not substitutes for signing in.
  const getAuthorizedOrder=(uid,key)=>{
    if(!currentUser || !live.uid) return null;
    const admin=isAdmin();
    const item=orders.find(o=>(o.__uid===uid || (admin && uid==='POS' && o.channel==='Showroom POS'))&&o.__key===key);
    if(!item) return null;
    if(!admin && !(currentUser.role==='customer' && uid===live.uid))return null;
    return item;
  };
  window.downloadOrderInvoice=(uid,key)=>{
    const o=getAuthorizedOrder(uid,key);
    if(!o) return alert('Order not found in your account, or access is not permitted. Sign in first.');
    if(!window.MQBInvoicePDF?.saveInvoice)return alert('PDF generator unavailable. Refresh the website and try again.');
    const profile=isAdmin()?(live.profiles?.[uid]||{}):(currentUser||{});
    try{MQBInvoicePDF.saveInvoice({order:o,shop:config,profile});}
    catch(error){alert('Invoice download failed: '+textError(error));}
  };
  window.handlePublicInvoiceLookup=event=>{
    event.preventDefault();
    if(!live.uid)return alert('Please sign in to your customer account to download your own order invoice.');
    const id=String($('lookupOrderId')?.value||'').trim().toUpperCase();
    const phone=String($('lookupPhone')?.value||'').replace(/\D/g,'');
    const matches=orders.filter(o=>String(o.orderId||'').toUpperCase()===id
      && (isAdmin() || (o.__uid===live.uid && String(o.customerPhone||'').replace(/\D/g,'').endsWith(phone))));
    if(!matches.length)return alert('No matching order is accessible in your signed-in account.');
    if(!isAdmin() && phone.length<10)return alert('Enter your complete registered order phone number.');
    window.downloadOrderInvoice(matches[0].__uid,matches[0].__key);
  };
  window.prepareAndPrintInvoice=(id)=>{
    const o=orders.find(x=>x.orderId===id);
    if(o?.__key && (o.__uid || (isAdmin() && o.channel==='Showroom POS')))return window.downloadOrderInvoice(o.__uid||'POS',o.__key);
    alert('Only signed-in orders stored in Firebase can be downloaded here.');
  };
  // Tracking uses only records already authorized by Firebase for the signed-in user.
  const shippingCard=o=>{
    const s=shipmentFor(o);
    const tracking=s.trackingUrl;
    return `<div class="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg space-y-1">
      <p><strong>Courier:</strong> ${esc(s.carrier||'Not assigned')}</p>
      <p><strong>AWB / Tracking:</strong> ${esc(s.trackingNumber||'Awaiting dispatch')}</p>
      ${s.dispatchDate?`<p><strong>Dispatched:</strong> ${esc(s.dispatchDate)}</p>`:''}
      ${s.eta?`<p><strong>Expected delivery:</strong> ${esc(s.eta)}</p>`:''}
      ${s.deliveredDate?`<p><strong>Delivered:</strong> ${esc(s.deliveredDate)}</p>`:''}
      ${s.notes?`<p><strong>Shipping note:</strong> ${esc(s.notes)}</p>`:''}
      ${tracking?`<p><a href="${esc(tracking)}" target="_blank" rel="noopener noreferrer" class="text-emerald-800 font-bold underline underline-offset-2">Track on courier website ↗</a></p>`:''}
    </div>`;
  };
  window.trackOrderById=()=>{
    const id=$('trackInputId')?.value.trim().toUpperCase()||'';const node=$('trackingResultBox');if(!node)return;
    const found=orders.find(x=>String(x.orderId||'').toUpperCase()===id);
    node.classList.remove('hidden');
    node.innerHTML=found?`<p><strong>Order:</strong> ${esc(found.orderId)}</p><p><strong>Status:</strong> ${esc(found.status||'Requested')}</p>${shippingCard(found)}`
      :'No matching order in your authorized account. Sign in to view tracking details.';
  };
  window.renderCustProfileOrders=()=>{
    if(!currentUser||currentUser.role!=='customer')return;
    const node=$('custOrderList');if(!node)return;
    const own=orders.filter(o=>o.__uid===live.uid);
    const count=$('custOrderCount');if(count)count.textContent=own.length+' order'+(own.length===1?'':'s')+' in your account';
    node.innerHTML=own.length?own.map(o=>{
      const items=Array.isArray(o.items)?o.items:[];
      return `<article class="p-3 border rounded-lg bg-brand-sand/50 text-xs space-y-2">
        <div class="flex flex-wrap justify-between gap-2"><strong>${esc(o.orderId||o.__key)}</strong><span>${esc(o.status||'Requested')}</span></div>
        <p><strong>Date:</strong> ${esc(o.date?new Date(o.date).toLocaleString('en-IN'):'Not recorded')} · <strong>Estimate:</strong> INR ${price(o.total).toLocaleString('en-IN')}</p>
        <p><strong>Products:</strong> ${esc(items.map(i=>`${i.title||'Item'} × ${i.qty||0}`).join(', ')||'No item details')}</p>
        <p><strong>Payment:</strong> ${esc(o.paymentStatus||'unverified')} · <strong>Delivery:</strong> ${esc(o.deliveryChoice||'Standard')}</p>
        ${shippingCard(o)}
        <button type="button" class="customer-invoice-download px-3 py-2 bg-brand-darkgreen text-white font-bold rounded-lg">Download Order Invoice (PDF)</button>
      </article>`;
    }).join(''):'<p class="text-xs text-neutral-500">No previous orders in this account yet.</p>';
    node.querySelectorAll('.customer-invoice-download').forEach((el,index)=>el.addEventListener('click',()=>{
      const o=own[index];window.downloadOrderInvoice(o.__uid,o.__key);
    }));
  };

  // --- Verified owner edit controls. Never write unconfirmed changes. ---
  window.handleProductFormSubmit=async e=>{
    e.preventDefault();if(!ensureAdmin())return;
    const id=$('editProductId')?.value.trim()||live.db.ref('catalog').push().key;
    const before=products.find(p=>p.id===id);
    const input={...before,id,title:$('editProductTitle')?.value.trim(),
      category:$('editProductCategory')?.value,stock:Number($('editProductStock')?.value),
      salePrice:Number($('editProductSalePrice')?.value),image:$('editProductImage')?.value.trim()||''};
    try { await live.saveProduct(input);closeProductEditModal();alert('Product saved and synchronized across devices.'); }
    catch(err) {alert('Product NOT saved: '+textError(err));}
  };
  window.updateOrderStatus=async (orderId,status)=>{
    if(!ensureAdmin())return;
    const o=orders.find(x=>x.orderId===orderId);
    if(!o?.__uid||!o?.__key) return alert('This order cannot be modified from the cloud dashboard.');
    try {await live.db.ref('orderRequests/'+o.__uid+'/'+o.__key+'/status').set(status);live.setStatus('✓ Order status saved to Firebase','ok');}
    catch(err){alert('Order status NOT saved: '+textError(err));}
  };
  window.resetAllSalesToZero=async()=>{
    if(!ensureAdmin())return;
    if(!confirm('Reset dashboard sales starting today? Historic orders are retained for audit and records.'))return;
    try {await live.db.ref('adminData/salesResetAt').set(Date.now());alert('Sales dashboard baseline reset. Historic orders preserved.');}
    catch(err){alert('Sales reset failed: '+textError(err));}
  };
  window.updateAnalytics=()=>{
    // Order requests do not count as revenue; only entered POS sales are reported.
    const completed=orders.filter(o=>o.channel==='Showroom POS' && new Date(o.date).getTime()>=live.salesResetAt);
    const revenue=completed.reduce((sum,o)=>sum+price(o.total),0);
    for(const id of ['anaTotalRevenue','hubTotalRevenue']) if($(id))$(id).textContent=formatPrice(revenue);
    for(const id of ['anaTotalOrders','hubTotalOrders']) if($(id))$(id).textContent=orders.length;
  };
  // Owner order editor: update only the shipping-related fields, never overwrite the order.
  let editingShippingRef=null;
  const statusNotice=(message,error=false)=>{
    const el=$('shippingSaveMessage');if(!el)return;
    el.textContent=message;el.className='rounded-lg p-2 '+(error?'bg-red-50 text-red-800':'bg-emerald-50 text-emerald-800');
  };
  window.openOrderShippingModal=(uid,key)=>{
    if(!ensureAdmin())return;
    const record=orders.find(o=>o.__uid===uid&&o.__key===key);
    if(!record)return alert('Order not found. Refresh the dashboard.');
    editingShippingRef={uid,key};
    const s=shipmentFor(record);
    $('shippingOrderSummary').textContent='Order '+(record.orderId||key)+' · '+(record.customerName||'Customer');
    for(const [field,val] of Object.entries({shippingCarrier:s.carrier==='Not assigned'?'':s.carrier,
      shippingAwb:s.trackingNumber,shippingTrackingUrl:s.trackingUrl,
      shippingDispatchDate:s.dispatchDate,shippingEta:s.eta,shippingDeliveredDate:s.deliveredDate,shippingNotes:s.notes})){
      const input=$(field);if(input)input.value=val;
    }
    const status=$('shippingOrderStatus');if(status){
      const orderStatus=String(record.status||'Requested');
      if(!SHIP_STATUSES.includes(orderStatus)){
        const opt=document.createElement('option');opt.value=orderStatus;opt.textContent=orderStatus;status.appendChild(opt);
      }
      status.value=orderStatus;
    }
    $('shippingSaveMessage')?.classList.add('hidden');
    $('orderShippingModal')?.classList.remove('hidden');
  };
  window.closeOrderShippingModal=()=>{
    $('orderShippingModal')?.classList.add('hidden');editingShippingRef=null;
  };
  window.saveShippingDetails=async e=>{
    e.preventDefault();
    if(!ensureAdmin()||!editingShippingRef)return;
    const {uid,key}=editingShippingRef;
    if(!orders.some(o=>o.__uid===uid&&o.__key===key)) return statusNotice('Order not found or no longer available.',true);
    const rawUrl=$('shippingTrackingUrl')?.value.trim()||'';
    const trackingUrl=safeTrackingUrl(rawUrl);
    if(rawUrl&&!trackingUrl)return statusNotice('Enter a valid HTTPS link from the courier website.',true);
    const newStatus=$('shippingOrderStatus')?.value||'Requested';
    if(!SHIP_STATUSES.includes(newStatus) && !orders.some(o=>o.__uid===uid&&o.__key===key&&o.status===newStatus))
      return statusNotice('Select a valid order status.',true);
    const carrier=$('shippingCarrier')?.value.trim().slice(0,100)||'';
    const trackingNumber=$('shippingAwb')?.value.trim().slice(0,120)||'';
    if(/[\r\n\x00-\x1f]/.test(carrier+trackingNumber)) return statusNotice('Remove line breaks or special control characters.',true);
    const date=(id)=>{const value=$(id)?.value||'';return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';};
    const shipping={
      carrier,trackingNumber,trackingUrl,
      dispatchDate:date('shippingDispatchDate'),eta:date('shippingEta'),
      deliveredDate:date('shippingDeliveredDate'),notes:($('shippingNotes')?.value||'').trim().slice(0,500),
      updatedAt:firebase.database.ServerValue.TIMESTAMP,
      updatedBy:live.uid
    };
    const button=$('saveShippingBtn');if(button)button.disabled=true;
    try {
      // Multipath update preserves customer address, items, totals, order ID and all other data.
      await live.db.ref('orderRequests/'+uid+'/'+key).update({
        shipping, courierName:carrier||'Not assigned', awb:trackingNumber, trackingUrl, status:newStatus
      });
      statusNotice('Shipping and tracking details saved to Firebase. Customer devices will refresh automatically.');
      live.setStatus('✓ Order shipping details saved in Firebase','ok');
    }catch(err){statusNotice('Shipping details NOT saved: '+textError(err),true);}
    finally{if(button)button.disabled=false;}
  };
  window.clearShippingDetails=()=>{
    if(!ensureAdmin()||!editingShippingRef)return;
    if(!confirm('Clear the tracking fields in this editor? Press Save / Update Shipping to apply the changes to Firebase. The order itself will remain intact.'))return;
    for(const id of ['shippingCarrier','shippingAwb','shippingTrackingUrl','shippingDispatchDate','shippingEta','shippingDeliveredDate','shippingNotes']) if($(id))$(id).value='';
    statusNotice('Fields cleared locally. Click Save / Update Shipping to save the change.');
  };
  // Admin search includes Firebase profile data and all historic customer orders.
  let selectedAdminCustomerUID='';
  const adminQuery=()=>String($('adminOrderHistorySearch')?.value||'').trim().toLowerCase();
  const adminOrderMatches=(o,q)=>{
    if(selectedAdminCustomerUID && o.__uid!==selectedAdminCustomerUID) return false;
    if(!q)return true;
    const p=live.profiles?.[o.__uid]||{};
    const fields=[o.orderId,o.__key,o.__uid,o.customerName,o.customerPhone,o.customerEmail,o.email,
      o.status,o.channel,p.name,p.phone,p.email];
    return fields.some(field=>String(field??'').toLowerCase().includes(q));
  };
  window.searchAdminOrderHistory=()=>{if(ensureAdmin()) renderAdminOrders();};
  window.clearAdminOrderHistorySearch=()=>{
    if(!ensureAdmin())return;
    selectedAdminCustomerUID='';if($('adminOrderHistorySearch'))$('adminOrderHistorySearch').value='';renderAdminOrders();
  };
  window.showAdminCustomerOrders=uid=>{
    if(!ensureAdmin())return;
    selectedAdminCustomerUID=uid;
    if($('adminOrderHistorySearch'))$('adminOrderHistorySearch').value='';
    switchAdminTab('orders');renderAdminOrders();
  };
  window.renderAdminOrders=()=>{
    const node=$('adminOrdersContainer');if(!node)return;
    if(!isAdmin()){node.textContent='Verified Super Admin sign-in required.';return;}
    const visible=orders.filter(o=>adminOrderMatches(o,adminQuery()));
    const counter=$('adminOrderHistoryCount');if(counter)counter.textContent=visible.length+' matching order(s) of '+orders.length+' total';
    const selectedName=live.profiles?.[selectedAdminCustomerUID]?.name||selectedAdminCustomerUID;
    const selected=$('adminHistoryFilterStatus');if(selected) selected.textContent=selectedAdminCustomerUID?'Customer filter: '+selectedName:'';
    node.innerHTML=visible.length?visible.map(o=>{
      const id=esc(o.orderId||o.__key||'');
      const choices=Array.from(new Set([...SHIP_STATUSES,String(o.status||'Requested')]))
        .map(s=>`<option value="${esc(s)}" ${o.status===s?'selected':''}>${esc(s)}</option>`).join('');
      const items=Array.isArray(o.items)?o.items:[];
      const s=shipmentFor(o);
      const profile=live.profiles?.[o.__uid]||{};
      return `<article class="p-3 border rounded-lg bg-white shadow-sm text-xs space-y-2">
        <div class="flex justify-between gap-2"><strong>${id}</strong><strong>${esc(o.status||'Requested')}</strong></div>
        <p><strong>Date:</strong> ${esc(o.date?new Date(o.date).toLocaleString('en-IN'):'Not recorded')}</p>
        <p><strong>Customer:</strong> ${esc(o.customerName||profile.name||'')} · ${esc(o.customerPhone||profile.phone||'')}</p>
        <p><strong>Email:</strong> ${esc(o.customerEmail||o.email||profile.email||'Not recorded')}</p>
        <p>${esc(items.map(i=>i.title+' (x'+i.qty+')').join(', '))}</p>
        <p class="text-amber-700 font-semibold">Estimated total INR ${price(o.total).toLocaleString('en-IN')} · Payment ${esc(o.paymentStatus||'not verified')}</p>
        <p>${esc(o.address||'')} ${esc(o.postalCode||'')} · ${esc(o.deliveryChoice||'')}</p>
        <div class="flex gap-2 items-center flex-wrap"><label for="ship-${esc(o.__key||id)}">Status</label>
        <select id="ship-${esc(o.__key||id)}" class="cloud-order-status border rounded p-2" ${o.__uid?'':'disabled'}>${choices}</select></div>
        <div class="bg-brand-sand border rounded p-2 space-y-1">
          <p><strong>Courier:</strong> ${esc(s.carrier||'Not assigned')} · <strong>AWB:</strong> ${esc(s.trackingNumber||'Not assigned')}</p>
          ${s.dispatchDate?`<p>Dispatched: ${esc(s.dispatchDate)}</p>`:''}
          ${s.eta?`<p>ETA: ${esc(s.eta)}</p>`:''}
          ${s.trackingUrl?`<a href="${esc(s.trackingUrl)}" target="_blank" rel="noopener noreferrer" class="underline font-bold text-emerald-800">Open courier tracking</a>`:''}
        </div>
        <button type="button" class="cloud-download-invoice border border-emerald-700 text-emerald-900 px-4 py-2 rounded-lg font-bold w-full" ${o.__key?'':'disabled'}>Download Order Invoice (PDF)</button>
        ${o.__uid&&o.__key?`<button type="button" class="cloud-edit-shipping bg-brand-darkgreen text-white px-4 py-2 rounded-lg font-bold w-full">Edit Shipping / Courier Tracking</button>`
          :'<p class="text-[10px] text-neutral-500">POS invoices and shipping need separate verified sales records.</p>'}
        <p class="text-[10px] text-neutral-500">Non-tax order invoice, not payment proof. Courier booking and payment verification remain separate.</p>
      </article>`;
    }).join(''):'<p class="text-neutral-500 text-sm">No orders match this search.</p>';
    node.querySelectorAll('.cloud-order-status').forEach((el,index)=>{
      const record=visible[index];el.addEventListener('change',async()=>{
        if(!ensureAdmin()||!record.__uid||!record.__key)return;
        try {await live.db.ref('orderRequests/'+record.__uid+'/'+record.__key+'/status').set(el.value);} 
        catch(err){alert('Order status not saved: '+textError(err));renderAdminOrders();}
      });
    });
    node.querySelectorAll('.cloud-edit-shipping').forEach(el=>{
      // Use data attribute/index from matching cards, not filtered positions: prevents wrong-order edits.
      const card=el.closest('article');const record=visible[Array.prototype.indexOf.call(node.children,card)];
      el.addEventListener('click',()=>openOrderShippingModal(record.__uid,record.__key));
    });
    node.querySelectorAll('.cloud-download-invoice').forEach(el=>{
      const card=el.closest('article');const record=visible[Array.prototype.indexOf.call(node.children,card)];
      el.addEventListener('click',()=>window.downloadOrderInvoice(record.__uid||'POS',record.__key));
    });
  };
  window.searchAdminCustomers=()=>{if(ensureAdmin())renderAdminCustomers();};
  window.renderAdminCustomers=()=>{
    const node=$('adminCustomersTableBody');if(!node)return;
    if(!isAdmin()){node.textContent='Admin access required.';return;}
    const search=String($('adminCustomerSearch')?.value||'').trim().toLowerCase();
    const profiles=Object.entries(live.profiles||{}).filter(([uid,p])=>
      [uid,p.name,p.email,p.phone].some(v=>String(v??'').toLowerCase().includes(search)) ||
      orders.some(o=>o.__uid===uid && [o.orderId,o.customerName,o.customerPhone].some(v=>String(v??'').toLowerCase().includes(search))));
    const count=$('adminCustomerSearchCount');if(count)count.textContent=profiles.length+' matching customer(s)';
    node.innerHTML=profiles.length?profiles.map(([uid,p])=>{
      const history=orders.filter(o=>o.__uid===uid);
      return `<tr class="border-b">
      <td class="p-3"><strong>${esc(p.name||'Customer')}</strong><div class="text-[10px] text-neutral-500 break-all">ID: ${esc(uid)}</div></td>
      <td class="p-3">Customer</td><td class="p-3">${esc(p.phone||'')}</td><td class="p-3">${esc(p.email||'')}</td>
      <td class="p-3">${history.length} order(s)</td>
      <td class="p-3 text-right space-y-1">
        <button type="button" class="view-customer-orders bg-brand-darkgreen text-white px-2 py-1.5 rounded font-bold">View order history</button>
        <button type="button" class="send-customer-reset border border-emerald-700 text-emerald-800 px-2 py-1.5 rounded font-bold" ${p.email?'':'disabled'}>Send reset email</button>
      </td></tr>`;
    }).join(''):'<tr><td class="p-4" colspan="6">No customer profiles match this search.</td></tr>';
    node.querySelectorAll('.view-customer-orders').forEach((el,index)=>{
      el.addEventListener('click',()=>window.showAdminCustomerOrders(profiles[index][0]));
    });
    node.querySelectorAll('.send-customer-reset').forEach((el,index)=>{
      el.addEventListener('click',async()=>{
        if(!ensureAdmin())return;
        const email=String(profiles[index][1].email||'').trim();
        if(!email||!confirm('Send a Firebase password-reset email to '+email+'? The recipient sets their own password.'))return;
        el.disabled=true;
        try {await live.sendPasswordReset(email);alert('Reset request submitted. If the account exists, Firebase will email the customer.');}
        catch(err){alert('Reset request failed: '+textError(err));}
        finally{el.disabled=false;}
      });
    });
  };
  window.openManageUserModal=()=>alert('Passwords and user roles are managed in Firebase Authentication and by trusted server tools, not in the customer browser.');
  window.saveUserManagement=window.deleteUserAccount=()=>alert('Account changes are disabled here for safety. Use Firebase Authentication and a trusted admin backend.');
  window.downloadSystemBackup=()=>{
    if(!ensureAdmin())return;
    const json=JSON.stringify({timestamp:new Date().toISOString(),note:'Browser snapshot only. Export the complete database from Firebase Console for an authoritative backup.',products,orders,config:cleanSettings().config},null,2);
    const blob=new Blob([json],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=u;a.download='mqb-owner-snapshot-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
  };
  window.saveApiGatewaySettings=()=>alert('Never save SMS or webhook secret keys in a public website. Use a trusted backend for API connections.');
  window.handlePhotoFileInput=e=>{
    if(e?.target) e.target.value='';
    alert('Photos must be hosted on HTTPS. Firebase Storage upload is not configured; paste a secure image URL instead.');
  };
  window.completePosSale=()=>alert('POS sale finalization needs a server-side stock and payment transaction. Do not mark unverified sales as paid.');
  // Admin-only functions that change local UI state remain visible, but cannot grant Firebase permissions.
})();
