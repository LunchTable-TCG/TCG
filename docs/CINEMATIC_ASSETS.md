# Cinematic Assets

Bundled summon preview assets live under `apps/web/public/cinematics/cards/`.
They are local defaults for the match cinematic overlay and can be overridden by
setting `VITE_ASSET_CDN_BASE_URL`.

## Current Sources

- `archive-apprentice`
  - `summon.glb`: Khronos glTF Sample Assets `RiggedSimple`
  - `poster.gif`: Khronos glTF Sample Assets `RiggedSimple`
  - License: CC BY 4.0
  - Source:
    - [Model README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/RiggedSimple/README.md)
    - [GLB](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/RiggedSimple/glTF-Binary/RiggedSimple.glb)
- `ember-summoner`
  - `summon.glb`: three.js example `RobotExpressive`
  - License: CC0 1.0
  - Source:
    - [Model README](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md)
    - [GLB](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb)
- `mirror-warden`
  - `summon.glb`: Khronos glTF Sample Assets `RiggedFigure`
  - `poster.gif`: Khronos glTF Sample Assets `RiggedFigure`
  - License: CC BY 4.0
  - Source:
    - [Model README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/RiggedFigure/README.md)
    - [GLB](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/RiggedFigure/glTF-Binary/RiggedFigure.glb)
- `sky-patrol-scout`
  - `summon.glb`: Khronos glTF Sample Assets `Fox`
  - `poster.jpg`: Khronos glTF Sample Assets `Fox`
  - License:
    - Model: CC0 1.0
    - Rigging and animation: CC BY 4.0
    - glTF conversion: CC BY 4.0
  - Source:
    - [Model README](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/README.md)
    - [GLB](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb)

## Notes

- These assets are for local preview and prototype summon moments.
- Before shipping them as product content, keep attribution intact where the
  upstream license requires it and replace placeholder models with card-specific
  art direction.
