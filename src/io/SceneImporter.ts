import * as THREE from "three";
import { createBox, createSphere, createCylinder } from "../three/ShapeFactory";
import { SelectionManager } from "../three/SelectionManager";

interface ImportedObject {
  shapeType: "box" | "sphere" | "cylinder";
  position: number[];
  rotation: number[];
  scale: number[];
  color?: number;
  userData?: any;
  dimensions?: number[];
}

export class SceneImporter {
  static import(
    json: string,
    scene: THREE.Scene,
    selectionManager?: SelectionManager
  ): void {
    try {
      const data = JSON.parse(json);
      if (!data.objects || !Array.isArray(data.objects)) {
        console.error("Invalid scene data");
        return;
      }

      // --- Recreate shapes ---
      for (const objData of data.objects as ImportedObject[]) {
        const dims = objData.dimensions
          ? new THREE.Vector3().fromArray(objData.dimensions)
          : new THREE.Vector3(1, 1, 1);

        let shape: THREE.Group;
        switch (objData.shapeType) {
          case "sphere":
            shape = createSphere(dims);
            break;
          case "cylinder":
            shape = createCylinder(dims);
            break;
          default:
            shape = createBox(dims);
        }

        // Apply transform
        shape.position.fromArray(objData.position);
        shape.rotation.fromArray(objData.rotation as [number, number, number]);
        shape.scale.fromArray(objData.scale);

        // --- Mesh inside the group ---
        const mesh = shape.userData.mesh as THREE.Mesh;
        if (!mesh) {
          console.warn("❌ No mesh found for shape", shape);
        } else {
          // Tag mesh with parent group for TransformControls
          mesh.userData.shapeType = objData.shapeType;
          mesh.userData.parentGroup = shape;

          // Apply color if provided
          if (
            objData.color !== undefined &&
            mesh.material instanceof THREE.MeshStandardMaterial
          ) {
            mesh.material = mesh.material.clone();
          }

          // Register mesh in selection manager
          if (selectionManager) {
            console.log("Adding mesh to SelectionManager:", mesh);
            selectionManager.add(mesh);
          }
        }

        // Restore group userData
        shape.userData = {
          ...shape.userData,
          ...objData.userData,
          shapeType: objData.shapeType,
        };

        // Add group to scene
        scene.add(shape);
        console.log("Added shape to scene:", objData.shapeType, shape);
      }

      // Debug: list all selectable meshes
      if (selectionManager) {
        console.log(
          "Selectable meshes after import:",
          selectionManager["selectableMeshes"]
        );
      }

      console.log("✅ Scene imported successfully!");
    } catch (err) {
      console.error("❌ Failed to import scene:", err);
    }
  }
}
