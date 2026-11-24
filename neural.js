/* A real learned 12-channel local neural update, WebGL2 MRT. */
class NeuralCity {
 constructor(canvas,w){
  if(w.version!==1||w.channels!==12||w.hidden!==32||w.w1?.length!==32*49||w.w2?.length!==12*33||![...w.w1,...w.w2].every(Number.isFinite))throw Error('Incompatible Citylife weights');
  this.c=canvas;this.g=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:false});
  const g=this.g;if(!g||!g.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 floating point render targets unavailable');
  this.vao=g.createVertexArray();g.bindVertexArray(this.vao);
  this.w1=this.texture(49,32,new Float32Array(w.w1),g.R32F,g.RED);
  this.w2=this.texture(33,12,new Float32Array(w.w2),g.R32F,g.RED);
  this.update=this.program('#version 300 es\nprecision highp float;precision highp int;\n'+
  'uniform sampler2D s0,s1,s2,w1,w2;uniform int tick;uniform ivec2 dim;layout(location=0) out vec4 a;layout(location=1) out vec4 b;layout(location=2) out vec4 c;'+
  'vec4 readS(int k,ivec2 p){p=clamp(p,ivec2(0),dim-1);if(k==0)return texelFetch(s0,p,0);if(k==1)return texelFetch(s1,p,0);return texelFetch(s2,p,0);}'+
  'void main(){ivec2 p=ivec2(gl_FragCoord.xy);float f[48];float z[12];float h[32];for(int k=0;k<3;k++){vec4 v=readS(k,p),l=readS(k,p+ivec2(-1,0)),r=readS(k,p+ivec2(1,0)),u=readS(k,p+ivec2(0,1)),d=readS(k,p+ivec2(0,-1));for(int j=0;j<4;j++){int i=k*4+j;z[i]=v[j];f[i*4]=v[j];f[i*4+1]=(r[j]-l[j])*.5;f[i*4+2]=(u[j]-d[j])*.5;f[i*4+3]=l[j]+r[j]+u[j]+d[j]-4.*v[j];}}'+
  'float rnd=fract(sin(dot(vec3(vec2(p),float(tick)),vec3(12.9898,78.233,0.173)))*43758.5453);if(rnd<.5){for(int j=0;j<32;j++){float v=texelFetch(w1,ivec2(48,j),0).r;for(int i=0;i<48;i++)v+=f[i]*texelFetch(w1,ivec2(i,j),0).r;h[j]=max(0.,v);}for(int j=0;j<12;j++){float v=texelFetch(w2,ivec2(32,j),0).r;for(int i=0;i<32;i++)v+=h[i]*texelFetch(w2,ivec2(i,j),0).r;z[j]=clamp(z[j]+v,-3.,3.);}}'+
  'a=vec4(z[0],z[1],z[2],z[3]);b=vec4(z[4],z[5],z[6],z[7]);c=vec4(z[8],z[9],z[10],z[11]);}');
  this.display=this.program('#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D s0;out vec4 col;void main(){vec3 x=texture(s0,uv).rgb;col=vec4(clamp(x*.5+.5,0.,1.),1.);}');
  this.sets=[];this.tick=0;this.last=0;this.resize();this.seed();
 }
 program(fs){
 const g=this.g,compile=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s};
 const v=compile(g.VERTEX_SHADER,'#version 300 es\nout vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}'),f=compile(g.FRAGMENT_SHADER,fs),p=g.createProgram();
 g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);g.deleteShader(v);g.deleteShader(f);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;
 }
 texture(w,h,data,internal,format){
 const g=this.g,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,internal,w,h,0,format,g.FLOAT,data);return t;
 }
 clearSets(){const g=this.g;for(const s of this.sets){for(const t of s.t)g.deleteTexture(t);g.deleteFramebuffer(s.f)}this.sets=[]}
 resize(){const c=this.c;const d=Math.min(devicePixelRatio||1,1.5);c.width=Math.min(1600,Math.round(innerWidth*d));c.height=Math.min(1600,Math.round(innerHeight*d));}
 seed(){
 const g=this.g;this.clearSets();const a=innerWidth/innerHeight;this.w=a>=1?(innerWidth<700?112:192):96;this.h=Math.min(192,Math.max(48,Math.round(this.w/a)));
 for(let k=0;k<2;k++){const f=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,f);const t=[];for(let j=0;j<3;j++){const data=new Float32Array(this.w*this.h*4);if(k===0)for(let i=0;i<data.length;i++)data[i]=(Math.random()-.5)*.5;const tex=this.texture(this.w,this.h,data,g.RGBA32F,g.RGBA);t.push(tex);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+j,g.TEXTURE_2D,tex,0)}g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Neural state framebuffer incomplete');this.sets.push({f,t})}g.bindFramebuffer(g.FRAMEBUFFER,null);this.i=0;this.tick=0;
 }
 bind(p,name,t,unit){const g=this.g;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(g.getUniformLocation(p,name),unit)}
 step(now){
 const g=this.g;if(now-this.last<100)return;this.last=now;
 g.bindVertexArray(this.vao);g.useProgram(this.update);g.bindFramebuffer(g.FRAMEBUFFER,this.sets[1-this.i].f);g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);g.viewport(0,0,this.w,this.h);
 for(let j=0;j<3;j++)this.bind(this.update,'s'+j,this.sets[this.i].t[j],j);
 this.bind(this.update,'w1',this.w1,3);this.bind(this.update,'w2',this.w2,4);g.uniform2i(g.getUniformLocation(this.update,'dim'),this.w,this.h);g.uniform1i(g.getUniformLocation(this.update,'tick'),this.tick++);g.drawArrays(g.TRIANGLES,0,3);this.i=1-this.i;
 g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.c.width,this.c.height);g.useProgram(this.display);this.bind(this.display,'s0',this.sets[this.i].t[0],0);g.drawArrays(g.TRIANGLES,0,3);
 document.querySelector('#stats').textContent=this.w+' × '+this.h+' neural cells · step '+this.tick;
 }
 destroy(){const g=this.g;this.clearSets();g.deleteTexture(this.w1);g.deleteTexture(this.w2);g.deleteProgram(this.update);g.deleteProgram(this.display);g.deleteVertexArray(this.vao)}
}
