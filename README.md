# Raph · ASCII Code Art

Raph is a creative coder who writes artworks in Python.
Every piece is drawn only with letters, numbers and symbols.

This repository is an archive of the works and a technical portfolio:
what each piece is, why it was made, and which techniques shaped it.

## Works

| | Work | Year | Source code |
|---|---|---|---|
| ![](CAT-KNIGHT/images/03_knight.png) | [CAT KNIGHT](CAT-KNIGHT/) | 2026 | full code, in this repository |
| ![](MONEY-RAIN/images/02_rain.png) | [MONEY RAIN](MONEY-RAIN/) | 2026 | free, in this repository |
| ![](BIRTHDAY-CAKE/images/03_happy_birthday.png) | [HAPPY BIRTHDAY (Birthday Cake)](BIRTHDAY-CAKE/) | 2026 | free, in this repository |
| ![](ROSE/images/03_bloom.png) | [IN BLOOM (Rose)](ROSE/) | 2026 | free, in this repository |
| ![](DIAMOND-RING/images/02_finished.png) | [WILL YOU (Diamond Ring)](DIAMOND-RING/) | 2026 | free, in this repository |

More works will be added over time, including small standalone pieces released as free, open code.

## Live in the browser

Every work also runs on the web. The browser versions are rewritten in plain JavaScript (canvas), so they start instantly and run at full speed:

- Gallery: https://raphabdurakhmanov.github.io/Raphss/
- CAT KNIGHT: https://raphabdurakhmanov.github.io/Raphss/cat-knight/
- MONEY RAIN: https://raphabdurakhmanov.github.io/Raphss/money-rain/
- HAPPY BIRTHDAY: https://raphabdurakhmanov.github.io/Raphss/birthday-cake/
- IN BLOOM: https://raphabdurakhmanov.github.io/Raphss/rose/
- WILL YOU: https://raphabdurakhmanov.github.io/Raphss/diamond-ring/

Ready-to-host folders (Vercel, Netlify, any static hosting) are in `deploy/<name>/`.
Rebuild them after changing the code: `python js/tools/build.py`.

The JavaScript versions live in `js/<name>/app.js` with a shared renderer in `js/engine.js`.
Data that is the same every run (random seeds, cake points, Cat Knight frames) is exported from the Python
originals by `js/tools/export_*.py`, and `js/tools/compare.mjs` checks the JS frames against Python.

## Technology

Python · NumPy · pygame-ce · Pillow, and JavaScript for the web versions. Written from scratch, no 3D software or image assets.

---

© 2026 Raph. All rights reserved.
Images and videos in this repository may not be reused without permission.
