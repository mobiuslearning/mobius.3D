import { albums as demos, type Album, type AlbumPage } from './albums';
import { FolioScene } from './scene';
import { saveAlbum,loadAlbums } from './storage';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const allAlbums=[...demos];
let scene:FolioScene|null=null;
let active:Album|null=null;
let spread=0;
let currentVideos:HTMLVideoElement[]=[];
let soundEnabled=false;
let audio:AudioContext|undefined;
let filter='全部';
let toastTimer:ReturnType<typeof setTimeout>;
let openingElement:HTMLElement|null=null;
let fallback=false;
const show=(el:HTMLElement,yes=true)=>el.classList.toggle('hidden',!yes);
const pad=(n:number)=>String(n).padStart(2,'0');
function toast(message:string){$('toast').textContent=message;show($('toast'));clearTimeout(toastTimer);toastTimer=setTimeout(()=>show($('toast'),false),3600);}
function rustle(){
  if(!soundEnabled)return;
  try{
    audio??=new AudioContext();void audio.resume();
    const buffer=audio.createBuffer(1,audio.sampleRate*.32,audio.sampleRate);const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.sin(i/data.length*Math.PI)*.18;
    const source=audio.createBufferSource();source.buffer=buffer;const f=audio.createBiquadFilter();f.type='bandpass';f.frequency.value=1600;f.Q.value=.6;const gain=audio.createGain();gain.gain.value=.26;source.connect(f);f.connect(gain);gain.connect(audio.destination);source.start();
  }catch{toast('当前浏览器暂不支持翻页音效。');}
}
function updateReader(album:Album|null){
  if(album){openingElement=document.activeElement as HTMLElement;}
  active=album;document.body.classList.toggle('is-reading',!!album);show($('reader'),!!album);show($('catalog'),false);$('catalog-toggle').setAttribute('aria-expanded','false');
  ['intro','filters','desk-footer'].forEach(id=>{$(id).inert=!!album;$(id).setAttribute('aria-hidden',String(!!album));});
  if(fallback)show($('webgl-fallback'),!album);
  if(album){$('reader-title').textContent=album.title;$('reader-meta').textContent=`${album.date}  /  ${album.location}`;$('announcer').textContent=`已翻开《${album.title}》`;$('back').focus({preventScroll:true});}
  else {currentVideos.forEach(v=>v.pause());currentVideos=[];show($('video-controls'),false);$('announcer').textContent='已回到桌面';if(openingElement?.closest('#catalog'))$('catalog-toggle').focus({preventScroll:true});else if(openingElement&&openingElement!==document.body)openingElement.focus({preventScroll:true});}
}
function updateSpread(index:number,total:number,pages:AlbumPage[]){
  spread=index;const first=index*2+1,last=Math.min(index*2+2,total);$('page-current').textContent=first===last?pad(first):`${pad(first)} — ${pad(last)}`;$('page-total').textContent=pad(total);
  $('left-caption').textContent=pages[0]?.caption||'';$('right-caption').textContent=pages[1]?.caption||'';
  $<HTMLButtonElement>('prev-page').disabled=index===0;$<HTMLButtonElement>('next-page').disabled=index>=Math.ceil(total/2)-1;
  $('announcer').textContent=`${active?.title}，第 ${index*2+1} 至 ${Math.min(index*2+2,total)} 页`;
}
function updateVideos(videos:HTMLVideoElement[]){
  currentVideos=videos;show($('video-controls'),videos.length>0);$('play-video').querySelector('span')!.textContent='播放本页影像';$('video-mute').textContent='声音关闭';
  videos.forEach(v=>{v.addEventListener('pause',()=>{if(currentVideos.includes(v))$('play-video').querySelector('span')!.textContent='继续播放';});v.addEventListener('playing',()=>{$('play-video').querySelector('span')!.textContent='暂停影像';});});
}
function makeCatalog(){
  $('catalog-list').replaceChildren();
  allAlbums.filter(a=>filter==='全部'||a.category===filter).forEach(album=>{
    const button=document.createElement('button');button.className='catalog-item';button.setAttribute('aria-label',`翻开${album.title}`);
    const image=document.createElement('img');image.className='catalog-cover';image.alt='';image.src=album.cover.startsWith('/')||album.cover.startsWith('blob:')?album.cover:`/media/${album.cover}.jpg`;image.style.background=album.color;
    const title=document.createElement('span');const name=document.createElement('span');name.className='catalog-item-title';name.textContent=album.title;
    const meta=document.createElement('div');meta.className='catalog-item-subtitle';meta.textContent=`${album.category} · ${album.pages.length} 页 · ${album.date}`;title.append(name,meta);
    const arrow=document.createElement('span');arrow.className='catalog-item-arrow';arrow.textContent='↗';button.append(image,title,arrow);
    button.addEventListener('click',()=>openAlbum(album.id));$('catalog-list').append(button);
  });
  $('album-total').textContent=`${allAlbums.length} 本画册`;$('filters').querySelector('.filter span')!.textContent=String(allAlbums.length);
}
function openAlbum(id:string){if(active)return;if(scene)void scene.open(id);else if(fallback){const a=allAlbums.find(x=>x.id===id);if(a){updateReader(a);renderFallback(a,0);}}}
function renderFallback(album:Album,index:number){
  document.getElementById('flat-reader')?.remove();const wrapper=document.createElement('div');wrapper.id='flat-reader';wrapper.className='flat-reader';
  const videos:HTMLVideoElement[]=[];
  const pages=album.pages.slice(index*2,index*2+2);pages.forEach(p=>{let media:HTMLVideoElement|HTMLImageElement;if(p.type==='video'){media=document.createElement('video');media.src=p.src;media.poster=p.poster||'';media.controls=true;media.playsInline=true;videos.push(media);}else{media=document.createElement('img');media.src=p.src;media.alt=p.caption||album.title;}wrapper.append(media);});
  $('scene').append(wrapper);updateVideos(videos);updateSpread(index,album.pages.length,pages);
}
function turn(direction:number){if(scene)void scene.turn(direction);else if(active){const index=spread+direction;if(index>=0&&index<Math.ceil(active.pages.length/2))renderFallback(active,index);}}
function closeReader(){if(scene)scene.close();else{updateReader(null);document.getElementById('flat-reader')?.remove();}}
function toggleCatalog(){const opening=$('catalog').classList.contains('hidden');show($('catalog'),opening);$('catalog-toggle').setAttribute('aria-expanded',String(opening));if(opening)$('catalog-close').focus();}

async function boot(){
  try{allAlbums.push(...await loadAlbums());}catch{ /* Browsers that block storage can still browse the demo collection. */ }
  makeCatalog();
  try{
    scene=new FolioScene($('scene'));
    scene.onRead=updateReader;scene.onSpread=updateSpread;scene.onVideo=updateVideos;scene.onRustle=rustle;
    scene.onZoom=zoom=>$('zoom-level').textContent=`${Math.round(zoom*100)}%`;
    scene.onHover=(album,x,y)=>{
      const label=$('hover-label');label.replaceChildren();if(!album){label.style.opacity='0';return;}
      label.append(document.createTextNode(album.title));const small=document.createElement('small');small.textContent='点击翻阅 ↗';label.append(small);
      label.style.left=`${Math.max(110,Math.min(innerWidth-110,x))}px`;label.style.top=`${Math.min(innerHeight-80,y+13)}px`;label.style.opacity='1';
    };
    let loaded=0;
    await Promise.all(allAlbums.map(async album=>{await scene!.addAlbum(album);$('load-progress').textContent=`${Math.round(++loaded/allAlbums.length*100)}%`;}));
    scene.reset();
  }catch(error){console.error('Unable to initialize the 3D desktop',error);scene?.dispose();scene=null;fallback=true;show($('webgl-fallback'));toast('3D 暂不可用，你仍可从目录浏览照片与视频。');}
  $('loading').style.opacity='0';setTimeout(()=>show($('loading'),false),650);
}

$('catalog-toggle').addEventListener('click',toggleCatalog);$('catalog-close').addEventListener('click',()=>{show($('catalog'),false);$('catalog-toggle').focus();});
$('fallback-catalog').addEventListener('click',toggleCatalog);
$('zoom-in').addEventListener('click',()=>scene?.setZoom(scene.zoom*1.18));$('zoom-out').addEventListener('click',()=>scene?.setZoom(scene.zoom/1.18));$('reset').addEventListener('click',()=>scene?.reset());
$('filters').querySelectorAll<HTMLButtonElement>('.filter').forEach(button=>button.addEventListener('click',()=>{if(active)return;filter=button.dataset.category!;scene?.filter(filter);$('filters').querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});makeCatalog();}));
$('back').addEventListener('click',closeReader);$('close-reader').addEventListener('click',closeReader);
$('prev-page').addEventListener('click',()=>turn(-1));$('next-page').addEventListener('click',()=>turn(1));
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').classList.toggle('sound-off',!soundEnabled);$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'关闭翻页音效':'开启翻页音效');if(soundEnabled)rustle();toast(soundEnabled?'翻页音效已开启':'翻页音效已关闭');});
$('help').addEventListener('click',()=>$<HTMLDialogElement>('help-dialog').showModal());
$('add-album').addEventListener('click',()=>{if(active)return;$<HTMLDialogElement>('create-dialog').showModal();});
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('此浏览器暂不支持全屏，可使用浏览器的全屏功能。');}});
$('play-video').addEventListener('click',async()=>{
  const playing=currentVideos.some(v=>!v.paused);
  if(playing){currentVideos.forEach(v=>v.pause());$('play-video').querySelector('span')!.textContent='继续播放';}
  else{const results=await Promise.allSettled(currentVideos.map(v=>v.play()));if(results.some(r=>r.status==='rejected'))toast('这段影像暂时无法播放，请检查文件格式。');else $('play-video').querySelector('span')!.textContent='暂停影像';}
});
$('video-mute').addEventListener('click',()=>{const muted=!currentVideos[0]?.muted;currentVideos.forEach(v=>v.muted=muted);$('video-mute').textContent=muted?'声音关闭':'声音开启';$('video-mute').setAttribute('aria-label',muted?'开启视频声音':'关闭视频声音');});
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;
  if(e.key==='Escape'){if(active)closeReader();else show($('catalog'),false);}
  if(active&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();turn(e.key==='ArrowLeft'?-1:1);}
  if(!active&&(e.key==='+'||e.key==='='))scene?.setZoom(scene.zoom*1.18);
  if(!active&&e.key==='-')scene?.setZoom(scene.zoom/1.18);
  if(!active&&e.key==='0')scene?.reset();
});
$<HTMLInputElement>('media-files').addEventListener('change',()=>{const files=$<HTMLInputElement>('media-files').files;$('file-label').textContent=files?.length?`已选择 ${files.length} 个瞬间`:'选择照片或视频';});
async function videoPoster(file:File):Promise<Blob|undefined>{
  return new Promise(resolve=>{
    const video=document.createElement('video');const url=URL.createObjectURL(file);video.src=url;video.muted=true;video.playsInline=true;video.preload='auto';let done=false;
    const finish=(blob?:Blob)=>{if(done)return;done=true;clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);resolve(blob);};
    const timer=setTimeout(()=>finish(),6000);video.onerror=()=>finish();
    video.onloadeddata=()=>{const c=document.createElement('canvas');c.width=640;c.height=Math.max(1,Math.round(640*video.videoHeight/video.videoWidth));c.getContext('2d')!.drawImage(video,0,0,c.width,c.height);c.toBlob(b=>finish(b||undefined),'image/jpeg',.85);};
  });
}
$('create-form').addEventListener('submit',async e=>{
  e.preventDefault();const files=Array.from($<HTMLInputElement>('media-files').files||[]);const title=$<HTMLInputElement>('album-name').value.trim();
  if(!title){toast('为这本画册取一个名字吧。');return;}
  if(!files.length||files.length>20){toast('请选择 1–20 个照片或视频。');return;}
  if(files.some(f=>!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(f.type))){toast('请选择 JPG、PNG、WebP 照片，或 MP4、WebM 视频。');return;}
  if(files.reduce((sum,f)=>sum+f.size,0)>200*1024*1024){toast('每本画册最多保存 200 MB，请减少文件或压缩视频。');return;}
  const button=$<HTMLButtonElement>('create-submit');button.disabled=true;button.textContent='正在装订你的时光…';
  const newIndex=allAlbums.length-demos.length;
  try{
    const posters:(Blob|undefined)[]=[];
    for(let start=0;start<files.length;start+=3){const batch=await Promise.all(files.slice(start,start+3).map(file=>file.type.startsWith('video')?videoPoster(file):Promise.resolve(undefined)));posters.push(...batch);}
    const pages:AlbumPage[]=files.map((file,i)=>({type:file.type.startsWith('video')?'video':'photo',src:URL.createObjectURL(file),caption:i===0?$<HTMLInputElement>('album-caption').value.trim():undefined,poster:file.type.startsWith('video')?(posters[i]?URL.createObjectURL(posters[i]!):'/media/video-cover.svg'):undefined}));
    const album:Album={id:crypto.randomUUID(),title,subtitle:'MY PERSONAL MEMORIES',category:$<HTMLSelectElement>('album-category').value as Album['category'],color:$<HTMLInputElement>('album-color').value,ink:'#f8f2df',cover:pages[0].type==='photo'?pages[0].src:pages[0].poster!,layout:'split',date:new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit'}).format(new Date()),location:'我的独家记忆',x:-5.6+(newIndex%4)*4,z:10.5+Math.floor(newIndex/4)*5,angle:.04,pages};
    await saveAlbum({album,files,posters});allAlbums.push(album);if(scene)await scene.addAlbum(album);filter='全部';scene?.filter(filter);$('filters').querySelectorAll<HTMLButtonElement>('.filter').forEach(b=>{const selected=b.dataset.category==='全部';b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});makeCatalog();
    $<HTMLDialogElement>('create-dialog').close();$<HTMLFormElement>('create-form').reset();$('file-label').textContent='选择照片或视频';toast('新画册已收藏在这台设备，点开看看吧。');
    openAlbum(album.id);
  }catch(error){console.error('Could not save local album',error);toast('保存未完成：浏览器存储可能已满或不可用，请重试。');}
  finally{button.disabled=false;button.textContent='放到我的桌面';}
});
window.addEventListener('pagehide',()=>{currentVideos.forEach(v=>v.pause());});
void boot();
