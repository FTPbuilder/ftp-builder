"""Bike geometry (metres). x forward, y up, z lateral (+z = drive side).
FTPB_MODEL=clm : vélo de contre-la-montre / triathlon (cotes d'un cadre CLM taille M) ; sinon vélo aéro de route."""
import os
import numpy as np

D2R = np.pi / 180
MODEL = os.environ.get('FTPB_MODEL', 'aero')
CLM = MODEL == 'clm'

R_BEAD = 0.311            # 622 BSD / 2
TIRE_H = 0.0285           # section height of a 28 mm tyre on a wide rim
R_TIRE = R_BEAD + TIRE_H  # 0.3395
TIRE_HALF_W = 0.0149

AXLE_R = np.array([0.0, R_TIRE, 0.0])
if CLM:   # taille M : stack 481, reach 440, bases 420, drop 75, direction 73°, selle effective 81°
    CS, BB_DROP = 0.420, 0.075
    STACK, REACH = 0.481, 0.440
    HA, SA = 73.0 * D2R, 81.0 * D2R
    HT_LEN = 0.062         # tête de fourche intégrée : la douille visible paraît plus haute
    FORK_OFFSET = 0.040
    SADDLE_H = 0.750
else:
    CS, BB_DROP = 0.410, 0.072
    STACK, REACH = 0.560, 0.392
    HA, SA = 73.0 * D2R, 73.5 * D2R
    HT_LEN = 0.150
    FORK_OFFSET = 0.045
    SADDLE_H = 0.735
BB = np.array([np.sqrt(CS ** 2 - BB_DROP ** 2), R_TIRE - BB_DROP, 0.0])
HT_TOP = BB + np.array([REACH, STACK, 0.0])
AX_DN = np.array([np.cos(HA), -np.sin(HA), 0.0])   # steering axis, pointing down
AX_UP = -AX_DN
AX_FW = np.array([np.sin(HA), np.cos(HA), 0.0])    # perpendicular to axis, forward
HT_BOT = HT_TOP + HT_LEN * AX_DN
ST_DIR = np.array([-np.cos(SA), np.sin(SA), 0.0])

# front axle: on line HT_TOP + s*AX_DN + FORK_OFFSET*AX_FW with y = R_TIRE
_s = (HT_TOP[1] + FORK_OFFSET * AX_FW[1] - R_TIRE) / np.sin(HA)
AXLE_F = HT_TOP + _s * AX_DN + FORK_OFFSET * AX_FW
AXLE_TO_CROWN = _s - HT_LEN
WHEELBASE = AXLE_F[0] - AXLE_R[0]

SADDLE_TOP = BB + SADDLE_H * ST_DIR
ST_LEN = 0.50
ST_TOP = BB + ST_LEN * ST_DIR

# CLM : tube de selle droit à 79° (bord d'attaque rectiligne, découpe de roue derrière) ; la tige de selle aéro le prolonge, tête avancée
ST_ANG = 79.0 * D2R
ST_LEN_CLM = 0.530
_sd = np.array([-np.cos(ST_ANG), np.sin(ST_ANG), 0.0])
ST_CURVE = [BB + _sd * ST_LEN_CLM * k for k in (0.0, 1 / 3, 2 / 3, 1.0)]


def st_curve(t):
    """point and unit tangent of the CLM seat-tube centre-line, t in [0, 1]"""
    P = ST_CURVE
    p = (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]
    d = 3 * ((1 - t) ** 2 * (P[1] - P[0]) + 2 * (1 - t) * t * (P[2] - P[1]) + t ** 2 * (P[3] - P[2]))
    return p, d / np.linalg.norm(d)


def st_at_y(y):
    """seat-tube centre-line parameter t where the centre-line reaches height y (world)"""
    lo, hi = 0.0, 1.0
    for _ in range(50):
        m = (lo + hi) / 2
        if st_curve(m)[0][1] < y:
            lo = m
        else:
            hi = m
    return (lo + hi) / 2


POST_DIR = (ST_CURVE[3] - ST_CURVE[2]) / np.linalg.norm(ST_CURVE[3] - ST_CURVE[2])

REAR_OLD = 0.142
FRONT_OLD = 0.100
R_DROP_Z = 0.0745          # rear dropout plate centre
F_DROP_Z = 0.0535          # front dropout centre

# rotor planes
F_ROTOR_Z = -(FRONT_OLD / 2) + 0.0156 + 0.0009
R_ROTOR_Z = -(REAR_OLD / 2) + 0.0156 + 0.0009
F_ROTOR_R = 0.080
R_ROTOR_R = 0.070

# drivetrain
CHAIN_P = 0.0127
BIG_T, SMALL_T = 52, 36
BIG_Z, SMALL_Z = 0.0480, 0.0405
MONO = CLM                 # CLM : plateau unique (1x), sans dérailleur avant
if MONO:
    BIG_T, BIG_Z = 54, 0.0450
COGS = [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30]
COG_Z0 = 0.0605
COG_PITCH = 0.00385
COG_SEL = 4  # 15T
CRANK_LEN = 0.165 if CLM else 0.1725
CRANK_ANGLE = -55 * D2R    # drive arm direction (from +x, ccw)


def pitch_r(n, p=CHAIN_P):
    return p / (2 * np.sin(np.pi / n))


def cog_z(i):
    return COG_Z0 - i * COG_PITCH


# rear derailleur jockeys (relative to rear axle)
JOCKEY_T = 11
JOCKEY_U = AXLE_R + np.array([-0.012, -0.060, 0.0])
JOCKEY_L = JOCKEY_U + 0.074 * np.array([np.sin(25 * D2R), -np.cos(25 * D2R), 0.0])

# hub flanges (for the JS spoke builder)
HUB = {
    'front': {'flanges': [{'z': -0.0305, 'r': 0.0205, 'n': 12}, {'z': 0.0305, 'r': 0.0205, 'n': 12}]},
    'rear': {'flanges': [{'z': -0.0345, 'r': 0.0205, 'n': 12}, {'z': 0.0185, 'r': 0.0205, 'n': 12}]},
}

if __name__ == '__main__':
    for k in ['BB', 'HT_TOP', 'HT_BOT', 'AXLE_F', 'AXLE_TO_CROWN', 'WHEELBASE', 'SADDLE_TOP', 'ST_TOP', 'JOCKEY_U', 'JOCKEY_L', 'F_ROTOR_Z', 'R_ROTOR_Z']:
        print(k, np.round(globals()[k], 4))
    if CLM:
        print('POST_DIR', np.round(POST_DIR, 4), 'angle', round(float(np.degrees(np.arctan2(POST_DIR[1], -POST_DIR[0]))), 1))
        for y in (0.30, 0.45, 0.60, 0.735):
            t = st_at_y(y); print('ST y', y, 't', round(t, 3), np.round(st_curve(t)[0], 4))
