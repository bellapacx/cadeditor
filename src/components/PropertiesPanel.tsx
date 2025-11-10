"use client";

import React from "react";
import { Vector3, Euler } from "three";

interface PropertyPanelProps {
  title?: string;
  selection: any;
}

const formatVector = (v: Vector3 | Euler) =>
  `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;

const PropertiesPanel: React.FC<PropertyPanelProps> = ({
  title = "Properties",
  selection,
}) => {
  if (!selection) {
    return (
      <div className="p-4 bg-white shadow-md rounded-lg w-64 border border-gray-200">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-500">No selection</p>
      </div>
    );
  }

  const { type } = selection;

  return (
    <div className="p-4 bg-white shadow-lg rounded-xl w-64 border border-gray-200">
      <h3 className="text-xl font-semibold mb-4">{title}</h3>

      {/* Shape Properties */}

      <div className="space-y-2">
        <h4 className="font-medium text-gray-600">Transform</h4>
        <div>
          <span className="font-medium text-gray-700">Position:</span>
          <span className="ml-2 text-gray-800">
            {formatVector(selection.object.position)}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Rotation:</span>
          <span className="ml-2 text-gray-800">
            {formatVector(selection.object.rotation)}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Scale:</span>
          <span className="ml-2 text-gray-800">
            {formatVector(selection.object.scale)}
          </span>
        </div>
      </div>

      {/* Face Properties */}

      <div className="space-y-2">
        <h4 className="font-medium text-gray-600">Face</h4>
        <div>
          <span className="font-medium text-gray-700">Normal:</span>
          <span className="ml-2 text-gray-800">
            {selection.normal
              ? selection.normal
                  .toArray()
                  .map((n: number) => n.toFixed(2))
                  .join(", ")
              : "N/A"}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Area:</span>
          <span className="ml-2 text-gray-800">
            {selection.area ? selection.area.toFixed(3) : "N/A"}
          </span>
        </div>
      </div>

      {/* Edge Properties */}
      {type === "edge" && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-600">Edge</h4>
          <div>
            <span className="font-medium text-gray-700">Length:</span>
            <span className="ml-2 text-gray-800">
              {selection.length ? selection.length.toFixed(3) : "N/A"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;
