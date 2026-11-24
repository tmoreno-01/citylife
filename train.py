"""Citylife: experimental texture NCA, trained from a single urban photograph.
Not semantic 3D reconstruction. Train only after the RTX3090 overnight render.
"""
import argparse
import json
import random
import urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent
PHOTO = "https://upload.wikimedia.org/wikipedia/commons/f/f2/Sham_shui_po_day01.JPG"

class CityNCA(nn.Module):
    def __init__(self):
        super().__init__()
        self.first = nn.Conv2d(48, 32, 1)
        self.second = nn.Conv2d(32, 12, 1)
        nn.init.zeros_(self.second.weight)
        nn.init.zeros_(self.second.bias)
    def forward(self, x):
        p = F.pad(x, (1,1,1,1), mode="replicate")
        left, right = p[:,:,1:-1,:-2], p[:,:,1:-1,2:]
        up, down = p[:,:,:-2,1:-1], p[:,:,2:,1:-1]
        features = torch.stack((x,(right-left)*.5,(down-up)*.5,left+right+up+down-4*x), dim=2)
        features = features.flatten(1,2)
        dx = self.second(F.relu(self.first(features)))
        mask = (torch.rand_like(x[:,:1]) < .5).to(x.dtype)
        return (x+dx*mask).clamp(-3,3)

def random_state(batch, h, w, device):
    return (torch.rand(batch,12,h,w,device=device)-.5)*.5

def get_photo(path):
    if not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        request=urllib.request.Request(PHOTO,headers={"User-Agent":"Citylife artistic research/1.0 (public-domain Wikimedia Commons image)"})
        with urllib.request.urlopen(request, timeout=45) as r:
            raw=r.read()
        path.write_bytes(raw)
    im=ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return im.crop((0,round(im.height*.28),im.width,im.height))

def patches(x,k,n):
    # Sample local colour/geometry patches, not whole-image MSE.
    p=F.unfold(x,kernel_size=k,padding=0,stride=2).transpose(1,2)
    ids=torch.randint(p.shape[1],(n,),device=x.device)
    return p[:,ids,:].reshape(-1,p.shape[-1])

def texture_loss(out,target):
    loss=out.new_zeros(())
    for scale,k in ((1,5),(2,5),(4,3)):
        a=F.avg_pool2d(out,scale) if scale>1 else out
        b=F.avg_pool2d(target,scale) if scale>1 else target
        a=patches(a,k,128)
        b=patches(b,k,128)
        # Sliced Wasserstein: compare random projections of patch distributions.
        proj=F.normalize(torch.randn(a.shape[1],32,device=a.device),dim=0)
        ap=torch.sort(a@proj,dim=0).values
        bp=torch.sort(b@proj,dim=0).values
        loss=loss+F.l1_loss(ap,bp)/3
    return loss

def export(model,path,step):
    def pack(layer):
        weight=layer.weight.detach().cpu().squeeze(-1).squeeze(-1)
        return torch.cat([weight,layer.bias.detach().cpu()[:,None]],dim=1).flatten().tolist()
    obj={"version":1,"channels":12,"hidden":32,"step":step,"w1":pack(model.first),"w2":pack(model.second)}
    tmp=path.with_suffix(".tmp");tmp.write_text(json.dumps(obj,separators=(",",":")));tmp.replace(path)

def preview(state,path):
    rgb=((state[0,:3].detach().cpu().float().clamp(-1,1)+1)*127.5).byte().permute(1,2,0).numpy()
    # GPU texture coordinates are bottom-up.
    Image.fromarray(np.flipud(rgb)).resize((rgb.shape[1]*4,rgb.shape[0]*4),Image.Resampling.NEAREST).save(path)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--photo",type=Path,default=ROOT/"assets"/"city.jpg")
    ap.add_argument("--steps",type=int,default=3000)
    ap.add_argument("--width",type=int,default=128)
    ap.add_argument("--height",type=int,default=96)
    ap.add_argument("--batch",type=int,default=4)
    ap.add_argument("--device",default="cuda")
    ap.add_argument("--seed",type=int,default=611)
    ap.add_argument("--resume",type=Path)
    a=ap.parse_args()
    if min(a.width,a.height)<32 or a.batch<1 or a.steps<1:
        raise ValueError("Use width/height >=32, batch >=1, steps >=1")
    if a.device=="cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA PyTorch required. Install the CUDA build or use --device cpu for smoke tests.")
    torch.manual_seed(a.seed);random.seed(a.seed)
    device=torch.device(a.device)
    if device.type=="cuda":
        torch.backends.cuda.matmul.allow_tf32=True
        torch.backends.cudnn.allow_tf32=True
        print("GPU:",torch.cuda.get_device_name(0),flush=True)
    out=ROOT/"results";out.mkdir(exist_ok=True)
    im=get_photo(a.photo)
    im=ImageOps.fit(im,(a.width,a.height),method=Image.Resampling.LANCZOS)
    im.save(out/"training_target.jpg")
    rgb=np.flipud(np.asarray(im)).copy()
    target=torch.from_numpy(rgb).to(device).float().permute(2,0,1)[None]/127.5-1
    target=target.expand(a.batch,-1,-1,-1).contiguous()
    model=CityNCA().to(device)
    opt=torch.optim.Adam(model.parameters(),lr=1e-3)
    pool=random_state(64,a.height,a.width,device)
    start=0
    if a.resume:
        ck=torch.load(a.resume,map_location=device,weights_only=True)
        model.load_state_dict(ck["model"]);opt.load_state_dict(ck["optimizer"]);start=ck["step"]
    print("Training learned texture rules; random seeds, no video clips.",flush=True)
    for step in range(start+1,a.steps+1):
        ids=torch.randperm(len(pool),device=device)[:a.batch] if a.batch<=len(pool) else torch.randint(len(pool),(a.batch,),device=device)
        x=pool[ids].clone()
        x[:1]=random_state(1,a.height,a.width,device)
        # Damage some persistent states; learn to repair.
        if a.batch>1 and random.random()<.5:
            xx=random.randrange(a.width-12);yy=random.randrange(a.height-12)
            x[-1:,:,yy:yy+12,xx:xx+12]=0
        before=x[:,:3].clone()
        for _ in range(random.randint(16,28)):
            x=model(x)
        visible=x[:,:3]
        appearance=texture_loss(visible,target)
        overflow=F.relu(x.abs()-1.5).square().mean()
        # Gentle ongoing change, without requiring global flicker.
        change=(visible-before).abs().mean()
        activity=F.relu(.045-change)+F.relu(change-.35)
        loss=appearance+.15*overflow+.10*activity
        opt.zero_grad(set_to_none=True);loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(),1.)
        opt.step()
        with torch.no_grad():
            pool[ids]=x.detach()
        if step==1 or step%25==0:
            print(f"step {step}/{a.steps} | loss {loss.item():.4f} | appearance {appearance.item():.4f} | change {change.item():.4f}",flush=True)
        if step%250==0 or step==a.steps:
            export(model,out/"city_weights.json",step)
            torch.save({"model":model.state_dict(),"optimizer":opt.state_dict(),"step":step},out/"checkpoint.pt")
            preview(x,out/f"sample_{step:06}.png")
            # Independent rollout verifies growth rather than only pool reconstruction.
            with torch.no_grad():
                fresh=random_state(1,a.height,a.width,device)
                for _ in range(128):fresh=model(fresh)
                preview(fresh,out/f"fresh_{step:06}.png")
    print("Finished. Open index.html and select Neural weights > results/city_weights.json",flush=True)

if __name__=="__main__":
    main()
