import * as THREE from "three";

export type SelectableType = "shape" | "face" | "edge";

export interface Selection {
  object: THREE.Mesh;
  type: SelectableType;
  faceIndices?: number[]; // all triangles part of the logical face
  edge?: THREE.LineSegments;
  normal?: THREE.Vector3;
  area?: number;
  length?: number;
}

export class SelectionManager {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selected: Selection | null = null;
  private selectableMeshes: THREE.Mesh[] = [];

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
  }

  public add(mesh: THREE.Mesh) {
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      const geom = mesh.geometry;
      if (!geom.getAttribute("color")) {
        const count = geom.attributes.position.count;
        const colors = new Float32Array(count * 3).fill(1);
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      if (mesh.material instanceof THREE.MeshStandardMaterial)
        mesh.material.vertexColors = true;
    }

    if (!this.selectableMeshes.includes(mesh)) this.selectableMeshes.push(mesh);
  }

  public remove(mesh: THREE.Mesh) {
    this.selectableMeshes = this.selectableMeshes.filter((m) => m !== mesh);
  }

  private getPointer(event: PointerEvent, domElement: HTMLCanvasElement) {
    const rect = domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  public select(
    event: PointerEvent,
    domElement: HTMLCanvasElement,
    forcedType?: "face" | "edge"
  ) {
    if (this.selectableMeshes.length === 0) return;

    this.getPointer(event, domElement);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(
      this.selectableMeshes,
      true
    );
    if (intersects.length === 0) {
      this.clearHighlight();
      return null;
    }

    const hit = intersects[0];
    let selectionType: SelectableType = "shape";
    let faceIndices: number[] | undefined;
    let normal: THREE.Vector3 | undefined;
    let area: number | undefined;

    // SHIFT: select full shape
    if (event.shiftKey) {
      selectionType = "shape";
    }
    // FACE selection
    else if (
      forcedType === "face" ||
      (hit.faceIndex != null && forcedType !== "edge")
    ) {
      selectionType = "face";
      faceIndices = this.getFaceTriangles(
        hit.object as THREE.Mesh,
        hit.faceIndex!,
        hit.face!.normal
      );
      normal = hit.face!.normal.clone();
      area = this.computeFaceArea(hit.object as THREE.Mesh, faceIndices);
    }
    // EDGE selection
    else if (forcedType === "edge") {
      selectionType = "edge";
    }
    // Default: select face if available
    else if (hit.faceIndex != null) {
      selectionType = "face";
      faceIndices = this.getFaceTriangles(
        hit.object as THREE.Mesh,
        hit.faceIndex!,
        hit.face!.normal
      );
      normal = hit.face!.normal.clone();
      area = this.computeFaceArea(hit.object as THREE.Mesh, faceIndices);
    }

    let length: number | undefined;
    if (selectionType === "edge" && hit.object) {
      length = this.computeEdgeLength(hit.object as THREE.LineSegments);
    }

    this.highlight(hit.object as THREE.Mesh, selectionType, faceIndices);

    // return full selection info
    this.selected = {
      object: hit.object as THREE.Mesh,
      type: selectionType,
      faceIndices,
      normal,
      area,
      length,
    };

    return this.selected;
  }

  private getFaceTriangles(
    mesh: THREE.Mesh,
    clickedFaceIndex: number,
    normal: THREE.Vector3
  ) {
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom) return [clickedFaceIndex];

    const indices = geom.index ? geom.index.array : undefined;
    const pos = geom.attributes.position.array;
    const triangles: number[] = [];
    const threshold = 0.2; // ~11 degrees

    const triangleCount = indices ? indices.length / 3 : pos.length / 9;

    for (let i = 0; i < triangleCount; i++) {
      const aIdx = indices ? indices[i * 3] : i * 3;
      const bIdx = indices ? indices[i * 3 + 1] : i * 3 + 1;
      const cIdx = indices ? indices[i * 3 + 2] : i * 3 + 2;

      const a = new THREE.Vector3().fromArray(pos, aIdx * 3);
      const b = new THREE.Vector3().fromArray(pos, bIdx * 3);
      const c = new THREE.Vector3().fromArray(pos, cIdx * 3);

      const triNormal = new THREE.Triangle(a, b, c).getNormal(
        new THREE.Vector3()
      );
      if (triNormal.angleTo(normal) < threshold) triangles.push(i);
    }

    return triangles;
  }

  private computeFaceArea(mesh: THREE.Mesh, triangles?: number[]) {
    if (!triangles || triangles.length === 0) return undefined;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const pos = geom.attributes.position.array;
    const indices = geom.index ? geom.index.array : undefined;
    let area = 0;

    for (const triIdx of triangles) {
      const aIdx = indices ? indices[triIdx * 3] : triIdx * 3;
      const bIdx = indices ? indices[triIdx * 3 + 1] : triIdx * 3 + 1;
      const cIdx = indices ? indices[triIdx * 3 + 2] : triIdx * 3 + 2;

      const a = new THREE.Vector3().fromArray(pos, aIdx * 3);
      const b = new THREE.Vector3().fromArray(pos, bIdx * 3);
      const c = new THREE.Vector3().fromArray(pos, cIdx * 3);

      area += new THREE.Triangle(a, b, c).getArea();
    }

    return area;
  }

  private computeEdgeLength(edge?: THREE.LineSegments) {
    if (!edge) return undefined;
    const geom = edge.geometry as THREE.BufferGeometry;
    const pos = geom.attributes.position.array;
    let length = 0;
    for (let i = 0; i < pos.length; i += 6) {
      const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
      const b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]);
      length += a.distanceTo(b);
    }
    return length;
  }

  private highlight(
    object: THREE.Mesh,
    type: SelectableType,
    faceIndices?: number[]
  ) {
    this.clearHighlight();

    if (
      type === "shape" &&
      object.material instanceof THREE.MeshStandardMaterial
    ) {
      object.material.emissive.setHex(0x00aaff);
    }

    if (
      type === "face" &&
      object.geometry instanceof THREE.BufferGeometry &&
      faceIndices
    ) {
      const geom = object.geometry;
      const colorAttr = geom.getAttribute("color") as THREE.BufferAttribute;
      if (!colorAttr) return;

      for (const triIdx of faceIndices) {
        const idxArr = geom.index?.array;
        for (let i = 0; i < 3; i++) {
          const vertIdx = idxArr ? idxArr[triIdx * 3 + i] : triIdx * 3 + i;
          if (vertIdx < colorAttr.count) colorAttr.setXYZ(vertIdx, 1, 0.65, 0); // orange
        }
      }
      colorAttr.needsUpdate = true;
      if (object.material instanceof THREE.MeshStandardMaterial)
        object.material.vertexColors = true;
    }
  }

  public clearHighlight() {
    if (!this.selected) return;
    const sel = this.selected;

    if (
      sel.type === "shape" &&
      sel.object.material instanceof THREE.MeshStandardMaterial
    ) {
      sel.object.material.emissive.setHex(0x000000);
    }

    if (
      sel.type === "face" &&
      sel.faceIndices &&
      sel.object.geometry instanceof THREE.BufferGeometry
    ) {
      const geom = sel.object.geometry;
      const colorAttr = geom.getAttribute("color") as THREE.BufferAttribute;
      if (!colorAttr) return;

      for (const triIdx of sel.faceIndices) {
        const idxArr = geom.index?.array;
        for (let i = 0; i < 3; i++) {
          const vertIdx = idxArr ? idxArr[triIdx * 3 + i] : triIdx * 3 + i;
          if (vertIdx < colorAttr.count) colorAttr.setXYZ(vertIdx, 1, 1, 1);
        }
      }

      colorAttr.needsUpdate = true;
    }

    this.selected = null;
  }

  public getSelected(): Selection | null {
    return this.selected;
  }
}
