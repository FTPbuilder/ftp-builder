# Nageur et coach 3D de « Comprendre la séance » (`models/nageurs.js`)

Deux personnages sculptés pour FTP Builder, sans modèle tiers : le nageur (1,82 m, morphologie de nageur, bonnet orange, lunettes, jammer)
et le coach (1,79 m, t-shirt lycra, jammer, sifflet, cheveux courts). Ils sont utilisés par `js/22-swim3d.js`.

- `anatomy.py` : corps en champs de distance signée (tronc par sections, muscles en ellipsoïdes, membres en cônes arrondis, mains à doigts serrés),
  squelette de 29 os (bassin, 3 vertèbres, cou, tête, mâchoire ; clavicule, bras, avant-bras, main, 2 phalanges, pouce ; cuisse, jambe, pied, orteils).
  Repère : y vers le haut, z vers l'avant, x vers la gauche du personnage, en mètres, pieds au sol ; pose de référence en T, rotations neutres.
- `build.py` : maillage (noyau `../bike3d/sdf.py`), tenues et cheveux en coques ajustées (décalées de la peau, lissées, bord replié), peau cachée retirée,
  yeux, lunettes, sifflet et cordon, pull-buoy et plaquettes (objets rigides rattachés à leur os), poids de skinning (os les plus proches, mélange limité
  aux os voisins), teintes de peau et occultation ambiante précalculée (couleurs de sommets), GLB avec squelette.
- `pack_app.py` : GLB compressé → `models/nageurs.js` (base64, script classique).
- `view.mjs`, `shot.mjs`, `flow.mjs`, `sim.mjs` : aperçus pour le développement (GLB seul, scène de l'app, parcours complet, séance en accéléré).

## Régénérer

```
pip install --break-system-packages numpy scipy scikit-image fast-simplification trimesh embreex
cd tools/swim3d
python3 build.py                                   # → build/nageurs.glb (≈ 1 min)
npx gltfpack -i build/nageurs.glb -o build/nageurs_m.glb -cc -kn -km -ke -vp 14 -vn 10 -vc 8
python3 pack_app.py build/nageurs_m.glb ../../models/nageurs.js
```

gltfpack renomme les maillages : l'app retrouve chaque pièce par le nom de son nœud (`N_corps`, `N_cap`, `C_shirt`, `N_pull_buoy`…).
Les animations (nage, éducatifs, plongeon, virages, gestes du coach) sont calculées dans l'app par cinématique inverse, pas stockées dans le GLB.
