import * as THREE from 'three';
import type { Album, AlbumPage } from './albums';
import { coverTexture, pageTexture, woodTexture, pageEdgesTexture } from './textures';

const W=2.5,H=3.35;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
type Book={album:Album;root:THREE.Group;cover:THREE.Group;hit:THREE.Mesh;left:THREE.Mesh;right:THREE.Mesh;leftStack:THREE.Mesh;home:THREE.Vector3;angle:number;hover:number;};
type Tween={start:number;duration:number;update:(t:number)=>void;done?:()=>void};
const isMesh=(object:THREE.Object3D):object is THREE.Mesh=>(object as THREE.Mesh).isMesh===true;
export class FolioScene {
  renderer:THREE.WebGLRenderer;
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,300);
  books:Book[]=[];
  active:Book|null=null;
  spread=0;
  busy=false;
  zoom=1;
  category='全部';
  onHover:(album:Album|null,x:number,y:number)=>void=()=>{};
  onRead:(album:Album|null)=>void=()=>{};
  onSpread:(index:number,total:number,pages:AlbumPage[])=>void=()=>{};
  onZoom:(zoom:number)=>void=()=>{};
  onRustle:()=>void=()=>{};
  onVideo:(videos:HTMLVideoElement[])=>void=()=>{};
  private target=new THREE.Vector3(0,0,1);
  private look=new THREE.Vector3(0,0,1);
  private viewSize=18;
  private tweens:Tween[]=[];
  private raycaster=new THREE.Raycaster();
  private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private pointer=new THREE.Vector2();
  private drag:{x:number;y:number;world:THREE.Vector3;target:THREE.Vector3;moved:boolean}|null=null;
  private touches=new Map<number,{x:number;y:number}>();
  private pinchDistance=0;
  private pinching=false;
  private videos:HTMLVideoElement[]=[];
  private videoMeshes:THREE.Mesh[]=[];
  private frame=0;
  private lastTime=0;
  private savedView={target:new THREE.Vector3(),zoom:1};
  private pageVersion=0;
  private edges=pageEdgesTexture();
  private disposed=false;
  private floor:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;

  constructor(private container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.setClearColor('#e8e0d0');
    this.renderer.domElement.setAttribute('aria-hidden','true');
    container.appendChild(this.renderer.domElement);
    const ambient=new THREE.HemisphereLight('#fffaf0','#a59a7f',2);this.scene.add(ambient);
    const sun=new THREE.DirectionalLight('#fff9ec',2.3);sun.position.set(-14,25,-13);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
    sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;sun.shadow.radius=4;this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({map:woodTexture(),roughness:.97,color:'#efe8da'}));this.floor=floor;
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.035;this.scene.add(floor);
    this.resize();this.bindEvents();this.animate(0);
  }
  private tween(duration:number,update:(t:number)=>void,done?:()=>void){this.tweens.push({start:performance.now(),duration:reduced?80:duration,update,done});}
  private applyCamera(){
    const aspect=this.container.clientWidth/this.container.clientHeight;
    this.camera.left=-this.viewSize*aspect/2;this.camera.right=this.viewSize*aspect/2;this.camera.top=this.viewSize/2;this.camera.bottom=-this.viewSize/2;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.look).add(new THREE.Vector3(0,20,13));this.camera.lookAt(this.look);
  }
  private resize=()=>{
    this.renderer.setSize(this.container.clientWidth,this.container.clientHeight);
    if(!this.active){this.viewSize=this.baseSize()/this.zoom;}
    else this.viewSize=this.readerSize();
    this.applyCamera();
  };
  private baseSize(){return innerWidth<640?28:innerWidth<1000?21:18;}
  private readerSize(){
    const width=this.container.clientWidth,height=this.container.clientHeight;
    // Fill more of the reader while leaving room for the header and page controls.
    return Math.max(5.1,5.4/(width/height),3*height/Math.max(height-300,160));
  }
  async addAlbum(album:Album){
    const root=new THREE.Group();root.position.set(album.x+3,0,album.z+1);root.rotation.y=album.angle;
    const cloth=new THREE.MeshStandardMaterial({color:album.color,roughness:.92});
    const edgeMat=new THREE.MeshStandardMaterial({map:this.edges,roughness:1});
    const back=new THREE.Mesh(new THREE.BoxGeometry(W+.06,.075,H+.06),cloth);back.position.y=.04;back.castShadow=true;back.receiveShadow=true;root.add(back);
    const stack=new THREE.Mesh(new THREE.BoxGeometry(W-.055,.18,H-.055),[edgeMat,edgeMat,new THREE.MeshStandardMaterial({color:'#ede9dc'}),edgeMat,edgeMat,edgeMat]);stack.position.y=.165;stack.castShadow=true;stack.receiveShadow=true;root.add(stack);
    const cover=new THREE.Group();cover.position.set(-W/2,.3,0);
    const tex=await coverTexture(album);
    const board=new THREE.Mesh(new THREE.BoxGeometry(W+.04,.065,H+.065),[cloth,cloth,new THREE.MeshStandardMaterial({map:tex,roughness:.9}),cloth,cloth,cloth]);board.position.x=W/2;board.castShadow=true;board.receiveShadow=true;cover.add(board);root.add(cover);
    const spine=new THREE.Mesh(new THREE.BoxGeometry(.075,.255,H+.05),cloth);spine.position.set(-W/2-.02,.18,0);spine.castShadow=true;root.add(spine);
    const makePage=(x:number)=>{
      const page=new THREE.Mesh(new THREE.PlaneGeometry(W-.075,H-.075),new THREE.MeshStandardMaterial({color:'#f5f2e9',roughness:1,side:THREE.DoubleSide}));
      page.rotation.x=-Math.PI/2;page.position.set(x,.269,0);page.receiveShadow=true;root.add(page);return page;
    };
    const right=makePage(0),left=makePage(-W);left.visible=false;left.position.y=.37;
    const leftStack=new THREE.Mesh(new THREE.BoxGeometry(W-.055,.065,H-.055),edgeMat);leftStack.position.set(-W,.33,0);leftStack.visible=false;leftStack.castShadow=true;root.add(leftStack);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(W,.4,H),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.2;root.add(hit);
    const book:Book={album,root,cover,hit,left,right,leftStack,home:root.position.clone(),angle:album.angle,hover:0};
    hit.userData.book=book;this.books.push(book);this.scene.add(root);
    return book;
  }
  async open(id:string){
    if(this.busy||this.active)return;
    const book=this.books.find(b=>b.album.id===id);if(!book)return;
    this.busy=true;this.active=book;this.spread=0;
    this.savedView={target:this.target.clone(),zoom:this.zoom};
    this.onRead(book.album);this.onHover(null,0,0);
    this.books.forEach(other=>{if(other===book)return;other.root.traverse(obj=>{if(isMesh(obj)){const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(mat=>{mat.transparent=true;mat.depthWrite=false;mat.needsUpdate=true;});obj.castShadow=false;}});});
    this.tween(650,t=>this.books.forEach(other=>{if(other!==book)other.root.traverse(obj=>{if(isMesh(obj)){const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(mat=>mat.opacity=1-t);}});}),()=>{this.books.forEach(other=>{if(other!==book)other.root.visible=false;});});
    const target=book.home.clone().add(new THREE.Vector3(-W/2,.25,0));
    const from=this.look.clone(),startSize=this.viewSize,startAngle=book.root.rotation.y;
    this.target.copy(target);
    this.tween(1100,t=>{this.look.lerpVectors(from,target,t);this.viewSize=THREE.MathUtils.lerp(startSize,this.readerSize(),t);book.root.rotation.y=THREE.MathUtils.lerp(startAngle,0,t);book.root.position.y=THREE.MathUtils.lerp(book.hover,.1,t);});
    await this.setSpread(0);
    this.onRustle();
    this.tween(1050,t=>{book.cover.rotation.z=Math.PI*t;if(t>.42){book.left.visible=true;book.leftStack.visible=true;}},()=>{this.busy=false;this.onSpread(this.spread,book.album.pages.length,book.album.pages.slice(0,2));});
  }
  close(){
    if(!this.active||this.busy)return;
    const book=this.active;this.busy=true;this.stopVideos();this.pageVersion++;
    const from=this.look.clone(),size=this.viewSize,angle=book.cover.rotation.z;
    const destination=this.savedView.target.clone();this.target.copy(destination);this.zoom=this.savedView.zoom;
    this.onRead(null);this.onRustle();
    this.books.forEach(other=>{if(other!==book)other.root.visible=this.category==='全部'||other.album.category===this.category;});
    this.tween(800,t=>this.books.forEach(other=>{if(other!==book)other.root.traverse(obj=>{if(isMesh(obj)){const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(mat=>mat.opacity=t);if(t===1){materials.forEach(mat=>{mat.transparent=false;mat.depthWrite=true;mat.needsUpdate=true;});obj.castShadow=obj!==other.left&&obj!==other.right;}}});}));
    this.tween(1000,t=>{
      book.cover.rotation.z=angle*(1-t);if(t>.2){book.left.visible=false;book.leftStack.visible=false;}
      book.root.rotation.y=book.angle*t;book.root.position.y=.1*(1-t);
      this.look.lerpVectors(from,destination,t);this.viewSize=THREE.MathUtils.lerp(size,this.baseSize()/this.zoom,t);
    },()=>{this.active=null;this.busy=false;this.onZoom(this.zoom);});
  }
  private stopVideos(){
    this.videos.forEach(v=>{v.pause();v.removeAttribute('src');v.load();});this.videos=[];
    this.videoMeshes.forEach(mesh=>{mesh.removeFromParent();mesh.geometry.dispose();const mat=mesh.material as THREE.MeshBasicMaterial;mat.map?.dispose();mat.dispose();});this.videoMeshes=[];this.onVideo([]);
  }
  private async setSpread(index:number){
    const book=this.active;if(!book)return;
    const version=++this.pageVersion;
    this.stopVideos();this.spread=index;
    const pages=book.album.pages.slice(index*2,index*2+2);
    const maps=await Promise.all([pageTexture(pages[0],index*2),pageTexture(pages[1],index*2+1)]);
    if(version!==this.pageVersion||this.active!==book)return;
    [book.left,book.right].forEach((mesh,i)=>{const mat=mesh.material as THREE.MeshStandardMaterial;mat.map=maps[i];mat.needsUpdate=true;});
    pages.forEach((page,i)=>{
      if(page.type!=='video')return;
      const video=document.createElement('video');video.crossOrigin='anonymous';video.preload='metadata';video.muted=true;video.playsInline=true;video.loop=true;video.src=page.src;
      const tex=new THREE.VideoTexture(video);tex.colorSpace=THREE.SRGBColorSpace;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W*.89,H*.5),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
      mesh.rotation.x=-Math.PI/2;mesh.position.set(i===0?-W:0,i===0?.38:.278,0);mesh.visible=false;book.root.add(mesh);this.videoMeshes.push(mesh);this.videos.push(video);
      video.addEventListener('loadedmetadata',()=>{
        const aspect=video.videoWidth/video.videoHeight;if(!Number.isFinite(aspect)||aspect<=0)return;
        const width=aspect>1?W*.9:W*.883,height=aspect>1?H*.515:H*.844;
        mesh.scale.set(width/(W*.89),height/(H*.5),1);mesh.position.z=aspect>1?-.072:-.049;
        const frameAspect=width/height;
        tex.repeat.set(aspect>frameAspect?frameAspect/aspect:1,aspect<frameAspect?aspect/frameAspect:1);
        tex.offset.set((1-tex.repeat.x)/2,(1-tex.repeat.y)/2);
      });
      video.addEventListener('playing',()=>{mesh.visible=true;});
      video.addEventListener('error',()=>this.onVideo(this.videos));
    });
    this.onVideo(this.videos);this.onSpread(index,book.album.pages.length,pages);
  }
  async turn(direction:number){
    const book=this.active;
    if(!book||this.busy)return;
    const next=this.spread+direction;if(next<0||next>=Math.ceil(book.album.pages.length/2))return;
    this.busy=true;this.onRustle();this.stopVideos();
    const old=this.spread;const forward=direction>0;
    const maps=await Promise.all([pageTexture(book.album.pages[(forward?old*2+1:old*2)],forward?old*2+1:old*2),pageTexture(book.album.pages[forward?next*2:next*2+1],forward?next*2:next*2+1)]);
    const geo=new THREE.PlaneGeometry(W-.075,H-.075,32,2);geo.translate((W-.075)/2,0,0);
    const backMap=(forward?maps[1]:maps[0]).clone();backMap.repeat.x=-1;backMap.offset.x=1;
    const front=new THREE.MeshStandardMaterial({map:forward?maps[0]:maps[1],roughness:1,side:THREE.FrontSide});
    const back=new THREE.MeshStandardMaterial({map:backMap,roughness:1,side:THREE.BackSide});
    const sheet=new THREE.Group();sheet.position.set(-W/2,.4,0);
    const frontMesh=new THREE.Mesh(geo,front);frontMesh.rotation.x=-Math.PI/2;frontMesh.castShadow=true;frontMesh.receiveShadow=true;
    const backMesh=new THREE.Mesh(geo,back);backMesh.rotation.x=-Math.PI/2;backMesh.castShadow=true;backMesh.receiveShadow=true;sheet.add(frontMesh,backMesh);book.root.add(sheet);
    const base=Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
    sheet.rotation.z=forward?0:Math.PI;
    // Reveal the destination page underneath the curling sheet.
    const under=await pageTexture(book.album.pages[forward?next*2+1:next*2],forward?next*2+1:next*2);
    const mat=(forward?book.right:book.left).material as THREE.MeshStandardMaterial;mat.map=under;mat.needsUpdate=true;
    let swapped=false;
    this.tween(920,t=>{
      sheet.rotation.z=forward?Math.PI*t:Math.PI*(1-t);
      const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const x=base[i*3];pos.setZ(i,Math.sin(x/W*Math.PI)*Math.sin(t*Math.PI)*.28);}
      pos.needsUpdate=true;geo.computeVertexNormals();
      if(t>.52&&!swapped){swapped=true;void this.setSpread(next);}
    },()=>{sheet.removeFromParent();geo.dispose();front.dispose();back.dispose();backMap.dispose();this.busy=false;});
  }
  filter(category:string){
    if(this.active)return;this.category=category;
    this.books.forEach(book=>{book.root.visible=category==='全部'||book.album.category===category;});
    if(category!=='全部'){
      const visible=this.books.filter(b=>b.root.visible);if(!visible.length)return;
      const center=new THREE.Vector3();visible.forEach(b=>center.add(b.home));center.divideScalar(visible.length);center.y=0;
      if(innerWidth<640)center.z-=4;this.target.copy(center);
    }else this.target.set(innerWidth<640?2:0,0,innerWidth<640?-3:1);
  }
  setZoom(value:number){if(this.active)return;this.zoom=THREE.MathUtils.clamp(value,.45,2.7);this.onZoom(this.zoom);}
  reset(){if(this.active)return;this.target.set(innerWidth<640?2:0,0,innerWidth<640?-3:1);this.setZoom(1);}
  private worldPoint(x:number,y:number){
    const rect=this.container.getBoundingClientRect();this.pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);const point=new THREE.Vector3();this.raycaster.ray.intersectPlane(this.plane,point);return point;
  }
  private pick(x:number,y:number){
    this.worldPoint(x,y);
    return this.raycaster.intersectObjects(this.books.filter(b=>b.root.visible).map(b=>b.hit))[0]?.object.userData.book as Book|undefined;
  }
  private bindEvents(){
    const el=this.renderer.domElement;
    el.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;el.setPointerCapture(e.pointerId);this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touches.size===2){const [a,b]=[...this.touches.values()];this.pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);this.pinching=true;this.drag=null;return;}
      this.drag={x:e.clientX,y:e.clientY,world:this.worldPoint(e.clientX,e.clientY),target:this.target.clone(),moved:false};
    });
    el.addEventListener('pointermove',e=>{
      if(this.touches.has(e.pointerId))this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.touches.size===2){const [a,b]=[...this.touches.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(!this.active)this.setZoom(this.zoom*distance/this.pinchDistance);this.pinchDistance=distance;return;}
      if(this.drag){
        if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>5)this.drag.moved=true;
        if(this.drag.moved&&!this.active){
          const dx=(e.clientX-this.drag.x)/innerHeight*this.viewSize;
          const dz=(e.clientY-this.drag.y)/innerHeight*this.viewSize/Math.cos(Math.atan2(13,20));
          this.target.copy(this.drag.target).add(new THREE.Vector3(-dx,0,-dz));
          this.onHover(null,0,0);
        }
      }else if(!this.active&&!this.busy){const book=this.pick(e.clientX,e.clientY);this.books.forEach(b=>b.hover=b===book?.15:0);el.style.cursor=book?'pointer':'grab';this.onHover(book?.album||null,e.clientX,e.clientY);}
    });
    el.addEventListener('pointerup',e=>{
      this.touches.delete(e.pointerId);
      if(this.pinching){if(this.touches.size===0)this.pinching=false;this.drag=null;return;}
      const drag=this.drag;this.drag=null;
      if(!drag||drag.moved||this.busy)return;
      if(this.active){const p=this.worldPoint(e.clientX,e.clientY);const local=this.active.root.worldToLocal(p);if(Math.abs(local.z)<H/2+.7&&local.x>-W*1.6&&local.x<W*.7)void this.turn(local.x<-W/2?-1:1);}
      else{const book=this.pick(e.clientX,e.clientY);if(book)void this.open(book.album.id);}
    });
    el.addEventListener('pointercancel',e=>{this.touches.delete(e.pointerId);this.drag=null;if(!this.touches.size)this.pinching=false;});
    el.addEventListener('pointerleave',()=>{if(!this.drag){this.books.forEach(b=>b.hover=0);this.onHover(null,0,0);}});
    el.addEventListener('wheel',e=>{e.preventDefault();if(this.active)return;if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&!e.ctrlKey)this.target.x+=e.deltaX*.01;else this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));},{passive:false});
    el.addEventListener('dblclick',()=>{if(!this.active)this.reset();});
    window.addEventListener('resize',this.resize);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.videos.forEach(v=>v.pause());}else if(!this.disposed)this.animate(performance.now());});
    el.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('webgl-fallback')?.classList.remove('hidden');});
    if(innerWidth<640){this.target.set(2,0,-3);this.look.copy(this.target);}
  }
  private animate=(time:number)=>{
    if(this.disposed)return;
    const dt=Math.min((time-this.lastTime)/1000,.05);this.lastTime=time;
    this.tweens=this.tweens.filter(tween=>{const raw=Math.min((time-tween.start)/tween.duration,1);const t=raw<.5?4*raw*raw*raw:1-Math.pow(-2*raw+2,3)/2;tween.update(t);if(raw>=1){tween.done?.();return false;}return true;});
    if(!this.busy){this.look.lerp(this.target,1-Math.exp(-dt*8));if(!this.active)this.viewSize=THREE.MathUtils.lerp(this.viewSize,this.baseSize()/this.zoom,1-Math.exp(-dt*8));}
    this.books.forEach(book=>{if(book!==this.active)book.root.position.y=THREE.MathUtils.lerp(book.root.position.y,book.hover,1-Math.exp(-dt*9));});
    this.floor.position.set(this.look.x,-.035,this.look.z);this.floor.material.map!.offset.set(this.look.x/5,-this.look.z/5);
    this.applyCamera();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.animate);
  };
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.stopVideos();window.removeEventListener('resize',this.resize);this.renderer.dispose();}
}
