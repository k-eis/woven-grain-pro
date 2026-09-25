Woven Grain Pro — True 3D Prototype v8
© 2026 k-eis studio

This build adds a lightweight WebGL/Three.js rendering engine while preserving the existing 2D engine as a fallback.

MAIN CHANGES
- Added RENDER ENGINE: 2D / 3D switch.
- 3D mode uses real cylindrical / ribbon / beveled / flat strand geometry.
- A and B become two physical strand families that cross above/below one another.
- WEAVE DEPTH controls the actual vertical separation of crossings.
- LIGHT DIRECTION controls a real directional 3D light.
- CONTACT SHADOW enables real cast/receive shadows on the receiving surface.
- RELIEF changes physical strand thickness.
- SPECULAR changes material roughness / highlight response.
- SURFACE BEND introduces subtle 3D surface undulation.
- ROUND uses a low-poly cylinder to keep mobile performance reasonable.
- The existing animation is retained; 3D animation reveals real strands progressively without rebuilding the geometry every frame.
- The existing 2D renderer remains available as a fallback.
- PNG export uses the currently selected renderer.

MOBILE
- Mobile uses a deliberately reduced strand count and lower shadow map size.
- The geometry remains genuinely 3D; quality is reduced by object count / shadow resolution rather than replacing the 3D surface with a 2D fake.

NETWORK NOTE
- Three.js is loaded from jsDelivr in the HTML. The current prototype therefore needs an internet connection when the page is first loaded unless the Three.js library is later bundled locally.

FILES
- index(1).html
- woven-grain.js
- README.txt
