---
name: Midore
description: A calendar that plans your week; the public site is a magnetic week-planner board.
colors:
  work-vermilion: "#e11d48"
  work-lip: "#a3122f"
  vermilion-deep: "#be123c"
  life-amber: "#f5a524"
  life-lip: "#b8740a"
  people-sage: "#557563"
  people-lip: "#3b5446"
  enamel: "#fcfcfa"
  enamel-sheen: "#ffffff"
  steel-light: "#f3f4f5"
  steel-shade: "#d5d9dc"
  print: "#e9e8e4"
  print-ink: "#3a3a40"
  gridline: "#e3e6e8"
  gridline-hour: "#d3d8dc"
  canvas: "#fbf8fc"
  surface: "#ffffff"
  raised: "#f6f2f7"
  line: "#e4e1e6"
  line-strong: "#ccc3d8"
  ink: "#1b1b1e"
  muted: "#4a4455"
  faint: "#7b7487"
  signin-dark: "#131314"
  signin-dark-border: "#8e918f"
  signin-dark-text: "#e3e3e3"
typography:
  display:
    fontFamily: "Archivo, sans-serif"
    fontSize: "3.9rem"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 108"
  headline:
    fontFamily: "Archivo, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 108"
  title:
    fontFamily: "Archivo, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 108"
  body-lead:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  board-day:
    fontFamily: "Archivo, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 112"
  magnet:
    fontFamily: "Archivo, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 105"
  print:
    fontFamily: "Geist, sans-serif"
    fontSize: "11px"
    fontWeight: 600
  marker:
    fontFamily: "Permanent Marker, cursive"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.15
rounded:
  print: "3px"
  control: "4px"
  magnet: "5px"
  slot: "6px"
  chip: "7px"
  tray: "10px"
  bubble: "12px"
  card: "14px"
  board: "18px"
  frame: "26px"
  dot: "999px"
spacing:
  cell: "22px"
  cell-phone: "19px"
  magnet-gap: "8px"
  frame-inset: "10px"
  board-inset: "18px"
  board-inset-wide: "26px"
  tray-gap: "16px"
  section-y: "80px"
  section-y-wide: "112px"
components:
  magnet-work:
    backgroundColor: "{colors.work-vermilion}"
    textColor: "{colors.enamel-sheen}"
    typography: "{typography.magnet}"
    rounded: "{rounded.magnet}"
    padding: "4px 7px"
  magnet-life:
    backgroundColor: "{colors.life-amber}"
    textColor: "{colors.ink}"
    typography: "{typography.magnet}"
    rounded: "{rounded.magnet}"
    padding: "4px 7px"
  magnet-people:
    backgroundColor: "{colors.people-sage}"
    textColor: "{colors.enamel-sheen}"
    typography: "{typography.magnet}"
    rounded: "{rounded.magnet}"
    padding: "4px 7px"
  meeting-print:
    backgroundColor: "{colors.print}"
    textColor: "{colors.print-ink}"
    typography: "{typography.print}"
    rounded: "{rounded.print}"
    padding: "0 7px"
  magnet-loose:
    backgroundColor: "{colors.work-vermilion}"
    textColor: "{colors.enamel-sheen}"
    rounded: "{rounded.magnet}"
    padding: "6px 10px 8px"
  board:
    backgroundColor: "{colors.enamel}"
    rounded: "{rounded.board}"
    padding: "{spacing.board-inset}"
  board-frame:
    backgroundColor: "{colors.steel-light}"
    rounded: "{rounded.frame}"
    padding: "{spacing.frame-inset}"
  button-signin-dark:
    backgroundColor: "{colors.signin-dark}"
    textColor: "{colors.signin-dark-text}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-primary:
    backgroundColor: "{colors.work-vermilion}"
    textColor: "{colors.enamel-sheen}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.vermilion-deep}"
  booking-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "28px"
  booking-slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slot}"
    padding: "8px 0"
  booking-slot-selected:
    backgroundColor: "color-mix(in srgb, #e11d48 8%, #ffffff)"
    textColor: "{colors.work-vermilion}"
---

# Design System: Midore

## Overview

**Creative North Star: "The Fridge-Door Week"**

Midore's public face is a physical object: a white enamel planner board in a brushed aluminium frame, the kind that hangs on a kitchen wall. The week is a printed half-hour grid. Meetings are part of the printing, flat and grey, and cannot be moved. Everything a person chooses to do (work, errands, rest, people) is a magnet: a thick, glossy strip with a darker lip on its bottom edge and a real shadow on the board. The page's whole argument is the difference between print and magnet.

The world is calm and domestic rather than corporate. Headlines are heavy and slightly wide, like the lettering printed on a board; notes are scrawled in dry-erase marker; the colour comes almost entirely from the magnets. Outside the board, the page goes quiet: the signed-in app's paper-white canvas, hairline rules and charcoal ink carry the section bodies, and the board's materials reappear only as small echoes (a marquee of magnets, round dot magnets as step markers, a booking card held up by one magnet). In dark mode the enamel becomes black glass and the frame darkens; the magnets keep their colours.

Motion is physical and ordered. Things snap into place with one damped overshoot, in the order they were printed, and a magnet dropped on a meeting shakes and springs back. The page rejects the category default of a tilted app screenshot floating over gradient blobs.

**Key Characteristics:**
- One framed board is the hero and the closing panel; nothing else on the page is framed.
- Three magnet colours, each meaning one kind of time: vermilion work, amber life, sage people.
- Printed meetings are flat; magnets are thick. Depth is how the eye tells fixed from movable.
- Archivo at 800 weight and 108% width for every headline; Geist for reading; Permanent Marker only for handwriting.
- Snap with one overshoot, staged in sequence; nothing drifts or scatters except the one marquee.

## Colors

Neutral enamel, aluminium and paper, with all saturation reserved for three magnet colours.

### Primary
- **Kyoto Vermilion** (`work-vermilion`): the owner's brand colour. Work magnets, the round step and card dots, the logo mark, the one accented word in the hero headline, the hero checkmarks, today's day label, the selected booking slot, and the marker note when the board refuses a move. Its lip, **Lacquer Red** (`work-lip`), is the 3px band under every work magnet. **Deep Vermilion** (`vermilion-deep`) is the primary button's hover.

### Secondary
- **Marigold** (`life-amber`): life magnets (gym, groceries, a nap), Dori's chat bubble wash (14% over surface with a 30% amber hairline), and the dashed outline of a suggestion Dori has not pinned yet. Text on it is ink, never white. Its lip is **Burnt Marigold** (`life-lip`).

### Tertiary
- **Sage** (`people-sage`): people magnets (call mum, dinner with Maya), the weekend day labels, and the dot magnet holding up the booking card. Its lip is **Deep Sage** (`people-lip`). In dark mode the weekend labels lift to a lighter sage (#8fb39c) for legibility; the magnets do not change.

### Neutral
- **Enamel** (`enamel`) and **Enamel Sheen** (`enamel-sheen`): the board's writing surface, lit by a radial sheen from the top left and one diagonal glare streak. Dark: black glass (#141416 / #1c1c20).
- **Brushed Steel** (`steel-light` to `steel-shade`): the frame's vertical gradient under fine horizontal brush lines. Dark: #34343a to #1f1f23.
- **Print Grey** (`print`) with **Print Ink** (`print-ink`): fixed meetings, printed onto the board. Dark: #26262b with #c9c9cf.
- **Grid Rule** (`gridline`) and **Hour Rule** (`gridline-hour`): half-hour and hour lines and the day dividers. Dark: #222226 / #2e2e33.
- **Canvas** (`canvas`), **Surface** (`surface`), **Raised** (`raised`): the site's shared paper tones behind the page, the Dori band, and the booking band.
- **Line** (`line`) and **Strong Line** (`line-strong`): hairline section borders, FAQ rules, the dashed step rail.
- **Charcoal Ink** (`ink`), **Muted** (`muted`), **Faint** (`faint`): headlines and strong text, body copy, tertiary text.
- **Google Dark** (`signin-dark`, `signin-dark-border`, `signin-dark-text`): the provider's own published dark sign-in button, used as the page's primary action.

### Named Rules
**The Three Kinds Rule.** A magnet is vermilion, amber or sage, and the colour always states the kind of time: work, life, people. There is no fourth magnet colour, and no magnet colour is used for decoration.

**The Printed Meeting Rule.** Fixed meetings are Print Grey with Print Ink, flat, with no kind colour. The only mark a meeting may carry is a 1.5px vermilion hairline (55% strength) and a link glyph when it was booked through Midore.

## Typography

**Display Font:** Archivo (variable width axis), with sans-serif fallback
**Body Font:** Geist, with sans-serif fallback
**Handwriting Font:** Permanent Marker, with cursive fallback

**Character:** a sturdy, slightly stretched grotesque that reads as lettering printed on equipment, against a neutral modern body face; the marker is the only human hand on the page.

### Hierarchy
- **Display** (800, 108% width, 2.75rem on phones, 3.75rem from 640px, 3.4rem at 1024px when the hero splits into two columns, 3.9rem from 1280px; line-height 0.98; -0.035em): the hero headline only, with one word in vermilion.
- **Headline** (800, 108% width, 2.25rem on phones, 3rem from 640px, 3.75rem for the two widest statements; line-height 1.02): section headings, balanced wrap.
- **Title** (800, 108% width, 1.5rem): step titles and the booking card title.
- **Body Lead** (400, 1.1875rem, line-height 1.625, muted): the one paragraph under each heading, held to about 28–32rem.
- **Body** (400, 1.0625rem, line-height 1.65): FAQ answers and step text.
- **Label** (400–500, 0.9375rem): hero checks, booking metadata, trust list.
- **Board Day** (700, 12px, 112% width, 0.04em, uppercase): day columns on the board. Today in vermilion, weekend in sage.
- **Magnet** (700, 11.5px, 105% width, line-height 1.2): text on board magnets, clamped to three lines. Tray magnets use 12px, marquee magnets 15px.
- **Print** (Geist 600, 11px): meeting titles, single line. The hour rail is Geist 500, 11px, tabular figures.
- **Marker** (400, 14–15px, line-height 1.15–1.2): the board's status note, the Sunday note (tilted -4deg), the empty tray, and handwritten captions such as "Puppy or kitten, your pick." Set at 75–78% ink, or vermilion when refusing.

### Named Rules
**The Stretched Heavy Rule.** Every heading on the landing world is Archivo 800 at 108% width with -0.035em tracking. No lighter display weights and no second display face.

**The Marker Is Handwriting Rule.** Permanent Marker is only for what a person would write on the board: notes, replies, captions. Never headings, buttons or body copy.

## Layout

The first viewport is one board inside a frame, capped at 1440px wide and inset 8px on phones, 16px from 640px and 24px from 1024px. Inside, a header row holds the logo and one small secondary button. From 1024px the board splits into the offer (left, about 41%) and the week (right, about 59%), vertically centred; below that they stack with the offer first.

The week is a 2.25rem hour rail plus seven equal columns, 9 am to 8 pm in 22 half-hour rows of `cell` height (`cell-phone` below 768px). Magnets and meetings sit inset 3px from the column edges and 2px from the row line. Below 768px the week keeps a 560px minimum width, scrolls sideways with soft masked edges, opens scrolled to the weekend, and keeps the hour rail sticky. A metal tray runs under the grid, 64px minimum, with loose magnets on the left, the marker status note in the middle and Dori at the right edge; on phones the note moves to its own line above the magnets.

Below the board, sections alternate between canvas, a surface band with hairline borders, and a raised band, each with `section-y` vertical padding (`section-y-wide` from 640px) and content held to 72rem (48rem for centred statements). The page closes on a second framed board containing only the final call to action, centred.

## Elevation & Depth

Depth is material, not interface chrome. Two physical layers carry it: the frame, which stands off the page on a long soft shadow with bevelled inner highlights, and the magnets, which are thick. Everything printed (grid, meetings, day labels) is flat on the enamel. Section bodies outside the board are flat paper; only the booking card floats, because a magnet is holding it up.

### Shadow Vocabulary
- **Frame stand-off** (`inset 1px 1px 0 rgb(255 255 255 / 0.95), inset -1px -1px 0 rgb(24 24 27 / 0.14), 0 40px 70px -40px rgb(24 24 27 / 0.45), 0 12px 24px -16px rgb(24 24 27 / 0.3)`): the board frame only.
- **Enamel recess** (`inset 0 0 0 1px rgb(24 24 27 / 0.06), inset 0 2px 6px rgb(24 24 27 / 0.06)`): the writing surface sits slightly inside the frame.
- **Magnet at rest** (`inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -3px 0 <lip>, 0 1px 1px rgb(24 24 27 / 0.12), 0 6px 12px -6px rgb(24 24 27 / 0.5)`): top highlight, coloured lip, contact shadow, cast shadow. Paired with a 22% white top gloss gradient.
- **Magnet lifted** (`... 0 18px 28px -10px rgb(24 24 27 / 0.55)`): while dragging; the magnet also tilts -2deg.
- **Dot magnet** (`inset 0 -3px 0 rgb(0 0 0 / 0.2), 0 6px 10px -5px rgb(24 24 27 / 0.55)`): round magnets, with a radial highlight at 35% 30%.
- **Card on the board** (`0 1px 0 rgb(24 24 27 / 0.04), 0 30px 50px -30px rgb(24 24 27 / 0.45)`): the booking card, rotated -1.5deg.

### Named Rules
**The Thickness Rule.** Only movable things have thickness. A magnet always carries a lip and a cast shadow; printed things never do. If an element on the board has no gloss, it cannot be dragged.

**The One Frame Rule.** The aluminium frame appears around the hero board and the closing board only. Other sections are unframed paper.

## Shapes

Radii nest outward like the physical object: printed meeting (`print`), magnet (`magnet`), booking slot (`slot`), marquee magnet (`chip`), tray (`tray`), chat bubble (`bubble`, with the speaker's corner cut to 4px), booking card (`card`), board (`board`), frame (`frame`). Controls borrowed from the app keep its tight 4px corner. Dots are full circles: step markers (2.25rem), the card's magnet (26px), the FAQ toggle (28px, rotates 45deg when open). Small tilts (-1.5 to -4deg) belong to handheld objects: the booking card, the Sunday note, a dragged magnet, marquee magnets (-2 to +2deg).

## Components

### Magnets
Thick, glossy and grabbable. The defining component of the world.
- **Shape:** gently squared strip (`magnet` radius), height set by duration in half-hour cells minus 4px.
- **Colours:** kind colour with its own lip colour as a 3px inset band at the bottom; white text on vermilion and sage, ink on amber.
- **States:** grab cursor at rest; lifted while dragging (deeper shadow, -2deg tilt, raised above other magnets); snaps to the nearest whole cell on release, settling from where it was dropped. On a meeting, another magnet, or off the board, it springs back and shakes sideways (380ms) while the note explains in vermilion marker. Focus shows a 2px ink outline offset 2px; arrow keys move it one cell.
- **Suggested (Dori):** not yet stuck, so no solid fill: a 14% wash of its colour with a 1.5px dashed burnt-marigold outline and ink text; tapping pins it.
- **Loose (tray):** the same material at 12px with 6/10/8px padding; lifts 2px and tilts on hover with a fine pointer; tapping lets the planner place it in the first free gap.

### Printed meetings
Flat grey rectangles at the `print` radius, single-line Geist 600 titles, fading in from a slight blur in sequence. Never interactive, never coloured.

### Board and frame
The brushed-steel frame with its stand-off shadow wraps the enamel board; the board carries the header, offer and week. The tray beneath the grid is a strip of the same brushed aluminium with a top highlight.

### Buttons
- **Primary sign-in:** the provider's own dark button: Google dark fill, grey border, light text, Google's typeface and logo, 48px tall, 4px corners; brightens on hover. Provider buttons follow the providers' branding rules and are never recoloured.
- **Primary (signed in):** vermilion fill, white text, 44px, deep vermilion on hover, 0.98 press scale.
- **Secondary:** surface fill with a hairline border, ink text, 36px in the board header; border darkens and a faint vermilion wash appears on hover.

### Booking card
A white card held to the page by one sage dot magnet, tilted -1.5deg. Inside: faint URL, a title in Archivo, metadata with a line icon, and a 3-column grid of time slots with hairline borders at the `slot` radius. The selected slot turns vermilion with an 8% vermilion wash; slots press to 0.97. An ink bar shows the booking action.

### Dot magnets
Round vermilion markers holding numbered steps on a dashed rail (8px dash, 6px gap, strong line colour), with Archivo 800 white numerals. The rail hides below 768px.

### Dori conversation
Two bubbles in the app's style: the visitor on raised paper (bottom-right corner cut), Dori on an amber wash with an amber hairline (bottom-left corner cut). Dori herself appears as the live puppy or kitten, never as an illustration of a phone.

### FAQ
Native disclosure rows between hairlines; questions at 1.1875rem medium ink; a round outlined plus toggle that rotates into a vermilion ×.

## Do's and Don'ts

### Do:
- **Do** map every magnet to a kind: vermilion work, amber life, sage people, each with its own lip colour.
- **Do** keep meetings flat Print Grey; mark a Midore booking only with the 55% vermilion hairline and a link glyph.
- **Do** give anything draggable the full magnet material: top gloss, 3px lip, contact and cast shadow.
- **Do** stage arrival in order: meetings print first (45ms apart), then magnets snap in (from 350ms, 50ms apart) with one overshoot (`cubic-bezier(0.34, 1.45, 0.64, 1)`).
- **Do** write the board's replies in marker: confirmations at 75% ink, refusals in vermilion.
- **Do** switch off the marquee, reveals and snap-ins under reduced motion, keeping the final layout.
- **Do** keep the board scrollable on phones with the weekend in view first and the hour rail sticky.

### Don't:
- **Don't** put an app screenshot, a device mockup or gradient blobs behind the hero; the board is the product shown working.
- **Don't** add gloss, a lip or a kind colour to a printed meeting.
- **Don't** introduce a fourth magnet colour or use magnet colours as decoration away from magnets.
- **Don't** set headings, buttons or body copy in Permanent Marker.
- **Don't** frame sections other than the hero board and the closing board.
- **Don't** recolour or restyle the Google or Microsoft sign-in buttons.
- **Don't** scatter or loop motion on the board; the one continuous motion on the page is the marquee of magnets, which pauses on hover.
