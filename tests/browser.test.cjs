// Development checks only. The website itself has no dependencies.
// Run: node --test tests/browser.test.cjs (requires Playwright and Chromium).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const account='00000000-0000-4000-8000-000000000001';
let html;
async function launch(t,cloud=false){
 html=await fs.readFile(path.join(root,'index.html'),'utf8');
 const pageHtml=cloud?html.replace("const CLOUD = { url: '', key: '' };","const CLOUD = { url: 'https://test.supabase.co', key: 'sb_publishable_test' };"):html;
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(pageHtml);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
 return{browser,url:`http://127.0.0.1:${server.address().port}`};
}
async function ready(page){await page.waitForFunction(()=>document.querySelectorAll('.pin').length===7&&[...document.images].every(i=>i.complete&&i.naturalWidth));}
async function accountLogin(page,url){
 await page.goto(url);await ready(page);await page.locator('#account').click();await page.locator('input[name=email]').fill('owner@example.com');await page.locator('input[name=password]').fill('test-password');await page.locator('#modal-submit').click();await page.waitForFunction(()=>document.querySelector('#account').textContent==='my account');
}
test('single HTML on a plain static host persists edits, uploads and paste, restores backups, and fits mobile',async t=>{
 const {browser,url}=await launch(t);
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await ready(page);assert.match(await page.locator('#save-status').innerText(),/preview/);
 const dependencies=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel=stylesheet]')].length);assert.equal(dependencies,0);
 const pin=page.locator('.pin').first(),box=await pin.boundingBox();
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+80,box.y+65,{steps:6});await page.mouse.up();
 assert((await pin.boundingBox()).x>box.x+40);
 const corner=await pin.locator('.handle').boundingBox();await page.mouse.move(corner.x+4,corner.y+4);await page.mouse.down();await page.mouse.move(corner.x+40,corner.y+50,{steps:6});await page.mouse.up();assert((await pin.boundingBox()).width>box.width+25);
 await page.locator('#link-image').click();await page.locator('input[name=url]').fill('https://example.com/kept');await page.locator('input[name=caption]').fill('a memory');await page.locator('#modal-submit').click();
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('saved in this browser'));
 await page.reload();await ready(page);assert.equal(await page.locator('.caption').first().innerText(),'a memory');
 await page.locator('#browse').click();await page.context().route('https://example.com/**',r=>r.fulfill({body:'linked destination'}));
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('.pin').first().click()]);await popup.waitForLoadState();assert.equal(popup.url(),'https://example.com/kept');await popup.close();
 await page.locator('#edit').click();await page.locator('#add-tab').click();await page.locator('input[name=name]').fill('flowers');await page.locator('#modal-submit').click();assert(await page.locator('#empty').isVisible());
 const sample=await page.evaluate(()=>SAMPLES['05']);const buffer=Buffer.from(sample.split(',')[1],'base64');
 await page.locator('#file-input').setInputFiles({name:'flower.jpg',mimeType:'image/jpeg',buffer});await page.waitForFunction(()=>document.querySelectorAll('.pin').length===1);
 await page.evaluate(data=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(data)],'pasted.jpg',{type:'image/jpeg'}));document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true}));},[...buffer]);await page.waitForFunction(()=>document.querySelectorAll('.pin').length===2);
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('saved in this browser'));
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#backup').click()]);const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(backup.tabs.at(-1).images.length,2);assert.match(backup.tabs.at(-1).images[0].src,/^data:image\/jpeg/);
 await page.locator('.pin').first().click();await page.locator('#delete-image').click();await page.waitForFunction(()=>document.querySelectorAll('.pin').length===1);
 page.once('dialog',d=>d.accept());await page.locator('#backup-input').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.querySelectorAll('.pin').length===2);
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('saved in this browser'));
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.pin').length===2);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
 assert.deepEqual(errors,[]);
});
test('cloud protocol: private upload, cross-session sync, conflicts, refresh, and logout',async t=>{
 const {browser,url}=await launch(t,true);const boards=new Map(),objects=new Map();let refreshes=0,uploads=0;
 async function service(route){
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method();
  const reply=(status,value,headers={})=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*',...headers},body:typeof value==='string'?value:JSON.stringify(value)});
  if(method==='OPTIONS')return reply(204,'');
  if(p.startsWith('/auth/v1/token')){if(u.search.includes('refresh_token'))refreshes++;return reply(200,{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:account,email:'owner@example.com'}});}
  if(p==='/auth/v1/logout')return reply(204,'');
  assert.equal(req.headers().authorization,'Bearer test-access');
  if(p==='/rest/v1/pink_boards'){
   const queryOwner=u.searchParams.get('user_id')?.slice(3);
   if(method==='GET')return reply(200,boards.has(queryOwner)?[boards.get(queryOwner)]:[]);
   const data=req.postDataJSON();
   if(method==='POST'){if(boards.has(data.user_id))return reply(409,{message:'duplicate'});boards.set(data.user_id,data);return reply(201,'');}
   if(method==='PATCH'){const row=boards.get(queryOwner);if(row.revision!==Number(u.searchParams.get('revision')?.slice(3)))return reply(200,[]);const next={...row,...data};boards.set(queryOwner,next);return reply(200,[next]);}
  }
  if(p.startsWith('/storage/v1/object/pink-images/')&&method==='POST'){assert(p.includes(account+'/'));objects.set(p.replace('/object/','/object/authenticated/'),req.postDataBuffer());uploads++;return reply(200,{Key:'ok'});}
  if(p.startsWith('/storage/v1/object/authenticated/pink-images/')){assert(p.includes(account+'/'));const data=objects.get(p);assert(data);return route.fulfill({status:200,contentType:'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'},body:data});}
  throw new Error('Unexpected API call: '+method+' '+p);
 }
 const a=await browser.newContext(),b=await browser.newContext();await a.route('https://test.supabase.co/**',service);await b.route('https://test.supabase.co/**',service);
 const p=await a.newPage(),q=await b.newPage();const errors=[];for(const pg of[p,q])pg.on('pageerror',e=>errors.push(e.message));
 await accountLogin(p,url);await accountLogin(q,url);
 const img=p.locator('.pin').first();await img.click();await p.locator('#link-image').click();await p.locator('input[name=url]').fill('https://example.com/shared');await p.locator('input[name=caption]').fill('from another device');await p.locator('#modal-submit').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='all changes saved');
 await q.waitForFunction(()=>document.querySelector('.caption')?.textContent==='from another device');
 const image=await p.evaluate(()=>SAMPLES['01']);await p.locator('#file-input').setInputFiles({name:'cloud.jpg',mimeType:'image/jpeg',buffer:Buffer.from(image.split(',')[1],'base64')});await p.waitForFunction(()=>document.querySelectorAll('.pin').length===8);await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='all changes saved');
 assert.equal(uploads,1);assert.match(boards.get(account).data.tabs[0].images.at(-1).src,/^storage:/);
 await q.waitForFunction(()=>document.querySelectorAll('.pin').length===8&&[...document.images].every(i=>i.complete&&i.naturalWidth));
 // An expiry forces the refresh-token path before the next write.
 await p.evaluate(()=>{session.expires_at=0;});await img.click();await p.locator('#forward-image').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='all changes saved');assert(refreshes>0);
 // Force the stored revision ahead without delivering it to the client.
 const current=boards.get(account);boards.set(account,{...current,revision:current.revision+1});
 await p.locator('.pin').first().click();await p.locator('#delete-image').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('conflict'));
 await p.locator('#save-status').click();await p.locator('#modal-submit').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='all changes saved');
 assert.equal(boards.get(account).data.tabs[0].images.length,7);
 await p.locator('#account').click();await p.locator('#modal-delete').click();await p.waitForFunction(()=>document.querySelector('#account').textContent==='sign in to sync');assert.match(await p.locator('#save-status').innerText(),/preview/);
 assert.deepEqual(errors,[]);
});
