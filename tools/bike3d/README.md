# Maquette 3D du Garage (`models/velo-aero.js`)

Vélo aéro dessiné pour FTP Builder : cadre original sans marque, géométrie d'un vélo aéro taille M (empattement 99 cm, stack 56, reach 39),
dans le repère de `js/22-bike3d.js` (x vers l'avant, y vers le haut, z côté transmission, en mètres, axe arrière en 0).
Les formes sculptées (cadre, fourche, cockpit, selle, cocottes, manivelles, dérailleurs, étriers) sont des champs de distance signée
maillés par marching cubes ; les pièces mécaniques (cassette, plateaux, chaîne, disques, moyeux, pneus) sont construites directement.
Chaque objet du GLB est nommé (`Frame_Paint`, `Chain_Outer`, `RimBrake_F`, `Cassette_Cogs_11`…) : `js/22-bike3d.js` les range par composant.
L'occultation ambiante est précalculée par lancer de rayons (attribut `COLOR_0`). Jantes, rayons, stickers et couleurs sont générés dans l'app.

## Régénérer

```
pip install --break-system-packages numpy scipy scikit-image shapely mapbox_earcut trimesh fast-simplification embreex
cd tools/bike3d
FTPB_APP=1 python3 build.py 1.0 all        # → build/bike_app.glb (≈ 3 min ; sans « all », les pièces déjà maillées sont reprises du cache)
npx gltfpack -i build/bike_app.glb -o build/bike_app_m.glb -cc -kn -km -ke -vn 10 -vp 14 -vtf -kv
python3 pack_app.py build/bike_app_m.glb ../../models/velo-aero.js
```

`python3 build.py 1.0 all` (sans `FTPB_APP`) produit la version pleine définition (`build/bike.glb`, ~760 000 triangles).
Les formes se règlent dans `geom.py` (cotes), `frame.py` (cadre, fourche), `parts.py` (cockpit, selle, transmission, freins) et `mech.py`.
