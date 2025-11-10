import React from "react";
import Canvas3D from "./components/Canvas3D";
import Canvas3DTest from "./components/testcanvas";
import "./index.css";

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-gray-500">
      <Canvas3D />
    </div>
  );
};

export default App;
