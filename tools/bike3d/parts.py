"""SDF parts: cockpit, seatpost, saddle, calipers, cranks, derailleurs."""
import numpy as np
from sdf import *
from geom import *

X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])


def V3(x, y, z=0.0):
    return np.array([x, y, z], np.float64)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


HEAD_TOP_PROF = dict(af=.0215, ab=.058, cut=.0345, b=.0205, n=2.35, re=.0022)

# ---------------------------------------------------------------- cockpit
C_S = HT_TOP + 0.036 * AX_UP
STEM_DIR = V3(np.cos(3 * D2R), np.sin(3 * D2R))
B_C = C_S + 0.100 * STEM_DIR

# bend / drop centre-line (right side, relative to B_C)
BEND = [V3(0.008, 0.000, 0.150), V3(0.011, 0.000, 0.168), V3(0.030, -0.0005, 0.179), V3(0.055, -0.007, 0.185), V3(0.071, -0.028, 0.189),
        V3(0.074, -0.064, 0.193), V3(0.058, -0.099, 0.198), V3(0.029, -0.120, 0.202), V3(-0.010, -0.127, 0.205),
        V3(-0.058, -0.127, 0.207)]
HOOD_Z = 0.186


def bend_points(sgn):
    return [B_C + V3(p[0], p[1], sgn * p[2]) for p in BEND]


def cockpit_sdf():
    spacer = Tube([HT_TOP + 0.0009 * AX_UP, HT_TOP + 0.0158 * AX_UP], X,
                  [(0, HEAD_TOP_PROF), (1, HEAD_TOP_PROF)], nseg=4, caprad=0.0012)
    clamp = Tube([HT_TOP + 0.0167 * AX_UP, HT_TOP + 0.0575 * AX_UP], X,
                 [(0, dict(af=.0215, ab=.056, cut=.0335, b=.0205, n=2.4)),
                  (1, dict(af=.0205, ab=.050, cut=.0300, b=.0195, n=2.4))], nseg=6, caprad=0.0045)
    body = Tube([C_S - 0.004 * STEM_DIR, C_S + 0.04 * STEM_DIR + 0.001 * Y, B_C - 0.004 * STEM_DIR], Y,
                [(0, dict(af=.0185, ab=.0185, b=.0185, n=2.8)),
                 (0.5, dict(af=.0160, ab=.0160, b=.0178, n=2.9)),
                 (1, dict(af=.0140, ab=.0140, b=.0205, n=3.0))], nseg=16)
    aero = dict(af=.0105, ab=.0360, cut=1.0, b=.0079, n=2.0)
    rnd = dict(af=.0119, ab=.0119, cut=1.0, b=.0119, n=2.0)
    tops = Tube([B_C + V3(0.010, 0, -0.1755), B_C + V3(0.004, 0, -0.095), B_C + V3(0, 0, 0), B_C + V3(0.004, 0, 0.095),
                 B_C + V3(0.010, 0, 0.1755)], X,
                [(0, rnd), (0.10, rnd), (0.20, aero), (0.80, aero), (0.90, rnd), (1, rnd)], kind='catmull', nseg=70)
    stem = Union(clamp, body, k=0.010)
    return Union(Union(stem, tops, k=0.012), spacer, k=0.0)


def closed_spline(pts, n=120):
    P = np.asarray(pts, np.float64)
    k = len(P)
    out = []
    for i in range(k):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % k], P[(i + 2) % k]
        for t in np.linspace(0, 1, max(2, n // k), endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def poly_sdf2(px, py, poly):
    d2 = np.full(px.shape, np.inf); inside = np.zeros(px.shape, bool)
    E = len(poly)
    for i in range(E):
        ax, ay = poly[i]; bx, by = poly[(i + 1) % E]
        ex, ey = bx - ax, by - ay
        wx, wy = px - ax, py - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        dx, dy = wx - t * ex, wy - t * ey
        d2 = np.minimum(d2, dx * dx + dy * dy)
        cond = ((ay <= py) & (by > py)) | ((by <= py) & (ay > py))
        xint = ax + (py - ay) * (bx - ax) / (by - ay + 1e-12)
        inside ^= cond & (px < xint)
    return np.sqrt(d2) * np.where(inside, -1.0, 1.0)


HOOD_PROFILE = [(0.025, -0.011), (0.023, 0.003), (0.040, 0.0120), (0.066, 0.0150), (0.088, 0.0185), (0.101, 0.0265),
                (0.110, 0.0335), (0.118, 0.0318), (0.120, 0.0210), (0.117, 0.0060), (0.112, -0.0070), (0.103, -0.0175),
                (0.083, -0.0225), (0.058, -0.0225), (0.039, -0.0185)]


def hood_sdf(sgn):
    zc = sgn * HOOD_Z
    poly = closed_spline(HOOD_PROFILE, 150)

    def f(P):
        L = P - B_C
        x, y, z = L[:, 0], L[:, 1], L[:, 2]
        d2 = poly_sdf2(x, y, poly)
        hw = 0.0140 - 0.0040 * smoothstep(0.093, 0.118, x) - 0.0012 * smoothstep(0.035, 0.022, x) - 0.0022 * smoothstep(-0.004, 0.030, y)
        dz = np.abs(z - zc) - hw
        return smax(d2, dz, 0.0090)
    lo = B_C + V3(0.015, -0.030, zc - 0.02); hi = B_C + V3(0.13, 0.045, zc + 0.02)
    return Func(f, lo, hi)


def lever_sdf(sgn):
    zc = sgn * HOOD_Z
    L = [V3(0.111, -0.002, 0.000), V3(0.115, -0.030, 0.001), V3(0.109, -0.066, 0.005), V3(0.094, -0.099, 0.009), V3(0.075, -0.120, 0.011)]
    pts = [B_C + V3(p[0], p[1], zc + sgn * p[2]) for p in L]
    blade = Tube(pts, X, [(0, dict(af=.0060, ab=.0060, b=.0098, n=3.0)),
                          (0.35, dict(af=.0050, ab=.0050, b=.0088, n=3.0)),
                          (1, dict(af=.0038, ab=.0038, b=.0068, n=2.8))], kind='catmull', nseg=30, caprad=0.003)
    return blade


# ---------------------------------------------------------------- seat post & saddle
POST_HEAD = BB + 0.681 * ST_DIR - 0.002 * X
RAIL_Y = POST_HEAD[1] + 0.0075 + 0.006 + 0.0035


def seatpost_sdf():
    post = Tube([BB + 0.43 * ST_DIR, BB + 0.676 * ST_DIR], X,
                [(0, dict(af=.0125, ab=.036, cut=.0265, b=.0112, n=2.3)), (1, dict(af=.0125, ab=.036, cut=.0265, b=.0112, n=2.3))],
                nseg=6, caprad=0.002)
    head = RoundBox(POST_HEAD, (0.0235, 0.0075, 0.0140), 0.0055)
    return Union(post, head, k=0.009)


def seat_clamp_sdf():
    cradles = [RoundBox(POST_HEAD + V3(0.0, 0.0105, s * 0.021), (0.0185, 0.003, 0.0050), 0.0025) for s in (1, -1)]
    bolts = [Cylinder(POST_HEAD + V3(s * 0.013, -0.0075, 0), Y, 0.0042, 0.0022, 0.0008) for s in (1, -1)]
    plate = RoundBox(POST_HEAD + V3(0, 0.0072, 0), (0.0200, 0.0016, 0.0125), 0.0012)
    return Union(plate, *cradles, *bolts, k=0.0015)


S0 = SADDLE_TOP.copy()


def saddle_shell_sdf():
    def f(P):
        L = P - S0
        Xl, Yl, Zl = L[:, 0], L[:, 1], L[:, 2]
        w = 0.0190 + 0.0525 * (1 - smoothstep(-0.068, 0.042, Xl))
        dw = (w - (0.0190 + 0.0525 * (1 - smoothstep(-0.068, 0.042, Xl + 1e-3)))) / 1e-3
        dZ = (np.abs(Zl) - w) / np.sqrt(1 + dw * dw)
        xr = -0.1265 - 0.0065 * (1 - np.clip(Zl / 0.0715, -1, 1) ** 2)
        xn = 0.1145 - 0.010 * np.clip(Zl / 0.019, -1.5, 1.5) ** 2
        d_plan = smax(smax(dZ, xr - Xl, 0.020), Xl - xn, 0.011)
        yc = 0.0068 * smoothstep(-0.03, -0.125, Xl) - 0.0032 * smoothstep(0.03, 0.11, Xl)
        q = np.clip(np.abs(Zl) / w, 0, 1.2)
        ytop = yc - 0.0165 * q ** 2.3
        thick = 0.0235 * (1 - smoothstep(-0.02, 0.10, Xl)) + 0.0150 * smoothstep(-0.02, 0.10, Xl)
        ybot = yc - thick + 0.004 * q ** 2
        d_vert = np.maximum((Yl - ytop) * 0.92, ybot - Yl)
        d = smax(d_plan, d_vert, 0.0068)
        # centre relief channel / cut-out
        ax0, ax1, rr = -0.072, 0.030, 0.0092
        t = np.clip((Xl - ax0) / (ax1 - ax0), 0, 1)
        ds = np.sqrt((Xl - (ax0 + t * (ax1 - ax0))) ** 2 + Zl ** 2) - rr
        d = smax(d, -ds, 0.0035)
        return d
    lo = S0 + V3(-0.14, -0.05, -0.08); hi = S0 + V3(0.13, 0.02, 0.08)
    return Func(f, lo, hi)


def saddle_rails_sdf():
    rails = []
    for s in (1, -1):
        pts = [V3(0.092, -0.014, s * 0.010), V3(0.070, -0.033, s * 0.019), V3(0.035, -0.0367, s * 0.021),
               V3(-0.045, -0.0367, s * 0.021), V3(-0.080, -0.032, s * 0.026), V3(-0.104, -0.016, s * 0.036)]
        pts = [S0 + p for p in pts]
        rails.append(Tube(pts, Y, [(0, dict(af=.0035, ab=.0035, b=.0035, n=2.0)), (1, dict(af=.0035, ab=.0035, b=.0035, n=2.0))],
                          kind='catmull', nseg=40))
    return Union(*rails)


# ---------------------------------------------------------------- brake calipers
def caliper_sdf(axle, angle, rmid, zplane, mount='fork'):
    er = V3(np.cos(angle), np.sin(angle)); et = V3(-np.sin(angle), np.cos(angle))
    R = np.stack([et, er, Z], 1)  # local x=tangent, y=radial, z=lateral
    c = axle + rmid * er + zplane * Z

    def L(x, y, z):
        return c + x * et + y * er + z * Z
    body = RoundBox(L(0, 0.004, 0), (0.0255, 0.0150, 0.0165), 0.0058, R)
    slot = RoundBox(L(0, -0.012, 0), (0.040, 0.0135, 0.0026), 0.0008, R)
    pist = [Cylinder(L(s * 0.0085, -0.001, 0), Z, 0.0088, 0.0182, 0.003) for s in (1, -1)]
    cal = Subtract(Union(body, *pist, k=0.003), slot, k=0.0008)
    parts = [cal]
    if mount == 'fork':
        parts.append(RoundBox(L(0.026, 0.002, -0.010), (0.010, 0.010, 0.006), 0.003, R))
    else:
        parts.append(RoundBox(c + V3(0, -0.016, -0.004), (0.020, 0.008, 0.009), 0.003))
    bolt = [Cylinder(L(s * 0.017, 0.016, 0), er, 0.0032, 0.004, 0.001) for s in (1, -1)]
    return Union(*parts, k=0.004), Union(*bolt)


# ---------------------------------------------------------------- cranks
def crank_dir(a):
    return V3(np.cos(a), np.sin(a))


def crank_sdf(side, spider=True):
    a = CRANK_ANGLE if side > 0 else CRANK_ANGLE + np.pi
    d = crank_dir(a)
    perp = V3(-d[1], d[0])
    z0, z1 = side * 0.0625, side * 0.0675
    arm = Tube([BB + z0 * Z, BB + 0.06 * d + (z0 + (z1 - z0) * 0.35) * Z, BB + CRANK_LEN * d + z1 * Z], perp,
               [(0, dict(af=.0165, ab=.0165, b=.0080, n=3.0)), (0.5, dict(af=.0128, ab=.0128, b=.0072, n=3.0)),
                (1, dict(af=.0118, ab=.0118, b=.0068, n=3.0))], nseg=24, caprad=0.002)
    eye = Cylinder(BB + CRANK_LEN * d + z1 * Z, Z, 0.0118, 0.0068, 0.0028)
    root = Cylinder(BB + (z0 + side * 0.001) * Z, Z, 0.0210, 0.0080, 0.0030)
    parts = [arm, eye, root]
    bolts = []
    if side > 0 and not spider:   # montage direct : pas d'araignée, écrou du plateau au pied de la manivelle
        bolts.append(Cylinder(BB + 0.0718 * Z, Z, 0.0112, 0.0010, 0.0005))
    elif side > 0:
        for k in range(4):
            aa = a + (45 + 90 * k) * D2R
            dd = crank_dir(aa)
            sp = Tube([BB + 0.012 * dd + 0.058 * Z, BB + 0.054 * dd + 0.0505 * Z], V3(-dd[1], dd[0]),
                      [(0, dict(af=.0075, ab=.0075, b=.0040, n=2.6)), (1, dict(af=.0058, ab=.0058, b=.0032, n=2.6))], nseg=8, caprad=0.002)
            parts.append(sp)
            bolts.append(Cylinder(BB + 0.055 * dd + 0.0505 * Z, Z, 0.0046, 0.0032, 0.001))
    else:
        bolts.append(Cylinder(BB - 0.0710 * Z, Z, 0.0115, 0.0012, 0.0006))
    return Union(*parts, k=0.008), (Union(*bolts) if bolts else None)


# ---------------------------------------------------------------- derailleurs
def rd_sdf():
    zc = cog_z(COG_SEL)
    H = AXLE_R + V3(0.006, -0.030, 0)
    hanger = Union(Cylinder(AXLE_R + 0.0810 * Z, Z, 0.0112, 0.0022, 0.0008),
                   Tube([AXLE_R + 0.0810 * Z, H + 0.0810 * Z], X, [(0, dict(af=.0075, ab=.0075, b=.0022, n=4)), (1, dict(af=.0068, ab=.0068, b=.0022, n=4))],
                        nseg=4, caprad=0.0), k=0.003)
    bk = Cylinder(H + 0.0900 * Z, Z, 0.0090, 0.0068, 0.0025)
    P = JOCKEY_U + V3(-0.004, 0.016, 0)
    body = Tube([H + V3(-0.004, -0.004, 0.0905), H + V3(-0.022, -0.012, 0.086), P + V3(0.004, 0.004, zc + 0.0185)], Y,
                [(0, dict(af=.0110, ab=.0110, b=.0085, n=3.2)), (0.5, dict(af=.0118, ab=.0118, b=.0090, n=3.2)),
                 (1, dict(af=.0095, ab=.0095, b=.0075, n=3.0))], kind='catmull', nseg=20, caprad=0.003)
    motor = Ellipsoid(H + V3(-0.020, -0.004, 0.0895), (0.017, 0.012, 0.0085))
    pk = Cylinder(P + (zc + 0.0155) * Z, Z, 0.0082, 0.0060, 0.0022)
    rd = Union(bk, body, motor, pk, k=0.006)
    return hanger, rd


def rd_cage_sdf():
    zc = cog_z(COG_SEL)
    U, Lw = JOCKEY_U, JOCKEY_L

    def plate(z, ru, rl, th):
        def f(P):
            w = P[:, :2] - U[:2]
            ab = Lw[:2] - U[:2]
            t = np.clip((w @ ab) / (ab @ ab), 0, 1)
            q = P[:, :2] - (U[:2] + t[:, None] * ab)
            r = ru + (rl - ru) * t - 0.0035 * np.sin(np.pi * t)
            d2 = np.linalg.norm(q, axis=1) - r
            dz = np.abs(P[:, 2] - z) - th
            out = np.sqrt(np.maximum(d2 + 0.0008, 0) ** 2 + np.maximum(dz + 0.0008, 0) ** 2)
            return out + np.minimum(np.maximum(d2 + 0.0008, dz + 0.0008), 0) - 0.0008
        lo = np.minimum(U, Lw) - 0.03; hi = np.maximum(U, Lw) + 0.03
        lo[2] = z - th - 0.01; hi[2] = z + th + 0.01
        return Func(f, lo, hi)
    outer = plate(zc + 0.0068, 0.0148, 0.0158, 0.0011)
    inner = plate(zc - 0.0062, 0.0128, 0.0136, 0.0009)
    axles = Union(*[Cylinder(p + zc * Z, Z, 0.0042, 0.0075, 0.001) for p in (U, Lw)])
    bolts = Union(*[Cylinder(p + (zc + 0.0084) * Z, Z, 0.0046, 0.0011, 0.0005) for p in (U, Lw)])
    return Union(outer, inner, axles, k=0.0), bolts


def fd_sdf(stc=None):
    """front derailleur; stc = seat-tube point the braze-on bracket reaches (default: straight seat tube)"""
    zc = BIG_Z
    a0, a1 = 92 * D2R, 130 * D2R

    def cage(P):
        w = P - BB
        r = np.linalg.norm(w[:, :2], axis=1)
        ang = np.arctan2(w[:, 1], w[:, 0])
        t = np.clip((ang - a0) / (a1 - a0), 0, 1)            # 0 = front of cage, 1 = tail
        rin = 0.1125 + 0.0010 * t
        rout = 0.1310 - 0.0080 * t                            # taller at the front, tapering to the tail
        dr = np.abs(r - (rin + rout) / 2) - (rout - rin) / 2
        da = np.maximum(a0 - ang, ang - a1) * r
        flare = 0.0012 * np.clip((0.1215 - r) / 0.008, 0, 1)  # lower edge flares outward
        d_out = np.abs(w[:, 2] - (zc + 0.0064 + flare)) - 0.0009
        d_in = np.abs(w[:, 2] - (zc - 0.0062)) - 0.0008
        plate_o = np.maximum(np.maximum(dr, da), d_out)
        plate_i = np.maximum(np.maximum(dr + 0.0035, da + 0.008), d_in)
        tail = np.maximum(np.maximum(np.abs(r - 0.1185) - 0.0035, np.abs(ang - (a1 - 0.012)) * r - 0.0030), np.abs(w[:, 2] - zc) - 0.0072)
        top = np.maximum(np.maximum(np.abs(r - 0.1290) - 0.0018, np.abs(ang - 1.80) * r - 0.0060), np.abs(w[:, 2] - zc) - 0.0068)
        return smin(np.minimum(np.minimum(plate_o, plate_i), np.minimum(tail, top)), 1.0, 0.0) - 0.0005
    lo = BB + V3(-0.15, 0.0, zc - 0.02); hi = BB + V3(0.03, 0.15, zc + 0.02)
    cg = Func(cage, lo, hi)
    ang_b = 106 * D2R
    bodyc = BB + 0.152 * V3(np.cos(ang_b), np.sin(ang_b)) + V3(0, 0, 0.049)
    body = Union(RoundBox(bodyc, (0.0135, 0.0085, 0.0080), 0.0055), Ellipsoid(bodyc + V3(-0.006, 0.006, 0.0), (0.011, 0.007, 0.0072)), k=0.004)
    links = [Tube([bodyc + V3(s, -0.006, 0.0), BB + 0.1305 * V3(np.cos(ang_b + s * 3), np.sin(ang_b + s * 3)) + V3(0, 0, zc + 0.002)], Z,
                  [(0, dict(af=.0030, ab=.0030, b=.0050, n=2.6)), (1, dict(af=.0026, ab=.0026, b=.0045, n=2.6))], nseg=6, caprad=0.0015) for s in (-0.007, 0.007)]
    # braze-on bracket to the seat tube (drive side face)
    stc = BB + 0.1524 * ST_DIR if stc is None else stc
    bracket = Tube([bodyc + V3(0.003, 0.002, -0.004), stc + V3(0.006, 0.002, 0.018)], Y,
                   [(0, dict(af=.0060, ab=.0060, b=.0045, n=3)), (1, dict(af=.0090, ab=.0090, b=.0030, n=3))], nseg=6, caprad=0.002)
    return Union(cg, Union(body, *links, bracket, k=0.004), k=0.003)


# ---------------------------------------------------------------- rim brakes (dual-pivot style, for rim-brake variants)
def rim_caliper_sdf(axle, theta_deg, bolt_dir, bolt_len):
    th = theta_deg * D2R
    er = V3(np.cos(th), np.sin(th)); et = V3(-np.sin(th), np.cos(th))
    R = np.stack([et, er, Z], 1)

    def L(r, t, z):
        return axle + r * er + t * et + z * Z
    r_pad, z_face = 0.3080, 0.0152
    pads, shoes, arms = [], [], []
    for s in (1, -1):
        pads.append(RoundBox(L(r_pad, 0, s * (z_face + 0.0025)), (0.0195, 0.0042, 0.0025), 0.0016, R))
        shoes.append(RoundBox(L(r_pad + 0.0004, 0, s * (z_face + 0.0063)), (0.0215, 0.0054, 0.0014), 0.0011, R))
        t0 = -0.0035 * s
        pts = [L(r_pad + 0.001, t0, s * 0.0222), L(0.3225, t0, s * 0.0262), L(0.3430, t0, s * 0.0256), L(0.3555, t0, s * 0.0150), L(0.3600, t0, s * 0.0010)]
        arms.append(Tube(pts, et, [(0, dict(af=.0068, ab=.0068, b=.0030, n=3.2)), (0.55, dict(af=.0076, ab=.0076, b=.0034, n=3.2)), (1, dict(af=.0084, ab=.0084, b=.0040, n=3.0))],
                         kind='catmull', nseg=26, caprad=0.0018))
    body = RoundBox(L(0.3625, 0.0, 0.0), (0.0105, 0.0062, 0.0125), 0.0050, R)
    spring = Tube([L(0.3585, -0.009, 0.010), L(0.3660, -0.002, 0.016), L(0.3680, 0.008, 0.008)], et,
                  [(0, dict(af=.0016, ab=.0016, b=.0016, n=2)), (1, dict(af=.0016, ab=.0016, b=.0016, n=2))], kind='catmull', nseg=10)
    qr = Tube([L(0.3500, 0.0085, 0.0270), L(0.3570, 0.0150, 0.0275), L(0.3650, 0.0215, 0.0250)], et,
              [(0, dict(af=.0030, ab=.0030, b=.0018, n=2.6)), (1, dict(af=.0024, ab=.0024, b=.0016, n=2.6))], kind='catmull', nseg=10, caprad=0.0012)
    b0 = L(0.3625, 0.0, 0.0); bd = nrm(bolt_dir)
    bolt = Cylinder(b0 + bd * (bolt_len / 2), bd, 0.0036, bolt_len / 2, 0.0008)
    nut = Cylinder(b0 + bd * (bolt_len - 0.002), bd, 0.0058, 0.0022, 0.0008)
    arms_sdf = Union(Union(*arms, body, k=0.0045), spring, qr, k=0.0015)
    return arms_sdf, Union(*pads), Union(*shoes, k=0.0), Union(bolt, nut, k=0.001)
