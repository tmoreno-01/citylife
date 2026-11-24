/* CITYLIFE: a local, continuous urban ecosystem. Canvas2D oblique projection.
   No network inference, no neural weights, no animation clips. */
(function(){
"use strict";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>x*x*(3-2*x);
function rng(seed){let n=seed>>>0;return ()=>{n=(n+0x6D2B79F5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}
const between=(r,a,b)=>a+(b-a)*r();
const PALETTE=[
 [154,150,135],[175,170,152],[128,132,125],[156,143,126],
 [144,153,149],[178,166,149],[116,121,116],[159,157,149],
 [143,131,120],[169,174,165],[128,136,138],[172,157,139]
];
class CitySimulation{
 constructor(seed=Date.now(),size=34){this.seed=seed;this.r=rng(seed);this.size=size;this.time=0;this.next=0;this.pulse=0;this.events=[];this.lots=[];this.grid=new Map();this.make()}
 make(){
  const r=this.r,n=this.size,half=n/2;
  const axis=()=>{let a=[],p=-half*1.12,i=0;while(i<n){const block=3+Math.floor(r()*4);for(let j=0;j<block&&i<n;j++,i++){const w=between(r,.78,1.25);a.push({start:p,w,block:a.length?Math.floor(i/4):0});p+=w+.08}p+=between(r,.50,.95)}const mid=(a[0].start+a[a.length-1].start+a[a.length-1].w)/2;for(const t of a)t.start-=mid;return a};
  this.ax=axis();this.ay=axis();
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
   const X=this.ax[i],Y=this.ay[j],dx=between(r,.02,.13),dy=between(r,.02,.13);
   const district=Math.floor(i/5)*100+Math.floor(j/5),style=Math.floor(r()*48);
   const wave=.5+.5*Math.sin(i*.29+j*.2+this.seed*.001);
   const empty=r()<.055;
   const h=empty?0:clamp(between(r,.45,1.75)+(r()**2)*2.6+wave*.8+(r()<.075?between(r,1.6,4.4):0),.25,7);
   const b={i,j,x:X.start+dx,y:Y.start+dy,w:X.w-dx-between(r,.02,.10),d:Y.w-dy-between(r,.02,.10),h,target:h,style,district,age:between(r,0,140),energy:between(r,.3,.8),speed:between(r,.12,.65),cool:between(r,0,12),phase:r()*7,roof:r(),green:r()<.23,dead:empty};
   this.lots.push(b);this.grid.set(i+','+j,b);
  }
  // Draw far buildings first. Camera looks along the negative diagonal.
  this.lots.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  for(const b of this.lots)b.neighbors=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>this.grid.get((b.i+x)+','+(b.j+y))).filter(Boolean);
  this.trigger();
 }
 trigger(i,j){
  const r=this.r;
  if(i===undefined){i=Math.floor(between(r,this.size*.27,this.size*.73));j=Math.floor(between(r,this.size*.27,this.size*.73))}
  this.events.push({i,j,age:0,life:between(r,8,22),radius:between(r,3,8),kind:Math.floor(r()*5),strength:between(r,.55,1)});
  if(this.events.length>7)this.events.shift();
 }
 update(dt){
  const r=this.r;this.time+=dt;this.next+=dt;this.pulse+=dt;
  if(this.pulse>7){this.pulse=0;if(r()<.88)this.trigger()}
  for(const e of this.events)e.age+=dt;
  this.events=this.events.filter(e=>e.age<e.life);
  for(const b of this.lots){
   b.age+=dt;b.cool=Math.max(0,b.cool-dt);
   const delta=b.target-b.h;
   // Continuous height interpolation, not teleporting or alpha crossfades.
   b.h+=Math.sign(delta)*Math.min(Math.abs(delta),dt*b.speed*(.35+Math.min(1,Math.abs(delta))));
   if(b.h<.035&&b.target===0){b.h=0;b.dead=true}
  }
  if(this.next<.36)return;this.next=0;
  // Take a snapshot: local decisions must not depend on draw order.
  const snap=new Map(this.lots.map(b=>[b,{h:b.h,target:b.target,energy:b.energy,style:b.style}]));
  for(const b of this.lots){
   const ns=b.neighbors.map(n=>snap.get(n));const density=ns.reduce((s,n)=>s+Math.min(1,n.h/2.8),0)/Math.max(1,ns.length);
   b.energy=clamp(b.energy+(density-.48)*.018+between(r,-.018,.026),0,1);
   if(b.cool>0||Math.abs(b.target-b.h)>.10)continue;
   let changed=false;
   for(const e of this.events){
    const d=Math.hypot(b.i-e.i,b.j-e.j),front=e.age/e.life*e.radius;
    if(Math.abs(d-front)>1.7||d>e.radius+1||r()>.11*e.strength)continue;
    if(e.kind===0||e.kind===1){ // growth front, dense towers and extensions
     if(b.dead){b.style=Math.floor(r()*48);b.age=0;b.dead=false}
     b.target=clamp(b.h+between(r,.45,e.kind===0?2.4:4.2),.35,8.2);
    }else if(e.kind===2){ // demolition front, rebuild later
     b.target=r()<.65?0:Math.max(.1,b.h-between(r,.6,2.3));
    }else if(e.kind===3){ // spread the neighboring architectural lineage
     const p=ns[Math.floor(r()*ns.length)];
     if(b.dead){b.style=p?p.style:Math.floor(r()*48);b.dead=false;b.age=0;b.target=between(r,.8,3.7)}
     else b.target=clamp(b.h+between(r,-.65,1.6),.25,7.5);
    }else{ // gradual low-rise contraction followed by fresh growth
     b.target=clamp(b.h+between(r,-2.2,.65),0,6.5);
    }
    b.cool=between(r,3,9);b.speed=between(r,.14,.72);changed=true;break;
   }
   if(changed)continue;
   if(b.dead&&r()<.009+density*.012){b.style=Math.floor(r()*48);b.target=between(r,.65,3.4);b.dead=false;b.age=0;b.cool=between(r,5,17)}
   else if(b.h>.05&&r()<.004+b.energy*.007){
    b.target=b.age>85&&r()<.26?0:clamp(b.h+between(r,-1.1,1.35),.18,7.6);
    b.cool=between(r,6,21);b.speed=between(r,.10,.43);
   }
  }
 }
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const color=(a,f=1)=>'rgb('+a.map(x=>Math.round(clamp(x*f,0,255))).join(',')+')';
class CityRenderer{
 constructor(c,sim){this.c=c;this.ctx=c.getContext('2d',{alpha:false});this.sim=sim;this.photo=null;this.materials=[];this.roofs=[];this.ground=canvas(1,1);this.resize();this.textures()}
 resize(){
  const d=Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.65);
  const w=Math.max(1,Math.round(innerWidth*d)),h=Math.max(1,Math.round(innerHeight*d)),f=Math.min(1,1920/w,1440/h);
  this.c.width=Math.round(w*f);this.c.height=Math.round(h*f);
  this.W=this.c.width;this.H=this.c.height;this.s=Math.max(this.W/29,this.H/21);this.cx=this.W*.50;this.cy=this.H*.57;
  this.ground.width=this.W;this.ground.height=this.H;this.buildGround();
 }
 project(x,y,z=0){return [this.cx+(x-y)*this.s*.86,this.cy+(x+y)*this.s*.52-z*this.s*.94]}
 poly(g,pts,fill){g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.closePath();g.fillStyle=fill;g.fill()}
 plane(g,pattern,o,u,v,w,h,shade=0){
  g.save();g.transform(u[0],u[1],v[0],v[1],o[0],o[1]);g.fillStyle=pattern;g.fillRect(0,0,w,h);
  if(shade){g.fillStyle='rgba(19,25,27,'+shade+')';g.fillRect(0,0,w,h)}g.restore();
 }
 textures(){
  const r=rng(this.sim.seed^0x9876234),g=this.ctx;
  this.materials=[];this.roofs=[];
  for(let k=0;k<48;k++){
   const base=PALETTE[k%PALETTE.length],f=canvas(144,192),x=f.getContext('2d'),style=k%6;
   x.fillStyle=color(base,between(r,.87,1.12));x.fillRect(0,0,144,192);
   if(this.photo){ // A small photographic grain contribution, not pasted city blocks.
    const p=this.photo,sw=p.width*.14,sh=p.height*.19;
    x.globalAlpha=.12;x.drawImage(p,between(r,0,p.width-sw),between(r,p.height*.32,p.height-sh),sw,sh,0,0,144,192);x.globalAlpha=1;
   }
   // Weathered concrete and vertical runoff stains.
   for(let j=0;j<950;j++){x.fillStyle=r()<.5?'rgba(29,33,29,.065)':'rgba(255,250,235,.08)';x.fillRect(r()*144,r()*192,between(r,1,4),between(r,1,9))}
   const floors=8,cols=style===0?3:style===1?5:style===2?4:style===3?6:4;
   const fw=144/cols,fh=192/floors;
   for(let row=0;row<floors;row++)for(let col=0;col<cols;col++){
    const a=col*fw,b=row*fh;
    const ww=fw*between(r,.58,.78),wh=fh*between(r,.48,.76),xx=a+(fw-ww)/2,yy=b+3;
    x.fillStyle='rgba(35,39,34,.32)';x.fillRect(xx-1,yy-1,ww+3,wh+4);
    x.fillStyle=color(base,.72);x.fillRect(xx,yy,ww,wh);
    x.fillStyle=color([68,76,75],between(r,.48,1.36));x.fillRect(xx+1,yy+1,ww-2,wh-2);
    if(r()<.22){x.fillStyle=color([186,176,146],between(r,.65,1));x.fillRect(xx+2,yy+2,ww*.42,wh-4)}
    x.fillStyle='rgba(215,218,202,.65)';x.fillRect(xx+ww*.48,yy,1,wh);x.fillRect(xx,yy+wh*.52,ww,1);
    if(style===2||style===4||r()<.20){
     x.fillStyle=color(base,.60);x.fillRect(a+1,b+fh-5,fw-2,5);
     x.fillStyle=color(base,1.15);x.fillRect(a+1,b+fh-6,fw-2,1.5);
     x.fillStyle='rgba(43,47,45,.54)';for(let l=3;l<fw-2;l+=5)x.fillRect(a+l,b+fh-11,1,5);
    }
    if(r()<.32){const q=xx+ww-4;x.fillStyle='#555953';x.fillRect(q+1,yy+wh-2,7,6);x.fillStyle='#b1b2a5';x.fillRect(q,yy+wh-3,7,5);x.fillStyle='#717772';x.fillRect(q+1,yy+wh-2,4,3)}
   }
   for(let j=0;j<cols+1;j++){x.fillStyle=color(base,.78);x.fillRect(j*fw,0,1.5,192)}
   for(let j=0;j<floors+1;j++){x.fillStyle='rgba(35,33,29,.19)';x.fillRect(0,j*fh,144,1)}
   this.materials.push(g.createPattern(f,'repeat'));
   const roof=canvas(96,96),q=roof.getContext('2d');
   q.fillStyle=color(base,between(r,.90,1.24));q.fillRect(0,0,96,96);
   for(let j=0;j<600;j++){q.fillStyle=r()<.5?'#22222213':'#ffffff19';q.fillRect(r()*96,r()*96,between(r,1,5),between(r,1,5))}
   q.strokeStyle='rgba(60,61,54,.30)';q.strokeRect(2,2,92,92);q.strokeRect(5,5,86,86);
   for(let j=0;j<3;j++){q.strokeStyle='#4e504a33';q.beginPath();q.moveTo(0,j*32);q.lineTo(96,j*32);q.stroke()}
   for(let j=0;j<4;j++){const X=between(r,8,77),Y=between(r,8,77),w=between(r,5,14),h=between(r,4,10);q.fillStyle='#292d2955';q.fillRect(X+3,Y+4,w,h);q.fillStyle=color(base,.85);q.fillRect(X,Y,w,h);q.fillStyle=color(base,1.15);q.fillRect(X,Y,w,2);q.fillStyle='#565b55';q.fillRect(X+2,Y+3,w-4,2)}
   this.roofs.push(g.createPattern(roof,'repeat'));
  }
 }
 setPhoto(im){this.photo=im;this.textures()}
 buildGround(){
  const g=this.ground.getContext('2d'),W=this.W,H=this.H,r=rng(this.sim.seed^1234);
  this.visible=this.sim.lots.filter(b=>{const p=this.project(b.x+b.w/2,b.y+b.d/2,0);return p[0]>-this.s*3&&p[0]<W+this.s*3&&p[1]>-this.s*2&&p[1]<H+this.s*10});
  g.fillStyle='#797d73';g.fillRect(0,0,W,H);
  const ax=this.sim.ax,ay=this.sim.ay,minX=ax[0].start-1,maxX=ax.at(-1).start+ax.at(-1).w+1,minY=ay[0].start-1,maxY=ay.at(-1).start+ay.at(-1).w+1;
  const quad=(x,y,w,h,c)=>this.poly(g,[this.project(x,y),this.project(x+w,y),this.project(x+w,y+h),this.project(x,y+h)],c);
  for(const b of this.sim.lots){quad(this.sim.ax[b.i].start,this.sim.ay[b.j].start,this.sim.ax[b.i].w,this.sim.ay[b.j].w,b.green?'#626e55':'#a2a096');}
  // Connected roads, lane dividers and pavements follow the actual block grid.
  for(let i=0;i<ax.length-1;i++){const end=ax[i].start+ax[i].w,gap=ax[i+1].start-end;if(gap>.35){quad(end+.05,minY,gap-.1,maxY-minY,'#575c58');for(let y=minY;y<maxY;y+=.78)quad(end+gap*.49,y,.018,.31,'#b8b6a1')}}
  for(let j=0;j<ay.length-1;j++){const end=ay[j].start+ay[j].w,gap=ay[j+1].start-end;if(gap>.35){quad(minX,end+.05,maxX-minX,gap-.1,'#5d605a');for(let x=minX;x<maxX;x+=.78)quad(x,end+gap*.49,.31,.018,'#b8b6a1')}}
  for(let i=0;i<3500;i++){g.fillStyle=r()<.5?'#2d372b11':'#ece4cd16';g.fillRect(r()*W,r()*H,1+r()*3,1+r()*2)}
 }
 drawBuilding(b){
  const h=b.h;if(h<.025)return;
  const g=this.ctx,s=this.s,pr=(x,y,z)=>this.project(x,y,z);
  const x=b.x,y=b.y,w=b.w,d=b.d;
  const A=pr(x,y,h),B=pr(x+w,y,h),C=pr(x+w,y+d,h),D=pr(x,y+d,h);
  const F=pr(x+w,y+d,0);
  if(Math.max(A[0],B[0],C[0],D[0])<-12||Math.min(A[0],B[0],C[0],D[0])>this.W+12||A[1]>this.H+25||F[1]<-25)return;
  const u=[s*.86,s*.52],v=[-s*.86,s*.52],z=[0,-s*.94];
  const tex=this.materials[b.style],roof=this.roofs[b.style];
  // Texture scale: one facade atlas = 1.6 world units wide, 2.4 high.
  // Anchor at ground, so new floors appear as a structure grows.
  const bx=pr(x+w,y,0),by=pr(x,y+d,0);
  this.plane(g,tex,bx,[v[0]*1.6/144,v[1]*1.6/144],[z[0]*2.4/192,z[1]*2.4/192],d*144/1.6,h*192/2.4,.28);
  this.plane(g,tex,by,[u[0]*1.6/144,u[1]*1.6/144],[z[0]*2.4/192,z[1]*2.4/192],w*144/1.6,h*192/2.4,.07);
  this.plane(g,roof,A,[u[0]/96,u[1]/96],[v[0]/96,v[1]/96],w*96,d*96,0);
  // Parapets, roof edges and equipment read as coherent geometry.
  g.lineWidth=Math.max(.55,s*.014);g.strokeStyle='rgba(231,225,203,.60)';g.beginPath();g.moveTo(...D);g.lineTo(...A);g.lineTo(...B);g.stroke();
  g.strokeStyle='rgba(46,49,43,.55)';g.beginPath();g.moveTo(...B);g.lineTo(...C);g.lineTo(...D);g.stroke();
  if(h>.35&&b.roof<.70){
   const a=x+w*.15,e=y+d*.18,ww=w*(.22+b.roof*.21),dd=d*.26,hh=.10+b.roof*.11;
   const p=pr(a,e,h+hh),q=pr(a+ww,e,h+hh),r=pr(a+ww,e+dd,h+hh),t=pr(a,e+dd,h+hh);
   this.poly(g,[q,r,pr(a+ww,e+dd,h),pr(a+ww,e,h)],'#6c7168');
   this.poly(g,[t,r,pr(a+ww,e+dd,h),pr(a,e+dd,h)],'#a4a398');
   this.poly(g,[p,q,r,t],'#bebbb0');
  }
 }
 draw(){
  const g=this.ctx;g.setTransform(1,0,0,1,0,0);g.drawImage(this.ground,0,0);
  // Stable directional shadows, painted before geometry.
  for(const b of this.visible){if(b.h<.03)continue;
   const x=b.x,y=b.y,w=b.w,d=b.d,dx=b.h*.24,dy=b.h*.16;
   const p=this.project(x,y),q=this.project(x+w+dx,y+dy),r=this.project(x+w+dx,y+d+dy),t=this.project(x+dx,y+d+dy);
   this.poly(g,[p,q,r,t],'rgba(27,31,29,.17)');
  }
  for(const b of this.visible)this.drawBuilding(b);
  const grad=g.createLinearGradient(0,0,0,this.H);grad.addColorStop(0,'rgba(209,214,204,.15)');grad.addColorStop(.6,'rgba(209,214,204,0)');g.fillStyle=grad;g.fillRect(0,0,this.W,this.H);
 }
 pick(x,y){
  const px=x*this.W,py=y*this.H;let best=null,dist=Infinity;
  for(const b of this.sim.lots){const p=this.project(b.x+b.w/2,b.y+b.d/2,b.h);const d=Math.hypot(px-p[0],py-p[1]);if(d<dist){best=b;dist=d}}
  if(best)this.sim.trigger(best.i,best.j);
 }
}
if(typeof module!=='undefined')module.exports={CitySimulation,rng};
if(typeof document==='undefined')return;
const c=document.querySelector('#city'),info=document.querySelector('#stats'),pause=document.querySelector('#pause');
let sim=new CitySimulation(Date.now()^Math.floor(Math.random()*1e9),innerWidth<700?30:36),view=new CityRenderer(c,sim),paused=false,last=0,acc=0,lastDraw=0,speed=1,frames=0,report=0;
const im=new Image();im.onload=()=>view.setPhoto(im);im.src='https://upload.wikimedia.org/wikipedia/commons/f/f2/Sham_shui_po_day01.JPG';
function frame(t){
 requestAnimationFrame(frame);
 const dt=Math.min(.08,(t-(last||t))/1000);last=t;
 if(paused||document.hidden)return;
 acc+=dt*speed;report+=dt;
 while(acc>=1/30){sim.update(1/30);acc-=1/30}
 // Frame rate cap saves battery; physical time remains independent.
 if(t-lastDraw>=1000/30-2){view.draw();lastDraw=t;frames++}
 if(report>=1){const moving=sim.lots.filter(b=>Math.abs(b.target-b.h)>.04).length;info.textContent=sim.lots.filter(b=>b.h>.025).length+' buildings · '+moving+' changing · '+Math.round(frames/report)+' fps';report=0;frames=0}
}
pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Resume':'Pause'};
document.querySelector('#reset').onclick=()=>{sim=new CitySimulation(Date.now()^Math.floor(Math.random()*1e9),innerWidth<700?30:36);view.sim=sim;view.textures();view.buildGround();view.draw()};
document.querySelector('#speed').onchange=e=>speed=Number(e.target.value);
c.addEventListener('pointerdown',e=>{view.pick(e.clientX/innerWidth,e.clientY/innerHeight)});
window.addEventListener('resize',()=>{view.resize();view.draw()});
view.draw();requestAnimationFrame(frame);
})();