"""Écrit models/velo-aero.js : GLB compressé (meshopt) + polices des stickers, en base64, sous forme de script classique.
Usage : python3 pack_app.py build/bike_app_m.glb ../../models/velo-aero.js [dossier_des_polices]
Sans dossier de polices, celles du fichier existant sont conservées (woff2 de @fontsource : barlow-condensed, orbitron, archivo-black, pacifico)."""
import base64, sys, os, json, re
glb = sys.argv[1]; out = sys.argv[2]
fd = sys.argv[3] if len(sys.argv) > 3 else None
fonts = {'sport': 'barlow-condensed-latin-800-italic.woff2', 'tech': 'orbitron-latin-800-normal.woff2', 'bloc': 'archivo-black-latin-400-normal.woff2', 'script': 'pacifico-latin-400-normal.woff2'}
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
if fd:
    font_b64 = {k: b64(os.path.join(fd, v)) for k, v in fonts.items()}
else:
    old = open(out).read()
    font_b64 = json.loads(re.search(r'fonts: (\{.*?\}),\n', old).group(1))
with open(out, 'w') as f:
    f.write('"use strict";\n')
    f.write('// FTP Builder · Garage : maquette 3D « Aéro » (cadre original FTP Builder, géométrie taille M) — fichier GÉNÉRÉ par tools/bike3d (ne pas éditer à la main).\n')
    f.write('// GLB compressé (EXT_meshopt_compression + KHR_mesh_quantization) et polices des stickers (licence SIL OFL : Barlow Condensed, Orbitron, Archivo Black, Pacifico),\n')
    f.write('// en base64 pour se charger comme un script classique : GitHub Pages, hors ligne, et file:// des tests.\n')
    f.write('window.FTPB_BIKE = {\n')
    f.write('  fonts: ' + json.dumps(font_b64) + ',\n')
    f.write('  glb: "' + b64(glb) + '"\n};\n')
print(out, os.path.getsize(out))
