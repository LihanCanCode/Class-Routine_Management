# Tutorial System Implementation

## Overview
Interactive guided tutorial system with a demo room that automatically appears for first-time admin users, walking them through key features with hands-on examples.

## Features
✅ 11-step interactive guided tour with demo room
✅ Automatic trigger on first admin login
✅ Navigation automation (tutorial navigates to relevant pages)
✅ Demo room (DEMO-101) with pre-seeded schedules
✅ Red-flagged schedule for review demonstration
✅ Available time slot for booking demonstration
✅ Spotlight effect highlighting target elements
✅ Smooth animations and transitions
✅ Skip/Complete functionality with backend persistence
✅ Local storage + backend dual-layer persistence
✅ Tutorial reset option (backend endpoint provided)

## Demo Room Setup

### DEMO-101 Room
The tutorial uses a demo room with the following setup:
- **Room Number:** DEMO-101
- **Type:** Classroom
- **Capacity:** 60
- **Building:** Tutorial Building

### Pre-seeded Schedules
- **Monday 08:30-10:00:** Data Structures (C5S1)
- **Monday 10:00-11:30:** Database Management (C5S2)
- **Monday 11:30-13:00:** 🟢 **FREE** (Demo booking slot)
- **Monday 13:00-14:30:** Web Technologies (SW4)
- **Tuesday 08:30-10:00:** Algorithms (C4S1)
- **Tuesday 10:00-11:30:** 🔴 **FLAGGED** (ME/All - Needs Review)
- **Tuesday 13:00-14:30:** Operating Systems (C5S1)
- **Wednesday 08:30-10:00:** Computer Networks (SW5)
- **Wednesday 10:00-11:30:** 🟢 **FREE**
- **Wednesday 13:00-14:30:** Software Engineering (SW4)
- **Thursday 10:00-11:30:** Artificial Intelligence (C4S2)

## Tutorial Steps

1. **Welcome Screen** - Introduction with demo room info
2. **Upload Navigation** - Click Upload link in navbar
3. **Upload Page Guide** - Explain upload process (no actual upload needed)
4. **View Schedule Navigation** - Click View Schedule link
5. **Select Demo Room** - Guide to select DEMO-101 from dropdown
6. **Review Red Flag** - Highlight Tuesday 10:00-11:30 red cell (needs review)
7. **Book Room Navigation** - Click Book Room link
8. **Booking Form Demo** - Guide to book Monday 11:30-13:00 slot
9. **Quiz Booking Navigation** - Show quiz booking feature
10. **Quiz Schedule View** - Show quiz schedule page
11. **Completion** - Tutorial complete message

## Setup Instructions

### 1. Seed Demo Data
Before using the tutorial, seed the demo room:

```bash
cd backend
npm run seed:tutorial
```

Expected output:
```
🔗 Connected to MongoDB
✅ Created demo room: DEMO-101
✅ Created 11 demo schedules

📋 Tutorial Demo Setup:
   - Demo Room: DEMO-101
   - Red Flagged Slot: Tuesday 10:00-11:30 (needs review)
   - Available for Booking: Monday 11:30-13:00
   - Alternative Slot: Wednesday 10:00-11:30

✅ Tutorial demo data seeded successfully!
```

### 2. First Admin Login
When an admin logs in for the first time:
1. Tutorial automatically starts
2. Guides through navigation and features
3. Uses DEMO-101 for hands-on demonstration

## Components

### Frontend Components
- `TutorialContext.jsx` - State management and API integration
- `TutorialManager.jsx` - Main coordinator with navigation logic
- `TutorialOverlay.jsx` - Backdrop and spotlight effect
- `TutorialCard.jsx` - Popup card with step content
- `tutorialSteps.js` - Step configuration with demo data

### Backend Files
- `seedTutorialDemo.js` - Seeds DEMO-101 room and schedules
- `routes/auth.js` - Tutorial skip/complete/reset endpoints
- `models/User.js` - Tutorial tracking fields

### Backend Routes
- `PUT /api/auth/tutorial-skip` - Mark tutorial as skipped
- `PUT /api/auth/tutorial-complete` - Mark tutorial as completed
- `PUT /api/auth/tutorial-reset` - Reset tutorial for user

### Database Fields (User Model)
```javascript
tutorialCompleted: {
    type: Boolean,
    default: false
},
tutorialProgress: {
    currentStep: { type: Number, default: 0 },
    completedSteps: { type: [Number], default: [] },
    lastAccessed: { type: Date, default: null },
    skipped: { type: Boolean, default: false }
}
```

## Data Attributes
The following elements have `data-tutorial` attributes for targeting:
- `[data-tutorial="upload-schedule"]` - Upload nav link
- `[data-tutorial="file-upload"]` - File upload area
- `[data-tutorial="view-schedule"]` - View schedule nav link
- `[data-tutorial="book-room"]` - Book room nav link
- `[data-tutorial="booking-form"]` - Booking form container
- `[data-tutorial="quiz-booking"]` - Quiz booking nav link
- `[data-tutorial="quiz-schedule"]` - Quiz schedule nav link

## Tutorial Flow

### Interactive Navigation
The tutorial automatically navigates between pages:
- **Step 1 → 2:** Click "Take me there" → Navigates to `/upload`
- **Step 3 → 4:** Click "Show schedules" → Navigates to `/view`
- **Step 6 → 7:** Click "Let's book" → Navigates to `/book`
- **Step 8 → 9:** Click "Show me" → Navigates to `/quiz`
- **Step 9 → 10:** Click "Next" → Navigates to `/view-quiz`

### Booking Demo Details
Step 7 dynamically calculates the next Monday and shows:
```
Select room: DEMO-101
Date: Next Monday (Jan 6, 2026)
Time: 11:30-13:00
This slot is free and perfect for demo booking!
```

## Usage

### For First-Time Admins
Tutorial automatically appears after login if:
- User role is 'admin'
- `user.tutorialCompleted === false`
- Tutorial hasn't been skipped (no localStorage flag)

### Manual Reset
To reset tutorial for a user, call:
```javascript
import { resetTutorial } from '../services/api';
await resetTutorial();
```

Or via backend:
```bash
PUT /api/auth/tutorial-reset
Authorization: Bearer <token>
```

### Re-seed Demo Room
If demo room is deleted or modified:
```bash
cd backend
npm run seed:tutorial
```

Note: Script checks if DEMO-101 exists and skips if already present.

### Skipping the Tutorial
Users can click the X button on any tutorial card to skip.
This sets:
- `localStorage.tutorialSkipped = 'true'`
- Backend: `user.tutorialProgress.skipped = true`

### Completing the Tutorial
Upon reaching the final step and clicking "Finish":
- Backend: `user.tutorialCompleted = true`
- localStorage: `tutorialSkipped` removed
- Tutorial won't appear on subsequent logins

## Customization

### Adding New Steps
Edit `frontend/src/components/Tutorial/tutorialSteps.js`:

```javascript
{
    id: 11,
    title: "New Feature",
    description: "Description of the feature...",
    targetElement: "[data-tutorial='new-feature']",
    position: "bottom-right",
    highlightPulse: true,
    showWhen: "route:/new-page", // Optional
    demoData: { // Optional demo hints
        room: "DEMO-101",
        info: "Additional context"
    },
    actions: {
        next: "Got it!",
        previous: "Back"
    }
}
```

### Modifying Demo Schedules
Edit `backend/seedTutorialDemo.js` to change demo schedules:
```javascript
{
    roomNumber: 'DEMO-101',
    day: 'Friday',
    startTime: '14:30',
    endTime: '16:00',
    courseTitle: 'New Course',
    teacherInitial: 'XY',
    batch: 'C5S1',
    semester: 'Spring 2026',
    department: 'CSE',
    needsReview: false // Set true for red flag
}
```

### Positions
Available positions:
- `center` - Centered modal
- `bottom`, `top`, `left`, `right` - Relative to target
- `bottom-right`, `bottom-left` - Corner positions

### Conditional Steps
Use `showWhen` and `skipIfNotFound`:
```javascript
{
    showWhen: "route:/upload",
    skipIfNotFound: true, // Skip if not on this route
    ...
}
```

## Technical Details

### Spotlight Effect
SVG mask creates a cutout around the target element with:
- 8px padding around target
- 12px border radius
- Pulse animation on border
- 70% opacity overlay

### Position Calculation
Automatically adjusts card position to stay within viewport bounds:
- Checks if card extends beyond screen edges
- Repositions to visible area
- Updates on window resize and scroll

### Navigation Logic
TutorialManager handles automatic navigation:
- Step 1: Navigate to `/upload`
- Step 3: Navigate to `/view`
- Step 6: Navigate to `/book`
- Step 8: Navigate to `/quiz`
- Step 9: Navigate to `/view-quiz`

### Dynamic Demo Data
Booking step calculates next Monday dynamically:
```javascript
const nextMonday = new Date();
nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
```

### Persistence Flow
1. User interacts with tutorial
2. Action triggers API call to backend
3. Backend updates User model
4. localStorage updated for immediate state
5. On next login, backend state takes precedence

## Integration Checklist
- [x] User model updated with tutorial fields
- [x] TutorialContext created with state management
- [x] TutorialOverlay component with spotlight effect
- [x] TutorialCard component with positioning
- [x] TutorialManager with navigation logic
- [x] Tutorial steps configuration with 11 steps
- [x] App.jsx wrapped with TutorialProvider
- [x] Navigation links have data-tutorial attributes
- [x] Upload page has data-tutorial on file input
- [x] Booking form has data-tutorial attribute
- [x] Backend routes for skip/complete/reset
- [x] API service methods added
- [x] CSS animations added to index.css
- [x] Demo room seed script created
- [x] Package.json script for seeding

## Troubleshooting

### Tutorial Not Appearing
1. Check user.tutorialCompleted is false
2. Clear localStorage: `localStorage.removeItem('tutorialSkipped')`
3. Verify user.role is 'admin'
4. Check TutorialProvider wraps app in App.jsx

### Demo Room Not Found
1. Run seed script: `npm run seed:tutorial`
2. Check MongoDB connection
3. Verify Room and Schedule models are correct

### Red Cell Not Showing
1. Ensure DEMO-101 Tuesday 10:00-11:30 has `needsReview: true`
2. Check ViewSchedule.jsx renders red cells with `bg-red-50`
3. Re-seed if needed

### Booking Slot Not Available
1. Verify Monday 11:30-13:00 is not booked in demo data
2. Check date calculation for next Monday
3. Ensure no conflicting bookings in Booking collection

## Future Enhancements
- [ ] Tutorial progress indicator in user profile
- [ ] Restart tutorial button in user menu
- [ ] Different tutorial paths for CRs vs Admins
- [ ] Interactive click-to-continue elements
- [ ] Video/GIF demonstrations in steps
- [ ] Tooltips for individual UI elements
- [ ] Achievement badges for completion
- [ ] Tutorial analytics (completion rate, drop-off points)
- [ ] Multi-language tutorial support
- [ ] Onboarding checklist integration
