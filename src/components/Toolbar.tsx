import React from "react";

interface ToolbarProps {
  onCreate: (type: "box" | "sphere" | "cylinder") => void;
  onSelect: () => void;
  onSketch: (tool: "rectangle" | "circle") => void;
  activeTool?:
    | "select"
    | "box"
    | "sphere"
    | "cylinder"
    | "sketch-rectangle"
    | "sketch-circle";
  snapToGrid?: boolean;
  toggleSnap?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onCreate,
  onSelect,
  onSketch,
  activeTool,
  snapToGrid,
  toggleSnap,
}) => {
  const getButtonClass = (
    tool: string,
    activeColor: string,
    defaultColor: string
  ) =>
    `px-3 py-1 rounded font-medium text-white hover:brightness-90 transition-colors duration-150 ${
      activeTool === tool ? activeColor : defaultColor
    }`;

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-3 bg-gray-50 p-4 rounded-xl shadow-xl border border-gray-200">
      <button
        className={getButtonClass("select", "bg-gray-700", "bg-gray-500")}
        onClick={onSelect}
      >
        Select
      </button>

      <div className="flex flex-col gap-2">
        <span className="text-gray-700 font-semibold text-sm">Create 3D:</span>
        <button
          className={getButtonClass("box", "bg-blue-700", "bg-blue-500")}
          onClick={() => onCreate("box")}
        >
          Box
        </button>
        <button
          className={getButtonClass("sphere", "bg-orange-700", "bg-orange-500")}
          onClick={() => onCreate("sphere")}
        >
          Sphere
        </button>
        <button
          className={getButtonClass("cylinder", "bg-green-700", "bg-green-500")}
          onClick={() => onCreate("cylinder")}
        >
          Cylinder
        </button>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <span className="text-gray-700 font-semibold text-sm">Sketch 2D:</span>
        <button
          className={getButtonClass(
            "sketch-rectangle",
            "bg-purple-700",
            "bg-purple-500"
          )}
          onClick={() => onSketch("rectangle")}
        >
          Rectangle
        </button>
        <button
          className={getButtonClass(
            "sketch-circle",
            "bg-pink-700",
            "bg-pink-500"
          )}
          onClick={() => onSketch("circle")}
        >
          Circle
        </button>

        {toggleSnap && (
          <button
            className={`px-3 py-1 mt-1 rounded font-medium text-white ${
              snapToGrid ? "bg-indigo-700" : "bg-indigo-500"
            } hover:brightness-90 transition-colors duration-150`}
            onClick={toggleSnap}
          >
            Snap to Grid: {snapToGrid ? "ON" : "OFF"}
          </button>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
