"""Original time-trial / triathlon frame + fork (FTP Builder, no brand), as signed distance fields. FTPB_MODEL=clm.
Straight tubes with truncated-airfoil sections (flat flanks toward a Kamm tail), crisp junctions; deep fork blades on a wide crown."""
import numpy as np
from sdf import *
from geom import *
from frame import P2, HTP, FKP, tyre_envelope, rear_clearance, region_below_plane, region_profile_below, X, Y, Z

assert CLM, 'frame_clm needs FTPB_MODEL=clm'

# ---------------------------------------------------------------- profiles (af nose, ab tail, cut Kamm truncation, b half-width, nb tail exponent)
HT_PROF_TOP = dict(af=.0195, ab=.084, cut=.056, b=.0172, n=2.3, nb=1.7, re=.0016)
HT_PROF_BOT = dict(af=.0205, ab=.090, cut=.060, b=.0190, n=2.3, nb=1.7, re=.0016)
ST_U = np.array([np.sin(ST_ANG), np.cos(ST_ANG), 0.0])        # seat tube: perpendicular, forward


def sub_tube(full, ref, t0, t1, n=9, caprad=0.0):
    """portion t0..t1 (arc length) of a Tube, same centre-line and profiles : sert à reprendre un raccord localement avec un grand rayon"""
    C = full.C; s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))]); tn = s / s[-1]
    ts = np.linspace(t0, t1, n)
    pts = np.stack([np.interp(ts, tn, C[:, k]) for k in range(3)], 1)
    keys = [((t - t0) / (t1 - t0), {k: float(np.interp(t, tn, full.par[k])) for k in PROFILE_KEYS}) for t in ts]
    return Tube(pts, ref, keys, kind='poly', nseg=n - 1, caprad=caprad)


def bb_block():
    """boîtier caréné : bloc à flancs plats (extrusion latérale d'un profil allongé d'avant en arrière), roulements affleurants"""
    c = BB + P2(-0.012, 0.004)
    side = dict(af=.030, ab=.050, cut=1.0, b=.0325, n=2.7, re=.0015)
    mid = dict(af=.036, ab=.058, cut=1.0, b=.0370, n=2.7, re=.0015)
    return Tube([c - 0.0405 * Z, c + 0.0405 * Z], X, [(0, side), (0.5, mid), (1, side)], nseg=10, caprad=0.009)


def st_point(y):
    """seat-tube centre-line point at height y (straight tube)"""
    return st_curve(st_at_y(y))[0]


# ---------------------------------------------------------------- key lines (also used by decals, bolts and the cockpit)
TT_Y = 0.7065                                   # top tube: level centre-line, top edge where the head-tube top plane meets its tail
TT0 = HT_TOP + 0.020 * AX_DN - 0.020 * AX_FW
TT0 = np.array([TT0[0], TT_Y, 0.0])
TT1 = st_point(TT_Y) - 0.006 * X                # rear end, inside the seat tube
DT0 = HTP(0.028, -0.004)                        # down tube: straight deep blade from the head tube to the bottom bracket
DT1 = BB + P2(0.008, 0.016)
ST_END = ST_CURVE[3]                            # top of the seat tube (the aero seat post goes in along POST_DIR)
SS_TOP = st_point(0.600) - 0.010 * ST_U         # seat stays end inside the seat tube flanks, above the tyre


def frame_sdf():
    ht = Tube([HTP(-0.002), HTP(HT_LEN)], X, [(0, HT_PROF_TOP), (1, HT_PROF_BOT)], nseg=8)
    # top tube: level, tall and narrow with flat flanks, its lower edge rising toward the seat tube
    tt = Tube([TT0, TT1], Y, [(0, dict(af=.0225, ab=.0500, b=.0142, n=3.0, re=.0015)),
                              (1, dict(af=.0225, ab=.0260, b=.0125, n=2.8, re=.0015))], nseg=30)
    # down tube: truncated airfoil, chord ≈ 11 cm, widening into the bottom bracket
    dt = Tube([DT0, DT1], X, [(0, dict(af=.0255, ab=.088, cut=.063, b=.0205, n=2.5, nb=1.65, re=.0018)),
                              (0.62, dict(af=.0260, ab=.092, cut=.066, b=.0225, n=2.6, nb=1.65, re=.0018)),
                              (1, dict(af=.0280, ab=.088, cut=.064, b=.0350, n=2.8, nb=1.7, re=.0018))], nseg=36, caprad=0.006)
    # seat tube: straight leading edge, long tail cut away around the rear wheel
    st = Tube([ST_CURVE[0], ST_CURVE[3]], X,
              [(0, dict(af=.0230, ab=.060, cut=.040, b=.0300, n=2.6, nb=1.7, re=.0018)),
               (0.18, dict(af=.0212, ab=.092, cut=.072, b=.0178, n=2.4, nb=1.62, re=.0016)),
               (1, dict(af=.0200, ab=.082, cut=.060, b=.0168, n=2.4, nb=1.62, re=.0016))], nseg=40, caprad=0.004)
    bbshell = Cylinder(BB, Z, 0.0235, 0.0435, 0.0032)

    stays = []
    for sgn in (1, -1):
        top = SS_TOP + sgn * 0.0090 * Z
        bot = P2(0.006, R_TIRE + 0.011, sgn * R_DROP_Z)
        ss = Tube([bot, top], X, [(0, dict(af=.0062, ab=.0150, cut=.0115, b=.0058, n=2.4, nb=1.7)),
                                  (1, dict(af=.0072, ab=.0190, cut=.0145, b=.0074, n=2.4, nb=1.7))], nseg=24, caprad=0.002)
        cs = Tube([BB + P2(0.004, 0.0, sgn * 0.0225), BB + P2(-0.082, 0.011, sgn * 0.0282),
                   P2(0.155, 0.3115, sgn * 0.0605), P2(0.006, R_TIRE - 0.004, sgn * R_DROP_Z)], Y,
                  [(0, dict(af=.0250, ab=.0250, b=.0125, n=3.6)),
                   (0.3, dict(af=.0185, ab=.0185, b=.0102, n=3.4)),
                   (1, dict(af=.0105, ab=.0105, b=.0070, n=2.8))], nseg=28)
        drop = Cylinder(P2(0.0, R_TIRE, sgn * R_DROP_Z), Z, 0.0125, 0.0035, 0.0015)
        stays.append((ss, cs, drop))

    front = Union(ht, tt, dt, k=0.016)
    main = Union(front, st, k=0.012)
    # bas du cadre : voile plein entre diagonal et tube de selle (grand congé local), boîtier caréné, bases hautes
    web = Union(sub_tube(dt, X, 0.55, 1.0, caprad=0.006), sub_tube(st, X, 0.0, 0.40), k=0.045)
    block = bb_block()
    lower = Union(web, block, k=0.030)
    main = Union(main, lower, k=0.0)
    bbpart = Union(bbshell, stays[0][1], stays[1][1], k=0.011)
    bbj = Union(main, bbpart, k=0.016)
    rear = Union(bbj, stays[0][0], stays[1][0], k=0.010)
    hanger_boss = RoundBox(P2(0.003, R_TIRE - 0.013, R_DROP_Z), (0.0085, 0.0135, 0.0035), 0.003)
    full = Union(rear, stays[0][2], stays[1][2], hanger_boss, k=0.0055)
    full = Subtract(full, rear_clearance(AXLE_R), k=0.0040)
    # dessous de la douille : coupé seulement dans l'empreinte de la tête de fourche (le diagonal file derrière sans marche)
    full = Subtract(full, region_profile_below(HT_BOT, AX_DN, HT_PROF_BOT, grow=0.0025), k=0.0024)
    full = Subtract(full, region_profile_below(HT_TOP, AX_UP, HT_PROF_TOP, grow=0.0020), k=0.0016)   # dessus de douille, sans entamer l'horizontal
    full = Subtract(full, region_below_plane(ST_END - 0.002 * POST_DIR, POST_DIR, 0.075, ST_END, POST_DIR), k=0.0022)
    return full


# ---------------------------------------------------------------- fork: crown grown from the head-tube nose, straight deep blades
def leg_points(sgn, n_curve=14, n_line=26):
    """blade centre-line: starts inside the steerer nose, sweeps out in a 'Y', then runs straight to the dropout"""
    A = FKP(0.006, 0.0, sgn * 0.010); Cc = FKP(0.112, 0.0030, sgn * 0.0512)
    D = FKP(AXLE_TO_CROWN - 0.003, FORK_OFFSET - 0.0015, sgn * F_DROP_Z)
    d = (D - Cc) / np.linalg.norm(D - Cc)
    B = Cc - 0.058 * d; B = np.array([B[0], B[1], sgn * 0.0505])
    t = np.linspace(0, 1, n_curve)[:, None]
    curve = (1 - t) ** 2 * A + 2 * (1 - t) * t * B + t ** 2 * Cc
    line = Cc + np.linspace(0, 1, n_line)[1:, None] * (D - Cc)
    return np.vstack([curve, line])


LEG = lambda sgn: [FKP(0.112, 0.0030, sgn * 0.0512), FKP(AXLE_TO_CROWN - 0.003, FORK_OFFSET - 0.0015, sgn * F_DROP_Z)]


def fork_sdf():
    top = Tube([FKP(-0.004), FKP(0.030)], AX_FW, [(0, HT_PROF_BOT), (1, HT_PROF_BOT)], nseg=6, caprad=0.004)
    legs = []
    for sgn in (1, -1):
        # le haut du fourreau reprend le nez de la douille ; il s'affine en descendant
        leg = Tube(leg_points(sgn), AX_FW, [(0, dict(af=.0200, ab=.084, cut=.056, b=.0140, n=2.4, nb=1.65, re=.0014)),
                                            (0.26, dict(af=.0155, ab=.060, cut=.043, b=.0115, n=2.4, nb=1.65, re=.0014)),
                                            (1, dict(af=.0095, ab=.032, cut=.022, b=.0080, n=2.3, nb=1.65, re=.0012))], kind='poly', nseg=40)
        foot = Cylinder(AXLE_F + sgn * F_DROP_Z * Z, Z, 0.0108, 0.0036, 0.0015)
        legs.append(Union(leg, foot, k=0.006))
    fork = Union(top, Union(legs[0], legs[1], k=0.012), k=0.020)
    fork = Subtract(fork, tyre_envelope(AXLE_F, gap=0.0095), k=0.006)
    fork = Subtract(fork, region_below_plane(FKP(0.0012), AX_UP, 0.11, HT_TOP, AX_DN), k=0.0015)
    return fork
