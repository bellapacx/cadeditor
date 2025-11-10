import * as THREE from "three";
import { SelectionManager } from "./SelectionManager";

export type SketchTool = "rectangle" | "circle";

export interface SketchOptions {
  snapToGrid?: boolean;
  gridSize?: number;
  extrudeHeight?: number;
}

export class SketchManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private selectionManager: SelectionManager;
  private plane: THREE.Plane; // XZ-plane for sketches
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private activeTool: SketchTool = "rectangle";
  private options: SketchOptions;

  private startPoint: THREE.Vector3 | null = null;
  private previewMesh: THREE.Mesh | null = null;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    selectionManager: SelectionManager,
    options?: SketchOptions
  ) {
    this.camera = camera;
    this.scene = scene;
    this.selectionManager = selectionManager;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // XZ-plane
    this.options = {
      snapToGrid: true,
      gridSize: 0.5,
      extrudeHeight: 1,
      ...options,
    };
  }

  public setTool(tool: SketchTool) {
    this.activeTool = tool;
  }

  private snapToGrid(value: number): number {
    if (!this.options.snapToGrid) return value;
    const g = this.options.gridSize!;
    return Math.round(value / g) * g;
  }

  private getPointer(event: PointerEvent, domElement: HTMLCanvasElement) {
    const rect = domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getPointOnPlane(event: PointerEvent, domElement: HTMLCanvasElement) {
    this.getPointer(event, domElement);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, point);

    point.x = this.snapToGrid(point.x);
    point.z = this.snapToGrid(point.z);
    point.y = 0;
    return point;
  }

  public onPointerDown(event: PointerEvent, domElement: HTMLCanvasElement) {
    this.startPoint = this.getPointOnPlane(event, domElement);

    if (this.previewMesh) this.scene.remove(this.previewMesh);
    const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.5,
    });
    this.previewMesh = new THREE.Mesh(geometry, material);
    this.previewMesh.position.copy(this.startPoint);
    this.scene.add(this.previewMesh);
  }

  public onPointerMove(event: PointerEvent, domElement: HTMLCanvasElement) {
    if (!this.startPoint || !this.previewMesh) return;
    const currentPoint = this.getPointOnPlane(event, domElement);

    switch (this.activeTool) {
      case "rectangle": {
        const width = Math.abs(currentPoint.x - this.startPoint.x) || 0.01;
        const depth = Math.abs(currentPoint.z - this.startPoint.z) || 0.01;
        const geometry = new THREE.BoxGeometry(width, 0.01, depth);

        this.previewMesh.geometry.dispose();
        this.previewMesh.geometry = geometry;
        this.previewMesh.position.set(
          (this.startPoint.x + currentPoint.x) / 2,
          0,
          (this.startPoint.z + currentPoint.z) / 2
        );
        break;
      }
      case "circle": {
        const radius =
          currentPoint.clone().sub(this.startPoint).length() || 0.01;
        const geometry = new THREE.CircleGeometry(radius, 32);
        geometry.rotateX(-Math.PI / 2);

        this.previewMesh.geometry.dispose();
        this.previewMesh.geometry = geometry;
        this.previewMesh.position.set(this.startPoint.x, 0, this.startPoint.z);
        break;
      }
    }
  }

  public onPointerUp() {
    if (!this.startPoint || !this.previewMesh) return;

    let shape: THREE.Shape;
    let extrudeGeom: THREE.ExtrudeGeometry;

    switch (this.activeTool) {
      case "rectangle": {
        const geom = this.previewMesh.geometry;
        if (geom instanceof THREE.BoxGeometry) {
          const w = geom.parameters.width;
          const d = geom.parameters.depth;

          shape = new THREE.Shape();
          shape.moveTo(-w / 2, -d / 2);
          shape.lineTo(-w / 2, d / 2);
          shape.lineTo(w / 2, d / 2);
          shape.lineTo(w / 2, -d / 2);
          shape.lineTo(-w / 2, -d / 2);

          extrudeGeom = new THREE.ExtrudeGeometry(shape, {
            depth: this.options.extrudeHeight,
            bevelEnabled: false,
          });
        } else return;
        break;
      }
      case "circle": {
        const geom = this.previewMesh.geometry;
        if (geom instanceof THREE.CircleGeometry) {
          shape = new THREE.Shape();
          shape.absarc(0, 0, geom.parameters.radius, 0, Math.PI * 2, false);

          extrudeGeom = new THREE.ExtrudeGeometry(shape, {
            depth: this.options.extrudeHeight,
            bevelEnabled: false,
          });
        } else return;
        break;
      }
    }

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(extrudeGeom, material);

    // Position mesh
    mesh.position.copy(this.previewMesh.position);
    mesh.position.y = this.options.extrudeHeight! / 2;

    // --- NEW: face grouping for extruded mesh ---
    mesh.userData.faceGroups = { top: [], bottom: [], sides: [] };
    const index = extrudeGeom.index?.array;
    if (index) {
      const triangleCount = index.length / 3;
      const posAttr = extrudeGeom.attributes.position;
      for (let i = 0; i < triangleCount; i++) {
        const a = index[i * 3];
        const b = index[i * 3 + 1];
        const c = index[i * 3 + 2];

        const va = new THREE.Vector3().fromBufferAttribute(posAttr, a);
        const vb = new THREE.Vector3().fromBufferAttribute(posAttr, b);
        const vc = new THREE.Vector3().fromBufferAttribute(posAttr, c);

        const normal = new THREE.Vector3()
          .subVectors(vb, va)
          .cross(new THREE.Vector3().subVectors(vc, va))
          .normalize();

        if (Math.abs(normal.y - 1) < 0.001)
          mesh.userData.faceGroups.top.push(i);
        else if (Math.abs(normal.y + 1) < 0.001)
          mesh.userData.faceGroups.bottom.push(i);
        else mesh.userData.faceGroups.sides.push(i);
      }
    }

    this.scene.add(mesh);
    this.selectionManager.add(mesh);

    this.scene.remove(this.previewMesh);
    this.previewMesh.geometry.dispose();
    this.previewMesh = null;
    this.startPoint = null;
  }
}
