# Onyx

> A modern, sleek desktop image editor built with React, Vite, and Electron.

[![Version](https://img.shields.io/badge/version-1.1.2-blue.svg)](https://github.com/unsafezer0/onyx/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Sleek Interface**: Built with modern UI paradigms. Beautiful default Dark mode with Light mode support.
- **Core Adjustments**: Tweak Brightness, Contrast, Saturation, Hue, Blur, Grayscale, Sepia, and Invert.
- **One-Click Presets**: Instantly apply beautifully crafted presets like Vintage, Cool, Warm, B&W, and Dramatic.
- **Rich Layering System**: Add unlimited text layers and image overlays. Customize fonts, colors, and styling instantly.
- **Layer Management**: Drag-and-drop layers in the properties panel to easily reposition and reorder them.
- **Smart Alignment & Snapping**: Magnetic snapping to canvas edges, center, and other layers with visual guides.
- **Auto-Save & Session Restore**: Never lose your progress. Your canvas automatically saves in the background and restores when you open Onyx.
- **Advanced Editing**: Non-destructive cropping, background replacement, and 8-handle freeform layer resizing.
- **Advanced Layer Styling**: Apply standard blending modes (Multiply, Screen, Overlay, etc.) for professional composition.
- **Performance Optimized**: Automatic background downscaling preserves aspect ratios on large 4K+ images for buttery-smooth editing.
- **Pixel-Perfect Canvas**: Smooth panning with zoom support and maximum-quality exporting (PNG, JPEG, WebP).
- **Pro Keyboard Controls**: Full undo/redo stack (Ctrl+Z/Ctrl+Y), saving (Ctrl+S), exporting (Ctrl+E), opening (Ctrl+O), and quick layer deletion (Delete/Backspace).

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build the Electron application
bun run build && bun run electron:build
```
