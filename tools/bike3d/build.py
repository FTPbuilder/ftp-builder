"""Assemble la maquette du vélo (GLB). Usage : FTPB_APP=1 python3 build.py 1.0 all → build/bike_app.glb (version de l'app). Voir README.md."""
import sys, os, json, time, hashlib, inspect
import numpy as np
from sdf import mesh_sdf, catmull, nrm
import frame as FR
import parts as PT
import mech as ME
from mech import M, merge, lathe, fix_orientation, vertex_normals
from geom import *
from glb import GLB

Q = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0   # resolution multiplier (1 = final)
APP = os.environ.get('FTPB_APP') == '1'                  # lighter model for the FTP builder app (phones)
TF = 0.52 if APP else 1.0
SUF = '_app' if APP else ''
REBUILD = set(sys.argv[2:])
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build')
CACHE = os.path.join(OUT, 'cache')
os.makedirs(CACHE, exist_ok=True)


def cached(name, fn, h, tf):
    THIN = ('fd', 'rd_cage', 'rd_bolts', 'lever_1', 'lever_-1', 'rails', 'seatclamp', 'caliper_f_bolts', 'caliper_r_bolts', 'crank_r_bolts', 'crank_l_bolts')
    if APP:   # big sculpted parts get much lighter, medium ones a little; thin parts (cages, levers) keep their detail or they would alias
        tf = tf * TF if tf >= 30000 else tf if name in THIN or name.endswith(('_pads', '_shoes', '_bolt')) else tf * 0.72
    path = f'{CACHE}/{name}{SUF}_{Q:.2f}.npz'
    if os.path.exists(path) and not ({'all', name} & REBUILD):
        z = np.load(path)
        return M(z['V'], z['F'], z['N'])
    t = time.time()
    s = fn()
    V, F, N = mesh_sdf(s, h=h * Q, target_faces=int(tf), verbose=False)
    np.savez(path, V=V, F=F, N=N)
    print(f'  {name}: {len(F)} faces, {time.time() - t:.1f}s', flush=True)
    return M(V, F, N)


def cached_mech(name, fn):
    path = f'{CACHE}/{name}{SUF}.npz'
    if os.path.exists(path) and not ({'all', name, 'mech'} & REBUILD):
        z = np.load(path, allow_pickle=True)
        out = []
        for i in range(int(z['n'])):
            out.append(M(z[f'V{i}'], z[f'F{i}'], z[f'N{i}'], z[f'UV{i}'] if f'UV{i}' in z else None))
        return out
    res = fn()
    res = list(res) if isinstance(res, (list, tuple)) else [res]
    d = {'n': len(res)}
    for i, m in enumerate(res):
        d[f'V{i}'] = m.V; d[f'F{i}'] = m.F; d[f'N{i}'] = m.N
        if m.UV is not None:
            d[f'UV{i}'] = m.UV
    np.savez(path, **d)
    return res


# ---------------------------------------------------------------- bar tape
def tape_mesh(points, r=0.0136, ridge=0.00042, pitch=0.0205, nring=36, nseg=300, sgn=1):
    C = catmull(points, nseg)
    T = nrm(np.gradient(C, axis=0))
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    Nf = np.zeros_like(C); Bf = np.zeros_like(C)
    n0 = np.cross(T[0], [0, 1.0, 0]); n0 = n0 / np.linalg.norm(n0)
    Nf[0] = n0
    for i in range(1, len(C)):
        v = Nf[i - 1] - np.dot(Nf[i - 1], T[i]) * T[i]
        Nf[i] = v / np.linalg.norm(v)
    Bf = np.cross(T, Nf)
    th = np.linspace(0, 2 * np.pi, nring + 1)
    V = np.zeros((len(C), nring + 1, 3)); UV = np.zeros((len(C), nring + 1, 2))
    for i in range(len(C)):
        f = (s[i] / pitch + sgn * th / (2 * np.pi)) % 1.0
        saw = np.where(f < 0.88, 1 - f / 0.88, (f - 0.88) / 0.12)
        # taper ridge at start/end
        fade = np.clip(min(s[i], s[-1] - s[i]) / 0.01, 0, 1)
        rr = r + ridge * saw * fade
        V[i] = C[i] + rr[:, None] * (np.cos(th)[:, None] * Nf[i] + np.sin(th)[:, None] * Bf[i])
        UV[i, :, 0] = th / (2 * np.pi); UV[i, :, 1] = s[i] / pitch
    F = []
    W = nring + 1
    for i in range(len(C) - 1):
        for j in range(nring):
            a = i * W + j; b = (i + 1) * W + j
            F += [[a, b, b + 1], [a, b + 1, a + 1]]
    V = V.reshape(-1, 3); F = np.array(F)
    # end cap (drop end) fan
    ci = len(V); V = np.vstack([V, C[-1]]); UV = np.vstack([UV.reshape(-1, 2), [[0, 0]]])
    base = (len(C) - 1) * W
    F = np.vstack([F, [[base + j, ci, base + j + 1] for j in range(nring)]])
    m = M(V, F, None, UV)
    # orient outward
    cen = V[F].mean(1); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    near = np.array([C[min(int(np.argmin(np.linalg.norm(C - c, axis=1))), len(C) - 1)] for c in cen[::97]])
    if np.mean(np.sum(fn[::97] * (cen[::97] - near), 1) > 0) < 0.5:
        F = F[:, ::-1]
    m = M(V, F, None, UV)
    return m, C[-1], T[-1]


def bar_plug(end, tangent):
    prof = np.array([[0.0, 0.0], [0.0128, 0.0], [0.0128, 0.0], [0.0131, 0.0015], [0.0131, 0.0045], [0.0124, 0.0060], [0.0124, 0.0060], [0.0, 0.0060]])
    m = fix_orientation(lathe(prof, 40))
    z = tangent / np.linalg.norm(tangent)
    x = np.cross([0, 1.0, 0], z); x /= np.linalg.norm(x); y = np.cross(z, x)
    R = np.stack([x, y, z], 1)
    return m.transformed(R, end - 0.0012 * z)


# ---------------------------------------------------------------- decals
def decal_from(mesh, sel_fn, uv_fn, offset=0.00028):
    V, F, N = mesh.V, mesh.F, mesh.N
    keep = sel_fn(V, F, N)
    Fk = F[keep]
    used = np.unique(Fk)
    remap = -np.ones(len(V), np.int64); remap[used] = np.arange(len(used))
    Vn = V[used] + offset * N[used]
    UV = uv_fn(V[used])
    return M(Vn, remap[Fk], N[used], UV)


def downtube_decal(frame, side):
    dt0 = FR.HTP(0.080, -0.010); dt1 = BB + np.array([0.006, 0.012, 0])
    L = np.linalg.norm(dt1 - dt0); T = (dt1 - dt0) / L
    U = np.array([1.0, 0, 0]) - T[0] * T; U /= np.linalg.norm(U)
    s0, s1, ulo, uhi = 0.13, 0.89, -0.0385, 0.0170

    def coords(P):
        w = P - dt0
        return (w @ T) / L, w @ U

    def sel(V, F, N):
        c = V[F].mean(1); n = N[F].mean(1)
        s, u = coords(c)
        return (s > s0 - 0.01) & (s < s1 + 0.01) & (u > ulo - 0.004) & (u < uhi + 0.004) & (side * n[:, 2] > 0.35) & (side * c[:, 2] > 0.008)

    def uv(P):
        s, u = coords(P)
        us = (s1 - s) / (s1 - s0) if side > 0 else (s - s0) / (s1 - s0)
        vs = (uhi - u) / (uhi - ulo)
        return np.stack([us, vs], 1)
    return decal_from(frame, sel, uv), dict(length=float(L * (s1 - s0)), height=float(uhi - ulo))


def headtube_decal(frame):
    a0, a1, zw = 0.022, 0.112, 0.0185

    def sel(V, F, N):
        c = V[F].mean(1); n = N[F].mean(1)
        w = c - HT_TOP
        a = w @ AX_DN
        f = w @ AX_FW
        return (a > a0 - 0.004) & (a < a1 + 0.004) & (np.abs(c[:, 2]) < zw + 0.003) & (n @ AX_FW > 0.25) & (f > 0.0)

    def uv(P):
        w = P - HT_TOP
        a = w @ AX_DN
        return np.stack([(zw - P[:, 2]) / (2 * zw), (a1 - a) / (a1 - a0)], 1)
    return decal_from(frame, sel, uv), dict(width=2 * zw, height=a1 - a0)


def fork_decal(fork, side):
    A0, A1 = 0.105, 0.310
    # leg centre-line (forward offset) as function of A
    leg = [FR.FKP(0.040, 0.0), FR.FKP(0.095, 0.001), FR.FKP(0.25, 0.017), FR.FKP(AXLE_TO_CROWN - 0.003, FORK_OFFSET - 0.0015)]
    from sdf import bezier
    C = bezier(leg, 64)
    Ac = (C - HT_BOT) @ AX_DN; Fc = (C - HT_BOT) @ AX_FW

    def coords(P):
        w = P - HT_BOT
        A = w @ AX_DN; f = w @ AX_FW - np.interp(A, Ac, Fc)
        return A, f
    flo, fhi = -0.020, 0.0085

    def sel(V, F, N):
        c = V[F].mean(1); n = N[F].mean(1)
        A, f = coords(c)
        return (A > A0 - 0.005) & (A < A1 + 0.005) & (f > flo - 0.003) & (f < fhi + 0.003) & (side * n[:, 2] > 0.45) & (side * c[:, 2] > 0.04)

    def uv(P):
        A, f = coords(P)
        us = (A - A0) / (A1 - A0) if side > 0 else (A1 - A) / (A1 - A0)
        return np.stack([us, (f - flo) / (fhi - flo)], 1)
    return decal_from(fork, sel, uv), dict(length=A1 - A0, height=fhi - flo)


# ---------------------------------------------------------------- bottle-cage bolts
def bottle_bolts(frame_sdf_node):
    from sdf import grad as sgrad
    dt0 = FR.HTP(0.080, -0.010); dt1 = BB + np.array([0.006, 0.012, 0])
    T = (dt1 - dt0) / np.linalg.norm(dt1 - dt0)
    U = np.array([1.0, 0, 0]) - T[0] * T; U /= np.linalg.norm(U)
    seeds = []
    for s in (0.50, 0.66):           # down tube, trailing (upper) face
        seeds.append((dt0 + s * (dt1 - dt0), -U))
    for s in (0.20, 0.34):           # seat tube, leading (front) face
        c = BB + s * ST_LEN * ST_DIR
        F = np.array([1.0, 0, 0]) - ST_DIR[0] * ST_DIR; F /= np.linalg.norm(F)
        seeds.append((c, F))
    out = []
    for c, d in seeds:
        lo, hi = 0.0, 0.08
        for _ in range(40):
            mid = (lo + hi) / 2
            v = frame_sdf_node(np.array([c + mid * d], np.float32))[0]
            if v < 0: lo = mid
            else: hi = mid
        p = c + lo * d
        n = sgrad(frame_sdf_node, np.array([p], np.float32))[0]; n = n / np.linalg.norm(n)
        prof = np.array([[0.0, 0.0], [0.0046, 0.0], [0.0046, 0.0], [0.0046, 0.0011], [0.0040, 0.0019], [0.0022, 0.0019], [0.0022, 0.0019], [0.0022, 0.0008], [0.0022, 0.0008], [0.0, 0.0008]])
        m = fix_orientation(lathe(prof, 24))
        z = n; x = np.cross([0, 0, 1.0], z); x = x / np.linalg.norm(x) if np.linalg.norm(x) > 1e-6 else np.array([1.0, 0, 0]); y = np.cross(z, x)
        out.append(m.transformed(np.stack([x, y, z], 1), p - 0.0002 * n))
    return merge(out)


# ---------------------------------------------------------------- ambient occlusion bake
def hemisphere_dirs(k, seed=3):
    rng = np.random.default_rng(seed)
    # stratified cosine-weighted
    n = int(np.ceil(np.sqrt(k)))
    u = (np.arange(n)[:, None] + rng.random((n, n))) / n
    v = (np.arange(n)[None, :] + rng.random((n, n))) / n
    u = u.ravel()[:k]; v = v.ravel()[:k]
    r = np.sqrt(u); th = 2 * np.pi * v
    return np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(np.maximum(0, 1 - u))], 1)


def rim_proxy(depth=0.050, seg=96):
    rtop = 0.3152
    pts = [(rtop - 0.0007, 0.0116), (rtop, 0.0146)]
    for s in np.linspace(0.05, 1, 24):
        w = 0.0146 + 0.0012 * np.sin(np.pi * 0.5 * min(s / 0.42, 1)) - 0.0027 * np.clip((s - 0.42) / 0.58, 0, 1) ** 2
        if s > 0.7:
            w *= np.sqrt(max(0, 1 - ((s - 0.7) / 0.3) ** 2))
        pts.append((rtop - s * depth, w))
    right = np.array(pts); left = right[::-1].copy(); left[:, 1] *= -1
    prof = np.vstack([right, left[1:]])
    return lathe(prof, seg)


def bake_ao(items, occluders, K=96, maxd=0.085, batch=20000):
    from embreex import rtcore_scene as rtcs
    from embreex.mesh_construction import TriangleMesh
    scene = rtcs.EmbreeScene()
    tris = np.concatenate([m.V[m.F] for m in occluders]).astype(np.float32)
    TriangleMesh(scene, tris)
    D = hemisphere_dirs(K)
    out = {}
    rng = np.random.default_rng(7)
    for name, m in items:
        V = m.V.astype(np.float64); N = m.N / np.maximum(np.linalg.norm(m.N, axis=1, keepdims=True), 1e-9)
        ao = np.ones(len(V))
        for s in range(0, len(V), batch):
            v = V[s:s + batch]; n = N[s:s + batch]
            a = np.where(np.abs(n[:, :1]) < 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 1.0, 0]]))
            t = np.cross(n, a); t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9); bt = np.cross(n, t)
            phi = rng.random(len(v)) * 2 * np.pi
            c, si = np.cos(phi)[:, None], np.sin(phi)[:, None]
            t2 = c * t + si * bt; b2 = -si * t + c * bt
            dirs = (D[None, :, 0:1] * t2[:, None, :] + D[None, :, 1:2] * b2[:, None, :] + D[None, :, 2:3] * n[:, None, :]).reshape(-1, 3)
            orig = np.repeat(v + n * 0.00045, K, axis=0)
            dist = scene.run(orig.astype(np.float32), dirs.astype(np.float32), dists=np.full(len(orig), maxd, np.float32), query='DISTANCE')
            dist = np.asarray(dist).reshape(-1, K)
            w = np.clip(1.0 - dist / maxd, 0, 1) ** 0.75
            ao[s:s + batch] = 1.0 - w.mean(1)
        ao = np.nan_to_num(ao, nan=1.0)
        out[name] = np.clip(0.12 + 0.88 * np.clip(ao, 0, 1) ** 1.15, 0, 1)
    return out


# ---------------------------------------------------------------- build
def main():
    t0 = time.time()
    g = GLB()
    mat = {}

    def m(name, color, metal=0.0, rough=0.5, **kw):
        mat[name] = g.material(name, color, metal, rough, **kw)
        return mat[name]
    m('Paint_Frame', (0.10, 0.12, 0.14, 1), 0.0, 0.42)
    m('Carbon_Black', (0.018, 0.018, 0.020, 1), 0.0, 0.42)
    m('Rubber_Hood', (0.012, 0.012, 0.013, 1), 0.0, 0.80)
    m('Bar_Tape', (0.015, 0.015, 0.016, 1), 0.0, 0.78)
    m('Saddle_Cover', (0.014, 0.014, 0.015, 1), 0.0, 0.68)
    m('Saddle_Rails', (0.030, 0.030, 0.032, 1), 0.3, 0.38)
    m('Tyre_Tread', (0.022, 0.022, 0.022, 1), 0.0, 0.72)
    m('Tyre_Wall', (0.020, 0.020, 0.020, 1), 0.0, 0.70)
    m('Metal_Silver', (0.80, 0.80, 0.81, 1), 1.0, 0.28)
    m('Metal_Steel', (0.62, 0.62, 0.64, 1), 1.0, 0.34)
    m('Metal_Dark', (0.10, 0.10, 0.11, 1), 0.9, 0.36)
    m('Anodized_Black', (0.025, 0.025, 0.028, 1), 0.6, 0.38)
    m('Decal', (1, 1, 1, 1), 0.0, 0.4, double=False)
    m('Brake_Pad', (0.055, 0.030, 0.022, 1), 0.0, 0.85)

    root = g.node('Bike', extras={'generator': 'ftp-builder', 'units': 'm'})

    queue = []

    def add(name, mesh, mname, parent, uv=False, offset=None):
        queue.append(dict(name=name, mesh=mesh, mname=mname, parent=parent, uv=uv, offset=offset))

    print('SDF parts', flush=True)
    frame = cached('frame', FR.frame_sdf, 0.0011, 170000)
    fork = cached('fork', FR.fork_sdf, 0.0009, 52000)
    cockpit = cached('cockpit', PT.cockpit_sdf, 0.0008, 60000)
    hoods = [cached(f'hood_{s}', lambda s=s: PT.hood_sdf(s), 0.0006, 14000) for s in (1, -1)]
    levers = [cached(f'lever_{s}', lambda s=s: PT.lever_sdf(s), 0.00045, 7000) for s in (1, -1)]
    post = cached('seatpost', PT.seatpost_sdf, 0.0007, 12000)
    clamp = cached('seatclamp', PT.seat_clamp_sdf, 0.0004, 5000)
    shell = cached('saddle', PT.saddle_shell_sdf, 0.0008, 42000)
    rails = cached('rails', PT.saddle_rails_sdf, 0.0005, 6000)
    calF = PT.caliper_sdf(AXLE_F, 138 * D2R, 0.0720, F_ROTOR_Z, 'fork')
    calR = PT.caliper_sdf(AXLE_R, 15 * D2R, 0.0620, R_ROTOR_Z, 'stay')
    cal_f = cached('caliper_f', lambda: calF[0], 0.00055, 12000)
    cal_fb = cached('caliper_f_bolts', lambda: calF[1], 0.0004, 1500)
    cal_r = cached('caliper_r', lambda: calR[0], 0.00055, 12000)
    cal_rb = cached('caliper_r_bolts', lambda: calR[1], 0.0004, 1500)
    crR = PT.crank_sdf(1); crL = PT.crank_sdf(-1)
    crank_r = cached('crank_r', lambda: crR[0], 0.0006, 26000)
    crank_rb = cached('crank_r_bolts', lambda: crR[1], 0.0004, 2500)
    crank_l = cached('crank_l', lambda: crL[0], 0.0006, 14000)
    crank_lb = cached('crank_l_bolts', lambda: crL[1], 0.0004, 1200)
    rdh, rdb = PT.rd_sdf()
    rd_hanger = cached('rd_hanger', lambda: rdh, 0.0005, 4000)
    rd_body = cached('rd_body', lambda: rdb, 0.0005, 16000)
    cage, cbolts = PT.rd_cage_sdf()
    rd_cage = cached('rd_cage', lambda: cage, 0.00035, 9000)
    rd_bolts = cached('rd_bolts', lambda: cbolts, 0.0003, 1200)
    fd = cached('fd', PT.fd_sdf, 0.0005, 12000)

    print('mechanical parts', flush=True)
    tread, wall_r, wall_l = cached_mech('tyre', lambda: ME.tyre_meshes(128 if APP else 192))
    hub_f, = cached_mech('hub_f', lambda: ME.hub_mesh(True))
    hub_r, = cached_mech('hub_r', lambda: ME.hub_mesh(False))
    lock_f, = cached_mech('lock_f', lambda: ME.centerlock(F_ROTOR_Z - 0.0050))
    lock_r, = cached_mech('lock_r', lambda: ME.centerlock(R_ROTOR_Z - 0.0050))
    axle_f, = cached_mech('axle_f', lambda: ME.axle_ends(True))
    axle_r, = cached_mech('axle_r', lambda: ME.axle_ends(False))
    rot_f = cached_mech('rotor_f', lambda: ME.rotor_meshes(F_ROTOR_R, F_ROTOR_Z))
    rot_r = cached_mech('rotor_r', lambda: ME.rotor_meshes(R_ROTOR_R, R_ROTOR_Z))
    ring_b, ring_s = cached_mech('rings', lambda: ME.chainrings(CRANK_ANGLE))
    cogs, core = cached_mech('cassette', ME.cassette)
    cogs11, core11 = cached_mech('cassette11', lambda: ME.cassette([11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28], 0.00395))
    ch_o, ch_i, ch_r = cached_mech('chain', lambda: ME.chain_meshes()[:3])
    pul, pulh = cached_mech('pulleys', ME.pulleys)

    # bar tape & plugs
    tapes, plugs = [], []
    for s in (1, -1):
        tm, end, tg = tape_mesh(PT.bend_points(s), sgn=s)
        tapes.append(tm); plugs.append(bar_plug(end, tg))

    # ---------------- assemble
    nf = g.node('Frame', parent=root)
    add('Frame_Paint', frame, 'Paint_Frame', nf)
    bb_path = f'{CACHE}/bolts_{Q:.2f}.npz'
    if os.path.exists(bb_path) and not ({'all', 'frame', 'bolts'} & REBUILD):
        z = np.load(bb_path); bolts = M(z['V'], z['F'], z['N'])
    else:
        bolts = bottle_bolts(FR.frame_sdf()); np.savez(bb_path, V=bolts.V, F=bolts.F, N=bolts.N)
    add('Bottle_Bolts', bolts, 'Anodized_Black', nf)
    decals = {}
    dR, infoR = downtube_decal(frame, 1); dL, infoL = downtube_decal(frame, -1)
    dH, infoH = headtube_decal(frame)
    add('Decal_DownTube_R', dR, 'Decal', nf, uv=True)
    add('Decal_DownTube_L', dL, 'Decal', nf, uv=True)
    add('Decal_HeadTube', dH, 'Decal', nf, uv=True)
    decals.update(downtube=infoR, headtube=infoH)

    nfo = g.node('Fork', parent=root)
    add('Fork_Paint', fork, 'Paint_Frame', nfo)
    fR, infoF = fork_decal(fork, 1); fL, _ = fork_decal(fork, -1)
    add('Decal_Fork_R', fR, 'Decal', nfo, uv=True)
    add('Decal_Fork_L', fL, 'Decal', nfo, uv=True)
    decals['fork'] = infoF

    ns = g.node('Seatpost', parent=root)
    add('Seatpost_Paint', post, 'Paint_Frame', ns)
    add('Seat_Clamp', clamp, 'Anodized_Black', ns)
    nsa = g.node('Saddle', parent=root)
    add('Saddle_Cover', shell, 'Saddle_Cover', nsa)
    add('Saddle_Rails', rails, 'Saddle_Rails', nsa)

    nc = g.node('Cockpit', parent=root)
    add('Cockpit_Carbon', cockpit, 'Carbon_Black', nc)
    for i, s in enumerate(('R', 'L')):
        add(f'Bartape_{s}', tapes[i], 'Bar_Tape', nc, uv=True)
        add(f'BarEnd_{s}', plugs[i], 'Anodized_Black', nc)
        add(f'Hood_{s}', hoods[i], 'Rubber_Hood', nc)
        add(f'Lever_{s}', levers[i], 'Carbon_Black', nc)

    nd = g.node('Drivetrain', parent=root)
    add('Crank_R', crank_r, 'Anodized_Black', nd)
    add('Crank_L', crank_l, 'Anodized_Black', nd)
    add('Crank_Bolts', merge([crank_rb, crank_lb]), 'Metal_Silver', nd)
    add('Chainring_Big', ring_b, 'Metal_Dark', nd)
    add('Chainring_Small', ring_s, 'Metal_Dark', nd)
    add('Chain_Outer', ch_o, 'Metal_Silver', nd)
    add('Chain_Inner', ch_i, 'Metal_Steel', nd)
    add('Chain_Rollers', ch_r, 'Metal_Silver', nd)
    add('FD', fd, 'Anodized_Black', nd)
    add('RD_Hanger', rd_hanger, 'Metal_Dark', nd)
    add('RD_Body', rd_body, 'Anodized_Black', nd)
    add('RD_Cage', rd_cage, 'Anodized_Black', nd)
    add('RD_Bolts', rd_bolts, 'Metal_Silver', nd)
    add('RD_Pulleys', pul, 'Metal_Dark', nd)
    add('RD_PulleyHubs', pulh, 'Metal_Silver', nd)

    nb = g.node('Brakes', parent=root)
    add('Caliper_F', cal_f, 'Anodized_Black', nb)
    add('Caliper_F_Bolts', cal_fb, 'Metal_Silver', nb)
    add('Caliper_R', cal_r, 'Anodized_Black', nb)
    add('Caliper_R_Bolts', cal_rb, 'Metal_Silver', nb)
    if APP:
        fsdf = FR.frame_sdf()

        def bolt_to_frame(axle, th, target):
            er = np.array([np.cos(th * D2R), np.sin(th * D2R), 0.0]); body = axle + 0.3625 * er
            d = (target - body); d /= np.linalg.norm(d)
            for k in range(1, 200):
                if fsdf(np.array([body + d * 0.0005 * k], np.float32))[0] < -0.002:
                    return d, 0.0005 * k
            return d, 0.02
        rimF = PT.rim_caliper_sdf(AXLE_F, 107.0, -AX_FW, 0.024)
        dR, lR = bolt_to_frame(AXLE_R, -20.0, BB + np.array([0.0, -0.006, 0.0]))
        rimR = PT.rim_caliper_sdf(AXLE_R, -20.0, dR, lR)
        for tag, parts in (('F', rimF), ('R', rimR)):
            arms = cached(f'rimbrake_{tag}', lambda p=parts: p[0], 0.00045, 16000)
            pads = cached(f'rimbrake_{tag}_pads', lambda p=parts: p[1], 0.0004, 2400)
            shoes = cached(f'rimbrake_{tag}_shoes', lambda p=parts: p[2], 0.0004, 2400)
            bolt = cached(f'rimbrake_{tag}_bolt', lambda p=parts: p[3], 0.0004, 1600)
            add(f'RimBrake_{tag}', arms, 'Anodized_Black', nb)
            add(f'RimBrake_{tag}_Pads', pads, 'Brake_Pad', nb)
            add(f'RimBrake_{tag}_Shoes', merge([shoes, bolt]), 'Metal_Dark', nb)

    for key, axle, hub, lock, ax, rot in (('Front', AXLE_F, hub_f, lock_f, axle_f, rot_f), ('Rear', AXLE_R, hub_r, lock_r, axle_r, rot_r)):
        w = g.node(f'Wheel_{key}', parent=root, translation=axle,
                   extras={'hub': HUB['front' if key == 'Front' else 'rear'], 'r_bead': R_BEAD, 'r_tyre': R_TIRE})
        k = key[0]
        o = np.asarray(axle)
        add(f'Hub_{k}', hub, 'Anodized_Black', w, offset=o)
        add(f'Lockring_{k}', lock, 'Anodized_Black', w, offset=o)
        add(f'Axle_{k}', ax, 'Anodized_Black', w, offset=o)
        add(f'Rotor_{k}_Band', rot[0], 'Metal_Steel', w, offset=o)
        add(f'Rotor_{k}_Spider', rot[1], 'Anodized_Black', w, offset=o)
        add(f'Rotor_{k}_Rivets', rot[2], 'Metal_Silver', w, offset=o)
        add(f'Tyre_{k}_Tread', tread, 'Tyre_Tread', w, uv=True, offset=o)
        add(f'Tyre_{k}_Wall_R', wall_r, 'Tyre_Wall', w, uv=True, offset=o)
        add(f'Tyre_{k}_Wall_L', wall_l, 'Tyre_Wall', w, uv=True, offset=o)
        if key == 'Rear':
            add('Cassette_Cogs', cogs, 'Metal_Silver', w, offset=o)
            add('Cassette_Core', core, 'Anodized_Black', w, offset=o)
            if APP:
                add('Cassette_Cogs_11', cogs11, 'Metal_Silver', w, offset=o)

    # ---- ambient occlusion (world space) then write
    def world(it):
        m = it['mesh']
        return m if it['offset'] is None else M(m.V + it['offset'], m.F, m.N)
    rims = [M(r.V + AXLE_F, r.F, r.N) for r in [rim_proxy()]] + [M(r.V + AXLE_R, r.F, r.N) for r in [rim_proxy()]]
    DISC = ('Rotor_', 'Caliper_', 'Lockring_')
    solid = [it for it in queue if not it['name'].startswith('Decal')]
    is_rim = lambda n: n.startswith('RimBrake_')
    sets = [  # (who gets AO, which meshes occlude them)
        (lambda n: not is_rim(n) and n != 'Cassette_Cogs_11', lambda n: not is_rim(n) and n != 'Cassette_Cogs_11'),
        (is_rim, lambda n: not n.startswith(DISC) and n != 'Cassette_Cogs_11'),
        (lambda n: n == 'Cassette_Cogs_11', lambda n: not is_rim(n) and n != 'Cassette_Cogs'),
    ]
    t1 = time.time()
    aos = {}
    if 'noao' not in REBUILD:
        for who, occl in sets:
            items = [(it['name'], world(it)) for it in solid if who(it['name'])]
            if items:
                aos.update(bake_ao(items, [world(it) for it in solid if occl(it['name'])] + rims))
        print(f'  AO baked for {len(aos)} meshes in {time.time() - t1:.1f}s', flush=True)
    for it in queue:
        m = it['mesh']
        mi = g.mesh(it['name'], m.V, m.F, m.N, m.UV if it['uv'] else None, mat[it['mname']], C=aos.get(it['name']))
        g.node(it['name'], mi, parent=it['parent'])

    meta = {'decals': decals, 'axle_f': AXLE_F.tolist(), 'axle_r': AXLE_R.tolist(), 'bb': BB.tolist(),
            'ht_top': HT_TOP.tolist(), 'saddle_top': SADDLE_TOP.tolist(), 'r_bead': R_BEAD, 'r_tyre': R_TIRE,
            'wheelbase': float(WHEELBASE), 'hub': HUB, 'rotor_z': {'front': F_ROTOR_Z, 'rear': R_ROTOR_Z}}
    out = os.path.join(OUT, 'bike_app.glb' if APP else 'bike.glb')
    size = g.save(out, extras=meta)
    tri = sum(a['count'] for a in g.accessors if a['type'] == 'SCALAR') // 3
    print(f'GLB {size / 1e6:.2f} MB, {tri} triangles, {time.time() - t0:.1f}s')
    json.dump(meta, open(os.path.join(OUT, 'bike_meta.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
