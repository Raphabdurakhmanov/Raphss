# IN BLOOM

Rose · ASCII Code Art by Raph, 2026

![IN BLOOM](images/preview.gif)

## Artist's Note

A single line of light grows into a stem, a bud forms, and slowly, petal by petal, it opens.
A rose that is never cut and never fades, drawn only with letters, numbers and symbols.

| growing | bud | in bloom |
|---|---|---|
| ![](images/01_growing.png) | ![](images/02_bud.png) | ![](images/03_bloom.png) |

## Technology

Python · NumPy · pygame-ce

## Creative Process

1. Form: the stem, leaves, sepals and a closed bud are built in 3D.
2. Growth: a travelling point of light draws the stem up, then the bud fills in.
3. Bloom: one spiral surface loosens from the bud into a full rose, outer petals first.
4. Motion: a soft sway, petals trailing behind it, dewdrops that fall and splash.
5. ASCII Rendering: the scene becomes a grid of characters, shaded by brightness.

## Technical Concepts

3D geometry and rotation · parametric spiral surfaces · perspective projection with depth ordering
Diffuse and specular lighting · particle motion with gravity · outline detection · character-based shading

## Source Code

The full Python source is free and included in this folder.

```npip install -r requirements.txt
python rose.py
```n
Space pause, R restart, S screenshot, Esc quit.
Free for personal projects. Please credit Raph if you share what you make. See LICENSE.txt.


---

Artist: Raph
© 2026 Raph. All rights reserved. Images and video in this repository may not be reused without permission.
