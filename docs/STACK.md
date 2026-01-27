# Project Stack

## Overview

Single Page Application (SPA) prototype for a round smartwatch display.

## Tech Stack

- **Vanilla HTML/CSS/JavaScript** — no frameworks, no build tools

- **No server required** — open index.html from root folder directly in browser

- **Google Fonts** — Roboto Flex for typography

## Why This Stack

- Simple structure, easy for AI assistance

- No framework or build tool complexity to debug

- Just refresh the browser to see changes

- Deploys anywhere as static files
 
## Project Structure

```
sweetie/
├── index.html       # entry point (in root, links to src/)
├── design/          # Figma screen exports (PNG) for reference
├── docs/            # all project documentation
│   ├── DESIGN.md    # design specifications and screen descriptions
│   ├── STACK.md     # this file
│   └── WORKFLOW.md  # how to run and work on the project
└── src/
    ├── assets/      # images, icons used in the app
    ├── styles/
    │   ├── variables.css  # design tokens from Figma
    │   └── main.css       # main styles
    └── js/
        ├── app.js         # main application logic
        ├── utils/         # utility modules (spring physics, etc.)
        ├── components/    # reusable components (blob, graph, etc.)
        └── screens/       # individual screen modules
```
 
## SPA Approach

All screens exist within a single page. Navigation shows/hides screens without page reload. This keeps the app simple and state management straightforward.
 
## Round Display

The app targets a circular smartphone screen. The main container clips content to a circle. All UI must account for curved edges — keep interactive elements away from the perimeter.
 
## CSS Architecture

- Design tokens in `variables.css` (colors, fonts, spacing from Figma)

- Component styles in `main.css`

- No utility classes, just semantic CSS
 
## JavaScript Approach

- ES modules

- Each screen is a self-contained module

- Simple show/hide navigation

- Event delegation where practical
 