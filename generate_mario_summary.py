#!/usr/bin/env python3
"""Generate Mario_Project_Summary.docx at the workspace root.

Summarizes the current state of the NES-style platformer project
("Super Plumber Bros."): v0 baseline functional in HTML5 Canvas,
with two known bugs (enemy stomp collision, camera horizontal tracking).
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

OUTPUT = Path(__file__).resolve().parent / "Mario_Project_Summary.docx"


def set_cell(cell, text, bold=False, size=10):
    """Replace a table cell's text with a single styled run."""
    cell.text = ""
    run = cell.paragraphs[0].add_run(text)
    run.bold = bold
    run.font.size = Pt(size)


def add_bullets(doc, items):
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def main():
    doc = Document()

    core = doc.core_properties
    core.title = "Super Plumber Bros. - Project Status Summary"
    core.author = "Project Team"
    core.subject = "NES platformer v0 baseline status"

    # --- Title block ---
    doc.add_heading("NES Platformer Project - Status Summary", level=0)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run('"Super Plumber Bros." - v0 Baseline (HTML5 Canvas)')
    run.italic = True

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run(
        f"Date: {date.today().isoformat()}    Version: v0 (baseline)    Status: functional, 2 known bugs"
    )
    run.italic = True
    run.font.size = Pt(9)

    # --- 1. Project Overview ---
    doc.add_heading("1. Project Overview", level=1)
    doc.add_paragraph(
        "The project is a Super-Mario-Bros.-style (NES era) platformer, built from scratch in "
        "pure HTML / CSS / Canvas / JavaScript - no libraries, no build step. It ships with one "
        "fully playable level (1-1): movement, variable jump, running, Goombas, ? blocks, coins, "
        "a mushroom power-up, pipes, pits, a staircase and a flagpole."
    )
    add_bullets(
        doc,
        [
            "Fixed 60 fps timestep game logic inside requestAnimationFrame, so the game feels identical on 60Hz and 144Hz displays.",
            "Axis-separated AABB collision against the tile grid (move X, resolve, move Y, resolve) - robust, no tunneling.",
            "Variable jump via asymmetric gravity (low gravity while ascending with the button held, high gravity on release).",
            "Enemies activate when the camera nears them, matching classic NES behaviour.",
            "Rendering targets a 256x240 canvas (true NES resolution), scaled up with pixelated image-rendering for the authentic look.",
        ],
    )

    # --- 2. Current Status ---
    doc.add_heading("2. Current Status: v0 Baseline", level=1)
    p = doc.add_paragraph()
    run = p.add_run("The v0 baseline is functional in HTML5 Canvas. ")
    run.bold = True
    p.add_run(
        "The level can be played from start to finish in any modern browser, and all core systems are in place:"
    )
    add_bullets(
        doc,
        [
            "Player movement: walk, run, and variable-height jump (hold to jump higher).",
            "Tile-grid collision resolution with no tunneling.",
            "Goomba enemies with camera-proximity activation, coins and ? blocks, brick breaking.",
            "Mushroom power-up (small -> big), timer, lives, pits, and flagpole course completion.",
        ],
    )

    # --- 3. Known Bugs ---
    doc.add_heading("3. Known Bugs", level=1)
    doc.add_paragraph(
        "Two known bugs remain in the v0 baseline. Both reproduce reliably in level 1-1 and are "
        "tracked below with their suspected code locations."
    )

    table = doc.add_table(rows=3, cols=5)
    table.style = "Table Grid"

    headers = ("#", "Bug", "Symptom", "Suspected Location", "Severity")
    for col, header in enumerate(headers):
        set_cell(table.rows[0].cells[col], header, bold=True)

    rows = (
        (
            "1",
            "Enemy stomp collision detection failing",
            "When the player lands on top of a Goomba, the stomp is not registered and the player "
            "takes a hit instead of defeating the enemy.",
            "js/game.js - player-vs-enemy overlap check (~line 156): the stomp branch requires "
            "downward velocity (p.vy > 0) plus a shallow overlap (< 10 px); stomps detected late "
            "fall through to damagePlayer().",
            "High",
        ),
        (
            "2",
            "Camera horizontal tracking leaves the player behind",
            "While running, the camera does not keep up with the player, so the player drifts "
            "toward (or off) the screen edge, breaking the classic NES camera feel.",
            "js/game.js - updateCamera() (~line 202): camX snaps to player.x - VIEW_W * 0.35 "
            "with no smoothing or look-ahead.",
            "Medium",
        ),
    )
    for row_idx, row_data in enumerate(rows, start=1):
        for col, value in enumerate(row_data):
            set_cell(table.rows[row_idx].cells[col], value)

    widths = (36, 150, 200, 240, 60)
    for row in table.rows:
        for col, width in enumerate(widths):
            row.cells[col].width = Pt(width)

    # --- 4. Recommended Next Steps ---
    doc.add_heading("4. Recommended Next Steps", level=1)
    add_bullets(
        doc,
        [
            "Fix the stomp check in js/game.js (register a stomp from the player's previous-frame "
            "position relative to the enemy's top edge, rather than requiring a shallow current-frame overlap).",
            "Tune the camera tracking in updateCamera() so the player always stays within the "
            "visible viewport while running (e.g. clamped look-ahead or smoothing).",
            "Re-test level 1-1 end to end (movement, stomps, power-up, timer, flagpole) after both fixes.",
            "Then expand scope per the roadmap: more enemy types (Koopa Troopa, flyers), a second "
            "power-up (fire), more levels/world map, a proper pixel font HUD, chiptune music, and "
            "high-score persistence via localStorage.",
        ],
    )

    doc.save(OUTPUT)
    print(f"Saved: {OUTPUT}")


if __name__ == "__main__":
    main()
