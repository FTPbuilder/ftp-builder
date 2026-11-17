"""Écrit models/nageurs.js : GLB compressé (meshopt) du nageur et du coach, en base64, sous forme de script classique.
Usage : python3 pack_app.py build/nageurs_m.glb ../../models/nageurs.js"""
import base64, sys, os
glb, out = sys.argv[1], sys.argv[2]
with open(out, 'w') as f:
    f.write('"use strict";\n')
    f.write('// FTP Builder · « Comprendre la séance » : nageur et coach 3D (corps sculptés, tenues, squelette) — fichier GÉNÉRÉ par tools/swim3d (ne pas éditer à la main).\n')
    f.write('// GLB compressé (EXT_meshopt_compression + KHR_mesh_quantization) en base64, pour se charger comme un script classique : GitHub Pages, hors ligne, file:// des tests.\n')
    f.write('window.FTPB_SWIM = { glb: "' + base64.b64encode(open(glb, 'rb').read()).decode() + '" };\n')
print(out, os.path.getsize(out))
