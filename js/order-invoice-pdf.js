/* MOIN QURAN BOX — dependency-free, downloadable NON-TAX order invoice PDF.
 * This is generated from the authenticated order already loaded under Firebase rules.
 * It is an order record, not proof of payment or a GST tax invoice.
 */
(() => {
  'use strict';
  const clean = value => String(value ?? '').normalize('NFKD')
    .replace(/[\u20B9]/g, 'INR ').replace(/[\u2010-\u2015]/g,'-')
    .replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"')
    .replace(/[^\x20-\x7E]/g, '?').replace(/\s+/g, ' ').trim();
  const escapePdf = value => clean(value).replace(/[\\()]/g,'\\$&');
  const money = value => 'INR '+(Math.max(0, Number(value)||0)).toFixed(2);
  const short = (value, n=96) => clean(value).slice(0,n);
  const invoiceFields = ({order, shop, profile}) => {
    const o=order||{}, p=profile||{}, c=shop||{};
    const items=Array.isArray(o.items)?o.items:[];
    return {
      shop: short(c.brandName||'MOIN QURAN BOX'),
      shopAddress: short(c.address||'',200),
      contact: short([c.phone1,c.phone2].filter(Boolean).join(' / '),80),
      orderId:short(o.orderId||o.__key||'Unknown',80),
      orderDate:short(o.date||'',60),
      status:short(o.status||'Requested',48),
      payment:short(o.paymentStatus||'unverified',48),
      channel:short(o.channel||'Website request',60),
      name:short(o.customerName||p.name||'Customer',120),
      email:short(o.customerEmail||o.email||p.email||'',120),
      phone:short(o.customerPhone||p.phone||'',50),
      address:short([o.address,o.city,o.state,o.postalCode].filter(Boolean).join(', '),350),
      delivery:short(o.deliveryChoice||'',100),
      courier:short(o.shipping?.carrier||o.courierName||'',100),
      tracking:short(o.shipping?.trackingNumber||o.awb||'',120),
      items:items.map(x=>({title:short(x.title||x.name||'Item',150), qty:Math.max(0, Number(x.qty??x.quantity)||0), unit:Math.max(0,Number(x.salePrice??x.unitPrice??x.price)||0)})),
      total:Math.max(0,Number(o.total)||0)
    };
  };
  function buildPdf(data) {
    const pageStreams=[]; let commands=[], y=790, page=0;
    function paint(s) { commands.push(s); }
    function startPage() {
      if(commands.length)pageStreams.push(commands.join('\n')+'\n');
      commands=[]; page++;
      paint('0.10 0.23 0.18 rg 0 745 595 97 re f');
      paint('1 1 1 rg');
      paint('BT /F2 20 Tf 42 797 Td ('+escapePdf(data.shop)+') Tj ET');
      paint('BT /F1 10 Tf 42 776 Td (ORDER INVOICE - NON-TAX / ORDER RECORD) Tj ET');
      paint('0.95 0.97 0.95 rg 0 732 595 13 re f');
      paint('0 0 0 rg');
      y=717;
    }
    function textLine(label, content='', opts={}) {
      const indent=opts.indent||42;
      const font=opts.bold?'F2':'F1'; const size=opts.size||10;
      const raw=clean((label||'')+(content ? ': '+clean(content):''));
      const max=opts.max||93;
      let rest=raw;
      while(rest.length){
        if(y<65)startPage();
        let line=rest.slice(0,max);
        if(rest.length>max){const breakAt=line.lastIndexOf(' ');if(breakAt>max*0.5)line=line.slice(0,breakAt);}
        paint('BT /'+font+' '+size+' Tf '+indent+' '+y+' Td ('+escapePdf(line)+') Tj ET');
        y-=opts.leading||16;rest=rest.slice(line.length).trimStart();
      }
      if(!raw)y-=8;
    }
    function section(name){ if(y<105)startPage(); y-=8;paint('0.84 0.88 0.85 RG 42 '+(y+7)+' m 553 '+(y+7)+' l S');textLine(name,'',{bold:true,size:11}); }
    startPage();
    textLine('Order ID',data.orderId,{bold:true});
    textLine('Order date',data.orderDate);
    textLine('Status',data.status);
    textLine('Payment status',data.payment);
    textLine('Order type',data.channel);
    section('SELLER');
    textLine('Store',data.shop);
    if(data.shopAddress)textLine('Address',data.shopAddress);
    if(data.contact)textLine('Contact',data.contact);
    section('CUSTOMER / DELIVERY');
    textLine('Name',data.name);
    if(data.email)textLine('Email',data.email);
    if(data.phone)textLine('Phone',data.phone);
    if(data.address)textLine('Delivery address',data.address);
    if(data.delivery)textLine('Delivery choice',data.delivery);
    section('ITEMS');
    if(!data.items.length)textLine('No item details stored on this order.');
    data.items.forEach((it,index)=>{
      textLine((index+1)+'. '+it.title,'',{bold:true,max:91});
      textLine('   Qty '+it.qty+' x '+money(it.unit),money(it.qty*it.unit),{indent:54});
    });
    section('TOTAL');
    textLine('Recorded order estimate',money(data.total),{bold:true,size:12});
    if(data.courier||data.tracking){section('SHIPPING');if(data.courier)textLine('Carrier',data.courier);if(data.tracking)textLine('Tracking / AWB',data.tracking);}
    y-=10;
    textLine('IMPORTANT: This is a non-tax order record, NOT a GST tax invoice.', '', {bold:true,max:88});
    textLine('It is not proof of payment. Items, taxes, availability and delivery', '', {max:88});
    textLine('charges require seller confirmation. Request a verified tax invoice', '', {max:88});
    textLine('from the seller when legally applicable.', '', {max:88});
    pageStreams.push(commands.join('\n')+'\n');
    const objects=[null];
    const add = content => {objects.push(content);return objects.length-1;};
    const pagesId=add(''); const fontId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds=[];
    pageStreams.forEach(stream=>{
      const streamId=add('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
      pageIds.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+fontId+' 0 R /F2 '+boldId+' 0 R >> >> /Contents '+streamId+' 0 R >>'));
    });
    objects[pagesId]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pageIds.length+' >>';
    const catalogId=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');
    let output='%PDF-1.4\n';const offsets=[0];
    for(let i=1;i<objects.length;i++){offsets.push(output.length);output+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
    const xrefOffset=output.length;
    output+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
    offsets.slice(1).forEach(offset=>{output+=String(offset).padStart(10,'0')+' 00000 n \n';});
    output+='trailer\n<< /Size '+objects.length+' /Root '+catalogId+' 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF\n';
    return output;
  }
  function saveInvoice({order,shop,profile}) {
    const data=invoiceFields({order,shop,profile});
    const pdf=buildPdf(data);
    const blob=new Blob([pdf],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='MOIN-QURAN-BOX-order-'+(data.orderId.replace(/[^a-zA-Z0-9_-]/g,'_')||'invoice')+'.pdf';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
    return {pdf,filename:anchor.download};
  }
  window.MQBInvoicePDF={saveInvoice,invoiceFields,buildPdf};
})();
