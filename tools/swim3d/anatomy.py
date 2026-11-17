"""Corps sculptés (champs de distance signée) du nageur et du coach, et leur squelette.

Repère : y vers le haut, z vers l'avant du personnage, x vers sa gauche, en mètres, pieds au sol (y = 0).
Pose de référence : T-pose (bras à l'horizontale, paumes vers le bas), jambes légèrement écartées.
Chaque primitive appartient à un os (groupe) : la peau suit l'os des primitives les plus proches (poids de skinning).
"""
import numpy as np
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bike3d'))
from sdf import Node, Union, Subtract, Ellipsoid, Sphere, RoundBox, F, smin  # noqa: E402

# ------------------------------------------------------------------ primitives propres au corps humain


class RoundCone(Node):
    """Cône arrondi entre a (rayon r1) et b (rayon r2) — segment de membre (Inigo Quilez)."""

    def __init__(self, a, b, r1, r2):
        self.a = np.array(a, np.float64); self.b = np.array(b, np.float64); self.r1, self.r2 = float(r1), float(r2)
        r = max(r1, r2)
        self._b = ((np.minimum(self.a, self.b) - r).astype(F), (np.maximum(self.a, self.b) + r).astype(F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        P = np.asarray(P, np.float64)
        ba = self.b - self.a; l2 = ba @ ba; rr = self.r1 - self.r2; a2 = l2 - rr * rr; il2 = 1.0 / l2
        pa = P - self.a; y = pa @ ba; z = y - l2
        x = pa * l2 - y[:, None] * ba; x2 = np.sum(x * x, 1); y2 = y * y * l2; z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - self.r1
        d1 = np.sqrt(x2 + z2) * il2 - self.r2
        d2 = np.sqrt(x2 + y2) * il2 - self.r1
        d = np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))
        return d.astype(F)


class Flat(Node):
    """Enfant aplati le long d'un axe (section ovale d'un membre) : on dilate l'espace autour de c."""

    def __init__(self, child, c, axis, s):
        self.ch = child; self.c = np.array(c, np.float64); self.ax = np.array(axis, np.float64) / np.linalg.norm(axis); self.s = float(s)
        self._b = child.bounds()

    def bounds(self):
        return self._b

    def __call__(self, P):
        P = np.asarray(P, np.float64)
        w = P - self.c; t = w @ self.ax
        Q = P + (t * (1.0 / self.s - 1.0))[:, None] * self.ax
        return (self.ch(Q.astype(F)) * min(1.0, self.s)).astype(F)


class Loft(Node):
    """Tronc par sections horizontales : demi-ellipses avant / arrière (rx, rz avant, rz arrière, centre z) interpolées en douceur."""

    def __init__(self, ys, rx, rzf, rzb, cz, n=240):
        from scipy.interpolate import CubicSpline
        ys = np.asarray(ys, np.float64)
        self.y = np.linspace(ys[0], ys[-1], n)
        self.t = [CubicSpline(ys, np.asarray(v, np.float64), bc_type='natural')(self.y) for v in (rx, rzf, rzb, cz)]
        m = max(np.max(self.t[0]), np.max(self.t[1]), np.max(self.t[2])) + 0.01
        self.y0, self.y1 = ys[0], ys[-1]
        self._b = (np.array([-m, ys[0] - 0.02, np.min(self.t[3]) - m], F), np.array([m, ys[-1] + 0.02, np.max(self.t[3]) + m], F))

    def bounds(self):
        return self._b

    def __call__(self, P):
        P = np.asarray(P, np.float64)
        y = np.clip(P[:, 1], self.y0, self.y1)
        rx, rzf, rzb, cz = (np.interp(y, self.y, t) for t in self.t)
        dx = P[:, 0]; dz = P[:, 2] - cz
        rz = np.where(dz > 0, rzf, rzb)
        k0 = np.sqrt((dx / rx) ** 2 + (dz / rz) ** 2)
        k1 = np.sqrt((dx / rx ** 2) ** 2 + (dz / rz ** 2) ** 2)
        ds = k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
        dy = np.maximum(self.y0 - P[:, 1], P[:, 1] - self.y1)
        out = np.sqrt(np.maximum(ds, 0) ** 2 + np.maximum(dy, 0) ** 2) + np.minimum(np.maximum(ds, dy), 0)
        return out.astype(F)


def rot_y_to(u, fwd=(0, 0, 1)):
    """Matrice dont la 2e colonne (axe y local) est u, la 3e est au plus près de fwd."""
    u = np.array(u, np.float64); u /= np.linalg.norm(u)
    f = np.array(fwd, np.float64); f = f - (f @ u) * u
    if np.linalg.norm(f) < 1e-6:
        f = np.array([1.0, 0, 0]) - u[0] * u
    f /= np.linalg.norm(f)
    x = np.cross(u, f)
    return np.stack([x, u, f], 1)


def rot_x_to(u, up=(0, 1, 0)):
    u = np.array(u, np.float64); u /= np.linalg.norm(u)
    v = np.array(up, np.float64); v = v - (v @ u) * u; v /= np.linalg.norm(v)
    return np.stack([u, v, np.cross(u, v)], 1)


# ------------------------------------------------------------------ morphologies
NAGEUR = dict(name='Nageur', H=1.82, sh=1.0, chest=1.0, waist=0.93, belly=0.0, muscle=1.08, lat=1.12, hip=0.97, thigh=1.0, calf=1.0, arm=1.03, neck=1.0, head=1.0, age=0)
COACH = dict(name='Coach', H=1.79, sh=0.98, chest=1.04, waist=1.08, belly=0.55, muscle=0.92, lat=0.95, hip=1.03, thigh=1.03, calf=0.98, arm=0.98, neck=1.05, head=1.02, age=1)


def skeleton(M):
    """Articulations (position monde en T-pose) et parent de chaque os."""
    s = M['H'] / 1.82; sh = M['sh']; ar = M['arm']
    J = {}
    J['Hips'] = ((0, 0.985 * s, 0.0), None)
    J['Spine'] = ((0, 1.075 * s, -0.004), 'Hips')
    J['Spine1'] = ((0, 1.19 * s, -0.010), 'Spine')
    J['Spine2'] = ((0, 1.33 * s, -0.014), 'Spine1')
    J['Neck'] = ((0, 1.522 * s, -0.024), 'Spine2')
    J['Head'] = ((0, 1.612 * s, -0.012), 'Neck')
    J['Jaw'] = ((0, 1.655 * s, 0.002), 'Head')
    sy = 1.455 * s
    for sd, k in (('L', 1), ('R', -1)):
        J[f'{sd}_Clav'] = ((k * 0.024, 1.468 * s, 0.004), 'Spine2')
        J[f'{sd}_Arm'] = ((k * 0.188 * sh, sy, -0.016), f'{sd}_Clav')
        e = 0.188 * sh + 0.302 * s * ar
        J[f'{sd}_ForeArm'] = ((k * e, sy, -0.016), f'{sd}_Arm')
        w = e + 0.268 * s * ar
        J[f'{sd}_Hand'] = ((k * w, sy, -0.016), f'{sd}_ForeArm')
        J[f'{sd}_Fing1'] = ((k * (w + 0.094 * s), sy - 0.003, -0.012), f'{sd}_Hand')
        J[f'{sd}_Fing2'] = ((k * (w + 0.140 * s), sy - 0.005, -0.012), f'{sd}_Fing1')
        J[f'{sd}_Thumb'] = ((k * (w + 0.018 * s), sy - 0.010, 0.020), f'{sd}_Hand')
        J[f'{sd}_UpLeg'] = ((k * 0.094, 0.935 * s, 0.0), 'Hips')
        J[f'{sd}_Leg'] = ((k * 0.106, 0.515 * s, 0.012), f'{sd}_UpLeg')
        J[f'{sd}_Foot'] = ((k * 0.116, 0.088 * s, -0.018), f'{sd}_Leg')
        J[f'{sd}_Toe'] = ((k * 0.121, 0.022 * s, 0.118 * s), f'{sd}_Foot')
    return J


# os voisins : la peau d'un os ne se mélange qu'avec ses voisins (pas de jambe gauche qui tire la droite)
def neighbours(J):
    nb = {k: {k} for k in J}
    for k, (_, p) in J.items():
        if p:
            nb[k].add(p); nb[p].add(k)
    # l'épaule (clavicule) et le haut du dos se mélangent aussi au bras ; le bassin aux deux cuisses
    for sd in 'LR':
        nb[f'{sd}_Arm'] |= {'Spine2', 'Spine1'}; nb['Spine2'].add(f'{sd}_Arm')
        nb[f'{sd}_Thumb'] |= {f'{sd}_Fing1'}; nb[f'{sd}_Fing1'] |= {f'{sd}_Thumb'}
        nb[f'{sd}_UpLeg'] |= {'Spine'}; nb['Spine'].add(f'{sd}_UpLeg')
    nb['Neck'] |= {'Jaw'}; nb['Jaw'] |= {'Neck', 'Spine2'}; nb['Spine2'] |= {'Jaw'}
    return nb


def body(M):
    """Liste (groupe, primitive, partie) + champ complet du corps (union lissée par parties)."""
    J = skeleton(M); s = M['H'] / 1.82
    mu, ch, wa, be, la, sh = M['muscle'], M['chest'], M['waist'], M['belly'], M['lat'], M['sh']
    P = lambda k: np.array(J[k][0], np.float64)
    prims = []

    def add(g, node, part, geo=True, wt=True):
        prims.append((g, node, part, geo, wt))

    # ---------------- tronc : sections du bassin à la base du cou (forme en V du nageur)
    ys = np.array([0.845, 0.905, 0.965, 1.035, 1.105, 1.180, 1.260, 1.330, 1.390, 1.440, 1.480, 1.520]) * s
    rx = np.array([0.146, 0.152 * M['hip'], 0.150 * M['hip'], 0.138 * wa, 0.137 * wa, 0.146 * (wa + 1) / 2, 0.160 * ch * la ** 0.3, 0.172 * ch * la ** 0.5,
                   0.180 * sh * la ** 0.4, 0.174 * sh, 0.146 * sh, 0.082 * M['neck']])
    bel = np.array([0, 0, 0.004, 0.022, 0.034, 0.028, 0.012, 0, 0, 0, 0, 0]) * be
    rzf = np.array([0.088, 0.094, 0.097, 0.094, 0.097, 0.103, 0.110 * ch, 0.116 * ch, 0.114 * ch, 0.102, 0.084, 0.058]) + bel
    rzb = np.array([0.104, 0.104, 0.096, 0.084, 0.082, 0.087, 0.093, 0.098, 0.097, 0.093, 0.082, 0.060])
    cz = np.array([-0.012, -0.010, -0.006, -0.002, 0.002, 0.002, -0.001, -0.005, -0.010, -0.018, -0.026, -0.030])
    # chaque tranche du tronc suit l'os à sa hauteur (Hips → Spine → Spine1 → Spine2)
    add('Spine1', Loft(ys, rx, rzf, rzb, cz), 'torso', wt=False)            # la forme : une seule section continue
    cut = lambda a, b: Loft(ys[a:b], rx[a:b], rzf[a:b], rzb[a:b], cz[a:b])    # les poids : une tranche par os
    add('Hips', cut(0, 4), 'torso', geo=False); add('Spine', cut(2, 6), 'torso', geo=False)
    add('Spine1', cut(4, 8), 'torso', geo=False); add('Spine2', cut(7, 12), 'torso', geo=False)
    sp2, sp1, sp0, hp = P('Spine2'), P('Spine1'), P('Spine'), P('Hips')
    for k in (1, -1):
        # pectoraux : galbe discret, bord inférieur net
        add('Spine2', Ellipsoid([k * 0.080, 1.408 * s, -0.005 + 0.116 * ch - 0.046], [0.092 * mu, 0.047 * mu, 0.030 * mu], rot_x_to([k * 0.92, -0.38, 0.03])), 'torso')
        # trapèzes : pente du cou vers l'épaule
        add('Spine2', RoundCone([k * 0.030, 1.540 * s, -0.040], [k * 0.150 * sh, 1.468 * s, -0.030], 0.038, 0.030), 'torso')
        # fessiers
        add('Hips', Ellipsoid(hp + [k * 0.066, -0.098 * s, -0.064], [0.082 * M['hip'], 0.098 * s, 0.070 * M['hip']], rot_y_to([k * 0.12, 1, 0])), 'torso')
        # omoplates (relief léger du dos)
        add('Spine2', Ellipsoid([k * 0.080, 1.405 * s, -0.096], [0.055, 0.070, 0.018], rot_y_to([k * -0.25, 1, 0], [0, 0, -1])), 'torso')
    # ---------------- cou, tête
    nk, hd, jw = P('Neck'), P('Head'), P('Jaw')
    add('Neck', RoundCone(nk + [0, -0.035, -0.004], hd + [0, 0.030, 0.000], 0.062 * M['neck'], 0.055 * M['neck']), 'head')
    for k in (1, -1):  # sterno-cléido-mastoïdiens, du derrière de l'oreille au sternum
        add('Neck', RoundCone(hd + [k * 0.046, 0.040, -0.022], nk + [k * 0.014, -0.055, 0.046], 0.016, 0.013), 'head')
    hs = M['head']
    add('Head', Ellipsoid(hd + [0, 0.110 * hs, -0.016], [0.076 * hs, 0.098 * hs, 0.098 * hs]), 'head')                   # crâne
    add('Head', Ellipsoid(hd + [0, 0.074 * hs, 0.022], [0.064 * hs, 0.074 * hs, 0.060]), 'head')                           # masse du visage
    add('Head', Ellipsoid(hd + [0, 0.122 * hs, 0.064], [0.054 * hs, 0.015, 0.017]), 'head')                                 # arcade
    for k in (1, -1):
        add('Head', Ellipsoid(hd + [k * 0.044, 0.084 * hs, 0.052], [0.021, 0.013, 0.017]), 'head')                         # pommettes
        add('Head', Flat(Ellipsoid(hd + [k * 0.078 * hs, 0.092 * hs, -0.020], [0.010, 0.026, 0.016]), hd + [k * 0.078 * hs, 0.092, -0.020], [1, 0, 0], 0.6), 'head')  # oreilles
        add('Head', Sphere(hd + [k * 0.0120, 0.071 * hs, 0.093], 0.0080), 'head')                                           # ailes du nez
    add('Head', RoundCone(hd + [0, 0.112 * hs, 0.086], hd + [0, 0.078 * hs, 0.104], 0.0072, 0.0108), 'head')               # arête du nez
    add('Head', Sphere(hd + [0, 0.075 * hs, 0.101], 0.0102), 'head')                                                        # bout du nez
    add('Jaw', Ellipsoid(jw + [0, -0.008, 0.016], [0.050 * hs, 0.040, 0.054]), 'head')                                     # mâchoire
    for k in (1, -1):                                                                                                       # ligne de la mâchoire
        add('Jaw', RoundCone(jw + [k * 0.054 * hs, -0.006, -0.026], jw + [k * 0.016, -0.040, 0.054], 0.015, 0.016), 'head')
    add('Jaw', Ellipsoid(jw + [0, -0.038, 0.057], [0.024, 0.017, 0.019]), 'head')                                           # menton
    add('Jaw', Ellipsoid(jw + [0, 0.000, 0.068], [0.020, 0.0060, 0.0085]), 'head')                                          # lèvre inférieure
    add('Head', Ellipsoid(hd + [0, 0.053 * hs, 0.079], [0.022, 0.0062, 0.0090]), 'head')                                    # lèvre supérieure
    # ---------------- bras (gauche puis miroir)
    for sd, k in (('L', 1), ('R', -1)):
        cl, sh_, el, wr = P(f'{sd}_Clav'), P(f'{sd}_Arm'), P(f'{sd}_ForeArm'), P(f'{sd}_Hand')
        f1, th = P(f'{sd}_Fing1'), P(f'{sd}_Thumb')
        X = np.array([k, 0, 0.0])
        add(f'{sd}_Clav', RoundCone(cl + [0, 0.004, 0.030], sh_ + [-k * 0.030, 0.016, 0.022], 0.018, 0.022), 'torso')     # clavicule
        add(f'{sd}_Arm', Ellipsoid(sh_ + [k * 0.012, 0.006, 0.000], [0.074 * mu, 0.066 * mu, 0.064 * mu]), 'arm')           # deltoïde
        add(f'{sd}_Arm', RoundCone(sh_ + X * 0.03, el, 0.053 * mu, 0.040), 'arm')
        add(f'{sd}_Arm', Ellipsoid(sh_ + X * 0.160 + [0, -0.002, 0.016], [0.090, 0.036 * mu, 0.036 * mu], rot_x_to(X)), 'arm')   # biceps
        add(f'{sd}_Arm', Ellipsoid(sh_ + X * 0.130 + [0, 0.004, -0.020], [0.105, 0.038 * mu, 0.036 * mu], rot_x_to(X)), 'arm')   # triceps
        add(f'{sd}_ForeArm', Flat(RoundCone(el, wr, 0.043 * mu, 0.027), (el + wr) / 2, [0, 1, 0], 0.80), 'arm')
        add(f'{sd}_ForeArm', Ellipsoid(el + X * 0.072 + [0, 0.004, 0.004], [0.085, 0.040 * mu, 0.045 * mu], rot_x_to(X)), 'arm')  # fléchisseurs
        add(f'{sd}_ForeArm', Sphere(el + [-k * 0.006, 0.004, -0.028], 0.020), 'arm')                                            # olécrâne
        # main : paume, doigts serrés (deux phalanges), pouce
        add(f'{sd}_Hand', RoundBox(wr + X * 0.050 + [0, -0.003, 0.002], [0.048, 0.0125, 0.041], 0.0115), 'hand')
        add(f'{sd}_Hand', Ellipsoid(wr + X * 0.030 + [0, -0.010, 0.022], [0.026, 0.012, 0.017]), 'hand')                    # éminence thénar
        for i, dz in enumerate((0.0265, 0.0090, -0.0090, -0.0255)):
            L1 = (0.046, 0.050, 0.047, 0.036)[i]; L2 = (0.040, 0.044, 0.042, 0.033)[i]; r = (0.0093, 0.0097, 0.0093, 0.0081)[i]
            b0 = f1 + [-k * 0.008, 0, dz]; b1 = b0 + X * L1; b2 = b1 + X * L2
            add(f'{sd}_Fing1', RoundCone(b0, b1, r, r * 0.93), 'hand')
            add(f'{sd}_Fing2', RoundCone(b1, b2 - X * 0.004, r * 0.90, r * 0.78), 'hand')
        tdir = np.array([k * 0.70, -0.06, 0.71]); tdir /= np.linalg.norm(tdir)
        t1 = th + tdir * 0.036
        add(f'{sd}_Thumb', RoundCone(th, t1, 0.0128, 0.0108), 'hand')
        t2 = np.array([k * 0.92, -0.04, 0.40]); t2 /= np.linalg.norm(t2)
        add(f'{sd}_Thumb', RoundCone(t1, t1 + t2 * 0.032, 0.0106, 0.0088), 'hand')
    # ---------------- jambes
    for sd, k in (('L', 1), ('R', -1)):
        hj, kn, an, to = P(f'{sd}_UpLeg'), P(f'{sd}_Leg'), P(f'{sd}_Foot'), P(f'{sd}_Toe')
        th_ = M['thigh']
        dleg = (kn - hj) / np.linalg.norm(kn - hj)
        add(f'{sd}_UpLeg', Flat(RoundCone(hj + [-k * 0.010, 0.02, -0.004], kn, 0.082 * th_, 0.054), hj, [1, 0, 0], 0.90), 'leg')
        add(f'{sd}_UpLeg', Ellipsoid(hj + (kn - hj) * 0.50 + [k * 0.010, 0, 0.032], [0.066 * th_, 0.175, 0.056 * th_], rot_y_to(-dleg)), 'leg')     # quadriceps
        add(f'{sd}_UpLeg', Ellipsoid(hj + (kn - hj) * 0.80 + [-k * 0.022, 0, 0.034], [0.038, 0.072, 0.038], rot_y_to(-dleg)), 'leg')               # vaste interne
        add(f'{sd}_UpLeg', Ellipsoid(hj + (kn - hj) * 0.46 + [0, 0, -0.034], [0.058 * th_, 0.165, 0.052 * th_], rot_y_to(-dleg)), 'leg')            # ischios
        add(f'{sd}_Leg', Sphere(kn + [0, 0.004, 0.012], 0.049), 'leg')                                                                              # genou
        add(f'{sd}_Leg', Ellipsoid(kn + [0, -0.006, 0.046], [0.024, 0.027, 0.012]), 'leg')                                                         # rotule
        dcalf = (an - kn) / np.linalg.norm(an - kn)
        add(f'{sd}_Leg', RoundCone(kn, an + [0, 0.02, 0], 0.050 * M['calf'], 0.033), 'leg')
        add(f'{sd}_Leg', Ellipsoid(kn + (an - kn) * 0.30 + [0, 0, -0.030], [0.054 * M['calf'], 0.112, 0.050 * M['calf']], rot_y_to(-dcalf)), 'leg')  # mollet
        add(f'{sd}_Leg', Ellipsoid(kn + (an - kn) * 0.38 + [k * 0.008, 0, 0.020], [0.030, 0.125, 0.028], rot_y_to(-dcalf)), 'leg')                  # tibia
        # pied
        add(f'{sd}_Foot', Sphere(an + [0, 0.004, -0.004], 0.034), 'leg')
        add(f'{sd}_Foot', Ellipsoid(an + [0, -0.044, -0.040], [0.032, 0.030, 0.040]), 'leg')                                                       # talon
        fd = to - an + [0, 0.010, 0]; L = np.linalg.norm(fd)
        add(f'{sd}_Foot', Ellipsoid(an + fd * 0.47 + [0, -0.030, 0], [0.039, 0.025, L * 0.60], rot_y_to([0, 1, 0], fd)), 'leg')
        add(f'{sd}_Toe', Ellipsoid(to + [0, -0.002, 0.026], [0.041, 0.016, 0.038]), 'leg')
    # ---------------- union par parties puis du tout (lissages différents)
    kpart = {'torso': 0.034, 'head': 0.014, 'arm': 0.018, 'hand': 0.0045, 'leg': 0.020}
    U = lambda part, pre='': Union(*[n for g, n, p, geo, wt in prims if geo and p == part and g.startswith(pre)], k=kpart[part])
    torso, head = U('torso'), U('head')
    arms = [U('arm', sd) for sd in 'LR']; hands = [U('hand', sd) for sd in 'LR']; legs = [U('leg', sd) for sd in 'LR']
    full = Union(Union(torso, head, k=0.020), *arms, k=0.030)
    full = Union(full, *legs, k=0.030)
    full = Union(full, *hands, k=0.010)
    # creux discrets : orbites, ligne blanche des abdos, sillon de la colonne
    hs = M['head']; hdp = P('Head')
    eyes = [Sphere(hdp + [k * 0.031, 0.103 * hs, 0.083], 0.0128) for k in (1, -1)]
    full = Subtract(full, Union(*eyes), k=0.008)
    grooves = [RoundCone([0, 1.04 * s, -0.080], [0, 1.42 * s, -0.090], 0.0060, 0.0060)]   # sillon de la colonne
    full = Subtract(full, Union(*grooves), k=0.010)
    return J, prims, full


def eye_centres(M):
    J = skeleton(M); hd = np.array(J['Head'][0]); hs = M['head']
    return [hd + [k * 0.031, 0.102 * hs, 0.0680] for k in (1, -1)]
