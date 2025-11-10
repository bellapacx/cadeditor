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
  const geom = new THREE.SphereGeometry(0.5, 32, 16); // unit sphere
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geom, mat);

  // Scale the mesh to match dims
  mesh.scale.set(dims.x, dims.y, dims.z);

  const group = new THREE.Group();
  group.add(mesh);

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
