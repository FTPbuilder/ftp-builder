"""Tiny signed-distance-field modelling kernel (numpy) + sparse marching-cubes mesher."""
import os
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification

F = np.float32
BIG = F(10.0)


def smin(a, b, k):
    k = np.maximum(k, 1e-9)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def nrm(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


class Node:
    def bounds(self):
        raise NotImplementedError

    def __call__(self, P):
        raise NotImplementedError


def _inside(P, lo, hi, m):
    return np.all((P >= lo - m) & (P <= hi + m), axis=1)


class Union(Node):
    def __init__(self, *children, k=0.0):
        self.ch = [c for c in children if c is not None]
        self.k = k

    def bounds(self):
        b = [c.bounds() for c in self.ch]
        return np.min([x[0] for x in b], axis=0), np.max([x[1] for x in b], axis=0)

    def __call__(self, P):
        d = np.full(len(P), BIG, F)
        m = self.k + 0.004
        for c in self.ch:
            lo, hi = c.bounds()
            mask = _inside(P, lo, hi, m)
            if not mask.any():
                continue
            dc = c(P[mask]).astype(F)
            d[mask] = smin(d[mask], dc, self.k) if self.k > 0 else np.minimum(d[mask], dc)
        return d


class Subtract(Node):
    """a minus b (smooth)."""

    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k

    def bounds(self):
        return self.a.bounds()

    def __call__(self, P):
        d = self.a(P)
        lo, hi = self.b.bounds()
        mask = _inside(P, lo, hi, self.k + 0.004)
        if mask.any():
            db = self.b(P[mask])
            d[mask] = smax(d[mask], -db, self.k) if self.k > 0 else np.maximum(d[mask], -db)
        return d


class Intersect(Node):
    def __init__(self, a, b, k=0.0):
        self.a, self.b, self.k = a, b, k

    def bounds(self):
        la, ha = self.a.bounds(); lb, hb = self.b.bounds()
        return np.maximum(la, lb), np.minimum(ha, hb)

    def __call__(self, P):
        return smax(self.a(P), self.b(P), self.k) if self.k > 0 else np.maximum(self.a(P), self.b(P))


class Func(Node):
    def __init__(self, f, lo, hi):
        self.f, self.lo, self.hi = f, np.array(lo, F), np.array(hi, F)

    def bounds(self):
        return self.lo, self.hi

    def __call__(self, P):
        return self.f(P).astype(F)


class Xform(Node):
    """Child defined in local coords; world = R @ local + t."""

    def __init__(self, child, R=None, t=(0, 0, 0)):
        self.c = child
        self.R = np.eye(3) if R is None else np.asarray(R, np.float64)
        self.t = np.asarray(t, np.float64)
        lo, hi = child.bounds()
        corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
        w = corners @ self.R.T + self.t
        self._b = (w.min(0).astype(F), w.max(0).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        L = ((P - self.t) @ self.R).astype(F)
        return self.c(L)


# ------------------------------------------------------------------ primitives
class Sphere(Node):
    def __init__(self, c, r):
        self.c, self.r = np.array(c, F), F(r)

    def bounds(self):
        return self.c - self.r, self.c + self.r

    def __call__(self, P):
        return np.linalg.norm(P - self.c, axis=1) - self.r


class Ellipsoid(Node):
    def __init__(self, c, radii, R=None):
        self.c = np.array(c, np.float64); self.r = np.array(radii, np.float64)
        self.R = np.eye(3) if R is None else np.asarray(R)
        e = np.abs(self.R) @ self.r
        self._b = ((self.c - e).astype(F), (self.c + e).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        L = (P - self.c) @ self.R
        k0 = np.linalg.norm(L / self.r, axis=1)
        k1 = np.linalg.norm(L / (self.r * self.r), axis=1)
        return (k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)).astype(F)


class RoundBox(Node):
    def __init__(self, c, half, rad=0.0, R=None):
        self.c = np.array(c, np.float64); self.h = np.array(half, np.float64); self.rad = rad
        self.R = np.eye(3) if R is None else np.asarray(R)
        e = np.abs(self.R) @ self.h
        self._b = ((self.c - e).astype(F), (self.c + e).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        L = (P - self.c) @ self.R
        q = np.abs(L) - (self.h - self.rad)
        out = np.linalg.norm(np.maximum(q, 0), axis=1)
        inn = np.minimum(np.max(q, axis=1), 0)
        return (out + inn - self.rad).astype(F)


class Cylinder(Node):
    """Capped cylinder along axis through c, radius r, half length h, edge rounding e."""

    def __init__(self, c, axis, r, h, e=0.0):
        self.c = np.array(c, np.float64); self.a = nrm(axis); self.r, self.h, self.e = r, h, e
        ext = np.sqrt(np.maximum(1 - self.a ** 2, 0)) * r + np.abs(self.a) * h
        self._b = ((self.c - ext).astype(F), (self.c + ext).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        w = P - self.c
        ax = w @ self.a
        rad = np.linalg.norm(w - ax[:, None] * self.a, axis=1)
        dx = rad - (self.r - self.e); dy = np.abs(ax) - (self.h - self.e)
        out = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2)
        return (out + np.minimum(np.maximum(dx, dy), 0) - self.e).astype(F)


class Torus(Node):
    """Torus around axis z' through c: major R, minor r; optional lateral stretch for a tyre envelope."""

    def __init__(self, c, axis, R, r):
        self.c = np.array(c, np.float64); self.a = nrm(axis); self.R, self.r = R, r
        e = R + r
        self._b = ((self.c - e).astype(F), (self.c + e).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        w = P - self.c
        ax = w @ self.a
        rad = np.linalg.norm(w - ax[:, None] * self.a, axis=1)
        return (np.sqrt((rad - self.R) ** 2 + ax ** 2) - self.r).astype(F)


# ------------------------------------------------------------------ swept tube
def bezier(P, n):
    P = np.asarray(P, np.float64)
    t = np.linspace(0, 1, n)[:, None]
    if len(P) == 4:
        return (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]
    if len(P) == 3:
        return (1 - t) ** 2 * P[0] + 2 * (1 - t) * t * P[1] + t ** 2 * P[2]
    if len(P) == 2:
        return (1 - t) * P[0] + t * P[1]
    raise ValueError


def catmull(P, n):
    """Centripetal-ish Catmull-Rom through points, resampled uniformly by arc length."""
    P = np.asarray(P, np.float64)
    ext = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    out = np.array(out)
    seg = np.linalg.norm(np.diff(out, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    su = np.linspace(0, s[-1], n)
    return np.stack([np.interp(su, s, out[:, k]) for k in range(3)], 1)


# bouts de tube exacts (distance intérieure mesurée jusqu'au plan du bout) : gabarit CLM ; le gabarit aéro garde l'ancien calcul pour rester reproductible
EXACT_CAPS = os.environ.get('FTPB_MODEL') == 'clm'
# nb : exposant de la moitié arrière du profil (flancs d'aile plus droits vers la troncature) ; 0 = même exposant que l'avant (n)
PROFILE_KEYS = ('af', 'ab', 'b', 'n', 'cut', 're', 'ou', 'ov', 'nb')
DEFAULTS = dict(af=0.01, ab=0.01, b=0.01, n=2.0, cut=1.0, re=0.0015, ou=0.0, ov=0.0, nb=0.0)


def profile_sdf(u, v, p):
    a = np.where(u >= 0, p['af'], p['ab'])
    b = p['b']; n = p['n']
    nb = p.get('nb')
    if nb is not None and np.any(nb > 0):
        n = np.where((u < 0) & (nb > 0), nb, n)
    x = np.abs(u) / a + 1e-12
    y = np.abs(v) / b + 1e-12
    xn = x ** n; yn = y ** n
    r = (xn + yn) ** (1.0 / n)
    f = r - 1.0
    rr = r ** (1.0 - n)
    gu = rr * xn / x / a
    gv = rr * yn / y / b
    g = np.sqrt(gu * gu + gv * gv) + 1e-9
    d = f / g
    # Kamm-tail truncation, combined with a C1 exterior (no crease in the field outside the corner)
    re = p['re']
    a = d + re
    b = -u - p['cut'] + re
    return np.sqrt(np.maximum(a, 0) ** 2 + np.maximum(b, 0) ** 2) + np.minimum(np.maximum(a, b), 0) - re


class Tube(Node):
    """Profile swept along a centre-line.

    pts: control points (bezier if kind='bezier' with 2-4 pts, else catmull through pts)
    ref: reference 'chord' direction (3-vector) projected in each cross-section plane, or callable(t)->vec
    keys: list of (t, dict) profile keyframes along normalised arc length
    """

    def __init__(self, pts, ref, keys, kind='bezier', nseg=40, caps=True, caprad=0.0):
        if kind == 'bezier':
            C = bezier(pts, nseg + 1)
        elif kind == 'poly':
            C = np.asarray(pts, np.float64)
        else:
            C = catmull(pts, nseg + 1)
        self.C = C
        T = np.gradient(C, axis=0); T = nrm(T)
        self.T = T
        s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
        tn = s / s[-1]
        refs = np.array([ref(t) if callable(ref) else ref for t in tn], np.float64)
        U = refs - (np.sum(refs * T, 1))[:, None] * T
        U = nrm(U)
        V = np.cross(T, U)
        self.U, self.V = U, V
        self.par = {}
        keys = sorted(keys, key=lambda kv: kv[0])
        fills = {}
        for k in PROFILE_KEYS:
            ts = [kt for kt, kd in keys]
            vs = [kd.get(k, None) for kt, kd in keys]
            # fill missing with previous / default
            last = DEFAULTS[k]
            filled = []
            for v_ in vs:
                if v_ is None:
                    v_ = last
                filled.append(v_); last = v_
            if k == 'nb':   # exposant arrière absent ou nul → celui de l'avant de la même clé (jamais d'exposant intermédiaire invalide)
                filled = [kd['nb'] if kd.get('nb', 0) > 0 else fills['n'][j] for j, (kt, kd) in enumerate(keys)]
            fills[k] = filled
            if len(ts) >= 3 and len(set(ts)) == len(ts):
                from scipy.interpolate import PchipInterpolator
                self.par[k] = PchipInterpolator(ts, filled, extrapolate=True)(np.clip(tn, ts[0], ts[-1]))
            else:
                self.par[k] = np.interp(tn, ts, filled)
        self.caps = caps
        self.caprad = caprad
        ext = np.max(np.maximum(np.maximum(self.par['af'], self.par['ab']), self.par['b'])) + np.max(np.abs(self.par['ou'])) + np.max(np.abs(self.par['ov'])) + 0.003
        self._b = ((C.min(0) - ext).astype(F), (C.max(0) + ext).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        P = P.astype(np.float64)
        C = self.C
        M = len(C)
        best = np.full(len(P), np.inf)
        idx = np.zeros(len(P), np.int32)
        tt = np.zeros(len(P))
        for i in range(M - 1):
            A = C[i]; AB = C[i + 1] - A
            L2 = AB @ AB
            t = np.clip(((P - A) @ AB) / L2, 0.0, 1.0)
            Q = A + t[:, None] * AB
            d2 = np.einsum('ij,ij->i', P - Q, P - Q)
            m = d2 < best
            best[m] = d2[m]; idx[m] = i; tt[m] = t[m]
        i = idx; t = tt[:, None]
        c = C[i] + t * (C[i + 1] - C[i])
        U = nrm((1 - t) * self.U[i] + t * self.U[i + 1])
        T = nrm((1 - t) * self.T[i] + t * self.T[i + 1])
        V = np.cross(T, U)
        w = P - c
        p = {k: (1 - tt) * self.par[k][i] + tt * self.par[k][i + 1] for k in PROFILE_KEYS}
        u = np.einsum('ij,ij->i', w, U) - p['ou']
        v = np.einsum('ij,ij->i', w, V) - p['ov']
        d2 = profile_sdf(u, v, p)
        if self.caps:
            ax = np.full(len(P), -1.0)
            if EXACT_CAPS:   # distance signée au plan de chaque bout, aussi à l'intérieur (sinon le champ saute au ras du bout)
                s0 = i == 0
                ax[s0] = -((P[s0] - C[0]) @ self.T[0])
                s1 = i == M - 2
                ax[s1] = np.maximum(ax[s1], (P[s1] - C[-1]) @ self.T[-1])
            else:
                s0 = (i == 0) & (tt <= 0.0)
                ax[s0] = -(w[s0] @ self.T[0])
                s1 = (i == M - 2) & (tt >= 1.0)
                ax[s1] = w[s1] @ self.T[-1]
            cr = self.caprad
            d2r = d2 + cr; axr = ax + cr
            out = np.sqrt(np.maximum(d2r, 0) ** 2 + np.maximum(axr, 0) ** 2)
            d = out + np.minimum(np.maximum(d2r, axr), 0) - cr
        else:
            d = d2
        return d.astype(F)


# ------------------------------------------------------------------ mesher
def grad(sdf, P, eps=1.5e-4):
    P = P.astype(F)
    g = np.zeros_like(P)
    for k in range(3):
        e = np.zeros(3, F); e[k] = eps
        g[:, k] = (sdf(P + e) - sdf(P - e)) / (2 * eps)
    return g


def mesh_sdf(sdf, h=0.0012, lo=None, hi=None, block=8, target_faces=None, verbose=True, project_iters=3):
    import time
    t0 = time.time()
    if lo is None:
        lo, hi = sdf.bounds()
    lo = np.asarray(lo, np.float64) - 3 * h
    hi = np.asarray(hi, np.float64) + 3 * h
    nb = np.ceil((hi - lo) / (h * block)).astype(int)
    dims = nb * block + 1
    # coarse sample at block centres
    gi = [lo[k] + (np.arange(nb[k]) + 0.5) * block * h for k in range(3)]
    G = np.stack(np.meshgrid(*gi, indexing='ij'), -1).reshape(-1, 3).astype(F)
    dc = np.empty(len(G), F)
    for s in range(0, len(G), 400000):
        dc[s:s + 400000] = sdf(G[s:s + 400000])
    dc = dc.reshape(nb)
    halfdiag = 0.5 * block * h * np.sqrt(3)
    active = np.abs(dc) < (halfdiag * 2.0 + 4 * h)
    # fill dense volume with coarse sign
    vol = np.repeat(np.repeat(np.repeat(np.sign(dc).astype(F) * F(halfdiag), block, 0), block, 1), block, 2)
    vol = np.pad(vol, ((0, 1), (0, 1), (0, 1)), mode='edge')
    ab = np.argwhere(active)
    if verbose:
        print(f'  grid {dims.tolist()} active blocks {len(ab)}/{active.size}', flush=True)
    o = np.stack(np.meshgrid(np.arange(block + 1), np.arange(block + 1), np.arange(block + 1), indexing='ij'), -1).reshape(-1, 3)
    per = len(o)
    batch = max(1, 1500000 // per)
    for s in range(0, len(ab), batch):
        B = ab[s:s + batch]
        I = (B[:, None, :] * block + o[None, :, :]).reshape(-1, 3)
        P = (lo + I * h).astype(F)
        d = sdf(P)
        vol[I[:, 0], I[:, 1], I[:, 2]] = d
    t1 = time.time()
    verts, faces, normals, _ = marching_cubes(vol, level=0.0, spacing=(h, h, h))
    verts = verts + lo
    del vol
    # orientation: make face normals agree with sdf gradient
    fn = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    cen = verts[faces].mean(1)
    sub = np.random.default_rng(0).choice(len(faces), min(2000, len(faces)), replace=False)
    gg = grad(sdf, cen[sub])
    if np.mean(np.sum(fn[sub] * gg, 1) > 0) < 0.5:
        faces = faces[:, ::-1]
    nf0 = len(faces)
    if target_faces and len(faces) > target_faces:
        verts, faces = fast_simplification.simplify(verts.astype(np.float32), faces.astype(np.int32), 1.0 - target_faces / len(faces))
    verts = verts.astype(F)
    v0 = verts.copy()
    for _ in range(project_iters):
        d = sdf(verts)
        g = grad(sdf, verts)
        gl2 = np.maximum(np.sum(g * g, 1), 1e-6)
        step = np.clip(d / gl2, -0.6 * h, 0.6 * h)
        verts = verts - step[:, None] * g
    # undo the projection wherever it folded a triangle (keeps the surface watertight, no see-through specks)
    faces_i = faces.astype(np.int64)
    for _ in range(4):
        fn = np.cross(verts[faces_i[:, 1]] - verts[faces_i[:, 0]], verts[faces_i[:, 2]] - verts[faces_i[:, 0]])
        gc = grad(sdf, verts[faces_i].mean(1).astype(F))
        dot = np.sum(fn * gc, 1) / (np.linalg.norm(fn, axis=1) * np.linalg.norm(gc, axis=1) + 1e-12)
        bad = dot < 0.25
        if not bad.any():
            break
        bv = np.unique(faces_i[bad])
        verts[bv] = v0[bv]
    g = grad(sdf, verts, eps=3e-4)
    normals = g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
    # geometric (area-weighted) vertex normals as a safety net where the field gradient is unreliable
    fi = faces.astype(np.int64)
    fn = np.cross(verts[fi[:, 1]] - verts[fi[:, 0]], verts[fi[:, 2]] - verts[fi[:, 0]]).astype(np.float64)
    vn = np.zeros((len(verts), 3))
    for k in range(3):
        np.add.at(vn, fi[:, k], fn)
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
    cosang = np.sum(normals * vn, 1)
    badn = (cosang < 0.85) | ~np.isfinite(cosang)
    normals[badn] = vn[badn]
    if verbose:
        print(f'  normals replaced: {int(badn.sum())}', flush=True)
    if verbose:
        print(f'  eval {t1 - t0:.1f}s, mc+simplify {time.time() - t1:.1f}s, faces {nf0} -> {len(faces)}', flush=True)
    return verts.astype(F), faces.astype(np.int32), normals.astype(F)
