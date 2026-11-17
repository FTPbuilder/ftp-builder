"""Aperçu rapide d'un corps (sans squelette) : python3 preview_body.py nageur|coach [h] → build/<nom>_static.glb"""
import sys, os, time
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bike3d'))
from sdf import mesh_sdf  # noqa: E402
from glb import GLB  # noqa: E402
import anatomy as A  # noqa: E402

who = sys.argv[1] if len(sys.argv) > 1 else 'nageur'
h = float(sys.argv[2]) if len(sys.argv) > 2 else 0.004
M = A.NAGEUR if who == 'nageur' else A.COACH
J, prims, full = A.body(M)
t = time.time()
V, Fc, N = mesh_sdf(full, h=h, target_faces=80000)
print('mesh', len(V), len(Fc), f'{time.time() - t:.1f}s')
os.makedirs('build', exist_ok=True)
g = GLB()
m = g.material('skin', (0.80, 0.60, 0.50, 1), 0.0, 0.55)
g.node(who, mesh=g.mesh(who, V, Fc, N, mat=m))
print(g.save(f'build/{who}_static.glb'))
