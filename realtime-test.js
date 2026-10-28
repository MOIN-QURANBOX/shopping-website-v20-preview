/* Moin Quran Box | separate safe RTDB test page (not the existing V4 storefront). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config = {
    apiKey:'AIzaSyBcqj1WRGKYYgG3hONHjh3bfgXOwyUuyVM',
    authDomain:'moin-quran-box.firebaseapp.com',
    projectId:'moin-quran-box',
    databaseURL:'https://moin-quran-box-default-rtdb.firebaseio.com',
    appId:'1:623897373952:web:0514b4f11bcc977da3d7e5',
    messagingSenderId:'623897373952'
  };
  let auth, db, admin=false, currentUid=null, stopSync=null, catalogRef=null, catalogListener=null;
  function status(s,kind=''){ $('status').className='status '+kind; $('status').textContent=s; }
  function errorText(e){return (e && (e.code || e.message)) ? (e.code?e.code+': ':'')+(e.message||'') : String(e);}
  function message(id,text){$(id).textContent=text;}
  function img(src){if(!src)return '';try{const u=new URL(src);return u.protocol==='https:'?u.href:'';}catch{return '';}}
  function renderCatalog(raw){
    const list = Object.entries(raw||{}).map(([id,p])=>({...p,id})).filter(p=>p&&typeof p.title==='string').slice(0,150);
    $('catalog').innerHTML=list.length?list.map(p=>`<article class="product">
      ${img(p.image)?`<img loading="lazy" src="${esc(img(p.image))}" alt="${esc(p.title)}">`:''}
      <span class="small">${esc(p.category||'Islamic Collection')}</span><strong>${esc(p.title)}</strong>
      <span class="price">₹${Number(p.price||0).toLocaleString('en-IN')}</span>
      <span class="muted">Stock: ${Number(p.stock||0)}</span>
      <span class="muted">${esc(p.description||'')}</span>
    </article>`).join(''):'<p class="muted">No products published yet. An authenticated administrator can add the first product below.</p>';
  }
  function watchCatalog(){
    if(catalogRef&&catalogListener)catalogRef.off('value',catalogListener);
    catalogRef=db.ref('catalog');
    catalogListener=snap=>{renderCatalog(snap.val());status('Catalog connected','good');};
    catalogRef.on('value',catalogListener,e=>{
      status('Catalog not accessible','error');
      $('catalog').textContent='Catalog permission denied or offline. With the current admin-only rules, the catalog is visible only after signing in as an administrator. '+errorText(e);
    });
  }
  async function init(){
    if(!window.firebase || !firebase.auth || !firebase.database){status('Firebase SDK unavailable','error');$('catalog').textContent='Firebase SDK did not load. Check the browser connection.';return;}
    try{
      const app=firebase.apps.length?firebase.app():firebase.initializeApp(config);
      auth=app.auth();db=app.database();
      status('Connecting to Firebase…');
      auth.onAuthStateChanged(async u=>{
        if(stopSync){db.ref('syncChecks/'+currentUid).off('value',stopSync);stopSync=null;}
        currentUid=u?.uid||null;admin=false;
        $('adminPanel').classList.add('hidden');$('logout').classList.toggle('hidden',!u);$('login').classList.toggle('hidden',!!u);
        $('identity').textContent=u?'Signed in: '+(u.email||u.uid):'Not signed in';
        watchCatalog();
        if(!u){message('authMessage','');return;}
        try{
          const snap=await db.ref('admins/'+u.uid).once('value');
          if(currentUid!==u.uid)return;
          admin=snap.val()===true;
          if(!admin){message('authMessage','Account authenticated, but not marked as administrator at /admins/'+u.uid+'.');return;}
          $('adminPanel').classList.remove('hidden');message('authMessage','Firebase verified your Super Admin account.');
          stopSync=db.ref('syncChecks/'+u.uid).on('value',s=>{
            const data=s.val();$('latestSync').textContent=data?.message?`${data.message} · ${new Date(data.updatedAt).toLocaleString()}`:'No message yet';
          },e=>message('syncMessage','Sync listener error: '+errorText(e)));
        }catch(e){message('authMessage','Administrator check failed: '+errorText(e));}
      });
    }catch(e){status('Firebase init failed','error');message('authMessage',errorText(e));}
  }
  $('login').addEventListener('submit',async e=>{
    e.preventDefault(); const f=e.currentTarget; const btn=f.querySelector('button');btn.disabled=true;message('authMessage','Signing in…');
    try{await auth.signInWithEmailAndPassword(f.elements.email.value.trim(),f.elements.password.value);f.elements.password.value='';}
    catch(e){message('authMessage','Sign-in failed: '+errorText(e));}
    finally{btn.disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{try{await auth.signOut();}catch(e){message('authMessage',errorText(e));}});
  $('syncForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!admin||!currentUid)return;const input=$('syncInput');const data={message:input.value.trim().slice(0,120),updatedAt:firebase.database.ServerValue.TIMESTAMP};
    if(!data.message)return;message('syncMessage','Saving…');
    try{await db.ref('syncChecks/'+currentUid).set(data);message('syncMessage','Saved on Firebase. Open this test page on another device to verify sync.');}
    catch(err){message('syncMessage','Save failed: '+errorText(err));}
  });
  $('productForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!admin)return;const f=e.currentTarget;const price=Number(f.elements.price.value),stock=Number(f.elements.stock.value);const photo=f.elements.image.value.trim();
    if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(stock)||stock<0|| (photo&&!img(photo))){message('productMessage','Enter a valid price, whole-number stock, and HTTPS photo URL.');return;}
    const item={title:f.elements.title.value.trim().slice(0,120),category:f.elements.category.value.trim().slice(0,70),price,stock,image:photo,description:f.elements.description.value.trim().slice(0,500),updatedAt:firebase.database.ServerValue.TIMESTAMP};
    if(!item.title||!item.category)return;
    const btn=f.querySelector('button[type=submit]');btn.disabled=true;message('productMessage','Saving product to Firebase…');
    try{await db.ref('catalog').push(item);f.reset();message('productMessage','Product saved. All open pages will receive the update.');}
    catch(err){message('productMessage','Could not save product: '+errorText(err));}
    finally{btn.disabled=false;}
  });
  init();
})();
