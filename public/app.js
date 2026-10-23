const $=s=>document.querySelector(s);
const canvas=$('#canvas'), wrap=$('#canvas-wrap');
let board, activeTab=localStorage.getItem('pink-tab')||'everyday', selected=null, editing=true, scale=1, dirty=false, saving=false, generation=0, saveTimer, gesture=null, pendingRemote=null;
let modalAction=null, toastTimer;
const tab=()=>board.tabs.find(t=>t.id===activeTab)||board.tabs[0];
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function status(message){$('#save-status').textContent=message;}
function escapeHTML(value){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function resizeCanvas(){
  scale=wrap.clientWidth/1100;
  const height=Math.max(660,...(board?tab().images:[]).map(i=>i.y+i.h+65));
  canvas.style.height=height+'px';canvas.style.transform=`scale(${scale})`;canvas.style.setProperty('--inv-scale',1/scale);wrap.style.height=height*scale+'px';
}
new ResizeObserver(resizeCanvas).observe(wrap);
function render(){
  if(!board.tabs.some(t=>t.id===activeTab)) activeTab=board.tabs[0].id;
  document.documentElement.style.setProperty('--page',board.background);$('#colour').value=board.background;
  $('#tabs').replaceChildren(...board.tabs.map(t=>{
    const b=document.createElement('button');b.textContent=t.name;b.className=t.id===activeTab?'active':'';
    b.setAttribute('aria-current',t.id===activeTab?'page':'false');
    if(t.id===activeTab){const s=document.createElement('span');s.className='tab-star';s.textContent='✧';b.append(s);}
    b.onclick=()=>{activeTab=t.id;localStorage.setItem('pink-tab',activeTab);selected=null;render();};return b;
  }));
  $('#board-description').textContent=tab().description;$('#count').textContent=`${tab().images.length} little ${tab().images.length===1?'thing':'things'}`;
  canvas.querySelectorAll('.pin').forEach(el=>el.remove());
  for(const [index,i] of tab().images.entries()){
    const el=document.createElement('div');el.className='pin'+(i.link?' linked':'');el.dataset.id=i.id;el.tabIndex=0;
    el.setAttribute('aria-label',i.caption||`Image ${index+1}${i.link?', linked':''}`);
    el.innerHTML=`<img src="${escapeHTML(i.src)}" alt="${escapeHTML(i.caption||'A collected image')}" draggable="false"><span class="handle" aria-hidden="true"></span>${i.link?'<span class="link-mark">↗</span>':''}${i.caption?`<span class="caption">${escapeHTML(i.caption)}</span>`:''}`;
    setPosition(el,i);el.style.zIndex=index+1;
    el.addEventListener('pointerdown',e=>startGesture(e,i,el));
    el.addEventListener('dblclick',()=>{if(editing){select(i.id);editImage();}});
    el.addEventListener('click',()=>{if(!editing&&i.link)window.open(i.link,'_blank','noopener,noreferrer');});
    el.addEventListener('keydown',e=>{
      if(e.key==='Enter'){if(editing){select(i.id);editImage();}else if(i.link)window.open(i.link,'_blank','noopener,noreferrer');}
      if(editing&&e.key.startsWith('Arrow')){e.preventDefault();select(i.id);const d=e.shiftKey?10:2;i.x=Math.max(0,Math.min(1100-i.w,i.x+({'ArrowLeft':-d,'ArrowRight':d}[e.key]||0)));i.y=Math.max(0,Math.min(10000,i.y+({'ArrowUp':-d,'ArrowDown':d}[e.key]||0)));setPosition(el,i);changed();resizeCanvas();}
    });
    canvas.append(el);
  }
  canvas.classList.toggle('is-empty',tab().images.length===0);select(selected);resizeCanvas();
}
function setPosition(el,i){Object.assign(el.style,{left:i.x+'px',top:i.y+'px',width:i.w+'px',height:i.h+'px'});}
function select(id){selected=editing&&tab().images.some(i=>i.id===id)?id:null;canvas.querySelectorAll('.pin').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected));$('#image-toolbar').hidden=!selected;}
function startGesture(e,i,el){
  if(!editing||e.button!==0)return;e.preventDefault();select(i.id);
  const resizing=e.target.classList.contains('handle');
  gesture={id:i.id,startX:e.clientX,startY:e.clientY,x:i.x,y:i.y,w:i.w,h:i.h,resizing,moved:false};
  el.setPointerCapture(e.pointerId);
  const move=ev=>{
    const dx=(ev.clientX-gesture.startX)/scale,dy=(ev.clientY-gesture.startY)/scale;
    if(Math.abs(dx)+Math.abs(dy)<2&&!gesture.moved)return;gesture.moved=true;
    if(resizing){const ratio=gesture.h/gesture.w;const delta=Math.abs(dx)>Math.abs(dy/ratio)?dx:dy/ratio;const minW=Math.max(40,40/ratio),maxW=Math.min(1100-i.x,3000/ratio);i.w=Math.min(maxW,Math.max(minW,gesture.w+delta));i.h=i.w*ratio;}
    else {i.x=Math.max(0,Math.min(1100-i.w,gesture.x+dx));i.y=Math.max(0,Math.min(10000,gesture.y+dy));}
    setPosition(el,i);resizeCanvas();
  };
  const end=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);const moved=gesture?.moved;gesture=null;if(moved)changed();else applyPending();};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
canvas.addEventListener('pointerdown',e=>{if(e.target===canvas||e.target.closest('#empty'))select(null);});
function changed(){dirty=true;generation++;status('unsaved changes');clearTimeout(saveTimer);saveTimer=setTimeout(save,350);}
async function save(){
  if(saving||!dirty||gesture)return;
  saving=true;status('saving…');const version=generation;
  try{
    const res=await fetch('/api/board',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(board.revision)},body:JSON.stringify(board)});
    const result=await res.json();
    if(res.status===409){
      // Keep the unsaved local copy until the user explicitly resolves the conflict.
      pendingRemote=result.board;status('conflict · click to resolve');$('#save-status').onclick=resolveConflict;
      toast('Another window changed this collection. Click the save status to choose which version to keep.');return;
    }
    if(!res.ok)throw new Error(result.error);
    board.revision=result.revision;dirty=generation!==version;pendingRemote=null;
    status(dirty?'saving…':'all changes saved');
  }catch(err){status('not saved · retry');$('#save-status').onclick=()=>{save();};toast('Could not save. Your changes are still here. Check your connection, then click retry.');}
  finally{saving=false;if(dirty&&!pendingRemote&&generation!==version)saveTimer=setTimeout(save,350);}
}
function resolveConflict(){
  if(!pendingRemote)return;
  openModal('two windows, one collection',[
    {type:'hint',text:'Another window saved changes while you were editing. Keep your version to replace theirs, or use the saved version to discard your unsaved edits.'}
  ],()=>{board.revision=pendingRemote.revision;pendingRemote=null;$('#save-status').onclick=null;save();},'keep my version',()=>{board=pendingRemote;pendingRemote=null;dirty=false;$('#save-status').onclick=null;status('all changes saved');render();},'use saved version');
}
function applyPending(){if(pendingRemote&&!dirty&&!gesture&&!$('#modal').open){board=pendingRemote;pendingRemote=null;render();status('updated from another window');}}
setInterval(async()=>{
  if(!board||saving||document.hidden)return;
  try{const res=await fetch('/api/board');if(!res.ok)return;const remote=await res.json();if(remote.revision>board.revision){pendingRemote=remote;applyPending();}}catch{}
},2200);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
function openModal(title,fields,onSubmit,submit='save',onDelete=null,deleteLabel='delete tab'){
  $('#modal-title').textContent=title;$('#modal-fields').replaceChildren();$('#modal-error').textContent='';
  for(const field of fields){
    if(field.type==='hint'){const p=document.createElement('p');p.className='hint';p.textContent=field.text;$('#modal-fields').append(p);continue;}
    const label=document.createElement('label');label.textContent=field.label;label.htmlFor=field.name;
    const input=document.createElement('input');Object.assign(input,{id:field.name,name:field.name,value:field.value||'',placeholder:field.placeholder||'',maxLength:field.maxLength||200});input.autocomplete='off';if(field.required)input.required=true;
    $('#modal-fields').append(label,input);
  }
  $('#modal-submit').textContent=submit;$('#modal-delete').hidden=!onDelete;$('#modal-delete').textContent=deleteLabel;
  $('#modal-delete').onclick=()=>{onDelete?.();$('#modal').close();applyPending();};
  modalAction=onSubmit;$('#modal').showModal();
}
$('#modal-form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));if(modalAction(values)!==false){$('#modal').close();applyPending();}}catch(err){$('#modal-error').textContent=err.message;}};
for(const id of ['#close-modal','#cancel-modal'])$(id).onclick=()=>{$('#modal').close();applyPending();};
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){$('#modal').close();applyPending();}});
function editImage(){
  const i=tab().images.find(i=>i.id===selected);if(!i)return;
  openModal('a link, a little context.',[
    {name:'url',label:'where should this image take you?',value:i.link,placeholder:'https://somewhere-lovely.com',maxLength:2048},
    {name:'caption',label:'a small caption (optional)',value:i.caption,placeholder:'a thought, a place, a reminder…'},
    {type:'hint',text:'Leave the link empty for an image with no destination. Switch to browse to follow links.'}
  ],v=>{let link=v.url.trim();if(link&&!/^[a-z][a-z\d+.-]*:/i.test(link))link='https://'+link;if(link){let u;try{u=new URL(link);}catch{throw new Error('Enter a valid website address.');}if(!['http:','https:'].includes(u.protocol))throw new Error('Please use an http or https link.');link=u.href;}i.link=link;i.caption=v.caption.trim();render();changed();});
}
$('#link-image').onclick=editImage;
$('#delete-image').onclick=()=>{if(!selected)return;tab().images=tab().images.filter(i=>i.id!==selected);select(null);render();changed();};
$('#forward-image').onclick=()=>{const images=tab().images;const idx=images.findIndex(i=>i.id===selected);if(idx<0)return;images.push(...images.splice(idx,1));render();changed();};
$('#deselect').onclick=()=>select(null);
document.addEventListener('keydown',e=>{if($('#modal').open||['INPUT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape')select(null);if(editing&&selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();$('#delete-image').click();}});
function setMode(edit){editing=edit;select(null);document.body.classList.toggle('browsing',!edit);document.body.classList.toggle('readonly',!edit);$('#edit').classList.toggle('active',edit);$('#browse').classList.toggle('active',!edit);$('#edit').setAttribute('aria-pressed',edit);$('#browse').setAttribute('aria-pressed',!edit);$('#help').textContent=edit?'drag to arrange · pull a corner to resize · double-click to add a link':'a collection to wander through · click linked images to explore';}
$('#edit').onclick=()=>setMode(true);$('#browse').onclick=()=>setMode(false);
$('#add-tab').onclick=()=>openModal('make a little space.',[{name:'name',label:'tab name',placeholder:'flowers, daydreams, whatever…',maxLength:60,required:true},{name:'description',label:'a few words (optional)',placeholder:'things i want to remember',maxLength:300}],v=>{
  if(!v.name.trim())throw new Error('Give your tab a name.');if(board.tabs.length>=50)throw new Error('This prototype supports up to 50 tabs.');
  const t={id:crypto.randomUUID(),name:v.name.trim(),description:v.description.trim(),images:[]};board.tabs.push(t);activeTab=t.id;localStorage.setItem('pink-tab',activeTab);selected=null;render();changed();
},'create tab');
$('#tab-options').onclick=()=>{const t=tab();openModal('this little space.',[{name:'name',label:'tab name',value:t.name,maxLength:60,required:true},{name:'description',label:'a few words (optional)',value:t.description,maxLength:300}],v=>{if(!v.name.trim())throw new Error('Give your tab a name.');t.name=v.name.trim();t.description=v.description.trim();render();changed();},'save',board.tabs.length>1?()=>{
  if(t.images.length&&!confirm('Delete this tab and its images? This cannot be undone.'))return;
  board.tabs=board.tabs.filter(x=>x.id!==t.id);selected=null;render();changed();
}:null);};
$('#background').onclick=()=>$('#colour').click();$('#colour').oninput=e=>{board.background=e.target.value;document.documentElement.style.setProperty('--page',board.background);changed();};
$('#add-images').onclick=$('#empty-add').onclick=()=>$('#file-input').click();
$('#file-input').onchange=async e=>{await addFiles([...e.target.files]);e.target.value='';};
async function addFiles(files,point){
  if(!editing||!board)return;
  const target=tab(),targetId=target.id;let added=0;
  for(const file of files){
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){toast('Choose a JPG, PNG, GIF or WebP image.');continue;}
    if(file.size>12*1024*1024){toast('That image is too big. Choose a file smaller than 12 MB.');continue;}
    if(target.images.length>=300){toast('This tab is full. Make a new tab for more images.');break;}
    try{
      status('uploading…');
      const blobURL=URL.createObjectURL(file);let width,height;
      try{const img=new Image();img.src=blobURL;await img.decode();width=img.naturalWidth;height=img.naturalHeight;}finally{URL.revokeObjectURL(blobURL);}
      const res=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await res.json();if(!res.ok)throw new Error(result.error);
      // The active tab can change during upload; keep the image on its original tab.
      const destination=board.tabs.find(t=>t.id===targetId);if(!destination)throw new Error('The destination tab was removed. Please upload again.');
      const ratio=height/width;const w=Math.max(40,Math.min(270,420/ratio)),h=Math.max(40,w*ratio);
      const n=destination.images.length;
      const i={id:crypto.randomUUID(),src:result.src,x:Math.max(0,Math.min(1100-w,(point?.x??(45+(n%3)*330))+added*24)),y:Math.max(0,Math.min(10000,(point?.y??(40+Math.floor(n/3)*310))+added*24)),w,h,link:'',caption:''};
      destination.images.push(i);selected=i.id;added++;render();changed();
    }catch(err){toast(err.message||'Could not upload this image. Please try again.');status(dirty?'unsaved changes':'upload failed');}
  }
  if(added)toast(added===1?'a little something, added.':`${added} little things, added.`);
}
document.addEventListener('paste',e=>{if($('#modal').open||!editing)return;const files=[...(e.clipboardData?.items||[])].filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();addFiles(files);}});
let dragDepth=0;
wrap.addEventListener('dragenter',e=>{if(!editing||!e.dataTransfer.types.includes('Files'))return;e.preventDefault();dragDepth++;wrap.classList.add('dropping');});
wrap.addEventListener('dragover',e=>{if(editing&&e.dataTransfer.types.includes('Files'))e.preventDefault();});
wrap.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;wrap.classList.remove('dropping');}});
wrap.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;wrap.classList.remove('dropping');const r=wrap.getBoundingClientRect();addFiles([...e.dataTransfer.files],{x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale});});
async function init(){try{const res=await fetch('/api/board');if(!res.ok)throw new Error();board=await res.json();render();status('all changes saved');}catch{status('could not connect · retry');$('#save-status').onclick=init;toast('The collection could not load. Click retry to reconnect.');}}
init();
