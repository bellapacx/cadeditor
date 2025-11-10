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
  const snapRef = useRef(snapToGrid);
  snapRef.current = snapToGrid;

  // --- Initialize Scene ---
  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return;

    const mount = mountRef.current; // capture current div for safe cleanup

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Lights & Grid ---
    scene.add(new THREE.GridHelper(10, 10));
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // --- Managers ---
    const selectionManager = new SelectionManager(camera, scene);
    selectionManagerRef.current = selectionManager;

    const sketchManager = new SketchManager(camera, scene, selectionManager, {
      snapToGrid: snapRef.current, // use ref to get latest value
    });
    sketchManagerRef.current = sketchManager;

    // --- Controls ---
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    orbitControlsRef.current = orbit;

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

    // --- Animate ---
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize handler ---
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mount.clientWidth / mount.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener("resize", handleResize);
      if (
        rendererRef.current &&
        mount.contains(rendererRef.current.domElement)
      ) {
        mount.removeChild(rendererRef.current.domElement); // safe removal
        rendererRef.current.dispose(); // free WebGL resources
        rendererRef.current = null;
      }
    };
  }, []); // no dependency on snapToGrid, use a ref if you need it reactive

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

  // --- Pointer helpers ---
  const getPointerPositionInWorld = (event: PointerEvent) => {
    if (!rendererRef.current || !cameraRef.current || !dragStart.current)
      return new THREE.Vector3();

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, cameraRef.current);

    // Plane perpendicular to camera through dragStart
    const planeNormal = cameraRef.current.getWorldDirection(
      new THREE.Vector3()
    );
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      dragStart.current
    );

    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    return point;
  };

  // --- Pointer handlers ---
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

        if (selected) {
          const group = selected.object.parent || selected.object;
          transformControlsRef.current?.attach(group);
        } else {
          transformControlsRef.current?.detach();
        }

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
      if (!ghostShape.current || !dragStart.current || !sceneRef.current)
        return;

      if (toolMode !== "create") return;

      const currentPos = getPointerPositionInWorld(event);
      const delta = currentPos.clone().sub(dragStart.current);

      if (selectedShapeType === "sphere") {
        const uniform = Math.max(
          Math.abs(delta.x),
          Math.abs(delta.y),
          Math.abs(delta.z),
          0.1
        );
        ghostShape.current.scale.set(uniform, uniform, uniform);
        ghostShape.current.position.copy(
          dragStart.current.clone().add(currentPos).multiplyScalar(0.5)
        );
      } else if (selectedShapeType === "cylinder") {
        const sx = Math.max(Math.abs(delta.x), 0.1);
        const sz = Math.max(Math.abs(delta.z), 0.1);
        const sy = Math.max(delta.y, 0.1); // Y scale = drag Y
        ghostShape.current.scale.set(sx, sy, sz);

        // Keep base at dragStart
        ghostShape.current.position.set(
          dragStart.current.x + delta.x / 2,
          dragStart.current.y + sy / 2,
          dragStart.current.z + delta.z / 2
        );
      } else {
        // Box: freeform
        const sx = Math.max(Math.abs(delta.x), 0.1);
        const sy = Math.max(delta.y, 0.1);
        const sz = Math.max(Math.abs(delta.z), 0.1);
        ghostShape.current.scale.set(sx, sy, sz);

        ghostShape.current.position.set(
          dragStart.current.x + delta.x / 2,
          dragStart.current.y + sy / 2,
          dragStart.current.z + delta.z / 2
        );
      }
    },
    [toolMode, selectedShapeType]
  );

  const handlePointerUp = useCallback(() => {
    if (!sceneRef.current || !ghostShape.current) return;

    if (toolMode === "create") {
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
    shape.scale.copy(ghost.scale);

    // Save reference to group for transform controls
    shape.userData.group = shape;

    return shape;
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
