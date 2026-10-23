const $=id=>document.getElementById(id), token=()=>sessionStorage.getItem('token'),fmt=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,method='GET',data){const r=await fetch('/api/'+url,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token()||'')},body:data?JSON.stringify(data):undefined});const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw Error('O servidor apresentou uma falha. Tente novamente ou avise o estabelecimento.')}if(!r.ok)throw Error(typeof j.detail==='string'?j.detail:'Não foi possível concluir a solicitação.');return j}
function notify(e){alert(e.message||e)}
async function login(e){e.preventDefault();try{let j=await api('login','POST',{email:$('email').value,password:$('password').value});if(j.role!==document.body.dataset.role&&j.role!=='admin')throw Error('Perfil sem permissão');sessionStorage.setItem('token',j.token);sessionStorage.setItem('role',j.role);location.reload()}catch(e){notify(e)}}
function start(){if(document.body.dataset.role==='cliente')return load();if(!token()){$('auth').hidden=false;$('app').hidden=true}else{$('auth').hidden=true;$('app').hidden=false;load();setInterval(load,12000)}}
function logout(){sessionStorage.clear();location.reload()}
let products=[],cart={},drivers=[],storeMinimum=20,storeSettingsLoaded=false;
async function load(){try{let role=document.body.dataset.role;if(role==='cliente'){products=await api('products');await loadStore();showMenu();renderCart()}else if(role==='admin'){products=await api('products/all');$('list').innerHTML=products.map(p=>`<article><b>${esc(p.name)}</b> — ${fmt(p.price)} (${esc(p.category||'Lanches')}) <button onclick="edit(${p.id})">Editar</button><button onclick="disable(${p.id})">Desativar</button></article>`).join('');$('users').innerHTML=(await api('users')).map(u=>`<p>${esc(u.name)} — ${esc(u.role)} — ${esc(u.email)}</p>`).join('');await showOrders();if(!storeSettingsLoaded){await fillStoreForm();storeSettingsLoaded=true}}else{if(role==='atendente'){drivers=await api('drivers');await counterLoadProducts()}await showOrders()}}catch(e){notify(e)}}
function add(id){cart[id]=(cart[id]||0)+1;renderCart();tabCliente('checkout')}function less(id){cart[id]=Math.max(0,(cart[id]||0)-1);renderCart()}
function renderCart(){$('cart').innerHTML=products.filter(p=>cart[p.id]).map(p=>`<p>${esc(p.name)} × ${cart[p.id]} — ${fmt(p.price*cart[p.id])} <button onclick="less(${p.id})">−</button></p>`).join('')||'Carrinho vazio';$('cart').innerHTML+='<p><b>Subtotal: '+fmt(products.reduce((v,p)=>v+(cart[p.id]||0)*p.price,0))+'</b></p>'}
async function quote(){try{let q=await api('quote','POST',{address:$('address').value});$('quote').textContent=`${q.km} km • ${fmt(q.fee)}`}catch(e){notify(e)}}
async function buy(e){e.preventDefault();let items=Object.entries(cart).filter(x=>x[1]>0).map(([id,qty])=>({product_id:Number(id),qty}));if(!items.length)return notify('Carrinho vazio');const subtotal=products.reduce((v,p)=>v+(cart[p.id]||0)*p.price,0);if(subtotal<storeMinimum)return notify('Pedido mínimo de '+fmt(storeMinimum)+' sem frete.');try{let o=await api('orders','POST',{customer:$('customer').value,phone:$('phone').value,address:$('address').value,payment:$('payment').value,items});$('quote').textContent=`Pedido #${o.id} confirmado — Total ${fmt(o.total)} (frete ${fmt(o.fee)})`;cart={};renderCart()}catch(e){notify(e)}}
async function saveProduct(e){e.preventDefault();let id=$('pid').value,v={name:$('pname').value,description:$('pdesc').value,price:Number($('pprice').value),category:$('pcat').value||'Lanches',photo:$('pphoto').value,active:$('pactive').checked};try{await api(id?'products/'+id:'products',id?'PUT':'POST',v);e.target.reset();$('pid').value='';load()}catch(e){notify(e)}}
function edit(id){let p=products.find(p=>p.id===id);for(let [k,v] of Object.entries({pid:p.id,pname:p.name,pdesc:p.description,pprice:p.price,pcat:p.category,pphoto:p.photo}))$(k).value=v;$('pactive').checked=!!p.active}
async function disable(id){if(confirm('Desativar produto?')){try{await api('products/'+id,'DELETE');load()}catch(e){notify(e)}}}
async function addUser(e){e.preventDefault();try{await api('users','POST',{name:$('uname').value,email:$('uemail').value,password:$('upass').value,role:$('urole').value});e.target.reset();load()}catch(e){notify(e)}}
async function showOrders(){let role=document.body.dataset.role,orders=await api('orders');$('orders').innerHTML=orders.map(o=>`<article><b>#${o.id} — ${esc(o.customer)}</b><p>${esc(o.phone)} • ${esc(o.address)}</p><p>${o.items.map(i=>esc(i.name)+' × '+i.qty).join(', ')}</p><p>${o.distance} km • Frete ${fmt(o.fee)} • Total ${fmt(o.total)} • ${esc(o.status)}</p>${role==='motoboy'?`<a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address+', Belém PA')}">Abrir rota</a> <button ${o.status!=='Saiu para entrega'?'disabled':''} onclick="update(${o.id},true)">Entregue</button>`:role==='atendente'?`<select id="driver${o.id}"><option value="">Motoboy</option>${drivers.map(d=>`<option value="${d.id}" ${o.driver_id===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select><select id="status${o.id}">${['Recebido','Em preparo','Saiu para entrega','Concluído','Cancelado'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select><button onclick="update(${o.id},false)">Salvar</button>`:''}</article>`).join('')||'Nenhum pedido'}
async function update(id,moto){try{let v=moto?{status:'Concluído'}:{status:$('status'+id).value,...($('driver'+id).value?{driver_id:Number($('driver'+id).value)}:{})};if(!moto&&v.status==='Saiu para entrega'&&!v.driver_id)return notify('Escolha motoboy');await api('orders/'+id,'PATCH',v);load()}catch(e){notify(e)}}
// PDV do atendente: carrinho independente do site público
let counterProducts=[],counterCart={},counterProductsLoaded=false;
async function counterLoadProducts(){
 const list=await api('products');counterProducts=list;
 // Não reescrever o formulário enquanto o atendente preenche o pedido.
 showCounterProducts();
 counterRender();
}
function counterAdd(id){counterCart[id]=(counterCart[id]||0)+1;counterRender()}
function counterLess(id){if(counterCart[id])counterCart[id]--;counterRender()}
function counterRender(){
 const chosen=counterProducts.filter(p=>counterCart[p.id]>0);
 $('counter-cart').innerHTML=chosen.map(p=>`<p>${esc(p.name)} × ${counterCart[p.id]} — ${fmt(p.price*counterCart[p.id])} <button type="button" onclick="counterLess(${p.id})">−</button></p>`).join('')||'Nenhum item adicionado.';
 $('counter-total').textContent='Subtotal: '+fmt(chosen.reduce((a,p)=>a+p.price*counterCart[p.id],0));
}
function counterToggle(){const delivery=$('counter-type').value==='entrega';$('counter-delivery').hidden=!delivery;$('counter-phone').required=delivery;$('counter-address').required=delivery;$('counter-quote').textContent=''}
async function counterQuote(){try{let q=await api('quote','POST',{address:$('counter-address').value});$('counter-quote').textContent=`${q.km} km — Frete ${fmt(q.fee)}`}catch(e){notify(e)}}
async function counterCheckout(e){
 e.preventDefault();let items=Object.entries(counterCart).filter(([id,q])=>q>0).map(([id,qty])=>({product_id:Number(id),qty}));
 if(!items.length)return notify('Adicione pelo menos um lanche.');
 let btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
 try{
  let order=await api('counter-orders','POST',{customer:$('counter-name').value,phone:$('counter-phone').value,address:$('counter-address').value,delivery:$('counter-type').value==='entrega',payment:$('counter-payment').value,items});
  $('counter-result').textContent=`Pedido #${order.id} registrado! Frete ${fmt(order.fee)} — Total ${fmt(order.total)}.`;
  counterCart={};counterRender();e.target.reset();counterToggle();await showOrders();
 }catch(err){notify(err)}finally{btn.disabled=false}
}

function tabCliente(tab){const menu=tab==='menu';$('client-menu').hidden=!menu;$('client-checkout').hidden=menu;window.scrollTo({top:0,behavior:'smooth'})}

// Catálogo do cliente: busca, categorias e fotos retiradas do PDF.
let menuCategory='Todos';
function categoryButtons(items,container,selected,fn){
 const categories=['Todos',...new Set(items.map(p=>p.category||'Lanches'))];
 const target=$(container);if(!target)return;
 target.innerHTML=categories.map((cat,i)=>`<button type="button" class="${selected===cat?'selected':''}" onclick="${fn}(${i})">${esc(cat)}</button>`).join('');
}
function productCard(p,buttonAction){
 const photo=p.photo?`<img class="product-photo" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="product-photo"></div>';
 return `<article class="product-card">${photo}<div class="product-info"><span class="product-category">${esc(p.category||'Lanches')}</span><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><span class="product-price">${fmt(p.price)}</span><button type="button" onclick="${buttonAction}(${p.id})">Adicionar +</button></div></article>`;
}
function chooseMenuCategory(index){let categories=['Todos',...new Set(products.map(p=>p.category||'Lanches'))];menuCategory=categories[index]||'Todos';showMenu()}
function showMenu(){
 const search=($('menu-search')?.value||'').trim().toLocaleLowerCase('pt-BR');
 const categories=['Todos',...new Set(products.map(p=>p.category||'Lanches'))];
 if(!categories.includes(menuCategory))menuCategory='Todos';
 categoryButtons(products,'menu-categories',menuCategory,'chooseMenuCategory');
 const filtered=products.filter(p=>(menuCategory==='Todos'||p.category===menuCategory)&&(!search||(p.name+' '+p.description+' '+p.category).toLocaleLowerCase('pt-BR').includes(search)));
 $('list').innerHTML=filtered.map(p=>productCard(p,'add')).join('')||'<p>Nenhum produto encontrado.</p>';
}
let counterCategory='Todos';
function chooseCounterCategory(index){let categories=['Todos',...new Set(counterProducts.map(p=>p.category||'Lanches'))];counterCategory=categories[index]||'Todos';showCounterProducts()}
function showCounterProducts(){
 const search=($('counter-search')?.value||'').trim().toLocaleLowerCase('pt-BR');
 categoryButtons(counterProducts,'counter-categories',counterCategory,'chooseCounterCategory');
 const filtered=counterProducts.filter(p=>(counterCategory==='Todos'||p.category===counterCategory)&&(!search||(p.name+' '+p.description+' '+p.category).toLocaleLowerCase('pt-BR').includes(search)));
 $('counter-products').innerHTML=filtered.map(p=>productCard(p,'counterAdd')).join('')||'<p>Nenhum produto encontrado.</p>';
}
async function previewImport(){
 try{
  const p=await api('catalog/preview');
  $('import-preview').innerHTML=`<p><b>${p.total} produtos</b> em ${Object.keys(p.categories).length} categorias; <b>${p.create} novos</b> e <b>${p.update} a atualizar</b>.</p><p>Os produtos existentes com o mesmo nome terão preço, descrição e categoria atualizados. Fotos personalizadas já cadastradas serão mantidas. Os demais produtos e os pedidos serão preservados.</p><button type="button" onclick="importCatalog()">Confirmar importação do cardápio</button>`;
 }catch(e){notify(e)}
}
async function importCatalog(){
 if(!confirm('Confirmar a importação dos 43 produtos do PDF? Os preços dos produtos com o mesmo nome serão atualizados.'))return;
 try{
  const r=await api('catalog/import','POST');
  $('import-preview').innerHTML=`<p><b>Importação concluída!</b> ${r.created} produtos adicionados e ${r.updated} atualizados.</p>`;
  await load();
 }catch(e){notify(e)}
}
async function loadStore(){
 try{const st=await api('store');storeMinimum=st.minimum_order;const el=$('store-info');if(el)el.textContent='Pedido mínimo '+fmt(st.minimum_order)+' • Horário '+st.hours;}catch(e){console.warn('Não foi possível consultar configurações da loja',e)}
}
async function fillStoreForm(){
 const st=await api('store');$('minimum-order').value=st.minimum_order;$('store-hours').value=st.hours;
}
async function saveStore(e){
 e.preventDefault();try{await api('store','PUT',{minimum_order:Number($('minimum-order').value),hours:$('store-hours').value});alert('Configurações salvas!')}catch(err){notify(err)}
}
start();
