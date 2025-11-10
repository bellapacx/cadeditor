// ShapeFactory.ts
import * as THREE from "three";

export type ShapeType = "box" | "sphere" | "cylinder";

export const createBox = (dims: THREE.Vector3 = new THREE.Vector3(1, 1, 1)) => {
  const geom = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geom, mat);

  const group = new THREE.Group();
  group.add(mesh);

  group.userData.mesh = mesh;
  group.userData.dimensions = dims.clone();
  group.userData.shapeType = "box"; // ✅ add this

  return group;
};
export const createSphere = (
  dims: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
) => {
  // ✅ Use average radius — ensures initial shape is always round
  const baseRadius = (dims.x + dims.y + dims.z) / 6;

  // ✅ Perfectly round geometry
  const geom = new THREE.SphereGeometry(baseRadius, 48, 32);

  // ✅ Material with visible faces and soft lighting
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    flatShading: true,
    metalness: 0.1,
    roughness: 0.6,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // ✅ Add optional visible edges
  const edgesGeom = new THREE.EdgesGeometry(geom);
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const edges = new THREE.LineSegments(edgesGeom, edgesMat);

  // ✅ Group mesh and edges together
  const group = new THREE.Group();
  group.add(mesh);
  group.add(edges);

  // ✅ Keep edge overlay aligned to mesh scale/rotation
  edges.position.copy(mesh.position);

  // ✅ Metadata
  group.userData.mesh = mesh;
  group.userData.dimensions = dims.clone();
  group.userData.shapeType = "sphere";

  return group;
};

export const createCylinder = (
  dims: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
) => {
  const geom = new THREE.CylinderGeometry(dims.x / 2, dims.x / 2, dims.y, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geom, mat);

  const group = new THREE.Group();
  group.add(mesh);

  group.userData.mesh = mesh;
  group.userData.dimensions = dims.clone();
  group.userData.shapeType = "cylinder"; // ✅ add this

  return group;
};
