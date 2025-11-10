# React 3D Canvas Editor

A React-based 3D canvas editor built with **Three.js** that allows you to:

- Create, select, and manipulate 3D shapes (boxes, spheres, cylinders)
- Sketch shapes directly on the canvas
- Transform shapes with **Translate / Rotate / Scale**
- Snap objects to a grid
- Export and import scenes in JSON format
- View and edit shape properties dynamically

---

## Features

### 1. **Shape Creation**

- Supports **Box**, **Sphere**, and **Cylinder**
- Interactive ghost shapes for preview before placement
- Dynamic scaling using pointer drag

### 2. **Selection & Transformation**

- Use **TransformControls** for:
  - Translate (`W`)
  - Rotate (`E`)
  - Scale (`R`)
- Selection modes:
  - Shape
  - Face (`F`)
  - Edge (`G`)

### 3. **Sketching**

- Integrated sketching tool
- Supports rectangle and circle sketches
- Snaps to grid for precise alignment

### 4. **Scene Management**

- Export the current scene as JSON
- Import JSON to restore the scene with full transform and selection support

### 5. **Properties Panel**

- Displays selected shape properties dynamically
- Updates live when transforming shapes

### 6. **Camera & Controls**

- OrbitControls for camera rotation, pan, and zoom
- Dragging shapes temporarily disables orbit controls

---

## Installation

Ensure you have a React project set up with **TypeScript** and **Three.js** installed:

```bash
npm install three @types/three
```
