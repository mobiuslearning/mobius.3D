import * as THREE from 'three';
import type { Album, AlbumPage } from './albums';

const images = new Map<string, HTMLImageElement>();
const textures = new Map<string, THREE.CanvasTexture>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (images.has(src)) return Promise.resolve(images.get(src)!);
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { images.set(src, image); resolve(image); }; image.onerror = reject; image.src = src; });
}
function canvas(w=768,h=1024) { const el=document.createElement('canvas');el.width=w;el.height=h;return { el,ctx:el.getContext('2d')! }; }
function texture(el: HTMLCanvasElement) { const tex=new THREE.CanvasTexture(el);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex; }
function crop(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number) {
  const scale=Math.max(w/img.width,h/img.height);const sw=w/scale,sh=h/scale;
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
}
function paperNoise(ctx:CanvasRenderingContext2D,w:number,h:number,strength=8) {
  const data=ctx.getImageData(0,0,w,h);let seed=41;
  for(let i=0;i<data.data.length;i+=4){seed=(seed*16807)%2147483647;const n=(seed/2147483647-.5)*strength;data.data[i]+=n;data.data[i+1]+=n;data.data[i+2]+=n;}
  ctx.putImageData(data,0,0);
}
export async function coverTexture(album:Album):Promise<THREE.CanvasTexture> {
  const {el,ctx}=canvas(); const w=el.width,h=el.height;
  ctx.fillStyle=album.color;ctx.fillRect(0,0,w,h);
  const src=album.cover.startsWith('blob:')||album.cover.startsWith('/')?album.cover:`/media/${album.cover}.jpg`;
  let img: HTMLImageElement|undefined;try{img=await loadImage(src);}catch{}
  if(album.layout==='full'){
    if(img)crop(ctx,img,0,0,w,h);
    const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#00000060');shade.addColorStop(.48,'#00000000');shade.addColorStop(1,'#00000060');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=album.ink;ctx.font='22px Arial';ctx.fillText(album.date,55,85);
    ctx.font='52px "Songti SC", serif';ctx.fillText(album.title,53,185);
    ctx.font='17px Arial';ctx.fillText(album.subtitle,56,229);
    ctx.font='16px Arial';ctx.fillText('A PERSONAL PHOTO JOURNAL',55,h-60);
  } else if(album.layout==='inset') {
    ctx.fillStyle=album.ink;ctx.font='17px Arial';ctx.fillText('F O L I O   /   '+album.date,62,82);
    ctx.font='53px "Songti SC",serif';ctx.fillText(album.title,60,185);
    ctx.font='16px Arial';ctx.fillText(album.subtitle,63,232);
    if(img)crop(ctx,img,62,300,w-124,h-440);
    ctx.fillStyle=album.ink;ctx.font='15px "Songti SC",serif';ctx.fillText('把沿途的光，收藏成册。',63,h-75);
    ctx.textAlign='right';ctx.font='15px Arial';ctx.fillText('01 — 06',w-62,h-75);ctx.textAlign='left';
  } else if(album.layout==='split') {
    if(img)crop(ctx,img,0,320,w,h-320);
    ctx.fillStyle=album.ink;ctx.font='18px Arial';ctx.fillText(album.date,53,64);
    ctx.font='64px "Songti SC",serif';ctx.fillText(album.title,50,172);
    ctx.font='18px Arial';ctx.fillText(album.subtitle,54,232);
    ctx.fillStyle=album.color;ctx.fillRect(44,h-89,150,40);ctx.fillStyle=album.ink;ctx.font='13px Arial';ctx.fillText('S L O W   L I F E',54,h-63);
  } else {
    ctx.fillStyle=album.ink;ctx.font='17px Arial';ctx.fillText('THE EVERYDAY ARCHIVE',60,76);
    ctx.font='88px "Songti SC",serif';Array.from(album.title).forEach((letter,i)=>ctx.fillText(letter,63+(i%2)*125,248+Math.floor(i/2)*115));
    ctx.font='15px Arial';ctx.fillText(album.subtitle,65,470);
    if(img)crop(ctx,img,64,540,w-128,300);
    ctx.fillStyle=album.ink;ctx.font='17px Arial';ctx.fillText(album.date,65,h-73);
    ctx.beginPath();ctx.arc(w-83,h-83,18,0,Math.PI*2);ctx.strokeStyle=album.ink;ctx.lineWidth=1;ctx.stroke();
  }
  paperNoise(ctx,w,h,12);
  const spine=ctx.createLinearGradient(0,0,35,0);spine.addColorStop(0,'#00000030');spine.addColorStop(.3,'#ffffff15');spine.addColorStop(.5,'#00000016');spine.addColorStop(1,'#00000000');ctx.fillStyle=spine;ctx.fillRect(0,0,35,h);
  return texture(el);
}
export async function pageTexture(page?:AlbumPage,index=0):Promise<THREE.CanvasTexture> {
  const key=page?`${page.poster||page.src}-${index}`:`blank-${index}`;
  if(textures.has(key))return textures.get(key)!;
  const {el,ctx}=canvas();const w=el.width,h=el.height;
  ctx.fillStyle='#f5f2e9';ctx.fillRect(0,0,w,h);
  if(page){
    try{
      const img=await loadImage(page.type==='video'?(page.poster||'/media/flower.jpg'):page.src);
      const landscape=img.width>img.height;
      const area=landscape?{x:38,y:225,w:w-76,h:530}:{x:45,y:65,w:w-90,h:h-160};
      crop(ctx,img,area.x,area.y,area.w,area.h);
      if(page.type==='video') {ctx.fillStyle='#f8f5e6d9';ctx.beginPath();ctx.arc(w/2,h/2,32,0,Math.PI*2);ctx.fill();ctx.fillStyle='#59684e';ctx.beginPath();ctx.moveTo(w/2-7,h/2-12);ctx.lineTo(w/2+14,h/2);ctx.lineTo(w/2-7,h/2+12);ctx.fill();ctx.font='12px Arial';ctx.fillStyle='#7b806b';ctx.textAlign='center';ctx.fillText('A MOMENT IN MOTION',w/2,area.y+area.h+48);}
    }catch{ctx.fillStyle='#929b80';ctx.font='25px "Songti SC",serif';ctx.textAlign='center';ctx.fillText('留一点空白，给回忆。',w/2,h/2);}
  }
  ctx.textAlign='center';ctx.fillStyle='#939582';ctx.font='13px Arial';ctx.fillText(String(index+1).padStart(2,'0'),w/2,h-35);
  paperNoise(ctx,w,h,4);
  const tex=texture(el);textures.set(key,tex);return tex;
}
export function woodTexture() {
  const {el,ctx}=canvas(1024,1024);const w=el.width,h=el.height;
  ctx.fillStyle='#d7c8ad';ctx.fillRect(0,0,w,h);
  let seed=193;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<19000;i++){
    const y=random()*h;const x=random()*w;
    ctx.strokeStyle=random()>.46?`rgba(111,89,58,${random()*.045})`:`rgba(255,247,222,${random()*.14})`;
    ctx.lineWidth=random()*1.3+.3;ctx.beginPath();ctx.moveTo(x,y);
    ctx.bezierCurveTo(x+40,y+random()*3,x+100,y-random()*3,x+40+random()*350,y+random()*2);ctx.stroke();
  }
  [0,512].forEach(y=>{ctx.fillStyle='#61574316';ctx.fillRect(0,y,w,1);ctx.fillStyle='#ffffef35';ctx.fillRect(0,y+1,w,1);});
  paperNoise(ctx,w,h,4);const tex=texture(el);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(200,200);return tex;
}
export function pageEdgesTexture() {
  const {el,ctx}=canvas(64,128);ctx.fillStyle='#e7e3d4';ctx.fillRect(0,0,64,128);
  for(let y=0;y<128;y+=4){ctx.fillStyle=y%12===0?'#c5c2b3':'#d8d4c5';ctx.fillRect(0,y,64,1);}
  return texture(el);
}
