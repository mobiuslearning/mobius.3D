import type { Album } from './albums';
export type StoredAlbum={album:Album;files:Blob[];poster?:Blob;posters?:(Blob|undefined)[]};
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('shiguang-folio',1);r.onupgradeneeded=()=>r.result.createObjectStore('albums',{keyPath:'album.id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveAlbum(value:StoredAlbum){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('albums','readwrite');tx.objectStore('albums').put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function loadAlbums():Promise<Album[]>{
  const db=await database();const stored=await new Promise<StoredAlbum[]>((resolve,reject)=>{const tx=db.transaction('albums','readonly');const r=tx.objectStore('albums').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
  return stored.map(({album,files,poster,posters})=>{album.pages=album.pages.map((p,i)=>{const thumbnail=posters?.[i]||(i===0?poster:undefined);return {...p,src:URL.createObjectURL(files[i]),poster:p.type==='video'?(thumbnail?URL.createObjectURL(thumbnail):'/media/video-cover.svg'):undefined};});album.cover=album.pages[0].type==='photo'?album.pages[0].src:album.pages[0].poster!;return album;});
}
