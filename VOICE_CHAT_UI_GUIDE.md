# Voice Chat Feature - Visual Guide

## UI Screenshots & Mockups

### 1. Voice Call Button in Chat Header

The voice call button appears in the chat header as a prominent purple/pink gradient button:

```
┌────────────────────────────────────────────┐
│ ← 👤 Character Name    📞 🪙 100  ⋮       │
│      Online                                 │
└────────────────────────────────────────────┘
```

**Features:**
- Purple/pink gradient background
- Phone icon
- Positioned next to coins display
- Hover animation (scale + shadow)
- Tooltip: "Start voice call"

---

### 2. Voice Chat Modal - Idle State

When user clicks the voice call button, a full-screen modal appears:

```
╔════════════════════════════════════════════╗
║                    ×                       ║
║                                           ║
║           ┌───────────────┐              ║
║           │               │              ║
║           │   Character   │   <-- Animated rings
║           │     Avatar    │              ║
║           │   (140x140)   │              ║
║           └───────────────┘              ║
║                                           ║
║          Character Name                  ║
║          Ready to call                   ║
║                                           ║
║              ┌─────┐                     ║
║              │  📞  │  <-- Green call button
║              └─────┘                     ║
║                                           ║
║  Make sure your microphone is enabled    ║
╚════════════════════════════════════════════╝
```

**Colors:**
- Background: Purple-900 to Indigo-900 gradient
- Avatar border: White/30% opacity
- Call button: Green-500 to Green-600 gradient
- Text: White with varying opacity

---

### 3. Voice Chat Modal - Connecting State

```
╔════════════════════════════════════════════╗
║                    ×                       ║
║                                           ║
║           ┌───────────────┐              ║
║         ⊙ │               │ ⊙  <-- Pulsing rings
║        ⊙  │   Character   │  ⊙          ║
║           │     Avatar    │              ║
║           │   (140x140)   │              ║
║           └───────────────┘              ║
║                                           ║
║          Character Name                  ║
║          🟡 Connecting...                ║
║                                           ║
║              Cancel                      ║
╚════════════════════════════════════════════╝
```

**Animations:**
- Multiple concentric rings pulsing outward
- Yellow indicator dot pulsing
- "Connecting..." text with loading animation

---

### 4. Voice Chat Modal - Connected State

```
╔════════════════════════════════════════════╗
║                    ×                       ║
║                                           ║
║           ┌───────────────┐              ║
║           │               │   <-- Green glow when
║           │   Character   │       character speaks
║           │     Avatar    │              ║
║           │   (140x140)   │              ║
║           └───────────────┘              ║
║                                           ║
║          Character Name                  ║
║          🟢 00:42                        ║
║                                           ║
║      ┌────────────────────────┐         ║
║      │ ● You're speaking      │  <-- User status
║      └────────────────────────┘         ║
║                                           ║
║         ┌─────┐     ┌─────┐             ║
║         │ 🔊  │     │  📞  │  <-- Mute & End call
║         └─────┘     └─────┘             ║
╚════════════════════════════════════════════╝
```

**Features:**
- Call timer showing duration (MM:SS)
- Green pulsing dot indicates active call
- Avatar has green glow + scale effect when character speaks
- User speaking indicator with green dot
- Mute button (toggles to red when muted)
- Red end call button

---

### 5. Voice Chat Modal - Character Speaking

```
╔════════════════════════════════════════════╗
║                    ×                       ║
║                                           ║
║         ┌───────────────┐                ║
║       ⊙ │               │ ⊙  <-- Green rings
║      ⊙  │   Character   │  ⊙     animated
║         │     Avatar    │                ║
║         │   (SCALED)    │  <-- 105% scale
║         └───────────────┘                ║
║         └─── GREEN GLOW ──┘              ║
║                                           ║
║          Character Name                  ║
║          🟢 01:15                        ║
║                                           ║
║      ┌────────────────────────┐         ║
║      │ ○ You're listening     │         ║
║      └────────────────────────┘         ║
║                                           ║
║         ┌─────┐     ┌─────┐             ║
║         │ 🔊  │     │  📞  │             ║
║         └─────┘     └─────┘             ║
╚════════════════════════════════════════════╝
```

**Animations when character speaks:**
- Avatar scales to 105%
- Green shadow/glow effect
- Animated concentric rings
- All animations smooth with transitions

---

## Color Scheme

### Primary Colors
- **Background Gradient**: `from-purple-900 via-purple-800 to-indigo-900`
- **Primary Accent**: Purple-500 to Pink-500
- **Success/Active**: Green-400
- **Warning/Connecting**: Yellow-400
- **Danger/End**: Red-500 to Red-600

### Text Colors
- **Primary**: White (`text-white`)
- **Secondary**: White 80% opacity (`text-white/80`)
- **Tertiary**: White 60% opacity (`text-white/60`)

### Button Colors
- **Call Start**: Green gradient with shadow
- **Call End**: Red gradient with shadow
- **Mute**: White/20% opacity (unmuted), Red-500 (muted)

---

## Animations

### 1. Pulsing Rings
```css
@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

### 2. Speaking Indicator
```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

### 3. Button Hover
```css
transition: all 0.2s ease;
hover: {
  scale: 1.05;
  shadow: xl;
}
```

---

## Responsive Design

### Desktop (>768px)
- Modal: max-width 448px (28rem)
- Avatar: 160px diameter
- Buttons: 80px (call) / 64px (mute)

### Mobile (<768px)
- Modal: Full width with padding
- Avatar: 140px diameter
- Buttons: 70px (call) / 56px (mute)

---

## Accessibility

- All interactive elements have `aria-label`
- Color contrast meets WCAG AA standards
- Keyboard navigation supported
- Screen reader friendly status updates
- Visual feedback for all state changes

---

## Technical Implementation

### Component Structure
```
VoiceChat
├── Modal Overlay (backdrop)
├── Modal Container (gradient background)
│   ├── Close Button
│   ├── Avatar Section
│   │   ├── Animated Rings (conditional)
│   │   ├── Avatar Image
│   │   └── Border (state-based color)
│   ├── Character Info
│   │   ├── Name
│   │   └── Status (with icon)
│   ├── User Status Indicator (when connected)
│   ├── Error Message (conditional)
│   └── Control Buttons
│       ├── Start Call (idle)
│       ├── Mute + End Call (connected)
│       └── Cancel (connecting/ended)
```

### State Machine
```
idle → connecting → connected → ended
  ↓                     ↓          ↓
error              ←─────┴──────────┘
```

---

## User Flow

1. **User clicks voice call button**
   - Modal opens in idle state
   - Show character avatar and name
   - Display green call button

2. **User clicks call button**
   - Request microphone permission
   - State changes to "connecting"
   - Show pulsing animations
   - Initialize audio context
   - Connect to voice API

3. **Connection established**
   - State changes to "connected"
   - Start call timer
   - Show mute and end call buttons
   - Begin audio streaming
   - Monitor user speaking status

4. **During conversation**
   - Visual feedback when user speaks
   - Animated indicators when character speaks
   - Real-time call duration
   - Mute/unmute capability

5. **Call ends**
   - User clicks end call OR
   - Connection is lost
   - State changes to "ended"
   - Clean up audio resources
   - Show "Call ended" message
   - Auto-close modal after 2 seconds

---

## Error States

### Microphone Access Denied
```
╔════════════════════════════════════════════╗
║  ⚠️ Unable to access microphone           ║
║  Please check your permissions.           ║
╚════════════════════════════════════════════╝
```

### Connection Failed
```
╔════════════════════════════════════════════╗
║  ⚠️ Connection failed                      ║
║  Please try again.                        ║
╚════════════════════════════════════════════╝
```

### API Not Configured
```
╔════════════════════════════════════════════╗
║  ⚠️ Voice chat not available              ║
║  API configuration required.              ║
╚════════════════════════════════════════════╝
```

All error messages appear in a red-tinted box with an icon, positioned below the avatar.
