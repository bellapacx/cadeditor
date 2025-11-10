import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  createBox,
  createSphere,
  createCylinder,
  ShapeType,
} from "../three/ShapeFactory";
import Toolbar from "./Toolbar";
import { SelectionManager } from "../three/SelectionManager";
import { SketchManager, SketchTool } from "../three/SketchManager";
import PropertiesPanel from "./PropertiesPanel";
import { SceneExporter } from "../io/SceneExporter";
import { SceneImporter } from "../io/SceneImporter";

type ToolMode = "select" | "create" | "sketch";

const Canvas3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [toolMode, setToolMode] = useState<ToolMode>("create");
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>("box");
  const [sketchTool, setSketchTool] = useState<SketchTool>("rectangle");
  const [snapToGrid, setSnapToGrid] = useState(true);

  const ghostShape = useRef<THREE.Group | null>(null);
  const dragStart = useRef<THREE.Vector3 | null>(null);

  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const sketchManagerRef = useRef<SketchManager | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const selectionModeRef = useRef<"shape" | "face" | "edge">("shape");
  const [selectionProperties, setSelectionProperties] = useState<any>(null);

  // --- Initialize Scene ---
  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return;
    const mount = mountRef.current; // ✅ local copy for cleanup

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.GridHelper(10, 10));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Managers
    const selectionManager = new SelectionManager(camera, scene);
    selectionManagerRef.current = selectionManager;

    const sketchManager = new SketchManager(camera, scene, selectionManager, {
      snapToGrid,
    });
    sketchManagerRef.current = sketchManager;

    // OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    orbitControlsRef.current = orbit;

    // TransformControls
    const transformControls = new TransformControls(
      camera,
      renderer.domElement
    );
    transformControlsRef.current = transformControls;
    scene.add(transformControls.getHelper());
    transformControls.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
      if (event.value && selectionManagerRef.current?.getSelected()) {
        setSelectionProperties({
          ...selectionManagerRef.current.getSelected(),
        });
      }
    });

    // Animate
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement); // ✅ safe cleanup
    };
  }, [snapToGrid]);

  // --- Keyboard controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!transformControlsRef.current) return;
      switch (e.key.toLowerCase()) {
        case "w":
          transformControlsRef.current.setMode("translate");
          break;
        case "e":
          transformControlsRef.current.setMode("rotate");
          break;
        case "r":
          transformControlsRef.current.setMode("scale");
          break;
        case "f":
          selectionModeRef.current = "face";
          break;
        case "g":
          selectionModeRef.current = "edge";
          break;
        default:
          selectionModeRef.current = "shape";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Pointer handlers (stabilized) ---
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 || !sceneRef.current || !rendererRef.current)
        return;

      if (toolMode === "select") {
        const forcedType =
          selectionModeRef.current === "face"
            ? "face"
            : selectionModeRef.current === "edge"
            ? "edge"
            : undefined;

        const selected = selectionManagerRef.current?.select(
          event,
          rendererRef.current.domElement,
          forcedType
        );

        setSelectionProperties(selected || null);

        if (selected) transformControlsRef.current?.attach(selected.object);
        else transformControlsRef.current?.detach();
        return;
      }

      if (toolMode === "create") {
        if (ghostShape.current) sceneRef.current.remove(ghostShape.current);
        const ghost = createGhostShape(selectedShapeType);
        const clickPos = getPointerPositionInWorld(event);
        ghost.position.copy(clickPos);
        ghost.scale.set(0.01, 0.01, 0.01);
        sceneRef.current.add(ghost);
        ghostShape.current = ghost;
        dragStart.current = clickPos.clone();
      }

      if (toolMode === "sketch") {
        sketchManagerRef.current?.setTool(sketchTool);
        sketchManagerRef.current?.onPointerDown(
          event,
          rendererRef.current.domElement
        );
      }
    },
    [toolMode, selectedShapeType, sketchTool]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!rendererRef.current || !sceneRef.current) return;

      if (toolMode === "create" && ghostShape.current && dragStart.current) {
        const currentPos = getPointerPositionInWorld(event);
        const delta = currentPos.clone().sub(dragStart.current);
        ghostShape.current.scale.set(
          Math.max(0.1, Math.abs(delta.x)),
          1,
          Math.max(0.1, Math.abs(delta.z))
        );
        ghostShape.current.position.set(
          dragStart.current.x + delta.x / 2,
          0.5,
          dragStart.current.z + delta.z / 2
        );
      }

      if (toolMode === "sketch") {
        sketchManagerRef.current?.onPointerMove(
          event,
          rendererRef.current.domElement
        );
      }
    },
    [toolMode]
  );

  const handlePointerUp = useCallback(() => {
    if (!sceneRef.current) return;

    if (toolMode === "create" && ghostShape.current) {
      const finalShape = createShapeFromGhost(
        ghostShape.current,
        selectedShapeType
      );
      sceneRef.current.add(finalShape);
      selectionManagerRef.current?.add(finalShape.userData.mesh);
      sceneRef.current.remove(ghostShape.current);
      ghostShape.current = null;
      dragStart.current = null;
    }

    if (toolMode === "sketch") sketchManagerRef.current?.onPointerUp();
  }, [toolMode, selectedShapeType]);

  // --- Attach pointer events ---
  useEffect(() => {
    if (!rendererRef.current) return;
    const el = rendererRef.current.domElement;

    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", preventContextMenu);
    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);

    return () => {
      el.removeEventListener("contextmenu", preventContextMenu);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // --- Helpers ---
  const createGhostShape = (type: ShapeType) => {
    const shape =
      type === "sphere"
        ? createSphere()
        : type === "cylinder"
        ? createCylinder()
        : createBox();
    const mesh = shape.userData.mesh as THREE.Mesh;
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material = mesh.material.clone();
      mesh.material.transparent = true;
      mesh.material.opacity = 0.5;
    }
    return shape;
  };

  const createShapeFromGhost = (ghost: THREE.Group, type: ShapeType) => {
    const shape =
      type === "sphere"
        ? createSphere()
        : type === "cylinder"
        ? createCylinder()
        : createBox();

    shape.position.copy(ghost.position);

    // Ensure minimum scale for spheres
    if (type === "sphere") {
      shape.scale.set(
        Math.max(ghost.scale.x, 0.1),
        Math.max(ghost.scale.y, 0.1),
        Math.max(ghost.scale.z, 0.1)
      );
    } else {
      shape.scale.copy(ghost.scale);
    }

    return shape;
  };

  const getPointerPositionInWorld = (event: PointerEvent) => {
    if (!rendererRef.current || !cameraRef.current) return new THREE.Vector3();
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    return point;
  };

  // --- Export / Import ---
  const handleExport = () => {
    if (!sceneRef.current) return;
    const json = SceneExporter.export(sceneRef.current);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sceneRef.current) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      SceneImporter.import(
        json,
        sceneRef.current!,
        selectionManagerRef.current!
      );
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute top-4 right-4">
        <PropertiesPanel selection={selectionProperties} />
      </div>
      <Toolbar
        activeTool={
          toolMode === "select"
            ? "select"
            : toolMode === "create"
            ? selectedShapeType
            : sketchTool === "rectangle"
            ? "sketch-rectangle"
            : "sketch-circle"
        }
        snapToGrid={snapToGrid}
        toggleSnap={() => setSnapToGrid((prev) => !prev)}
        onSelect={() => setToolMode("select")}
        onCreate={(type) => {
          setSelectedShapeType(type);
          setToolMode("create");
        }}
        onSketch={(tool) => {
          setSketchTool(tool);
          setToolMode("sketch");
        }}
      />
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg flex items-center gap-3">
        <button
          onClick={handleExport}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Export JSON
        </button>
        <label className="px-3 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700">
          Import JSON
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};

export default Canvas3D;
