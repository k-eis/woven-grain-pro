Woven Grain Pro α
k-eis DESIGN FILTER 007

This prototype evolves Woven Grain from flat edge-lighting into a shallow 2.5D surface renderer.

New controls:
- STRAND PROFILE: Round / Ribbon / Beveled / Flat
- RELIEF: physical-looking height strength
- CONTACT SHADOW: crossing/concave darkening and cast-shadow strength
- SPECULAR: surface highlight response
- SURFACE BEND: large-scale sheet deformation

The original weave engine remains in place. The new stage builds a height field from the weave,
derives surface normals, then shades the existing photographic pixels. It is intentionally a 2.5D
renderer so it stays fast in a browser while producing stronger material/volume cues.

Open index.html in a modern browser.
