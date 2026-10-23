import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml' };
const allowedTypes = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp'};
const seed = () => ({ revision:0, background:'#ffffff', tabs:[
  {id:'everyday',name:'everyday',description:'little things that caught my eye',images:[
    {id:'seed-1',src:'/photos/01.jpg',x:34,y:37,w:245,h:300,caption:'a place to disappear for a while',link:''},
    {id:'seed-2',src:'/photos/02.jpg',x:342,y:13,w:213,h:159,caption:'',link:''},
    {id:'seed-3',src:'/photos/03.jpg',x:640,y:52,w:187,h:247,caption:'',link:''},
    {id:'seed-4',src:'/photos/04.jpg',x:884,y:7,w:181,h:190,caption:'',link:''},
    {id:'seed-5',src:'/photos/05.jpg',x:315,y:245,w:253,h:313,caption:'a small kind of magic',link:''},
    {id:'seed-6',src:'/photos/06.jpg',x:641,y:373,w:256,h:190,caption:'',link:''},
    {id:'seed-7',src:'/photos/07.jpg',x:51,y:421,w:185,h:158,caption:'',link:''}
  ]},
  {id:'places',name:'places',description:'somewhere i would rather be',images:[]},
  {id:'interiors',name:'interiors',description:'rooms to dream about',images:[]},
  {id:'art',name:'art & objects',description:'things worth a second look',images:[]},
  {id:'someday',name:'someday',description:'a few things for later',images:[]}
] });

export function validateBoard(board) {
  if (!board || !/^#[\da-f]{6}$/i.test(board.background) || !Array.isArray(board.tabs) || !board.tabs.length || board.tabs.length > 50) return false;
  const ids = new Set();
  return board.tabs.every(t => {
    if (!t || typeof t.id !== 'string' || ids.has(t.id) || t.id.length > 100 || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 60 || typeof t.description !== 'string' || t.description.length > 300 || !Array.isArray(t.images) || t.images.length > 300) return false;
    ids.add(t.id);
    const imageIds = new Set();
    return t.images.every(i => {
      if (!i || typeof i.id !== 'string' || i.id.length > 100 || imageIds.has(i.id)) return false;
      imageIds.add(i.id);
      return typeof i.src === 'string' && /^\/(?:photos\/[\w.-]+\.jpg|uploads\/[\w-]+\.(?:jpg|png|gif|webp))$/.test(i.src)
        && typeof i.caption === 'string' && i.caption.length <= 200
        && typeof i.link === 'string' && i.link.length <= 2048 && (!i.link || validLink(i.link))
        && ['x','y','w','h'].every(k => Number.isFinite(i[k]))
        && i.x >= 0 && i.y >= 0 && i.x + i.w <= 1101 && i.y <= 10000 && i.w >= 40 && i.h >= 40 && i.w <= 1100 && i.h <= 3000;
    });
  });
}
function validLink(value) { try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; } }
async function body(req, limit) {
  const parts=[]; let size=0;
  for await (const part of req) { size+=part.length; if(size>limit) { const err=new Error('File is too large. Maximum 12 MB.');err.status=413;throw err; } parts.push(part); }
  return Buffer.concat(parts);
}
function signatureMatches(type, data) {
  if(type==='image/jpeg') return data[0]===255 && data[1]===216 && data[2]===255;
  if(type==='image/png') return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/gif') return /^GIF8[79]a/.test(data.subarray(0,6).toString());
  return type==='image/webp' && data.subarray(0,4).toString()==='RIFF' && data.subarray(8,12).toString()==='WEBP';
}

export async function createApp({dataDir=process.env.DATA_DIR || path.join(root,'data')}={}) {
  await mkdir(path.join(dataDir,'uploads'),{recursive:true});
  const stateFile=path.join(dataDir,'board.json');
  let board;
  try { board=JSON.parse(await readFile(stateFile,'utf8')); if(!validateBoard(board)) throw new Error('Saved board is invalid; refusing to overwrite it.'); }
  catch(err) { if(err.code!=='ENOENT') throw err; board=seed(); await writeFile(stateFile,JSON.stringify(board)); }
  let queue=Promise.resolve();
  return http.createServer(async (req,res) => {
    const json=(status,data) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost');
      // This is a shared-board prototype. Same-origin checks block cross-site writes.
      if (!['GET','HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return json(403,{error:'Cross-origin writes are not allowed.'});
      if(url.pathname==='/api/board' && req.method==='GET') return json(200,board);
      if(url.pathname==='/api/board' && req.method==='PUT') {
        const incoming=JSON.parse((await body(req,2*1024*1024)).toString());
        if(!validateBoard(incoming)) return json(400,{error:'Invalid board data.'});
        const update = queue.then(async()=>{
          if(Number(req.headers['if-match'])!==board.revision || req.headers['if-match']===undefined) return json(409,{error:'This collection changed in another window. Your latest changes have not been saved.',board});
          const next={background:incoming.background,tabs:incoming.tabs,revision:board.revision+1};
          await writeFile(stateFile+'.tmp',JSON.stringify(next));
          await rename(stateFile+'.tmp',stateFile);
          board=next;json(200,board);
        });
        queue=update.catch(()=>{});await update;return;
      }
      if(url.pathname==='/api/upload' && req.method==='POST') {
        const type=req.headers['content-type']?.split(';')[0];
        if(!allowedTypes[type]) return json(415,{error:'Choose a JPG, PNG, GIF or WebP image.'});
        const bytes=await body(req,12*1024*1024);
        if(!signatureMatches(type,bytes)) return json(415,{error:'This file does not look like a supported image.'});
        const filename=randomUUID()+'.'+allowedTypes[type];
        await writeFile(path.join(dataDir,'uploads',filename),bytes,{flag:'wx'});
        return json(201,{src:'/uploads/'+filename});
      }
      if(!['GET','HEAD'].includes(req.method)) return json(405,{error:'Method not allowed.'});
      let filename;
      const pathname=decodeURIComponent(url.pathname);
      if(pathname.startsWith('/uploads/')) {
        if(!/^\/uploads\/[\w-]+\.(jpg|png|gif|webp)$/.test(pathname)) return json(404,{error:'Not found.'});
        filename=path.join(dataDir,pathname);
      } else {
        const relative=pathname==='/'?'index.html':pathname.slice(1);
        filename=path.resolve(root,'public',relative);
        if(!filename.startsWith(path.join(root,'public')+path.sep)) return json(404,{error:'Not found.'});
      }
      const content=await readFile(filename);
      res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':pathname.startsWith('/uploads/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:content);
    } catch(err) { if(!res.headersSent) json(err.status || (err.code==='ENOENT'?404:err instanceof SyntaxError?400:500),{error:err.status?err.message:err.code==='ENOENT'?'Not found.':'The request could not be completed.'});else res.end(); }
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await createApp();
  app.listen(Number(process.env.PORT)||3000,process.env.HOST||'0.0.0.0',()=>console.log(`pink index is listening on port ${app.address().port}`));
}
