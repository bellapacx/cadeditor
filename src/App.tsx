import React from "react";
import Canvas3D from "./components/Canvas3D";

import "./index.css";

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen">
      <Canvas3D />
    </div>
  );
};

export default App;
