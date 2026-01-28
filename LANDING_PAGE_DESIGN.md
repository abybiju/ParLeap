# Landing Page Design Documentation

**Last Updated:** January 28, 2026

## Overview

The ParLeap landing page features a modern, Superlist-inspired design with a "Deep Space Sunrise" theme, glassmorphism effects, and smooth animations throughout.

## Design System

### Theme: Deep Space Sunrise
- **Background**: `#050505` (deep black)
- **Radial Gradient**: Top-center sunrise effect (orange → red → transparent)
- **Glass Cards**: `backdrop-blur-xl`, `bg-white/5`, `border-white/10`
- **Brand Colors**: Orange (`#FF8C00`) to Red (`#FF4500`) gradients
- **Typography**: Inter font, high contrast white text

### Color Palette
- **Primary Background**: `#050505`
- **Brand Orange Start**: `rgb(255, 140, 0)` / `#FF8C00`
- **Brand Orange End**: `rgb(255, 69, 0)` / `#FF4500`
- **Text Primary**: White (`#FFFFFF`)
- **Text Secondary**: Gray-300 (`#D1D5DB`)
- **Text Muted**: Gray-400/500 (`#9CA3AF` / `#6B7280`)

## Component Structure

### 1. Header (`frontend/components/layout/Header.tsx`)
- Fixed position, glassmorphic navbar
- Height: `h-20` (80px) with top padding `pt-6` (24px) for visual spacing
- Logo + "ParLeap" text (left-aligned, flex-shrink-0)
- Navigation links (Features, Pricing, Download) positioned between logo and buttons using flex-1 justify-end
- Right actions (Sign In, Get Started button) with flex-shrink-0
- Responsive: Nav links hidden on mobile (`hidden md:flex`), logo and buttons remain visible

### 2. Hero Section (`frontend/components/landing/HeroSection.tsx`)
- **Headline**: "You speak, It flows." (two-line format)
- **Subheadline**: Typewriter animation
- **Visual**: 3D floating mockup with perspective transforms
- **CTAs**: Primary (gradient orange) + Secondary (glass button)

### 3. Problem Framing (`frontend/components/landing/ProblemFraming.tsx`)
- Three glass cards in grid
- Icons: Mic, Shield, Cloud
- Staggered entrance animations

### 4. Feature Grid (`frontend/components/landing/FeatureGrid.tsx`)
- Bento grid layout
- Large box: Real-Time Confidence Engine with live graph
- Two smaller boxes: Zero-Latency Sync, Panic Button

### 5. AI Moment (`frontend/components/landing/AIMoment.tsx`)
- Storytelling animation (waveform → orb → card)
- Split layout with explanatory text

### 6. Feature Marquee (`frontend/components/landing/FeatureMarquee.tsx`)
- Infinite horizontal scroll
- Feature tags display

### 7. LyricWall (`frontend/components/landing/LyricWall.tsx`)
- Two columns scrolling in opposite directions
- 24 worship songs
- Slow scroll speeds (90s/80s)
- Pause on hover

### 8. TestimonialWall (`frontend/components/landing/TestimonialWall.tsx`)
- Three columns with different scroll speeds
- 12 testimonials
- Group hover pause
- Card hover effects (scale, glow)

### 9. Pricing (`frontend/components/landing/Pricing.tsx`)
- Three-tier pricing cards
- Glass cards with hover glow
- Highlighted "Most Popular" badge

### 10. Footer (`frontend/components/layout/Footer.tsx`)
- Logo + tagline
- Navigation links
- Social icons
- Copyright and legal links

## Animations

### Custom Tailwind Animations
- `float`: Gentle up/down motion (6s)
- `pulse-glow`: Pulsing glow effect (2s)
- `waveform`: Animated bars (0.8s)
- `aurora`: Background position animation (15s)
- `scroll-up`: Vertical scroll up (60s/90s)
- `scroll-down`: Vertical scroll down (50s/80s)

### Framer Motion
- Entrance animations: fade-up + scale on scroll
- Staggered children animations
- Hover effects: scale, glow, border changes
- Typewriter text animation

## Responsive Design

- **Mobile**: Single column layouts, stacked sections
- **Tablet**: 2-column grids where appropriate
- **Desktop**: Full 3-column layouts, all animations active

## Assets

### Images
- `/public/logo.png` - Main logo
- `/public/hero-logo.png` - Hero section logo
- `/public/logo-mask.png` - CSS mask for video logo
- `/public/live-page-mockup.png` - 3D mockup image

### Videos
- `/public/gradient.mp4` - Gradient video for liquid logo effect

## Key Features

1. **Glassmorphism**: Consistent glass card styling throughout
2. **Hover Effects**: Standardized orange glow on hover
3. **Infinite Scrolls**: Seamless looping animations
4. **Typewriter Effect**: Engaging hero subheadline
5. **3D Effects**: Perspective transforms on mockup
6. **Smooth Animations**: Framer Motion throughout

## File Structure

```
frontend/
├── app/
│   ├── page.tsx (Main landing page)
│   ├── layout.tsx (Root layout with Header)
│   └── globals.css (Theme styles)
├── components/
│   ├── landing/
│   │   ├── HeroSection.tsx
│   │   ├── ProblemFraming.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── AIMoment.tsx
│   │   ├── FeatureMarquee.tsx
│   │   ├── LyricWall.tsx
│   │   ├── TestimonialWall.tsx
│   │   ├── Pricing.tsx
│   │   ├── ConfidenceGraph.tsx
│   │   └── WaveformAnimation.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/
│       └── TypewriterText.tsx
└── public/
    ├── logo.png
    ├── hero-logo.png
    ├── logo-mask.png
    ├── live-page-mockup.png
    └── gradient.mp4
```

## Dependencies

- `framer-motion`: ^11.0.0 (animations)
- `lucide-react`: ^0.294.0 (icons)
- `tailwindcss-animate`: ^1.0.7 (Tailwind animations)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS mask support required for video logo effect
- WebGL not required (all effects are CSS-based)
