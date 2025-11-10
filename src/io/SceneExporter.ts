import * as THREE from "three";

interface ExportedMesh {
  uuid: string;
  shapeType: string;
  position: number[];
  rotation: number[]; // [x, y, z, order]
  scale: number[];
  materials: any[];
  userData: any;
}

interface SceneExport {
  metadata: {
    version: number;
    type: string;
    generator: string;
  };
  objects: ExportedMesh[];
}

export class SceneExporter {
  static export(scene: THREE.Scene): string {
    const objects: ExportedMesh[] = [];

    scene.traverse((child) => {
      // Skip cameras, lights, helpers
      if (
        child instanceof THREE.Camera ||
        child instanceof THREE.Light ||
        child instanceof THREE.GridHelper
      )
        return;

      if (child instanceof THREE.Group && child.userData?.shapeType) {
        const meshes = child.children.filter(
          (c) => c instanceof THREE.Mesh
        ) as THREE.Mesh[];

        meshes.forEach((mesh) => {
          const materials = Array.isArray(mesh.material)
            ? mesh.material.map((m) =>
                (m as THREE.MeshStandardMaterial).toJSON()
              )
            : [(mesh.material as THREE.MeshStandardMaterial).toJSON()];

          objects.push({
            uuid: mesh.uuid,
            shapeType: child.userData.shapeType,
            position: child.position.toArray(),
            rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
            scale: child.scale.toArray(),
            materials,
            userData: mesh.userData || {},
          });
        });
      }
    });

    const sceneData: SceneExport = {
      metadata: {
        version: 1.0,
        type: "SceneExport",
        generator: "SceneExporter",
      },
      objects,
    };

    return JSON.stringify(sceneData, null, 2);
  }
}
