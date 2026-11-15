"""Procedural mechanical meshes: tyres, hubs, axles, rotors, chainrings, cassette, chain, pulleys."""
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
from shapely.ops import unary_union
from geom import *


class M:
    """simple mesh container: V (n,3), F (m,3), N (n,3), UV (n,2) or None"""

    def __init__(self, V, F, N=None, UV=None):
        self.V = np.asarray(V, np.float64); self.F = np.asarray(F, np.int64)
        self.N = None if N is None else np.asarray(N, np.float64)
        self.UV = None if UV is None else np.asarray(UV, np.float64)
        if self.N is None:
            self.N = vertex_normals(self.V, self.F)

    def transformed(self, R=np.eye(3), t=(0, 0, 0)):
        return M(self.V @ np.asarray(R).T + t, self.F, self.N @ np.asarray(R).T, self.UV)


def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def merge(ms):
    ms = [m for m in ms if m is not None]
    V, F, N, UV = [], [], [], []
    off = 0
    has_uv = all(m.UV is not None for m in ms)
    for m in ms:
        V.append(m.V); F.append(m.F + off); N.append(m.N); off += len(m.V)
        if has_uv:
            UV.append(m.UV)
    return M(np.vstack(V), np.vstack(F), np.vstack(N), np.vstack(UV) if has_uv else None)


def from_trimesh(tm, angle=35):
    sm = trimesh.graph.smooth_shade(tm, angle=np.radians(angle))
    return M(sm.vertices, sm.faces, sm.vertex_normals)


def lathe(prof, seg=128, a0=0.0, a1=2 * np.pi, smooth=True, uv_v=None, uv_u_scale=1.0, flip_u=False):
    """prof: (k,2) array of (r, z). Revolves around z axis in the xy plane. Returns M with UVs.
    Sharp corners: repeat a point in prof to split normals."""
    prof = np.asarray(prof, np.float64)
    k = len(prof)
    th = np.linspace(a0, a1, seg + 1)
    # profile tangents -> normals (r,z) ; handle duplicated points as hard edges
    T = np.zeros_like(prof)
    for i in range(k):
        if i > 0 and np.allclose(prof[i], prof[i - 1]):
            T[i] = prof[min(i + 1, k - 1)] - prof[i]
        elif i < k - 1 and np.allclose(prof[i], prof[i + 1]):
            T[i] = prof[i] - prof[max(i - 1, 0)]
        else:
            T[i] = prof[min(i + 1, k - 1)] - prof[max(i - 1, 0)]
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    n2 = np.stack([T[:, 1], -T[:, 0]], 1)   # outward if profile goes with z increasing on outside... caller orders
    c, s = np.cos(th), np.sin(th)
    V = np.zeros((seg + 1, k, 3)); N = np.zeros((seg + 1, k, 3))
    V[:, :, 0] = c[:, None] * prof[None, :, 0]; V[:, :, 1] = s[:, None] * prof[None, :, 0]; V[:, :, 2] = prof[None, :, 1]
    N[:, :, 0] = c[:, None] * n2[None, :, 0]; N[:, :, 1] = s[:, None] * n2[None, :, 0]; N[:, :, 2] = n2[None, :, 1]
    if uv_v is None:
        L = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))])
        uv_v = L / max(L[-1], 1e-9)
    u = (th - a0) / (a1 - a0) * uv_u_scale
    if flip_u:
        u = uv_u_scale - u
    UV = np.zeros((seg + 1, k, 2)); UV[:, :, 0] = u[:, None]; UV[:, :, 1] = np.asarray(uv_v)[None, :]
    F = []
    for j in range(seg):
        for i in range(k - 1):
            a = j * k + i; b = (j + 1) * k + i
            if np.allclose(prof[i], prof[i + 1]):
                continue
            F.append([a, b, b + 1]); F.append([a, b + 1, a + 1])
    return M(V.reshape(-1, 3), np.array(F), N.reshape(-1, 3), UV.reshape(-1, 2))


def fix_orientation(m, center=None):
    """make lathe faces wind consistently with their normals"""
    fn = np.cross(m.V[m.F[:, 1]] - m.V[m.F[:, 0]], m.V[m.F[:, 2]] - m.V[m.F[:, 0]])
    vn = m.N[m.F].mean(1)
    flip = np.sum(fn * vn, 1) < 0
    F = m.F.copy(); F[flip] = F[flip][:, ::-1]
    return M(m.V, F, m.N, m.UV)


def extrude(poly, z0, z1, angle=30):
    geoms = list(poly.geoms) if hasattr(poly, 'geoms') else [poly]
    ms = []
    for g in geoms:
        if g.area < 1e-10:
            continue
        tm = trimesh.creation.extrude_polygon(g, z1 - z0)
        tm.apply_translation([0, 0, z0])
        ms.append(from_trimesh(tm, angle))
    return merge(ms)


# ---------------------------------------------------------------- tooth outlines
def sprocket_poly(N, tip=0.0034, rs=0.0040, spt=16, p=CHAIN_P, tipflat_frac=0.10):
    Rp = pitch_r(N, p)
    alpha = 2 * np.pi / N
    psi_e = 0.93 * np.arcsin(min(rs / Rp, 0.99))
    Rt = Rp + tip
    half = alpha / 2
    pts = []
    for i in range(N):
        base = i * alpha
        for j in range(spt):
            psi = -half + (j + 0.5) / spt * alpha
            ap = abs(psi)
            if ap <= psi_e:
                r = Rp * np.cos(psi) - np.sqrt(max(rs * rs - (Rp * np.sin(psi)) ** 2, 0))
            else:
                re_ = Rp * np.cos(psi_e) - np.sqrt(max(rs * rs - (Rp * np.sin(psi_e)) ** 2, 0))
                span = max(half * (1 - tipflat_frac) - psi_e, 1e-6)
                tt = np.clip((ap - psi_e) / span, 0, 1)
                r = re_ + (Rt - re_) * np.sin(tt * np.pi / 2) ** 0.9
            a = base + psi
            pts.append((r * np.cos(a), r * np.sin(a)))
    return Polygon(pts)


def annulus(r0, r1, n=96):
    return Point(0, 0).buffer(r1, resolution=n // 4).difference(Point(0, 0).buffer(r0, resolution=n // 4))


# ---------------------------------------------------------------- tyres (local to axle)
def tyre_profile(nside=26, ncrown=22):
    rc = R_TIRE - TIRE_HALF_W
    # crown arc from -37deg..+37deg around the section centre (angle from +r axis toward z)
    crown = []
    for t in np.linspace(-1, 1, ncrown):
        ang = t * 37 * D2R
        crown.append((rc + TIRE_HALF_W * np.cos(ang), TIRE_HALF_W * np.sin(ang)))
    side = []  # from crown edge (37deg) down to bead, right side (+z)
    for t in np.linspace(0, 1, nside):
        ang = (37 + t * 53) * D2R  # 37 -> 90 deg on the circle (equator)
        side.append((rc + TIRE_HALF_W * np.cos(ang), TIRE_HALF_W * np.sin(ang)))
    lower = []
    for t in np.linspace(0, 1, 10)[1:]:
        r = rc - t * (rc - (R_BEAD + 0.0005))
        z = 0.0116 + (TIRE_HALF_W - 0.0116) * np.sin((1 - t) * np.pi / 2) ** 0.7
        lower.append((r, z))
    lower.append((R_BEAD - 0.0015, 0.0112))
    return np.array(crown), np.array(side + lower)


def tyre_meshes(seg=192):
    crown, side = tyre_profile()
    tread = lathe(crown[:, [0, 1]], seg, uv_u_scale=24)
    # side walls: profile for +z side ordered crown->bead; for -z mirror
    sp = side.copy()
    v = np.linspace(1, 0, len(sp))  # 1 at crown edge, 0 at bead
    wall_r = lathe(sp, seg, uv_v=v, flip_u=True)
    sm = sp.copy(); sm[:, 1] *= -1
    wall_l = lathe(sm[::-1], seg, uv_v=v[::-1], flip_u=False)
    return fix_orientation(tread), fix_orientation(wall_r), fix_orientation(wall_l)


# ---------------------------------------------------------------- hubs (local to axle)
def hub_profile(front=True):
    if front:
        P = [(0.0060, -0.0500), (0.0090, -0.0500), (0.0090, -0.0500), (0.0094, -0.0470), (0.0100, -0.0462), (0.0100, -0.0462),
             (0.0120, -0.0455), (0.0128, -0.0400), (0.0145, -0.0350), (0.0205, -0.0335), (0.0215, -0.0322), (0.0215, -0.0288),
             (0.0200, -0.0280), (0.0140, -0.0270), (0.0122, -0.0200), (0.0116, 0.0), (0.0122, 0.0200), (0.0140, 0.0270), (0.0200, 0.0280),
             (0.0215, 0.0288), (0.0215, 0.0322), (0.0205, 0.0335), (0.0145, 0.0350), (0.0128, 0.0420), (0.0105, 0.0462), (0.0105, 0.0462),
             (0.0094, 0.0470), (0.0090, 0.0500), (0.0090, 0.0500), (0.0060, 0.0500)]
    else:
        P = [(0.0060, -0.0710), (0.0090, -0.0710), (0.0090, -0.0710), (0.0095, -0.0680), (0.0100, -0.0672), (0.0100, -0.0672),
             (0.0120, -0.0662), (0.0128, -0.0560), (0.0145, -0.0390), (0.0205, -0.0375), (0.0215, -0.0362), (0.0215, -0.0328),
             (0.0200, -0.0320), (0.0140, -0.0308), (0.0124, -0.0200), (0.0120, 0.0), (0.0128, 0.0120), (0.0150, 0.0155), (0.0205, 0.0163),
             (0.0215, 0.0172), (0.0215, 0.0204), (0.0190, 0.0212), (0.0172, 0.0216), (0.0172, 0.0665), (0.0105, 0.0672), (0.0105, 0.0672),
             (0.0094, 0.0682), (0.0090, 0.0710), (0.0090, 0.0710), (0.0060, 0.0710)]
    P = np.array(P)[:, ::-1][:, ::-1]
    return P


def hub_mesh(front=True):
    P = hub_profile(front)
    return fix_orientation(lathe(P, 96))


def centerlock(z, rin=0.0130, rout=0.0182, th=0.0042):
    # lockring with notches
    poly = annulus(rin, rout, 96)
    for k in range(12):
        a = k * 2 * np.pi / 12
        poly = poly.difference(Point((rout) * np.cos(a), (rout) * np.sin(a)).buffer(0.0016, 8))
    return extrude(poly, z - th / 2, z + th / 2)


def axle_ends(front=True):
    zl = -(F_DROP_Z + 0.0036) if front else -(R_DROP_Z + 0.0035)
    zr = (F_DROP_Z + 0.0036) if front else (R_DROP_Z + 0.0035 + 0.0045)
    # left head with hex socket
    head = Point(0, 0).buffer(0.0102, 16).difference(Polygon([(0.0030 * np.cos(a), 0.0030 * np.sin(a)) for a in np.arange(6) * np.pi / 3]))
    h1 = extrude(head, zl - 0.0075, zl)
    cap = Point(0, 0).buffer(0.0080, 16)
    h2 = extrude(cap, zr, zr + 0.0030)
    return merge([h1, h2])


# ---------------------------------------------------------------- rotors (local to axle)
def rotor_meshes(R_out, z):
    band_in = R_out - 0.0160
    band = annulus(band_in, R_out, 192)
    holes = []
    nh = 18 if R_out > 0.075 else 16
    for k in range(nh):
        a = k * 2 * np.pi / nh
        for rr, da in ((band_in + 0.0048, 0.0), (band_in + 0.0108, np.pi / nh)):
            holes.append(Point(rr * np.cos(a + da), rr * np.sin(a + da)).buffer(0.0021, 8))
    # outer scallops
    for k in range(nh):
        a = (k + 0.5) * 2 * np.pi / nh
        holes.append(Point((R_out + 0.0042) * np.cos(a), (R_out + 0.0042) * np.sin(a)).buffer(0.0048, 12))
    band = band.difference(unary_union(holes))
    spider_parts = [annulus(0.0185, 0.0270, 96)]
    rivets = []
    for k in range(6):
        a = k * 2 * np.pi / 6
        pts = []
        for t in np.linspace(0, 1, 12):
            r = 0.024 + t * (band_in + 0.003 - 0.024)
            aa = a + 0.42 * t
            pts.append((r * np.cos(aa), r * np.sin(aa)))
        spider_parts.append(LineString(pts).buffer(0.0042, 8))
        ae = a + 0.42
        rp = (band_in + 0.0015)
        spider_parts.append(Point(rp * np.cos(ae), rp * np.sin(ae)).buffer(0.0050, 12))
        rivets.append(Point(rp * np.cos(ae), rp * np.sin(ae)).buffer(0.0022, 8))
    spider = unary_union(spider_parts).difference(Point(0, 0).buffer(0.0175, 24))
    mb = extrude(band, z - 0.0009, z + 0.0009, angle=40)
    ms = extrude(spider, z + 0.0002, z + 0.0028, angle=40)
    mr = extrude(unary_union(rivets), z - 0.0012, z + 0.0034, angle=40)
    return mb, ms, mr


# ---------------------------------------------------------------- drivetrain (world coords)
def chainrings(drive_angle):
    out = []
    bolt_angles = [drive_angle + (45 + 90 * k) * D2R for k in range(4)]
    big = sprocket_poly(BIG_T, spt=14)
    Rp = pitch_r(BIG_T)
    inner = Point(0, 0).buffer(Rp - 0.0175, 64)
    tabs = []
    for a in bolt_angles:
        c = (0.055 * np.cos(a), 0.055 * np.sin(a))
        tabs.append(Point(c).buffer(0.0085, 16))
        tabs.append(LineString([c, ((Rp - 0.012) * np.cos(a), (Rp - 0.012) * np.sin(a))]).buffer(0.0080, 8))
    big_ring = big.difference(inner).union(unary_union(tabs).difference(Point(0, 0).buffer(0.040, 32)))
    holes = unary_union([Point(0.055 * np.cos(a), 0.055 * np.sin(a)).buffer(0.0034, 12) for a in bolt_angles])
    big_ring = big_ring.difference(holes)
    small = sprocket_poly(SMALL_T, spt=14)
    Rs = pitch_r(SMALL_T)
    small_ring = small.difference(Point(0, 0).buffer(Rs - 0.0125, 64))
    stabs = [Point(0.055 * np.cos(a), 0.055 * np.sin(a)).buffer(0.0080, 16) for a in bolt_angles]
    small_ring = small_ring.union(unary_union(stabs)).difference(holes).difference(Point(0, 0).buffer(0.046, 48))
    mb = extrude(big_ring, BIG_Z - 0.0020, BIG_Z + 0.0020, angle=40)
    msm = extrude(small_ring, SMALL_Z - 0.0012, SMALL_Z + 0.0012, angle=40)
    T = np.array([BB[0], BB[1], 0.0])
    return M(mb.V + T, mb.F, mb.N), M(msm.V + T, msm.F, msm.N)


def cassette(cog_list=None, pitch=None):
    cog_list = COGS if cog_list is None else cog_list
    pitch = COG_PITCH if pitch is None else pitch
    cogs = []
    dark = []
    for i, n in enumerate(cog_list):
        Rp = pitch_r(n)
        poly = sprocket_poly(n, tip=0.0030, rs=0.0040, spt=12)
        if n <= 16:
            poly = poly.difference(Point(0, 0).buffer(0.0178, 48))
        else:
            poly = poly.difference(Point(0, 0).buffer(0.0178, 48))
            wins = []
            nw = 5 if n < 24 else 6
            for k in range(nw):
                a = k * 2 * np.pi / nw + i * 0.3
                pts = []
                r0, r1 = 0.0235, Rp - 0.0085
                if r1 - r0 < 0.004:
                    continue
                w0, w1 = 0.30, 0.48
                arc = []
                for t in np.linspace(-1, 1, 8):
                    arc.append((r1 * np.cos(a + t * w1 * np.pi / nw), r1 * np.sin(a + t * w1 * np.pi / nw)))
                for t in np.linspace(1, -1, 8):
                    arc.append((r0 * np.cos(a + t * w0 * np.pi / nw), r0 * np.sin(a + t * w0 * np.pi / nw)))
                wins.append(Polygon(arc).buffer(0.0015, 4))
            if wins:
                poly = poly.difference(unary_union(wins))
        z = COG_Z0 - i * pitch
        m = extrude(poly, z - 0.0008, z + 0.0008, angle=40)
        cogs.append(m)
    # core (freehub/spacers) and lockring
    zl = COG_Z0 - (len(cog_list) - 1) * pitch
    core = lathe(np.array([[0.0170, zl - 0.003], [0.0200, zl - 0.003], [0.0200, zl - 0.003],
                           [0.0200, COG_Z0 + 0.001], [0.0200, COG_Z0 + 0.001], [0.0170, COG_Z0 + 0.001]]), 64)
    lock = annulus(0.0108, 0.0162, 64)
    for k in range(12):
        a = k * 2 * np.pi / 12
        lock = lock.difference(Point(0.0108 * np.cos(a), 0.0108 * np.sin(a)).buffer(0.0012, 6))
    lk = extrude(lock, COG_Z0 + 0.0009, COG_Z0 + 0.0034)
    return merge(cogs), merge([fix_orientation(core), lk])


def tangent(cA, rA, sA, cB, rB, sB):
    D = cB - cA; d = np.linalg.norm(D)
    k = sB * rB - sA * rA
    L = np.sqrt(d * d - k * k)
    th = np.arctan2(D[1], D[0]) - np.arctan2(k, L)
    t = np.array([np.cos(th), np.sin(th)])
    perp = np.array([-t[1], t[0]])
    return cA - sA * rA * perp, cB - sB * rB * perp


def chain_path():
    """returns callable s->(x,y,z), total length. Order: ring(CW) -> lower jockey(CW) -> upper jockey(CCW) -> cog(CW) -> ring"""
    zc = cog_z(COG_SEL)
    circ = [(BB[:2], pitch_r(BIG_T), -1, BIG_Z), (JOCKEY_L[:2], pitch_r(JOCKEY_T), -1, zc),
            (JOCKEY_U[:2], pitch_r(JOCKEY_T), +1, zc), (AXLE_R[:2], pitch_r(COGS[COG_SEL]), -1, zc)]
    n = len(circ)
    tans = []
    for i in range(n):
        a = circ[i]; b = circ[(i + 1) % n]
        tans.append(tangent(a[0], a[1], a[2], b[0], b[1], b[2]))
    segs = []  # ('arc', c, r, s, ang0, ang1, z) or ('line', p0, p1, z0, z1)
    for i in range(n):
        c, r, s, z = circ[i]
        arrive = tans[i - 1][1]; leave = tans[i][0]
        a0 = np.arctan2(*(arrive - c)[::-1]); a1 = np.arctan2(*(leave - c)[::-1])
        if s > 0:
            while a1 <= a0:
                a1 += 2 * np.pi
        else:
            while a1 >= a0:
                a1 -= 2 * np.pi
        segs.append(('arc', c, r, s, a0, a1, z))
        nb = circ[(i + 1) % n]
        segs.append(('line', tans[i][0], tans[i][1], z, nb[3]))
    lens = []
    for sg in segs:
        if sg[0] == 'arc':
            lens.append(abs(sg[5] - sg[4]) * sg[2])
        else:
            lens.append(np.linalg.norm(sg[2] - sg[1]))
    cum = np.concatenate([[0], np.cumsum(lens)])
    total = cum[-1]

    def at(s):
        s = s % total
        i = np.searchsorted(cum, s, side='right') - 1
        sg = segs[i]; u = (s - cum[i]) / max(lens[i], 1e-12)
        if sg[0] == 'arc':
            a = sg[4] + u * (sg[5] - sg[4])
            return np.array([sg[1][0] + sg[2] * np.cos(a), sg[1][1] + sg[2] * np.sin(a), sg[6]])
        p = sg[1] + u * (sg[2] - sg[1])
        return np.array([p[0], p[1], sg[3] + u * (sg[4] - sg[3])])
    return at, total


def chain_meshes():
    at, total = chain_path()
    nl = int(round(total / CHAIN_P))
    if nl % 2:
        nl += 1
    p = total / nl
    pins = np.array([at(i * p) for i in range(nl)])
    # base plate: stadium between (0,0) and (pitch,0)
    def plate(r_end, waist):
        pts = []
        for a in np.linspace(np.pi / 2, 3 * np.pi / 2, 10):
            pts.append((r_end * np.cos(a), r_end * np.sin(a)))
        for t in np.linspace(0.15, 0.85, 5):
            pts.append((t * CHAIN_P, -(waist + (r_end - waist) * (2 * abs(t - 0.5)) ** 2)))
        for a in np.linspace(-np.pi / 2, np.pi / 2, 10):
            pts.append((CHAIN_P + r_end * np.cos(a), r_end * np.sin(a)))
        for t in np.linspace(0.85, 0.15, 5):
            pts.append((t * CHAIN_P, (waist + (r_end - waist) * (2 * abs(t - 0.5)) ** 2)))
        return Polygon(pts)
    outer = plate(0.0043, 0.0037); inner = plate(0.0041, 0.0035)
    th = 0.0008
    mo = extrude(outer, -th / 2, th / 2, angle=50); mi = extrude(inner, -th / 2, th / 2, angle=50)
    roller = fix_orientation(lathe(np.array([[0.0037, -0.0012], [0.0037, 0.0012]]), 12))
    pin = fix_orientation(lathe(np.array([[0.0, -0.0028], [0.0019, -0.0028], [0.0019, -0.0028], [0.0019, 0.0028], [0.0019, 0.0028], [0.0, 0.0028]]), 10))
    O, I, Rl = [], [], []
    for i in range(nl):
        a = pins[i]; b = pins[(i + 1) % nl]
        d = b - a
        ang = np.arctan2(d[1], d[0])
        R = np.array([[np.cos(ang), -np.sin(ang), 0], [np.sin(ang), np.cos(ang), 0], [0, 0, 1]])
        zc = (a[2] + b[2]) / 2
        if i % 2 == 0:
            for dz in (-0.00215, 0.00215):
                O.append(mo.transformed(R, [a[0], a[1], zc + dz]))
            Rl.append(pin.transformed(np.eye(3), [a[0], a[1], a[2]]))
        else:
            for dz in (-0.00140, 0.00140):
                I.append(mi.transformed(R, [a[0], a[1], zc + dz]))
        Rl.append(roller.transformed(np.eye(3), [a[0], a[1], a[2]]))
    return merge(O), merge(I), merge(Rl), nl


def pulleys():
    zc = cog_z(COG_SEL)
    poly = sprocket_poly(JOCKEY_T, tip=0.0028, rs=0.0040, spt=12).difference(Point(0, 0).buffer(0.0085, 24))
    out = []
    hubs = []
    for c in (JOCKEY_U, JOCKEY_L):
        m = extrude(poly, zc - 0.0018, zc + 0.0018, angle=40)
        out.append(M(m.V + [c[0], c[1], 0], m.F, m.N))
        hb = fix_orientation(lathe(np.array([[0.0040, zc - 0.0038], [0.0088, zc - 0.0038], [0.0088, zc - 0.0038], [0.0088, zc + 0.0038], [0.0088, zc + 0.0038], [0.0040, zc + 0.0038]]), 32))
        hubs.append(M(hb.V + [c[0], c[1], 0], hb.F, hb.N))
    return merge(out), merge(hubs)


def valve():
    pass
