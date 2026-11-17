"""Nageur et coach de « Comprendre la séance » : corps sculptés, tenues, accessoires, squelette et poids → GLB animable.

Usage : python3 build.py   → build/nageurs.glb (puis gltfpack + pack_app.py, voir README.md)
"""
import os, sys, json, struct, time
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bike3d'))
from sdf import mesh_sdf, grad, Union, Subtract, Intersect, Ellipsoid, Sphere, RoundBox, Cylinder, Torus, F  # noqa: E402
import fast_simplification  # noqa: E402
import anatomy as A  # noqa: E402
from anatomy import RoundCone  # noqa: E402

H_RAW = 0.0034          # pas du maillage brut (m)
OUT = os.path.join(os.path.dirname(__file__), 'build')
os.makedirs(OUT, exist_ok=True)


# ------------------------------------------------------------------ utilitaires de maillage
def vnormals(V, Fc):
    fi = Fc.astype(np.int64)
    fn = np.cross(V[fi[:, 1]] - V[fi[:, 0]], V[fi[:, 2]] - V[fi[:, 0]])
    vn = np.zeros((len(V), 3))
    for k in range(3):
        np.add.at(vn, fi[:, k], fn)
    return (vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)).astype(F)


def adjacency(nv, Fc):
    e = np.concatenate([Fc[:, [0, 1]], Fc[:, [1, 2]], Fc[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    return e  # paires (i, j) dans les deux sens


def boundary_edges(Fc):
    e = np.concatenate([Fc[:, [0, 1]], Fc[:, [1, 2]], Fc[:, [2, 0]]])
    key = np.sort(e, 1)
    u, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    return e[cnt[inv.ravel()] == 1]  # arêtes orientées (sens de la face)


def laplace(V, Fc, it, fixed=None, lam=0.5):
    V = V.copy(); e = adjacency(len(V), Fc)
    deg = np.bincount(e[:, 0], minlength=len(V)).astype(np.float64)
    for _ in range(it):
        acc = np.zeros_like(V, dtype=np.float64)
        np.add.at(acc, e[:, 0], V[e[:, 1]])
        avg = acc / np.maximum(deg, 1)[:, None]
        mv = lam * (avg - V)
        if fixed is not None:
            mv[fixed] = 0
        V = V + mv
    return V.astype(F)


def submesh(V, Fc, fmask):
    F2 = Fc[fmask]; used = np.unique(F2); remap = -np.ones(len(V), np.int64); remap[used] = np.arange(len(used))
    return used, remap[F2].astype(np.int32)


def simplify(V, Fc, target):
    if len(Fc) <= target:
        return V, Fc
    v, f = fast_simplification.simplify(V.astype(np.float32), Fc.astype(np.int32), 1.0 - target / len(Fc))
    return v.astype(F), f.astype(np.int32)


def shell(V, Fc, N, vsel, off, smooth=0, rim=0.0022, noise=0.0, taper=0.0):
    """Tissu / silicone ajusté : faces sélectionnées décalées le long de la normale, lissées, bord replié vers la peau.
    taper > 0 : l'épaisseur diminue près du bord (distance en mètres), pour des cheveux qui s'affinent."""
    fmask = vsel[Fc].all(1)
    used, F2 = submesh(V, Fc, fmask)
    be = boundary_edges(F2); bv = np.unique(be)
    o = np.full(len(used), off, F)
    if taper:
        from scipy.spatial import cKDTree
        dist, _ = cKDTree(V[used][bv]).query(V[used]); o = (off * (0.25 + 0.75 * np.clip(dist / taper, 0, 1))).astype(F)
    Vs = (V[used] + N[used] * o[:, None]).astype(F)
    if smooth:
        Vs = laplace(Vs, F2, smooth, fixed=bv)
    if noise:
        rng = np.random.default_rng(1); Vs = Vs + N[used] * (rng.random(len(Vs))[:, None].astype(F) * noise)
    if rim and len(be):
        Ns = vnormals(Vs, F2)
        base = len(Vs); idx = -np.ones(len(Vs), np.int64); idx[bv] = base + np.arange(len(bv))
        Vr = Vs[bv] - Ns[bv] * (off + rim)
        Vs = np.concatenate([Vs, Vr]).astype(F)
        a, b = be[:, 0], be[:, 1]
        t1 = np.stack([b, a, idx[a]], 1); t2 = np.stack([b, idx[a], idx[b]], 1)
        F2 = np.concatenate([F2, t1, t2]).astype(np.int32)
    return Vs, F2


# ------------------------------------------------------------------ poids de skinning
SPINE = {'Hips', 'Spine', 'Spine1', 'Spine2'}


def skin_weights(V, J, prims, Fc=None, smooth_it=2):
    names = list(J.keys()); ng = len(names); gi = {n: i for i, n in enumerate(names)}
    D = np.full((len(V), ng), 9.0, np.float32)
    for g, node, part, geo, wt in prims:
        if not wt:
            continue
        lo, hi = node.bounds(); m = 0.08
        msk = np.all((V >= lo - m) & (V <= hi + m), 1)
        if msk.any():
            D[msk, gi[g]] = np.minimum(D[msk, gi[g]], node(V[msk]))
    nb = A.neighbours(J)
    allowed = np.zeros((ng, ng), bool)
    for n, s in nb.items():
        for t in s:
            allowed[gi[n], gi[t]] = True
    g0 = np.argmin(D, 1)
    tau = np.array([0.034 if n in SPINE else 0.011 if ('Fing' in n or 'Thumb' in n or n == 'Jaw') else 0.016 for n in names], np.float32)
    Dm = D[np.arange(len(V)), g0][:, None]
    W = np.exp(-(D - Dm) / tau[None, :]) * allowed[g0]
    if Fc is not None and smooth_it:
        e = adjacency(len(V), Fc); deg = np.bincount(e[:, 0], minlength=len(V)).astype(np.float32)
        for _ in range(smooth_it):
            acc = np.zeros_like(W); np.add.at(acc, e[:, 0], W[e[:, 1]])
            W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)[:, None]
    W = W / W.sum(1, keepdims=True)
    top = np.argsort(-W, 1)[:, :4]
    tw = np.take_along_axis(W, top, 1); tw[tw < 0.01] = 0
    tw = tw / tw.sum(1, keepdims=True)
    return top.astype(np.uint8), tw.astype(np.float32)


# ------------------------------------------------------------------ occultation ambiante (pose de référence)
def bake_ao(V, N, occ_meshes, K=48, maxd=0.16):
    import trimesh
    Vo = np.concatenate([m[0] for m in occ_meshes]); off = np.cumsum([0] + [len(m[0]) for m in occ_meshes[:-1]])
    Fo = np.concatenate([m[1] + o for m, o in zip(occ_meshes, off)])
    tm = trimesh.Trimesh(Vo, Fo, process=False)
    rng = np.random.default_rng(7); d = rng.normal(size=(K, 3)); d /= np.linalg.norm(d, axis=1, keepdims=True)
    ao = np.zeros(len(V))
    for s in range(0, len(V), 4000):
        v, n = V[s:s + 4000].astype(np.float64), N[s:s + 4000].astype(np.float64)
        sg = np.sign(np.sum(d[None] * n[:, None], 2)); sg[sg == 0] = 1
        dirs = d[None, :, :] * sg[:, :, None]
        dirs = (dirs + n[:, None] * 0.25); dirs /= np.linalg.norm(dirs, axis=2, keepdims=True)
        org = (v[:, None, :] + n[:, None, :] * 0.0015).repeat(K, 1).reshape(-1, 3); dd = dirs.reshape(-1, 3)
        loc, ri, _ = tm.ray.intersects_location(org, dd, multiple_hits=False)
        hit = np.zeros(len(org)); dist = np.linalg.norm(loc - org[ri], axis=1); hit[ri] = np.clip(1 - dist / maxd, 0, 1)
        ao[s:s + 4000] = 1 - hit.reshape(-1, K).mean(1) * 1.35
    return np.clip(ao, 0.25, 1.0)


# ------------------------------------------------------------------ accessoires rigides (SDF fins)
def mesh_small(sdf, h, target):
    V, Fc, N = mesh_sdf(sdf, h=h, target_faces=target, verbose=False)
    return V, Fc, N


def goggles(M):
    """Lunettes de natation : verres miroir, joints, pont de nez, élastique autour de la tête (os Head)."""
    e = A.eye_centres(M); hd = np.array(A.skeleton(M)['Head'][0])
    lens, rims = [], []
    for c in e:
        c = c + [0, 0.001, 0.021]
        lens.append(Ellipsoid(c, [0.0215, 0.0145, 0.0090]))
        rims.append(Subtract(Ellipsoid(c + [0, 0, -0.004], [0.0255, 0.0180, 0.0105]), Ellipsoid(c + [0, 0, 0.002], [0.0205, 0.0138, 0.0130]), k=0.001))
    bridge = RoundCone(e[0] + [-0.012, 0.004, 0.018], e[1] + [0.012, 0.004, 0.018], 0.0026, 0.0026)
    # élastique : anneau elliptique incliné autour du crâne, sur le bonnet
    cen = hd + [0, 0.112, -0.018]
    th = np.linspace(0, 2 * np.pi, 72, endpoint=False)
    pts = np.stack([np.sin(th) * 0.0855, -0.004 + 0.022 * np.cos(th) * 0 + 0.012 * (1 - np.cos(th)) * 0.9, np.cos(th) * 0.1035], 1) + cen
    pts[:, 1] -= 0.012 * (np.cos(th) > 0.85)
    strap = Union(*[RoundCone(pts[i], pts[(i + 1) % len(pts)], 0.0032, 0.0032) for i in range(len(pts)) if np.cos(th[i]) < 0.82], k=0.001)
    lv, lf, ln = mesh_small(Union(*lens), 0.0007, 1400)
    rv, rf, rn = mesh_small(Union(*rims, bridge, k=0.002), 0.0007, 3000)
    sv, sf, sn = mesh_small(strap, 0.0012, 2400)
    return [('lunettes_verres', lv, lf, ln, 'lens'), ('lunettes_monture', rv, rf, rn, 'goggle'), ('lunettes_elastique', sv, sf, sn, 'strap')]


def eyes(M):
    """Yeux (sclère, iris, pupille en couleurs de sommets) et paupières (peau), rattachés à la tête."""
    out = []
    for i, c in enumerate(A.eye_centres(M)):
        V, Fc, N = mesh_small(Sphere(c, 0.0112), 0.0007, 1000)
        ax = np.array([0, 0.05, 1.0]); ax /= np.linalg.norm(ax)
        z = (V - c) @ ax / 0.0112
        col = np.ones((len(V), 3)) * [0.82, 0.79, 0.75]
        col[z > 0.76] = [0.24, 0.16, 0.10]; col[z > 0.80] = [0.33, 0.22, 0.13]; col[z > 0.95] = [0.03, 0.03, 0.03]
        out.append((f'oeil_{"LR"[i]}', V, Fc, N, 'eye', col))
    return out


def whistle(M):
    J = A.skeleton(M); s2 = np.array(J['Spine2'][0])
    w = RoundBox(s2 + [0.0, 0.010, 0.150], [0.010, 0.012, 0.022], 0.006)
    w = Union(w, Cylinder(s2 + [0, 0.004, 0.128], [0, 0, 1], 0.0060, 0.012, 0.002), k=0.002)
    V, Fc, N = mesh_small(w, 0.0007, 900)
    cord = []
    th = np.linspace(-1.0, 1.0, 26)
    for sgn in (1, -1):
        pts = np.stack([sgn * (0.012 + 0.055 * np.sin((th + 1) / 2 * np.pi / 2)), 1.505 - 0.17 * (1 - (th + 1) / 2) ** 1.6, 0.03 + 0.10 * (1 - (th + 1) / 2) ** 0.7 - 0.06 * ((th + 1) / 2)], 1)
        cord += [RoundCone(pts[i], pts[i + 1], 0.0018, 0.0018) for i in range(len(pts) - 1)]
    ring = Torus([0, 1.505, -0.035], [0, 0.96, 0.28], 0.060, 0.0018)
    cv, cf, cn = mesh_small(Union(*cord, ring, k=0.001), 0.0008, 2400)
    return [('sifflet', V, Fc, N, 'whistle'), ('cordon', cv, cf, cn, 'cord')]


def pull_buoy(M):
    J = A.skeleton(M); hp = np.array(J['Hips'][0])
    c = np.array([0, 0.76, 0.0]) * (M['H'] / 1.82)
    a = Cylinder(c + [0, 0, 0.040], [0, 1, 0], 0.040, 0.105, 0.016)
    b = Cylinder(c + [0, 0, -0.040], [0, 1, 0], 0.040, 0.105, 0.016)
    mid = RoundBox(c, [0.018, 0.098, 0.042], 0.012)
    V, Fc, N = mesh_small(Union(a, b, mid, k=0.012), 0.0018, 2600)
    col = np.where((np.abs(V[:, 2] - c[2]) > 0.040)[:, None], [1.0, 1.0, 1.0], [0.55, 0.55, 0.55])
    return [('pull_buoy', V, Fc, N, 'buoy', col)], hp


def paddles(M):
    J = A.skeleton(M); out = []
    for sd, k in (('L', 1), ('R', -1)):
        wr = np.array(J[f'{sd}_Hand'][0]); c = wr + [k * 0.085, -0.026, 0.002]
        plate = RoundBox(c, [0.105, 0.0028, 0.075], 0.0026)
        holes = Union(*[Cylinder(c + [k * dx, 0, dz], [0, 1, 0], 0.0075, 0.01) for dx in (-0.06, -0.02, 0.02, 0.06) for dz in (-0.04, 0.0, 0.04)])
        plate = Subtract(plate, holes, k=0.001)
        strap1 = Torus(wr + [k * 0.150, -0.012, -0.002], [1, 0, 0], 0.0145, 0.0022)   # doigt du milieu
        strap2 = Torus(wr + [k * 0.012, -0.008, 0.000], [1, 0, 0], 0.034, 0.0030)    # poignet
        V, Fc, N = mesh_small(plate, 0.0011, 1600)
        sv, sf, sn = mesh_small(Union(strap1, strap2), 0.0008, 1400)
        out += [(f'plaquette_{sd}', V, Fc, N, 'paddle', sd), (f'sangle_{sd}', sv, sf, sn, 'strap', sd)]
    return out


# ------------------------------------------------------------------ GLB avec squelette
class SkinGLB:
    def __init__(self):
        self.bin = bytearray(); self.bv, self.acc, self.meshes, self.nodes, self.mats, self.skins = [], [], [], [], [], []
        self.mi = {}; self.roots = []

    def view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        o = len(self.bin); self.bin += data
        b = {'buffer': 0, 'byteOffset': o, 'byteLength': len(data)}
        if target:
            b['target'] = target
        self.bv.append(b); return len(self.bv) - 1

    def accessor(self, arr, typ, ct, target=None, norm=False, minmax=False):
        arr = np.ascontiguousarray(arr); v = self.view(arr.tobytes(), target)
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[typ]
        a = {'bufferView': v, 'componentType': ct, 'count': int(arr.size // n), 'type': typ}
        if norm:
            a['normalized'] = True
        if minmax:
            a['min'] = arr.reshape(-1, n).min(0).tolist(); a['max'] = arr.reshape(-1, n).max(0).tolist()
        self.acc.append(a); return len(self.acc) - 1

    def material(self, name, color, rough=0.5, metal=0.0, double=False, alpha=None):
        if name in self.mi:
            return self.mi[name]
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': list(map(float, color)) + ([] if len(color) == 4 else [1.0]), 'metallicFactor': metal, 'roughnessFactor': rough}}
        if double:
            m['doubleSided'] = True
        if alpha:
            m['alphaMode'] = 'BLEND'
        self.mats.append(m); self.mi[name] = len(self.mats) - 1; return self.mi[name]

    def mesh(self, name, V, Fc, N, mat, C=None, joints=None, weights=None):
        at = {'POSITION': self.accessor(V.astype(np.float32), 'VEC3', 5126, 34962, minmax=True), 'NORMAL': self.accessor(N.astype(np.float32), 'VEC3', 5126, 34962)}
        if C is not None:
            c8 = np.clip(np.asarray(C) * 255 + 0.5, 0, 255).astype(np.uint8)
            if c8.shape[1] == 3:
                c8 = np.concatenate([c8, np.full((len(c8), 1), 255, np.uint8)], 1)
            at['COLOR_0'] = self.accessor(c8, 'VEC4', 5121, 34962, norm=True)
        if joints is not None:
            at['JOINTS_0'] = self.accessor(joints.astype(np.uint8), 'VEC4', 5121, 34962)
            at['WEIGHTS_0'] = self.accessor(weights.astype(np.float32), 'VEC4', 5126, 34962)
        idx = Fc.astype(np.uint16 if len(V) < 65536 else np.uint32).ravel()
        prim = {'attributes': at, 'indices': self.accessor(idx, 'SCALAR', 5123 if idx.dtype == np.uint16 else 5125, 34963), 'material': mat}
        self.meshes.append({'name': name, 'primitives': [prim]}); return len(self.meshes) - 1

    def node(self, name, parent=None, **kw):
        n = {'name': name}; n.update({k: v for k, v in kw.items() if v is not None})
        self.nodes.append(n); i = len(self.nodes) - 1
        if parent is None:
            self.roots.append(i)
        else:
            self.nodes[parent].setdefault('children', []).append(i)
        return i

    def save(self, path, extras=None):
        gl = {'asset': {'version': '2.0', 'generator': 'ftp-builder swim3d'}, 'scene': 0, 'scenes': [{'nodes': self.roots, 'extras': extras or {}}],
              'nodes': self.nodes, 'meshes': self.meshes, 'materials': self.mats, 'skins': self.skins, 'accessors': self.acc, 'bufferViews': self.bv, 'buffers': [{'byteLength': len(self.bin)}]}
        js = json.dumps(gl, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        while len(self.bin) % 4:
            self.bin.append(0)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin)))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(self.bin)
        return os.path.getsize(path)


# ------------------------------------------------------------------ un personnage
def region_masks(V, M, who):
    """Zones (en pose de référence) des tenues et cheveux, et leur version rétrécie (peau cachée à supprimer)."""
    s = M['H'] / 1.82; x, y, z = V[:, 0], V[:, 1], V[:, 2]; ax = np.abs(x)
    head = (y > 1.585 * s) & (ax < 0.13)
    cap_line = y - (1.640 * s + 0.583 * (z + 0.100))
    reg = {}
    if who == 'nageur':
        reg['suit'] = ((y > 0.590 * s) & (y < 1.030 * s) & (ax < 0.30), (y > 0.610 * s) & (y < 1.010 * s) & (ax < 0.30))
        reg['cap'] = (head & (cap_line > 0), head & (cap_line > 0.016))
    else:
        reg['shorts'] = ((y > 0.560 * s) & (y < 0.985 * s) & (ax < 0.30), (y > 0.585 * s) & (y < 0.950 * s) & (ax < 0.30))
        sm = lambda v: np.clip(v, 0, 1) ** 2 * (3 - 2 * np.clip(v, 0, 1))
        collar = 1.512 * s + 0.032 * sm(ax / 0.10) - 0.040 * (z > 0) * sm(1 - ax / 0.075) + 0.012 * (z < 0)   # col rond
        neck = (np.hypot(x, z + 0.022) < 0.066) & (y > 1.47 * s)
        torso_ok = (y > 0.925 * s) & (y < collar) & (ax < 0.375) & ~neck
        reg['shirt'] = (torso_ok, (y > 0.945 * s) & (y < collar - 0.025) & (ax < 0.355) & ~(np.hypot(x, z + 0.022) < 0.085))
        hd = np.array(A.skeleton(M)['Head'][0])
        hl = hd[1] + np.where(z > -0.005, 0.112 + 0.060 * sm((z + 0.005) / 0.095), 0.112 - 0.092 * sm(-(z + 0.005) / 0.10))  # ligne des cheveux
        hl = hl + 0.018 * np.exp(-((z - 0.060) / 0.030) ** 2) * sm((ax - 0.030) / 0.03)                                     # golfes des tempes
        ear = (ax > 0.062) & (y < 1.742 * s) & (z > -0.055) & (z < 0.016)
        reg['hair'] = (head & (y > hl) & ~ear, None)
        hd = np.array(A.skeleton(M)['Head'][0])
        u = np.clip((ax - 0.012) / 0.040, 0, 1)                                         # 0 côté nez → 1 côté tempe
        arch = hd[1] + 0.121 * M['head'] + 0.007 * np.sin(np.pi * np.clip(u * 0.9 + 0.1, 0, 1)) - 0.003 * u
        th = 0.0042 - 0.0018 * u
        reg['brow'] = ((np.abs(y - arch) < th) & (z > hd[2] + 0.060) & (ax > 0.012) & (ax < 0.052) & head, None)
    return reg


def character(M, who, g, mats):
    t0 = time.time()
    J, prims, full = A.body(M)
    V, Fc, N = mesh_sdf(full, h=H_RAW, target_faces=None, verbose=False)
    print(f'{who}: brut {len(V)} v / {len(Fc)} f ({time.time() - t0:.0f} s)', flush=True)
    reg = region_masks(V, M, who)
    parts = []
    # tenues (coques ajustées) depuis le maillage brut
    spec = {'suit': (0.0022, 2, 7000, 'suit'), 'cap': (0.0030, 25, 4200, 'cap'), 'shorts': (0.0032, 6, 6000, 'shorts'),
            'shirt': (0.0062, 26, 9000, 'shirt'), 'hair': (0.0058, 3, 5200, 'hair'), 'brow': (0.0018, 1, 500, 'brow')}
    hide = np.zeros(len(V), bool)
    for k, (sel, shrink) in reg.items():
        off, sm, tgt, mat = spec[k]
        if k == 'cap':  # le silicone recouvre les oreilles : coque très lissée
            sm = 30
        Vs, Fs = shell(V, Fc, N, sel, off, smooth=sm, noise=0.0022 if k == 'hair' else 0.0, rim=0.0 if k in ('hair', 'brow') else 0.0024, taper=0.022 if k == 'hair' else 0.0)
        Vs, Fs = simplify(Vs, Fs, tgt)
        parts.append((k, Vs, Fs, vnormals(Vs, Fs), mat))
        if shrink is not None:
            hide |= shrink
    # peau visible seulement, simplifiée
    keep = ~hide[Fc].all(1)
    used, Fb = submesh(V, Fc, keep)
    Vb, Fb = simplify(V[used], Fb, 30000)
    Nb = grad(full, Vb, eps=3e-4); Nb = Nb / np.maximum(np.linalg.norm(Nb, axis=1, keepdims=True), 1e-9)
    gn = vnormals(Vb, Fb); bad = np.sum(Nb * gn, 1) < 0.8; Nb[bad] = gn[bad]
    # teintes de peau : lèvres, joues, (barbe naissante du coach) × occultation ambiante
    hd = np.array(J['Head'][0]); x, y, z = Vb[:, 0], Vb[:, 1], Vb[:, 2]
    tint = np.ones((len(Vb), 3))
    lips = np.exp(-(((y - (hd[1] + 0.047)) / 0.010) ** 2 + (x / 0.024) ** 2)) * (z > hd[2] + 0.075)
    tint *= 1 - lips[:, None] * np.array([0.10, 0.30, 0.28])
    cheeks = sum(np.exp(-(((y - hd[1] - 0.075) / 0.020) ** 2 + ((x - k * 0.040) / 0.020) ** 2)) for k in (1, -1)) * (z > hd[2] + 0.05)
    tint *= 1 - cheeks[:, None] * np.array([0.0, 0.06, 0.06])
    if who == 'coach':
        beard = ((y < hd[1] + 0.060) & (y > hd[1] + 0.000) & (z > hd[2] + 0.010) & (np.abs(x) < 0.070)) & ~(lips > 0.25)
        tint[beard] *= np.array([0.80, 0.78, 0.78])
    else:
        nip = sum(np.exp(-(((y - 1.355 * M['H'] / 1.82) / 0.008) ** 2 + ((x - k * 0.088) / 0.008) ** 2)) for k in (1, -1)) * (z > 0.05)
        tint *= 1 - nip[:, None] * np.array([0.12, 0.30, 0.28])
    occ = [(Vb, Fb)] + [(p[1], p[2]) for p in parts]
    ao = bake_ao(Vb, Nb, occ)
    Cb = np.clip(tint * ao[:, None], 0, 1)
    parts.insert(0, ('corps', Vb, Fb, Nb, 'skin', Cb))
    print(f'{who}: peau {len(Vb)} v, tenues {[(p[0], len(p[2])) for p in parts[1:]]} ({time.time() - t0:.0f} s)', flush=True)
    # squelette
    pre = 'N_' if who == 'nageur' else 'C_'
    root = g.node('Nageur' if who == 'nageur' else 'Coach')
    names = list(J.keys()); ni = {}
    for n in names:
        p, par = J[n]
        pw = np.array(p); pp = np.array(J[par][0]) if par else np.zeros(3)
        ni[n] = g.node(pre + n, parent=root if par is None else ni[par], translation=(pw - pp).tolist())
    ibm = np.zeros((len(names), 16), np.float32)
    for i, n in enumerate(names):
        m = np.eye(4); m[:3, 3] = -np.array(J[n][0]); ibm[i] = m.T.ravel()
    g.skins.append({'name': pre + 'skin', 'joints': [ni[n] for n in names], 'inverseBindMatrices': g.accessor(ibm, 'MAT4', 5126), 'skeleton': ni['Hips']})
    skin = len(g.skins) - 1
    for p in parts:
        k, Vp, Fp, Np, mat = p[:5]; C = p[5] if len(p) > 5 else None
        jo, we = skin_weights(Vp, J, prims, Fp, smooth_it=2 if k == 'corps' else 1)
        mi = g.mesh(pre + k, Vp, Fp, Np, mats[(who, mat)], C, jo, we)
        g.node(pre + k, parent=root, mesh=mi, skin=skin)
    # accessoires rigides, rattachés à leur os
    def rigid(name, V_, F_, N_, mat, bone, C=None, extras=None):
        bw = np.array(J[bone][0])
        mi = g.mesh(pre + name, (V_ - bw).astype(F), F_, N_, mats[(who, mat)], C)
        g.node(pre + name, parent=ni[bone], mesh=mi, extras=extras)
    for nm, V_, F_, N_, mat in goggles(M):
        rigid(nm, V_, F_, N_, mat, 'Head')
    for nm, V_, F_, N_, mat, col in eyes(M):
        rigid(nm, V_, F_, N_, mat, 'Head', col)
    if who == 'coach':
        for nm, V_, F_, N_, mat in whistle(M):
            rigid(nm, V_, F_, N_, mat, 'Spine2')
    if who == 'nageur':
        (nm, V_, F_, N_, mat, col), = pull_buoy(M)[0]
        rigid(nm, V_, F_, N_, mat, 'Hips', col)
        for nm, V_, F_, N_, mat, sd in paddles(M):
            rigid(nm, V_, F_, N_, mat, f'{sd}_Hand')
    print(f'{who}: fini ({time.time() - t0:.0f} s)', flush=True)
    return {n: list(map(float, J[n][0])) for n in names}


def main():
    g = SkinGLB(); mats = {}
    for who, M in (('nageur', A.NAGEUR), ('coach', A.COACH)):
        P = lambda *a, **k: g.material(f'{who}_{a[0]}', *a[1:], **k)
        mats[(who, 'skin')] = P('peau', (0.86, 0.66, 0.54), 0.52)
        mats[(who, 'suit')] = P('jammer', (0.05, 0.08, 0.16), 0.45)
        mats[(who, 'cap')] = P('bonnet', (1.0, 0.54, 0.30), 0.30)
        mats[(who, 'shorts')] = P('jammer', (0.04, 0.05, 0.07), 0.45)
        mats[(who, 'shirt')] = P('lycra', (0.06, 0.13, 0.30), 0.62)
        mats[(who, 'hair')] = P('cheveux', (0.10, 0.07, 0.05), 0.85)
        mats[(who, 'brow')] = P('sourcils', (0.11, 0.08, 0.06), 0.9)
        mats[(who, 'eye')] = P('yeux', (1, 1, 1), 0.12)
        mats[(who, 'lens')] = P('verres', (0.10, 0.16, 0.22), 0.05, 0.6)
        mats[(who, 'goggle')] = P('monture', (0.08, 0.09, 0.10), 0.35)
        mats[(who, 'strap')] = P('elastique', (0.06, 0.07, 0.08), 0.5)
        mats[(who, 'whistle')] = P('sifflet', (0.85, 0.10, 0.10), 0.35)
        mats[(who, 'cord')] = P('cordon', (0.92, 0.92, 0.92), 0.7)
        mats[(who, 'buoy')] = P('pullbuoy', (1.0, 0.78, 0.10), 0.65)
        mats[(who, 'paddle')] = P('plaquette', (0.10, 0.45, 0.85), 0.25)
    joints = {}
    for who, M in (('nageur', A.NAGEUR), ('coach', A.COACH)):
        joints[who] = character(M, who, g, mats)
    path = os.path.join(OUT, 'nageurs.glb')
    print('GLB', g.save(path, extras={'joints': joints}), 'octets →', path)


if __name__ == '__main__':
    main()
