"""Original aero road frame + fork, as signed distance fields."""
import numpy as np
from sdf import *
from geom import *

X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])


def P2(x, y, z=0.0):
    return np.array([x, y, z], np.float64)


def HTP(a, f=0.0, z=0.0):
    """point along steering axis measured down from HT_TOP, f forward."""
    return HT_TOP + a * AX_DN + f * AX_FW + z * Z


def FKP(a, f=0.0, z=0.0):
    """fork point: measured down from HT_BOT."""
    return HT_BOT + a * AX_DN + f * AX_FW + z * Z


def tyre_envelope(axle, gap=0.0068):
    rc = R_TIRE - TIRE_HALF_W
    return Union(Torus(axle, Z, rc, TIRE_HALF_W + gap),
                 Cylinder(axle, Z, rc, 0.0172 + gap * 0.5, 0.0))


def rear_clearance(axle):
    """Tyre + rim keep-out zone for the rear triangle: tight near the chain stays, roomier along the seat tube."""
    rc = R_TIRE - TIRE_HALF_W

    def f(P):
        w = P - axle
        r = np.sqrt(w[:, 0] ** 2 + w[:, 1] ** 2)
        z = w[:, 2]
        t = np.clip((P[:, 1] - 0.300) / 0.060, 0, 1)
        gap = 0.0066 + 0.0042 * t * t * (3 - 2 * t)
        torus = np.sqrt((r - rc) ** 2 + z ** 2) - (TIRE_HALF_W + gap)
        disc = np.maximum(r - rc, np.abs(z) - 0.0176)
        return np.minimum(torus, disc)
    e = rc + 0.04
    return Func(f, axle - e, axle + e)


def region_profile_below(p0, n, prof, grow=0.0015):
    """solid = {(p-p0).n > 0} within the head-tube profile (grown) around the steering axis."""
    n = nrm(n)
    pr = {k: np.float64(v) for k, v in dict(DEFAULTS, **prof).items()}
    pr['af'] += grow; pr['ab'] += grow; pr['b'] += grow; pr['cut'] += grow

    def f(P):
        w = P - HT_TOP
        a = w @ AX_DN
        q = w - a[:, None] * AX_DN
        u = q @ AX_FW; v = q @ Z
        d2 = profile_sdf(u, v, {k: np.full(len(P), val) for k, val in pr.items()})
        dp = -((P - p0) @ n)
        return np.maximum(dp, d2)
    lo = p0 - 0.15; hi = p0 + 0.15
    return Func(f, lo, hi)


def region_below_plane(p0, n, radius, axis_pt, axis_dir):
    """solid = {(p-p0).n > 0} within a cylinder of radius around axis."""
    n = nrm(n); a = nrm(axis_dir)

    def f(P):
        dp = -((P - p0) @ n)
        w = P - axis_pt
        ax = w @ a
        rad = np.linalg.norm(w - ax[:, None] * a, axis=1)
        return np.maximum(dp, rad - radius)
    lo = np.minimum(p0, axis_pt) - 0.12; hi = np.maximum(p0, axis_pt) + 0.12
    return Func(f, lo, hi)


# ---------------------------------------------------------------- frame
def frame_sdf():
    # head tube: aero, steerer axis at profile origin
    ht = Tube([HTP(0.0), HTP(HT_LEN)], X,
              [(0, dict(af=.0215, ab=.058, cut=.0345, b=.0205, n=2.35, re=.0022)),
               (1, dict(af=.0240, ab=.060, cut=.0365, b=.0240, n=2.35, re=.0022))], nseg=8)

    tt0 = HTP(0.026, -0.008)
    tt1 = BB + 0.462 * ST_DIR
    tt = Tube([tt0, tt0 + (tt1 - tt0) / 3 + 0.0045 * Y, tt0 + 2 * (tt1 - tt0) / 3 + 0.003 * Y, tt1], Y,
              [(0, dict(af=.0175, ab=.0175, b=.0180, n=2.7)),
               (0.15, dict(af=.0148, ab=.0148, b=.0172, n=2.7)),
               (0.6, dict(af=.0132, ab=.0132, b=.0160, n=2.6)),
               (1, dict(af=.0128, ab=.0128, b=.0150, n=2.5))], nseg=32)

    dt0 = HTP(0.080, -0.010)
    dt1 = BB + P2(0.006, 0.012)
    dt = Tube([dt0, dt0 + (dt1 - dt0) * 0.35 + 0.002 * AX_FW, dt0 + (dt1 - dt0) * 0.7, dt1], X,
              [(0, dict(af=.0230, ab=.062, cut=.0385, b=.0235, n=2.7, re=.0025)),
               (0.15, dict(af=.0215, ab=.066, cut=.0420, b=.0225, n=2.75)),
               (0.8, dict(af=.0215, ab=.066, cut=.0420, b=.0232, n=2.75)),
               (0.93, dict(af=.0225, ab=.060, cut=.0370, b=.0305, n=2.8)),
               (1, dict(af=.0245, ab=.042, cut=.0245, b=.0390, n=3.0))], nseg=36, caprad=0.006)

    st = Tube([BB + 0.0 * ST_DIR, BB + ST_LEN * ST_DIR], X,
              [(0, dict(af=.0235, ab=.046, cut=.031, b=.0340, n=2.8, re=.0022)),
               (0.10, dict(af=.0195, ab=.047, cut=.0310, b=.0240, n=2.6)),
               (0.25, dict(af=.0180, ab=.052, cut=.0345, b=.0180, n=2.55)),
               (0.7, dict(af=.0170, ab=.050, cut=.0330, b=.0164, n=2.55)),
               (1, dict(af=.0172, ab=.047, cut=.0315, b=.0160, n=2.5))], nseg=30, caprad=0.004)

    bbshell = Cylinder(BB, Z, 0.0235, 0.0435, 0.0032)

    stays = []
    for sgn in (1, -1):
        # seat stays (dropped)
        top = BB + 0.338 * ST_DIR - 0.004 * X + sgn * 0.0095 * Z
        bot = P2(0.006, R_TIRE + 0.011, sgn * R_DROP_Z)
        ss = Tube([bot, bot + P2(0.10, 0.072, sgn * -0.004), top + P2(-0.105, -0.066, sgn * 0.034), top], X,
                  [(0, dict(af=.0066, ab=.0150, cut=.0112, b=.0060, n=2.5)),
                   (0.7, dict(af=.0078, ab=.0190, cut=.0148, b=.0068, n=2.5)),
                   (1, dict(af=.0090, ab=.0220, cut=.0170, b=.0084, n=2.5))], nseg=28)
        # chain stays
        cs = Tube([BB + P2(0.004, 0.0, sgn * 0.0225), BB + P2(-0.080, 0.011, sgn * 0.0278),
                   P2(0.150, 0.3125, sgn * 0.0605), P2(0.006, R_TIRE - 0.004, sgn * R_DROP_Z)], Y,
                  [(0, dict(af=.0200, ab=.0200, b=.0110, n=3.2)),
                   (0.3, dict(af=.0160, ab=.0160, b=.0096, n=3.2)),
                   (1, dict(af=.0102, ab=.0102, b=.0070, n=2.8))], nseg=28)
        drop = Cylinder(P2(0.0, R_TIRE, sgn * R_DROP_Z), Z, 0.0125, 0.0035, 0.0015)
        stays.append((ss, cs, drop))

    front = Union(ht, tt, dt, k=0.017)
    main = Union(front, st, k=0.012)
    hub = Ellipsoid(BB + P2(-0.003, 0.010, 0.0), (0.031, 0.031, 0.0420))
    bbpart = Union(bbshell, hub, stays[0][1], stays[1][1], k=0.011)
    bbj = Union(main, bbpart, k=0.013)
    rear = Union(bbj, stays[0][0], stays[1][0], k=0.014)
    hanger_boss = RoundBox(P2(0.003, R_TIRE - 0.013, R_DROP_Z), (0.0085, 0.0135, 0.0035), 0.003)
    full = Union(rear, stays[0][2], stays[1][2], hanger_boss, k=0.0055)
    full = Subtract(full, rear_clearance(AXLE_R), k=0.0045)
    # flat faces for the headset / fork crown and seat-post entry
    full = Subtract(full, region_below_plane(HT_BOT, AX_DN, 0.070, HT_TOP, AX_DN), k=0.0024)
    full = Subtract(full, region_below_plane(HT_TOP, AX_UP, 0.08, HT_TOP, AX_DN), k=0.0018)
    full = Subtract(full, region_below_plane(ST_TOP, ST_DIR, 0.06, BB, ST_DIR), k=0.0025)
    return full


# ---------------------------------------------------------------- fork
def fork_sdf():
    top = Tube([FKP(-0.004), FKP(0.050)], AX_FW,
               [(0, dict(af=.0240, ab=.060, cut=.0365, b=.0240, n=2.35, re=.0022)),
                (0.30, dict(af=.0240, ab=.060, cut=.0365, b=.0240, n=2.35, re=.0022)),
                (1, dict(af=.0225, ab=.056, cut=.0340, b=.0300, n=2.6))], nseg=10)
    legs = []
    for sgn in (1, -1):
        p0 = FKP(0.040, 0.000, sgn * 0.028)
        p3 = FKP(AXLE_TO_CROWN - 0.003, FORK_OFFSET - 0.0015, sgn * F_DROP_Z)
        leg = Tube([p0, FKP(0.095, 0.001, sgn * 0.0515), FKP(0.25, 0.017, sgn * 0.0548), p3], AX_FW,
                   [(0, dict(af=.0180, ab=.0480, cut=.0340, b=.0150, n=2.6)),
                    (0.18, dict(af=.0140, ab=.0420, cut=.0300, b=.0114, n=2.6)),
                    (0.6, dict(af=.0118, ab=.0350, cut=.0250, b=.0096, n=2.5)),
                    (1, dict(af=.0094, ab=.0270, cut=.0190, b=.0078, n=2.4))], nseg=32)
        foot = Cylinder(AXLE_F + sgn * F_DROP_Z * Z, Z, 0.0108, 0.0036, 0.0015)
        legs.append(Union(leg, foot, k=0.006))
    fork = Union(top, legs[0], legs[1], k=0.024)
    fork = Subtract(fork, tyre_envelope(AXLE_F, gap=0.0095), k=0.006)
    fork = Subtract(fork, region_below_plane(FKP(0.0012), AX_UP, 0.09, HT_TOP, AX_DN), k=0.0015)
    return fork
