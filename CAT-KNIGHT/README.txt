Cat Knight
Raph · 2026


------------------------------------------------------------
WHAT'S INSIDE
------------------------------------------------------------
  cat_knight.py           the player. Run it and the kitten knight plays in a window.
  cat_knight_frames.npz   the finished letters of all 600 frames
  requirements.txt        the two Python libraries it needs (numpy, pygame-ce)
  HOW_IT_WORKS.txt        how the artwork was made, step by step
  LICENSE.txt             terms of use

The kitten knight was drawn in letters from a photo that isn't mine,
so the photo is not included. The frames file holds the finished letters.

------------------------------------------------------------
HOW TO RUN
------------------------------------------------------------
1. Install Python 3.13 (https://www.python.org).
   Tip: a fresh virtual environment avoids clashes with an old 'pygame' install:
     python -m venv venv   then   venv\Scripts\activate   (macOS/Linux: source venv/bin/activate)
2. Open a terminal in this folder and install the libraries:

     pip install -r requirements.txt

3. Run the artwork:

     python cat_knight.py

Controls
  Space   pause / resume
  R       replay from the start
  S       save a screenshot (PNG) next to the file
  Esc     quit

It aims for 30 fps; on an everyday laptop expect around 15 to 20 fps.
On small or scaled screens the window shrinks to fit.

------------------------------------------------------------
TESTED ON
------------------------------------------------------------
  Tested:       Windows 11 + Python 3.13
  Expected to work, not tested yet:
                Python 3.10 - 3.12, macOS, Linux

------------------------------------------------------------
PLEASE NOTE
------------------------------------------------------------
- This is the artwork itself, drawn live in a window (not a video file).
- For personal projects. Please don't sell it or claim it as your own.
  See LICENSE.txt.

