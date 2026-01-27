# Sweetie - Diabetes Management Smartwatch App

## Overview
Sweetie is a prototype smartwatch application for people with diabetes. The goal is to simplify daily diabetes management through AI-powered assistance.

**Important:** This is a Figma-to-prototype conversion. Do NOT redesign. Match the existing designs exactly.

## Device Specifications
- Screen: 252×252px
- Shape: Round (circular display)
- Platform: Smartwatch (generic)

## Tech Stack
- Vanilla HTML/CSS/JavaScript: No frameworks, no build tools
- No server required: Open index.html from root folder directly in browser
- Google Fonts: Roboto Flex for typography
- Data: Mock/simulated data only (no backend)

## Design Tokens

Use these CSS variables throughout the project:
```css
:root {
  /* Colors - Status */
  --color-accent-panic: #ce4544;    /* Glucose critical/low */
  --color-accent-good: #6dc027;     /* Glucose normal/good */
  --color-accent-warning: #d9c508;  /* Glucose warning */

  /* Colors - Base */
  --color-background: #000000;      /* Main background */
  --color-text-color: #ffffff;      /* Primary text */
  --color-faded-text: #cccccc;      /* Secondary text */
  --color-faded-bc: #2c2c2c;        /* Faded background/cards */

  /* Colors - Components */
  --button-bg: #2c2c2c;             /* Button default */
  --button-bg-pressed: #000000;     /* Button pressed state */
  --graph-color: #ffffff;           /* Graph line */
  --badge-bg: #2c2c2c;              /* Badge background */
  --bagde-text-color: #8d8d8d;      /* Badge text */

  /* Typography */
  --text-font-size-xl: 30px;        /* Large glucose reading */
  --text-font-size-l: 18px;         /* Time and sugar display */
  --text-font-size-m: 16px;         /* Body text */
  --text-font-size-s: 13px;         /* Small text */
  --text-font-size-xs: 11px;        /* Fuzzy time and keys */
  --time-and-sugar: 18px;
  --fuzzy-time-and-keys: 11px;

  /* Spacing */
  --spacing-padding-s: 6px;
  --spacing-padding-m: 8px;
  --spacing-padding-l: 12px;
  --button-sides-spacing: 8px;
  --button-updown-spacing: 12px;
}
```

## App Structure

### Main Navigation
Three main pages accessed by vertical swipe:
```
┌─────────────┐
│   Page 1    │  Glucose (Home)
│             │
└─────────────┘
    ↕ swipe
┌─────────────┐
│   Page 2    │  AI Assistant
│             │
└─────────────┘
    ↕ swipe
┌─────────────┐
│   Page 3    │  Insulin & Sensor Tracking
│             │
└─────────────┘
```

- Swipe up: Go to next page
- Swipe down: Go to previous page

### Page 1: Glucose (Home)
**Purpose:** Show current glucose level, history graph, and allow adding context markers.

**Screens in this flow:**
| File | Description |
|------|-------------|
| `home-sugar-context-1.png` | Default home state - shows glucose level and graph |
| `home-sugar-context-2.png` | User taps button to add context |
| `home-sugar-context-3.png` | Context options displayed |
| `home-sugar-context-4.png` | User selects a context marker |
| `home-sugar-context-5.png` | Confirmation / marker added to graph |

**Interactions:**
- User taps button → triggers flow through screens 2-5
- Tap interactions (button locations shown in design assets)

### Page 2: AI Assistant
**Purpose:** Chat interface for diabetes-related questions.

**Features:**
- User can type questions
- AI provides simulated helpful responses
- Common diabetes management queries

**Screens:** (to be defined in later phase)

### Page 3: Insulin & Sensor Tracking
**Purpose:** Track insulin doses and monitor sensor status.

**Features:**
- Log insulin doses
- View sensor days remaining
- Expiration warnings

**Screens:** (to be defined in later phase)

## File Naming Convention
```
[page]-[flow]-[name]-[number].png
```

Examples:
- `home-sugar-context-1.png`
- `home-sugar-context-2.png`
- `ai-chat-question-1.png`
- `tracking-insulin-log-1.png`

## Folder Structure
```
sweetie/
├── index.html          # entry point (root, links to src/)
├── design/
│   └── screens/
│       ├── home-sugar-context-1.png
│       ├── home-sugar-context-2.png
│       ├── home-sugar-context-3.png
│       ├── home-sugar-context-4.png
│       └── home-sugar-context-5.png
├── docs/
│   ├── PROJECT-BRIEF.md
│   ├── STACK.md
│   └── FIGMASTYLES.css
└── src/
    ├── assets/         # icons, images
    ├── styles/
    │   ├── variables.css
    │   └── main.css
    └── js/
        ├── app.js
        ├── utils/
        ├── components/
        └── screens/
```

## Mock Data

### Glucose Data
```javascript
{
  current: 124,           // mg/dL
  trend: "stable",        // "rising", "falling", "stable"
  lastReading: "3 min",   // time since last reading
  history: [...]          // array for graph
}
```

### Glucose Status Logic
- `--color-accent-good`: 70-180 mg/dL (normal)
- `--color-accent-warning`: 180-250 mg/dL or 55-70 mg/dL
- `--color-accent-panic`: >250 mg/dL or <55 mg/dL

## Development Phases

### Phase 1 (Current)
- [x] Set up project with CSS variables
- [ ] Implement Page 1 glucose flow (5 screens)
- [ ] Button tap interaction to progress through flow
- [ ] Match Figma designs exactly

### Phase 2 (Later)
- [ ] Add swipe navigation between main pages
- [ ] Implement Page 2 AI assistant
- [ ] Implement Page 3 tracking

### Phase 3 (Later)
- [ ] Add animations/transitions
- [ ] Polish interactions
- [ ] Test complete flow

## Success Criteria
1. Screens match Figma designs pixel-perfectly
2. Button tap progresses through context flow
3. Swipe navigation works between pages
4. Runs smoothly in browser at 252×252px
5. Can be demonstrated on phone browser

## Notes for Claude Code
- Start with Phase 1 only
- Use design PNGs as visual reference
- Build components to match designs exactly
- Ask if any design details are unclear


## Interaction Requirements
 
This is a smartwatch prototype for desktop browser presentation. All interactions must work with mouse input.
 
### Input Mapping
 
| Smartwatch gesture | Desktop equivalent |

|-------------------|-------------------|

| Tap | Click |

| Swipe | Click and drag |

| Long press | Click and hold (500ms) |

| Scroll | Mouse wheel or click-drag |
 
### Implementation Rules
 
- Use `mousedown`, `mouseup`, `mousemove` events — not touch events

- Swipe detection: track mouse drag distance and direction

- All interactive elements must have `cursor: pointer`

- Provide visual feedback on hover (smartwatches don't have this, but desktop users expect it)

- No touch-specific features like pinch-zoom
 
### Swipe Thresholds
 
- Minimum swipe distance: 50px

- Swipe direction: determined by dominant axis (horizontal vs vertical)

- Cancel swipe if mouse leaves the display area
 
### Visual Feedback
 
- Hover states on all tappable elements

- Active/pressed states on click

- Subtle transitions (150-200ms) for state changes
 
### Prototype Context
 
This prototype demonstrates the smartwatch UI concept. It will be viewed in a desktop browser, likely projected or screen-shared. Prioritise clarity and smooth interactions over realistic device simulation.
 