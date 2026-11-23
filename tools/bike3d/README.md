# Maquettes 3D du Garage (`models/velo-aero.js`, `models/velo-clm.js`)

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

## Gabarit CLM / triathlon (`models/velo-clm.js`)

Même chaîne, choisie par `FTPB_MODEL=clm` : cadre original sans marque aux cotes d'un vélo de contre-la-montre taille M
(stack 481, reach 440, bases 420, drop 75, direction 73°, selle effective 81°, manivelles 165, empattement ≈ 1,02 m).
Tubes droits à profils d'aile tronqués (flancs plats vers la troncature : exposant arrière `nb` des profils), raccords nets :
douille-nez à longue corde, horizontal haut et étroit, diagonal en lame (corde ≈ 11 cm), tube de selle droit à 79° découpé autour de la roue,
haubans droits ; fourche dont les fourreaux droits naissent du nez de la douille (tête en « Y », arche creusée par le pneu).
Bas de cadre : voile plein entre diagonal et tube de selle (congé local à grand rayon), boîtier caréné à flancs plats, bases hautes à section carrée ;
mono plateau 54 dents à flasque plein (montage direct, manivelle sans araignée), pas de dérailleur avant (`MONO` dans `geom.py`).
Poste de pilotage intégré : potence dans le prolongement de la douille, cintre de base en aile dont les cornes filent à plat puis plongent en crochet,
leviers de frein CLM qui prolongent le crochet,
rehausses en lames et pont profilé, prolongateurs sculptés (section large et plate au pont, effilés, relevés en poignées ovales avec les
manettes au bout), coques de repose-bras galbées ; ravitaillement : bidon profilé entre les prolongateurs, bidon derrière la selle,
boîte sur le tube horizontal.
Freins à disque seulement. Cotes dans `geom.py` (bloc `CLM`), formes dans `frame_clm.py` et `parts_clm.py`.
Objets en plus de ceux du gabarit aéro : `Extensions`, `Arm_Cups`, `Arm_Pads` (cockpit), `Bottles`, `Bottle_Caps`, `Bottle_Cages`, `Bento` (ravitaillement) ;
`Hood_R/L` sont les manettes au bout des prolongateurs, `Lever_R/L` les leviers de frein du cintre de base ; `Chainring_Cover` (flasque du plateau)
remplace `Chainring_Small`, et il n'y a pas d'objet `FD`. La roue arrière lenticulaire est
générée dans l'app (`js/22-bike3d.js`, même profil que l'ombrage `disc_proxy` de `build.py`).

```
cd tools/bike3d
FTPB_MODEL=clm FTPB_APP=1 python3 build.py 1.0 all     # → build/bike_clm_app.glb (≈ 4 min)
npx gltfpack -i build/bike_clm_app.glb -o build/bike_clm_app_m.glb -cc -kn -km -ke -vn 10 -vp 14 -vtf -kv
python3 pack_app.py build/bike_clm_app_m.glb ../../models/velo-clm.js   # polices reprises de models/velo-aero.js
```
En mode CLM, les bouts de tube sont exacts (`sdf.EXACT_CAPS`) ; le gabarit aéro garde l'ancien calcul pour rester reproductible à l'identique
(`nb` absent = même exposant que l'avant : ses profils ne changent pas).
