import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'original_mesh.obj'
verts, faces, names = [], [], []
name = ''
for line in src.read_text(encoding='utf-8', errors='replace').splitlines():
    vals = line.split()
    if not vals:
        continue
    if vals[0] == 'o':
        name = ' '.join(vals[1:])
    elif vals[0] == 'v':
        verts.append([float(v) for v in vals[1:4]])
    elif vals[0] == 'f':
        if name == 'Box001' or name.startswith('Completed'):
            faces.append([int(v.split('/')[0])-1 for v in vals[1:4]])
            names.append(name)
v = np.array(verts)
tris = v[np.array(faces)]
bb0, bb1 = tris.min(axis=(0,1)), tris.max(axis=(0,1))
print('bounds', bb0, bb1, 'faces', len(faces))
center = (bb0+bb1)/2
canvas = Image.new('RGB', (2000, 1800), '#eeeeee')
views = [(np.array([3,-2,1.3]), '+X oblique'), (np.array([-3,-2,1.3]), '-X oblique'), (np.array([1,0,0]), '+X front'), (np.array([-1,0,0]), '-X front')]
for k, (cam, label) in enumerate(views):
    cam = cam/np.linalg.norm(cam)
    right = np.cross(np.array([0.,0.,1.]),cam)
    right /= np.linalg.norm(right)
    up = np.cross(cam,right)
    basis = np.stack([right,up,cam],axis=1)
    p = (tris-center) @ basis
    xy0, xy1 = p[:,:,:2].min(axis=(0,1)), p[:,:,:2].max(axis=(0,1))
    scale = min(900/(xy1[0]-xy0[0]),740/(xy1[1]-xy0[1]))
    offset = np.array([500+(k%2)*1000,470+(k//2)*900])
    draw = ImageDraw.Draw(canvas)
    normals = np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0])
    lengths = np.linalg.norm(normals,axis=1)
    normals /= np.maximum(lengths[:,None], 1e-12)
    light = np.array([.3,-.5,.8]); light /= np.linalg.norm(light)
    shade = .65 + .28*np.maximum(normals @ light,0)
    pixels = np.array(canvas)
    depth = np.full((1800,2000),-np.inf)
    for i in range(len(p)):
        pts = p[i,:,:2]*scale
        pts[:,1] *= -1
        pts += offset
        lo = np.maximum(np.floor(pts.min(axis=0)).astype(int),[0,0])
        hi = np.minimum(np.ceil(pts.max(axis=0)).astype(int),[1999,1799])
        if np.any(lo>hi): continue
        xx, yy = np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
        a,b,c=pts
        den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-8: continue
        w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
        w2=1-w0-w1
        z=w0*p[i,0,2]+w1*p[i,1,2]+w2*p[i,2,2]
        old=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        mask=(w0>=-1e-8)&(w1>=-1e-8)&(w2>=-1e-8)&(z>old+1e-7)
        old[mask]=z[mask]
        color = tuple(int(c*shade[i]) for c in (220,214,161))
        pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=color
    canvas=Image.fromarray(pixels)
    draw=ImageDraw.Draw(canvas)
    draw.text((k%2*1000+35,k//2*900+25),label,fill='black',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',30))
out = src.with_suffix('.png')
canvas.save(out)
print(out)
