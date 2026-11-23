#!/usr/bin/env python3
"""scad -> stl -> blender glass render -> webp/avif -> manifest.json + index.html. stdlib only."""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "out"
SHAPES = {1: "ribbon", 2: "blob", 3: "wave", 4: "knot"}
PALETTE = {"key": "#FFFFFF", "a": "#8B5CF6", "b": "#FFEDD5"}
RES = 1600

SCAD = r"""
shape_type = 1;
R = 40; W = 22; T = 5; TWIST = 2; N = 160;
$fn = 48;
module ribbon() {
  for (i = [0:N-1]) hull() for (j = [i, i+1]) {
    a = 360*j/N;
    rotate([0,0,a]) translate([R,0,0]) rotate([0,a*TWIST,0]) cube([W,0.4,T],center=true);
  }
}
module blob() {
  union() {
    hull() { sphere(18); translate([22,6,4]) sphere(13); translate([-14,14,-6]) sphere(11); }
    hull() { translate([-14,14,-6]) sphere(11); translate([8,-20,10]) sphere(14); translate([-24,-4,6]) sphere(9); }
  }
}
module wave() {
  A = 10; F = 6; L = 110; Wd = 70; Th = 7;
  top = [for (x=[0:2:L]) [x - L/2, A*sin(F*x) + Th]];
  bot = [for (x=[L:-2:0]) [x - L/2, A*sin(F*x)]];
  rotate([90,0,0]) translate([0,0,-Wd/2]) linear_extrude(height=Wd) polygon(concat(top, bot));
}
module knot() {
  r = 8; Rk = 32; Rt = 14; n = 240;
  function p(t) = [(Rk + Rt*cos(3*t))*cos(2*t), (Rk + Rt*cos(3*t))*sin(2*t), Rt*sin(3*t)];
  for (i=[0:n-1]) hull() for (j=[i,i+1]) translate(p(360*j/n)) sphere(r, $fn=24);
}
if (shape_type==1) ribbon(); else if (shape_type==2) blob();
else if (shape_type==3) wave(); else knot();
"""

BPY = r"""
import bpy, sys, math
from mathutils import Vector
stl, out, res, key, ca, cb = sys.argv[sys.argv.index("--")+1:]
def rgb(h): h=h.lstrip("#"); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=stl)
ob = bpy.context.selected_objects[0]
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS"); ob.location = (0,0,0)
bpy.ops.object.shade_smooth()
m = bpy.data.materials.new("frost"); m.use_nodes = True
b = m.node_tree.nodes["Principled BSDF"]
for k,v in {"Transmission Weight":0.92,"Roughness":0.18,"IOR":1.45,"Base Color":(1,1,1,1)}.items():
    try: b.inputs[k].default_value = v
    except KeyError: pass
ob.data.materials.append(m)
dim = max(ob.dimensions)
def light(kind, loc, color, energy, size=None):
    d = bpy.data.lights.new(kind, kind); d.color = color; d.energy = energy
    if size and kind=="AREA": d.size = size
    o = bpy.data.objects.new(kind, d); o.location = loc; bpy.context.collection.objects.link(o)
light("AREA", (dim, -dim, dim*1.5), rgb(key)[:3], 800*dim, dim*2)
light("POINT", (-dim*0.4, dim*0.6, -dim*0.3), rgb(ca)[:3], 3000*dim)
light("POINT", (dim*0.4, dim*0.6, dim*0.2), rgb(cb)[:3], 3000*dim)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam)
cam.data.type = "ORTHO"; cam.data.ortho_scale = dim*1.35
cam.location = (0, -dim*3, dim*0.6)
cam.rotation_euler = (Vector((0,0,0)) - cam.location).to_track_quat("-Z","Y").to_euler()
bpy.context.scene.camera = cam
s = bpy.context.scene; s.render.engine = "CYCLES"; s.cycles.samples = 128; s.cycles.use_denoising = True
try: s.cycles.device = "GPU"
except Exception: pass
s.render.film_transparent = True
s.render.resolution_x = s.render.resolution_y = int(res)
s.render.image_settings.file_format = "PNG"; s.render.image_settings.color_mode = "RGBA"
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDER_OK", out)
"""

def find(*names):
    for n in names:
        p = shutil.which(n) or (n if Path(n).exists() else None)
        if p: return p
    return None

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print("FAIL:", " ".join(map(str, cmd)), "\n", r.stderr[-600:], file=sys.stderr)
    return r.returncode == 0

def main():
    scad = find("openscad", "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD")
    blender = find("blender", "/Applications/Blender.app/Contents/MacOS/Blender")
    cwebp, avifenc, magick = find("cwebp"), find("avifenc"), find("magick")
    print("tools:", dict(openscad=scad, blender=blender, cwebp=cwebp, avifenc=avifenc, magick=magick))
    if not (scad and blender): sys.exit("openscad/blender not found")
    for d in ("stl", "png", "web"): (OUT / d).mkdir(parents=True, exist_ok=True)
    src = OUT / "shapes.scad"; src.write_text(SCAD)
    bpy = Path(tempfile.mkdtemp()) / "render.py"; bpy.write_text(BPY)
    items = []
    for n, name in SHAPES.items():
        stl, png = OUT/"stl"/f"{name}.stl", OUT/"png"/f"{name}.png"
        ok = (run([scad, "--backend=manifold", "-D", f"shape_type={n}", "-o", stl, src])
              or run([scad, "-D", f"shape_type={n}", "-o", stl, src]))
        ok = ok and run([blender, "-b", "--factory-startup", "--python", bpy, "--",
                         stl, png, str(RES), PALETTE["key"], PALETTE["a"], PALETTE["b"]])
        if ok and magick: run([magick, png, "-trim", "+repage", png])
        entry = {"name": name, "png": f"png/{name}.png", "ok": bool(ok)}
        if ok and cwebp:
            w = OUT/"web"/f"{name}.webp"
            if run([cwebp, "-q", "85", "-alpha_q", "100", png, "-o", w]): entry["webp"] = f"web/{name}.webp"
        if ok and avifenc:
            a = OUT/"web"/f"{name}.avif"
            if run([avifenc, "-q", "80", png, a]): entry["avif"] = f"web/{name}.avif"
        items.append(entry); print(name, "OK" if ok else "FAILED")
    (OUT/"manifest.json").write_text(json.dumps({"palette": PALETTE, "items": items}, indent=2))
    cards = "".join(
        f'<figure><picture>' + (f'<source srcset="{i["avif"]}" type="image/avif">' if "avif" in i else "")
        + (f'<source srcset="{i["webp"]}" type="image/webp">' if "webp" in i else "")
        + f'<img src="{i["png"]}" alt="{i["name"]}" loading="lazy"></picture><figcaption>{i["name"]}</figcaption></figure>'
        for i in items if i["ok"])
    (OUT/"index.html").write_text(
        '<!doctype html><meta charset=utf-8><title>Glass shapes</title><style>'
        'body{margin:0;background:linear-gradient(135deg,#f5f3ff,#fff7ed);font:14px system-ui;'
        'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;padding:32px}'
        'img{width:100%;height:auto}figcaption{text-align:center;opacity:.6}</style>' + cards)
    print("done ->", OUT/"index.html")

main()
