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
      this.profiles={}; posTicket=[];
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
        this.on('customerProfiles', record=>{this.profiles=record||{};renderAdminCustomers();});
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
          orders=Object.entries(record||{}).map(([key,v])=>({...v,__uid:u.uid,__key:key,orderId:v.orderId||key})).reverse();
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
  window.handlePublicInvoiceLookup=event=>{event.preventDefault();alert('Tax invoices are issued only after payment verification by the shop. Contact the owner for an invoice.');};
  window.prepareAndPrintInvoice=(id)=>{
    const o=orders.find(x=>x.orderId===id);
    if(!o || o.channel!=='Showroom POS') return alert('This is only an order request, not an invoice. Ask the owner for the verified invoice.');
    alert('POS invoice printing requires verified tax details and payment review.');
  };
  window.trackOrderById=()=>{
    const id=$('trackInputId')?.value.trim().toUpperCase()||'';const node=$('trackingResultBox');if(!node)return;
    const found=orders.find(x=>x.orderId.toUpperCase()===id);
    node.classList.remove('hidden');
    node.textContent=found?('Request: '+found.orderId+' | Status: '+found.status+' | Courier: '+(found.courierName||'Not assigned')):'No matching order in your authorized account.';
  };
  window.renderCustProfileOrders=()=>{
    if(!currentUser||currentUser.role!=='customer')return;
    const node=$('custOrderList');if(!node)return;
    node.innerHTML=orders.length?orders.map(o=>`<div class="p-3 border rounded-lg bg-brand-sand/50 text-xs space-y-1">
      <strong>${esc(o.orderId)}</strong> — ${esc(o.status||'Requested')}<br>
      <span>Estimate: ₹${price(o.total).toLocaleString('en-IN')}</span><br>
      <small>Payment not verified · ${esc(o.deliveryChoice||'Standard delivery')}</small></div>`).join(''):'<p class="text-xs text-neutral-500">No order requests yet.</p>';
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
  window.renderAdminOrders=()=>{
    const node=$('adminOrdersContainer');if(!node)return;
    node.innerHTML=orders.length?orders.map(o=>{
      const id=esc(o.orderId||'');
      const statuses=['Requested','Processing','Shipped','Delivered','Cancelled'];
      const choices=statuses.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('');
      const items=Array.isArray(o.items)?o.items:[];
      return `<div class="p-3 border rounded-lg bg-white shadow-sm text-xs space-y-2">
        <div class="flex justify-between gap-2"><strong>${id}</strong><strong>${esc(o.status||'Requested')}</strong></div>
        <p><strong>Customer:</strong> ${esc(o.customerName||'')} · ${esc(o.customerPhone||'')}</p>
        <p>${esc(items.map(i=>i.title+' (x'+i.qty+')').join(', '))}</p>
        <p class="text-amber-700 font-semibold">Estimated total ₹${price(o.total).toLocaleString('en-IN')} · Payment ${esc(o.paymentStatus||'not verified')}</p>
        <p>${esc(o.address||'')} ${esc(o.postalCode||'')} · ${esc(o.deliveryChoice||'')}</p>
        <div class="flex gap-2 items-center"><label for="ship-${esc(o.__key||id)}">Status</label>
        <select id="ship-${esc(o.__key||id)}" data-order="${id}" class="cloud-order-status border rounded p-2" ${o.__uid?'':'disabled'}>${choices}</select></div>
        <p class="text-[10px] text-neutral-500">Carrier booking and payment confirmation require separate verification.</p>
      </div>`;
    }).join(''):'<p class="text-neutral-500 text-sm">No authenticated customer order requests yet.</p>';
    node.querySelectorAll('.cloud-order-status').forEach(el=>el.addEventListener('change',()=>updateOrderStatus(el.dataset.order,el.value)));
  };
  window.renderAdminCustomers=()=>{
    const node=$('adminCustomersTableBody');if(!node)return;
    const profiles=Object.entries(live.profiles||{});
    node.innerHTML=profiles.length?profiles.map(([uid,p])=>`<tr class="border-b"><td class="p-3">${esc(p.name||'Customer')}</td>
      <td class="p-3">Firebase</td><td class="p-3">${esc(p.phone||'')}</td><td class="p-3">${esc(p.email||'')}</td>
      <td class="p-3">Account-specific</td><td class="p-3 text-right">Password reset via Firebase only</td></tr>`).join(''):'<tr><td class="p-4" colspan="6">No Firebase customer profiles registered yet.</td></tr>';
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
