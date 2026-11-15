"""Bike geometry (metres). x forward, y up, z lateral (+z = drive side)."""
import numpy as np

D2R = np.pi / 180

R_BEAD = 0.311            # 622 BSD / 2
TIRE_H = 0.0285           # section height of a 28 mm tyre on a wide rim
R_TIRE = R_BEAD + TIRE_H  # 0.3395
TIRE_HALF_W = 0.0149

AXLE_R = np.array([0.0, R_TIRE, 0.0])
CS = 0.410
BB_DROP = 0.072
BB = np.array([np.sqrt(CS ** 2 - BB_DROP ** 2), R_TIRE - BB_DROP, 0.0])
STACK, REACH = 0.560, 0.392
HT_TOP = BB + np.array([REACH, STACK, 0.0])
HA = 73.0 * D2R
SA = 73.5 * D2R
HT_LEN = 0.150
AX_DN = np.array([np.cos(HA), -np.sin(HA), 0.0])   # steering axis, pointing down
AX_UP = -AX_DN
AX_FW = np.array([np.sin(HA), np.cos(HA), 0.0])    # perpendicular to axis, forward
HT_BOT = HT_TOP + HT_LEN * AX_DN
ST_DIR = np.array([-np.cos(SA), np.sin(SA), 0.0])
FORK_OFFSET = 0.045

# front axle: on line HT_TOP + s*AX_DN + FORK_OFFSET*AX_FW with y = R_TIRE
_s = (HT_TOP[1] + FORK_OFFSET * AX_FW[1] - R_TIRE) / np.sin(HA)
AXLE_F = HT_TOP + _s * AX_DN + FORK_OFFSET * AX_FW
AXLE_TO_CROWN = _s - HT_LEN
WHEELBASE = AXLE_F[0] - AXLE_R[0]

SADDLE_H = 0.735
SADDLE_TOP = BB + SADDLE_H * ST_DIR
ST_LEN = 0.50
ST_TOP = BB + ST_LEN * ST_DIR

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
COGS = [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30]
COG_Z0 = 0.0605
COG_PITCH = 0.00385
COG_SEL = 4  # 15T
CRANK_LEN = 0.1725
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
