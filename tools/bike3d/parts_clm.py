"""SDF parts of the CLM / triathlon bike (FTP Builder original design): integrated cockpit — aero stem in the line of the head tube,
wing base bar with TT brake levers, blade risers under a bridge, sculpted carbon extensions (flattened section, tapering, rising into
grips with the shifters at their tips), shaped arm cups and pads; aero seat post; TT saddle with split nose; hydration (aero bottle
between the extensions, bottle behind the saddle, top-tube box). FTPB_MODEL=clm."""
import numpy as np
from sdf import *
from geom import *
from parts import V3, smoothstep, poly_sdf2
import frame_clm as FC

assert CLM, 'parts_clm needs FTPB_MODEL=clm'
X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])
ROUND = lambda r: dict(af=r, ab=r, b=r, n=2.0, cut=1.0)
WING = dict(af=.0110, ab=.0400, cut=.0300, b=.0082, n=2.0, nb=1.6, re=.0012)      # aile du cintre de base (corde 41 mm)
BLADE = dict(af=.0115, ab=.0500, cut=.0380, b=.0090, n=2.3, nb=1.6, re=.0013)     # rehausses en lame (corde 50 mm)

# ---------------------------------------------------------------- cockpit layout
C_S = HT_TOP + 0.034 * AX_UP                          # stem: steerer clamp centre
STEM_DIR = V3(np.cos(-9 * D2R), np.sin(-9 * D2R))
B_C = C_S + 0.064 * STEM_DIR                          # base-bar centre
# base bar, right half (relative to B_C): flat aero wing, round horn running level forward, then a hook curving down (lever at its end)
BASE = [V3(0.000, 0.000, 0.000), V3(0.003, 0.000, 0.060), V3(0.010, 0.000, 0.118),
        V3(0.026, -0.001, 0.158), V3(0.052, -0.002, 0.180), V3(0.085, -0.002, 0.188), V3(0.112, -0.004, 0.190),
        V3(0.130, -0.014, 0.190), V3(0.138, -0.031, 0.190), V3(0.134, -0.048, 0.190)]
DIAG = nrm(np.array([1.0, 1.0, 0.0]))                  # repère des parties rondes (jamais parallèle à la corne ni au crochet)
RISER_Z, RISER_X = 0.078, -0.002                      # blade risers, nose in line with the base-bar leading edge
PAD_Y = 0.904                                          # arm-cup centre height
CUP = lambda sgn: V3(B_C[0] - 0.036, PAD_Y, sgn * 0.090)
EXT_Y = 0.877                                          # extension base height (bridge)
EXT_R = 0.0111                                         # round base-bar ends (22.2 mm: tape, levers)
BRIDGE_X = B_C[0] - 0.030


def ext_points(sgn):
    """extension centre-line: from inside the bridge, converging slightly, then rising into the grip"""
    x0 = B_C[0]
    return [V3(x0 - 0.045, EXT_Y, sgn * 0.074), V3(x0 + 0.030, EXT_Y + 0.002, sgn * 0.067), V3(x0 + 0.165, EXT_Y + 0.006, sgn * 0.050),
            V3(x0 + 0.232, EXT_Y + 0.015, sgn * 0.0435), V3(x0 + 0.270, EXT_Y + 0.041, sgn * 0.0410), V3(x0 + 0.287, EXT_Y + 0.069, sgn * 0.0400)]


def base_points():
    right = [B_C + p for p in BASE]
    left = [B_C + V3(p[0], p[1], -p[2]) for p in BASE]
    return left[::-1] + right[1:]


def tape_points(sgn):
    """round end of the base bar, from the wing to the lever (bar tape on the horn and the hook)"""
    from sdf import catmull
    C = catmull([B_C + V3(p[0], p[1], sgn * p[2]) for p in BASE[2:]], 300)
    z = np.abs(C[:, 2] - B_C[2]); s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    i0 = int(np.argmax(z > 0.152)); i1 = int(np.argmax(s > s[-1] - 0.004))
    return [C[i] for i in np.linspace(i0, i1, 18).astype(int)]


def bar_keys():
    """abscisses (0..1, de bout gauche à bout droit) où l'aile du cintre devient ronde"""
    from sdf import catmull
    C = catmull(base_points(), 600); s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))]); tn = s / s[-1]
    z = C[:, 2] - B_C[2]
    tL1, tL0 = tn[np.argmax(z > -0.150)], tn[np.argmax(z > -0.120)]
    tR0, tR1 = tn[len(z) - 1 - np.argmax(z[::-1] < 0.120)], tn[len(z) - 1 - np.argmax(z[::-1] < 0.150)]
    return float(tL1), float(tL0), float(tR0), float(tR1)


def cockpit_sdf():
    """stem in the line of the head tube, wing base bar, blade risers and the bridge that carries cups and extensions"""
    spacer = Tube([HT_TOP + 0.0009 * AX_UP, HT_TOP + 0.016 * AX_UP], X, [(0, FC.HT_PROF_TOP), (1, FC.HT_PROF_TOP)], nseg=4, caprad=0.0012)
    clamp = Tube([HT_TOP + 0.0168 * AX_UP, HT_TOP + 0.050 * AX_UP], X,
                 [(0, dict(FC.HT_PROF_TOP)), (1, dict(af=.0185, ab=.070, cut=.048, b=.0165, n=2.3, nb=1.7, re=.0016))], nseg=6, caprad=0.0050)
    body = Tube([C_S - 0.010 * STEM_DIR, B_C - 0.004 * STEM_DIR], Y,
                [(0, dict(af=.0175, ab=.0175, b=.0175, n=3.2, re=.0015)), (1, dict(af=.0120, ab=.0130, b=.0215, n=3.4, re=.0015))], nseg=12)
    rnd = ROUND(EXT_R)
    tL1, tL0, tR0, tR1 = bar_keys()
    ref = lambda t: X if tL1 < t < tR1 else DIAG
    bar = Tube(base_points(), ref, [(0, rnd), (tL1, rnd), (tL0, WING), (tR0, WING), (tR1, rnd), (1, rnd)], kind='catmull', nseg=150)
    stem = Union(Union(clamp, body, k=0.010), bar, k=0.010)
    # pont des repose-bras : poutre profilée d'un côté à l'autre, posée sur deux lames
    bridge = Tube([V3(BRIDGE_X, EXT_Y, -0.112), V3(BRIDGE_X, EXT_Y, 0.112)], X,
                  [(0, dict(af=.0135, ab=.0300, cut=.024, b=.0100, n=2.6, nb=1.6, re=.0015)), (1, dict(af=.0135, ab=.0300, cut=.024, b=.0100, n=2.6, nb=1.6, re=.0015))],
                  nseg=24, caprad=0.006)
    risers = [Tube([B_C + V3(RISER_X, 0.002, s * RISER_Z), V3(B_C[0] + RISER_X - 0.006, EXT_Y - 0.004, s * RISER_Z)], X, [(0, BLADE), (1, BLADE)], nseg=8)
              for s in (1, -1)]
    stack = Union(bridge, *risers, k=0.008)
    return Union(Union(stem, stack, k=0.006), spacer, k=0.0)


def cups_sdf():
    """arm cups: carbon shells, rear lip higher than the front, bracket on the bridge"""
    out = []
    for sgn in (1, -1):
        c = CUP(sgn)
        shell = Intersect(RoundBox(c, (0.066, 0.0175, 0.045), 0.0150), Ellipsoid(c + V3(0.0, 0.016, 0.0), (0.095, 0.052, 0.062)), k=0.004)
        scoop = Ellipsoid(c + V3(0.008, 0.046, 0.0), (0.080, 0.0525, 0.0365))
        cup = Subtract(shell, scoop, k=0.004)
        stem = RoundBox(V3(c[0] - 0.008, (c[1] + EXT_Y) / 2, sgn * 0.088), (0.022, 0.012, 0.016), 0.005)
        out.append(Union(cup, stem, k=0.006))
    return Union(*out)


def pads_sdf():
    """foam pads following the bowl of the cups"""
    out = []
    for sgn in (1, -1):
        c = CUP(sgn); cb = c + V3(0.008, 0.046, 0.0)
        layer = Subtract(Ellipsoid(cb, (0.0788, 0.0512, 0.0352)), Ellipsoid(cb + V3(0.0, 0.0080, 0.0), (0.0788, 0.0512, 0.0352)), k=0.002)
        out.append(Intersect(layer, RoundBox(c + V3(0.002, -0.006, 0.0), (0.064, 0.0255, 0.0345), 0.006), k=0.002))   # mousse affleurant le bord de la coque
    return Union(*out)


# section des prolongateurs : large et plate au pont (40 × 17 mm), effilée, puis poignée ovale debout (22 × 26 mm)
EXT_KEYS = [(0, dict(af=.0200, ab=.0200, b=.0085, n=3.0, re=.0015)), (0.28, dict(af=.0152, ab=.0152, b=.0085, n=3.0, re=.0015)),
            (0.62, dict(af=.0124, ab=.0124, b=.0092, n=2.8, re=.0015)), (0.82, dict(af=.0114, ab=.0114, b=.0112, n=2.6, re=.0015)),
            (1, dict(af=.0108, ab=.0108, b=.0128, n=2.4, re=.0015))]


def extensions_sdf():
    """sculpted extensions: wide flat section at the bridge, tapering forward, rising into an oval grip"""
    return Union(*[Tube(ext_points(s), Z, EXT_KEYS, kind='catmull', nseg=70, caprad=0.006) for s in (1, -1)])


def shifter_sdf(sgn):
    """grip end with the shifter: rubber cap over the tip and a button on the inner face"""
    P = ext_points(sgn); t = nrm(P[-1] - P[-2]); tip = P[-1]
    cap = Tube([tip - 0.018 * t, tip + 0.002 * t], Z, [(0, dict(af=.0113, ab=.0113, b=.0134, n=2.4)), (1, dict(af=.0111, ab=.0111, b=.0132, n=2.4))],
               nseg=6, caprad=0.0030)
    side = V3(0, 0, -sgn)
    up = nrm(np.cross(side, t))
    button = RoundBox(tip - 0.011 * t + 0.0114 * side, (0.0080, 0.0055, 0.0024), 0.0018, np.stack([t, up, side], 1))
    return Union(cap, button, k=0.002)


def lever_sdf(sgn):
    """TT brake lever at the end of the hook: short body in line with the hook, flat blade curling back toward the rider"""
    from sdf import catmull
    C = catmull([B_C + V3(p[0], p[1], sgn * p[2]) for p in BASE[-4:]], 80)
    e = C[-1]; t = nrm(C[-1] - C[-4])
    back = nrm(-X - (-X @ t) * t)
    body = Tube([e - 0.003 * t, e + 0.019 * t], Z, [(0, ROUND(.0123)), (1, dict(af=.0117, ab=.0117, b=.0127, n=2.4))], nseg=6, caprad=0.0040)
    p0 = e + 0.015 * t
    blade = Tube([p0, p0 + 0.020 * t + 0.002 * back, p0 + 0.036 * t + 0.014 * back, p0 + 0.043 * t + 0.032 * back], Z,
                 [(0, dict(af=.0088, ab=.0088, b=.0080, n=2.6)), (0.5, dict(af=.0080, ab=.0080, b=.0066, n=2.8)),
                  (1, dict(af=.0070, ab=.0070, b=.0052, n=2.8))], kind='catmull', nseg=26, caprad=0.0030)
    return Union(body, blade, k=0.004)


# ---------------------------------------------------------------- seat post (aero, in line with the straight seat tube), clamp
POST_TOP = FC.ST_END + 0.168 * POST_DIR
POST_HEAD = POST_TOP + V3(-0.003, 0.0045)
RAIL_Y = POST_HEAD[1] + 0.0075 + 0.006 + 0.0035
S0 = V3(POST_HEAD[0] + 0.020, RAIL_Y + 0.0367)          # saddle reference (top of the shell, mid-length): effective seat angle ≈ 81°


def seatpost_sdf():
    prof = dict(af=.0140, ab=.044, cut=.032, b=.0122, n=2.3, nb=1.65, re=.0014)
    post = Tube([FC.ST_END - 0.090 * POST_DIR, POST_TOP], X, [(0, prof), (1, prof)], nseg=8, caprad=0.002)
    head = RoundBox(POST_HEAD, (0.0240, 0.0075, 0.0140), 0.0055)
    return Union(post, head, k=0.010)


def seat_clamp_sdf():
    cradles = [RoundBox(POST_HEAD + V3(0.0, 0.0105, s * 0.021), (0.0185, 0.003, 0.0050), 0.0025) for s in (1, -1)]
    bolts = [Cylinder(POST_HEAD + V3(s * 0.013, -0.0075, 0), Y, 0.0042, 0.0022, 0.0008) for s in (1, -1)]
    plate = RoundBox(POST_HEAD + V3(0, 0.0072, 0), (0.0200, 0.0016, 0.0125), 0.0012)
    return Union(plate, *cradles, *bolts, k=0.0015)


# ---------------------------------------------------------------- TT saddle: short, wide split nose
def saddle_shell_sdf():
    def f(P):
        L = P - S0
        Xl, Yl, Zl = L[:, 0], L[:, 1], L[:, 2]
        wfun = lambda x: 0.0345 + 0.0300 * (1 - smoothstep(-0.080, 0.000, x))
        w = wfun(Xl); dw = (wfun(Xl + 1e-3) - w) / 1e-3
        dZ = (np.abs(Zl) - w) / np.sqrt(1 + dw * dw)
        xr = -0.1240 - 0.0055 * (1 - np.clip(Zl / 0.064, -1, 1) ** 2)
        xn = 0.1200 - 0.006 * np.clip(Zl / 0.034, -1.2, 1.2) ** 2
        d_plan = smax(smax(dZ, xr - Xl, 0.018), Xl - xn, 0.009)
        yc = 0.0060 * smoothstep(-0.03, -0.12, Xl) - 0.0030 * smoothstep(0.04, 0.115, Xl)
        q = np.clip(np.abs(Zl) / w, 0, 1.2)
        ytop = yc - 0.0120 * q ** 2.6
        thick = 0.0225 * (1 - smoothstep(-0.03, 0.08, Xl)) + 0.0170 * smoothstep(-0.03, 0.08, Xl)
        ybot = yc - thick + 0.004 * q ** 2
        d_vert = np.maximum((Yl - ytop) * 0.92, ybot - Yl)
        d = smax(d_plan, d_vert, 0.0062)
        # split nose: open slot from the tip, relief channel behind it
        slot = np.maximum(np.abs(Zl) - 0.0060, 0.036 - Xl)
        d = smax(d, -slot, 0.0030)
        ax0, ax1, rr = -0.075, 0.040, 0.0085
        t = np.clip((Xl - ax0) / (ax1 - ax0), 0, 1)
        ds = np.sqrt((Xl - (ax0 + t * (ax1 - ax0))) ** 2 + Zl ** 2) - rr
        d = smax(d, -np.maximum(ds, ytop - 0.0045 - Yl), 0.0030)
        return d
    lo = S0 + V3(-0.14, -0.05, -0.075); hi = S0 + V3(0.13, 0.02, 0.075)
    return Func(f, lo, hi)


def saddle_rails_sdf():
    rails = []
    for s in (1, -1):
        pts = [V3(0.092, -0.012, s * 0.014), V3(0.068, -0.031, s * 0.019), V3(0.035, -0.0367, s * 0.021),
               V3(-0.045, -0.0367, s * 0.021), V3(-0.078, -0.031, s * 0.027), V3(-0.098, -0.016, s * 0.036)]
        rails.append(Tube([S0 + p for p in pts], Y, [(0, ROUND(.0035)), (1, ROUND(.0035))], kind='catmull', nseg=40))
    return Union(*rails)


# ---------------------------------------------------------------- hydration
BF_X0, BF_X1 = B_C[0] + 0.040, B_C[0] + 0.2622         # front aero bottle (between the extensions): tail → nose along x
BF_Y = EXT_Y - 0.024
# méridien du bidon avant (abscisse depuis la queue, rayon) : queue effilée, plus grand diamètre aux 3/4, nez arrondi
BF_PROF = [(0.000, 0.000), (0.002, 0.0075), (0.010, 0.0125), (0.030, 0.0190), (0.070, 0.0260), (0.120, 0.0305), (0.165, 0.0318),
           (0.195, 0.0305), (0.210, 0.0268), (0.2185, 0.0200), (0.2215, 0.0120), (0.2222, 0.000)]


def bf_radius(x):
    from scipy.interpolate import PchipInterpolator
    s = np.array([p[0] for p in BF_PROF]); r = np.array([p[1] for p in BF_PROF])
    return float(np.maximum(PchipInterpolator(s, r)(np.clip(x - BF_X0, 0, s[-1])), 0))


def revolve(c, axis, prof, n=70):
    """body of revolution: meridian (abscissa from c along axis, radius) → exact distance in the meridian plane"""
    from scipy.interpolate import PchipInterpolator
    s = np.array([p[0] for p in prof]); r = np.array([p[1] for p in prof])
    ss = np.linspace(s[0], s[-1], n); rr = np.maximum(PchipInterpolator(s, r)(ss), 0)
    poly = np.vstack([np.c_[ss, rr], np.c_[ss[-2:0:-1], -rr[-2:0:-1]]])   # sans doubler les sommets des bouts (arête nulle → NaN)
    a = nrm(axis); c = np.asarray(c, np.float64)

    def f(P):
        w = P - c; u = w @ a; rho = np.linalg.norm(w - u[:, None] * a, axis=1)
        return poly_sdf2(u, rho, poly)
    R = r.max() + 0.004; e = c + a * s[-1]
    return Func(f, np.minimum(c, e) - R, np.maximum(c, e) + R)
RB_A = V3(S0[0] - 0.152, S0[1] - 0.040, 0.0)           # rear bottle: bottom end, just behind the saddle
RB_D = nrm(V3(-0.975, 0.22))                           # rising toward the back
RB_R, RB_L = 0.0365, 0.205


def bottle(c, axis, r, h):
    """round bottle body with grip grooves"""
    body = Cylinder(c, axis, r, h, 0.012)
    for u in (-0.25, 0.0, 0.25):
        body = Subtract(body, Torus(c + u * h * axis, axis, r + 0.0006, 0.0016), k=0.0012)
    return body


def front_bottle():
    """aero bottle: body of revolution, round nose forward, tapering tail"""
    return revolve(V3(BF_X0, BF_Y, 0), X, BF_PROF)


def bottles_sdf():
    rear = bottle(RB_A + RB_D * RB_L / 2, RB_D, RB_R, RB_L / 2)
    return Union(front_bottle(), rear)


def caps_sdf():
    """filler cap and straw of the front bottle, sport cap of the rear bottle"""
    fc = V3(BF_X0 + 0.060, BF_Y + bf_radius(BF_X0 + 0.060) + 0.0015, 0.0)
    cap_f = Cylinder(fc, Y, 0.0150, 0.0040, 0.0020)
    straw = Tube([fc + V3(0.0, 0.003, 0), fc + V3(-0.004, 0.030, 0), fc + V3(-0.022, 0.055, 0), fc + V3(-0.046, 0.064, 0)], Z,
                 [(0, ROUND(.0042)), (1, ROUND(.0040))], kind='catmull', nseg=24, caprad=0.002)
    clip = RoundBox(fc + V3(-0.048, 0.064, 0), (0.008, 0.004, 0.007), 0.002)
    rc = RB_A + RB_D * (RB_L + 0.005)
    cap_r = Union(Cylinder(rc, RB_D, 0.0200, 0.0060, 0.0025), Cylinder(rc + 0.008 * RB_D, RB_D, 0.0085, 0.0060, 0.0025), k=0.002)
    return Union(cap_f, straw, clip, cap_r, k=0.0015)


def cages_sdf():
    """straps of the front bottle hanging from the extensions; cage + arm of the rear bottle on the saddle rails"""
    parts = []
    for u in (0.28, 0.72):
        x = BF_X0 + u * (BF_X1 - BF_X0)
        r = bf_radius(x)
        c = V3(x, BF_Y, 0)

        def band(P, c=c, r=r):
            w = P - c
            rr = np.sqrt(w[:, 1] ** 2 + w[:, 2] ** 2)
            d = np.maximum(np.abs(rr - (r + 0.0026)) - 0.0020, np.abs(w[:, 0]) - 0.0070)
            return np.maximum(d, w[:, 1] - 0.010)
        parts.append(Func(band, c - 0.05, c + 0.05))
        ez = float(np.interp(x, [p[0] for p in ext_points(1)], [p[2] for p in ext_points(1)]))
        for s in (1, -1):
            parts.append(Tube([V3(x, BF_Y + 0.010, s * (r + 0.0026)), V3(x, EXT_Y - 0.004, s * (ez - 0.008)), V3(x, EXT_Y, s * (ez - 0.003))], X,
                              [(0, dict(af=.0070, ab=.0070, b=.0022, n=3)), (1, dict(af=.0070, ab=.0070, b=.0030, n=3))], nseg=8, caprad=0.001))
    # rear: two C-rings open at the top, a spine below, an arm up to the rails
    N = nrm(np.cross(RB_D, Z))                                 # bottle "up" (perpendicular to its axis, in the bike plane)
    for u in (0.22, 0.78):
        c = RB_A + RB_D * RB_L * u

        def ring(P, c=c):
            w = P - c
            a = w @ RB_D
            q = w - a[:, None] * RB_D
            r = np.linalg.norm(q, axis=1)
            d = np.maximum(np.abs(r - (RB_R + 0.0028)) - 0.0024, np.abs(a) - 0.0060)
            return np.maximum(d, q @ N - 0.016)
        parts.append(Func(ring, c - 0.06, c + 0.06))
    sp0 = RB_A + RB_D * RB_L * 0.18 - N * (RB_R + 0.005); sp1 = RB_A + RB_D * RB_L * 0.82 - N * (RB_R + 0.005)
    parts.append(Tube([sp0, sp1], N, [(0, dict(af=.0030, ab=.0030, b=.0085, n=3)), (1, dict(af=.0030, ab=.0030, b=.0085, n=3))], nseg=6, caprad=0.002))
    for s in (1, -1):
        r0 = S0 + V3(-0.068, -0.0367, s * 0.023)
        parts.append(Tube([sp0 + V3(0.002, 0.0, s * 0.006), V3(RB_A[0] + 0.014, RB_A[1] - RB_R - 0.010, s * 0.014), r0 + V3(-0.026, -0.018, 0), r0], Y,
                          [(0, dict(af=.0045, ab=.0045, b=.0060, n=2.8)), (1, dict(af=.0055, ab=.0055, b=.0050, n=2.8))], nseg=16, caprad=0.002))
        parts.append(RoundBox(r0, (0.012, 0.0060, 0.0055), 0.0025))
    return Union(*parts, k=0.004)


BENTO_X0, BENTO_X1 = 0.668, 0.780


def bento_sdf():
    """top-tube box (behind the stem)"""
    def ty(x):   # top-tube centre-line height at x
        return FC.TT0[1] + (FC.TT0[0] - x) / (FC.TT0[0] - FC.TT1[0]) * (FC.TT1[1] - FC.TT0[1])
    xc = (BENTO_X0 + BENTO_X1) / 2; hl = (BENTO_X1 - BENTO_X0) / 2
    y0 = ty(xc) + 0.0225
    box = RoundBox(V3(xc, y0 + 0.022, 0), (hl, 0.024, 0.0235), 0.010)
    lid = Ellipsoid(V3(xc - 0.004, y0 + 0.040, 0), (hl + 0.002, 0.012, 0.0215))
    b = Union(box, lid, k=0.006)
    # front face slanted to meet the stem
    b = Subtract(b, Func(lambda P: (P - V3(BENTO_X1 + 0.004, y0, 0)) @ nrm(V3(-0.6, -0.8)), V3(BENTO_X1 - 0.06, y0 - 0.02, -0.04), V3(BENTO_X1 + 0.02, y0 + 0.08, 0.04)), k=0.006)
    return b
