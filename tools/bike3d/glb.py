"""Minimal glTF 2.0 binary writer with node hierarchy, PBR materials, normals, uvs."""
import json, struct
import numpy as np


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.bufferViews, self.accessors, self.meshes, self.nodes, self.materials = [], [], [], [], []
        self.mat_index = {}
        self.root_children = []

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            bv['target'] = target
        self.bufferViews.append(bv)
        return len(self.bufferViews) - 1

    def _acc(self, arr, kind, target, minmax=False):
        arr = np.ascontiguousarray(arr)
        if arr.dtype == np.float32:
            ct = 5126
        elif arr.dtype == np.uint32:
            ct = 5125
        elif arr.dtype == np.uint16:
            ct = 5123
        else:
            raise ValueError(arr.dtype)
        v = self._view(arr.tobytes(), target)
        a = {'bufferView': v, 'componentType': ct, 'count': int(arr.shape[0]) if kind != 'SCALAR' else int(arr.size), 'type': kind}
        if minmax:
            a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.accessors.append(a)
        return len(self.accessors) - 1

    def material(self, name, color=(0.5, 0.5, 0.5, 1.0), metallic=0.0, roughness=0.5, double=False, extras=None):
        if name in self.mat_index:
            return self.mat_index[name]
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': list(map(float, color)), 'metallicFactor': float(metallic), 'roughnessFactor': float(roughness)}}
        if double:
            m['doubleSided'] = True
        if extras:
            m['extras'] = extras
        self.materials.append(m)
        self.mat_index[name] = len(self.materials) - 1
        return self.mat_index[name]

    def mesh(self, name, V, Fc, N=None, UV=None, mat=None, C=None):
        V = np.asarray(V, np.float32); Fc = np.asarray(Fc, np.uint32).reshape(-1)
        attrs = {'POSITION': self._acc(V, 'VEC3', 34962, True)}
        if N is not None:
            N = np.asarray(N, np.float32)
            N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
            attrs['NORMAL'] = self._acc(N.astype(np.float32), 'VEC3', 34962)
        if UV is not None:
            attrs['TEXCOORD_0'] = self._acc(np.asarray(UV, np.float32), 'VEC2', 34962)
        if C is not None:
            c8 = np.clip(np.asarray(C, np.float64) * 255 + 0.5, 0, 255).astype(np.uint8)
            if c8.ndim == 1:
                c8 = np.stack([c8, c8, c8, np.full_like(c8, 255)], 1)
            v = self._view(np.ascontiguousarray(c8).tobytes(), 34962)
            self.accessors.append({'bufferView': v, 'componentType': 5121, 'normalized': True, 'count': int(c8.shape[0]), 'type': 'VEC4'})
            attrs['COLOR_0'] = len(self.accessors) - 1
        idx = Fc.astype(np.uint16) if V.shape[0] < 65536 else Fc.astype(np.uint32)
        prim = {'attributes': attrs, 'indices': self._acc(idx, 'SCALAR', 34963)}
        if mat is not None:
            prim['material'] = mat
        self.meshes.append({'name': name, 'primitives': [prim]})
        return len(self.meshes) - 1

    def node(self, name, mesh=None, children=None, translation=None, rotation=None, extras=None, parent=None):
        n = {'name': name}
        if mesh is not None:
            n['mesh'] = mesh
        if translation is not None:
            n['translation'] = [float(x) for x in translation]
        if rotation is not None:
            n['rotation'] = [float(x) for x in rotation]
        if extras:
            n['extras'] = extras
        self.nodes.append(n)
        i = len(self.nodes) - 1
        if parent is None:
            self.root_children.append(i)
        else:
            self.nodes[parent].setdefault('children', []).append(i)
        return i

    def save(self, path, extras=None):
        gl = {'asset': {'version': '2.0', 'generator': 'ftp-builder bike generator'},
              'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': self.root_children}],
              'nodes': self.nodes, 'meshes': self.meshes, 'materials': self.materials,
              'accessors': self.accessors, 'bufferViews': self.bufferViews,
              'buffers': [{'byteLength': len(self.bin)}]}
        if extras:
            gl['scenes'][0]['extras'] = extras
        js = json.dumps(gl, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        while len(self.bin) % 4:
            self.bin.append(0)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(self.bin)
        return total
