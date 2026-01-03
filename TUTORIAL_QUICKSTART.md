# Tutorial Quick Start Guide

## Prerequisites
✅ MongoDB running on localhost:27017
✅ Backend server running on port 5000
✅ Frontend running on Vite dev server

## Setup (One-Time)

### 1. Seed Demo Room
```bash
cd backend
npm run seed:tutorial
```

**Expected Output:**
```
🔗 Connected to MongoDB
✅ Demo room DEMO-101 already exists (or created)
✅ Created 9 demo schedules

📋 Tutorial Demo Setup:
   - Demo Room: DEMO-101
   - Red Flagged Slot: Tuesday 10:00-11:30 (needs review)
   - Available for Booking: Monday 11:30-13:00
   - Alternative Slot: Wednesday 10:00-11:30
```

## Using the Tutorial

### For First-Time Admins

1. **Login as Admin**
   - The tutorial automatically starts on first admin login
   - If you've already logged in before, you need to reset the tutorial

2. **Tutorial Flow** (11 Steps):
   
   **Step 1: Welcome**
   - Introduction screen
   - Click "Start Tutorial"
   
   **Step 2-3: Upload Feature**
   - Automatically navigates to Upload page
   - Shows file upload area
   - No actual upload needed (demo data exists)
   
   **Step 4-5: View Schedules**
   - Navigates to View Schedule page
   - Guides to select DEMO-101 from room dropdown
   
   **Step 6: Review Red Flag**
   - Highlights Tuesday 10:00-11:30 slot (red)
   - Shows why it needs review (batch='All', course='ME')
   - Click on red cell to see edit modal
   
   **Step 7-8: Book Room**
   - Navigates to Book Room page
   - Shows booking form with demo slot details:
     - Room: DEMO-101
     - Date: Next Monday
     - Time: 11:30-13:00 (free slot)
   - You can actually book this slot to test!
   
   **Step 9-10: Quiz Features**
   - Shows quiz booking page
   - Shows quiz schedule view page
   
   **Step 11: Complete**
   - Congratulations screen
   - Tutorial marked as complete

### Skipping the Tutorial
- Click the **X** button on any tutorial card
- Tutorial won't appear on next login
- Can be reset later

### Restarting the Tutorial

**Method 1: Via API (Future - Add to UI)**
```javascript
import { resetTutorial } from './services/api';
await resetTutorial();
```

**Method 2: Via Backend**
```bash
curl -X PUT http://localhost:5000/api/auth/tutorial-reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Method 3: Clear localStorage**
```javascript
// In browser console
localStorage.removeItem('tutorialSkipped');
// Then update your user in MongoDB to set tutorialCompleted = false
```

## Demo Room Details

### DEMO-101 Schedule
| Day | Time | Course | Batch | Status |
|-----|------|--------|-------|--------|
| Monday | 08:30-10:00 | Data Structures | C5S1 | ✅ Normal |
| Monday | 10:00-11:30 | Database Management | C5S2 | ✅ Normal |
| **Monday** | **11:30-13:00** | **FREE** | - | 🟢 **Available for booking** |
| Monday | 13:00-14:30 | Web Technologies | SW4 | ✅ Normal |
| Tuesday | 08:30-10:00 | Algorithms | C4S1 | ✅ Normal |
| **Tuesday** | **10:00-11:30** | **ME** | **All** | 🔴 **Needs Review** |
| Tuesday | 13:00-14:30 | Operating Systems | C5S1 | ✅ Normal |
| Wednesday | 08:30-10:00 | Computer Networks | SW5 | ✅ Normal |
| **Wednesday** | **10:00-11:30** | **FREE** | - | 🟢 **Available** |
| Wednesday | 13:00-14:30 | Software Engineering | SW4 | ✅ Normal |
| Thursday | 10:00-11:30 | Artificial Intelligence | C4S2 | ✅ Normal |

### Why Tuesday 10:00-11:30 is Red?
- **Course:** "ME" (department code, not a course name)
- **Batch:** "All" (unclear/generic batch)
- **needsReview:** true
- **Purpose:** Demonstrate the review system for admins

## Testing the Tutorial

### As Admin:
1. Create a new admin user OR reset existing admin's tutorial
2. Login → Tutorial starts automatically
3. Follow all 11 steps
4. Try editing the red cell (Tuesday 10:00-11:30)
5. Try booking the Monday 11:30-13:00 slot

### Expected Behavior:
- ✅ Spotlight highlights target elements
- ✅ Tutorial card follows you across pages
- ✅ Navigation buttons work (Next/Previous)
- ✅ Skip button works (closes tutorial)
- ✅ Finish marks tutorial as complete
- ✅ Tutorial doesn't appear on next login

## Troubleshooting

### Tutorial not appearing?
1. Check user is admin: `user.role === 'admin'`
2. Check tutorial not completed: `user.tutorialCompleted === false`
3. Clear localStorage: `localStorage.removeItem('tutorialSkipped')`
4. Refresh page

### Demo room not found?
1. Run: `cd backend && npm run seed:tutorial`
2. Check MongoDB: `db.rooms.findOne({ roomNumber: 'DEMO-101' })`
3. Check schedules: `db.schedules.find({ roomNumber: 'DEMO-101' }).count()`

### Red cell not showing?
1. Verify schedule exists: Tuesday 10:00-11:30 with needsReview=true
2. Check ViewSchedule.jsx renders `bg-red-50` for needsReview
3. Re-seed if needed: Delete schedules and run seed script

### Booking slot not free?
1. Check no bookings exist for Monday 11:30-13:00
2. Check MongoDB bookings collection
3. Delete conflicting bookings if any

## Development Notes

### Adding More Demo Data
Edit `backend/seedTutorialDemo.js`:
```javascript
const demoSchedules = [
    {
        roomNumber: 'DEMO-101',
        day: 'Friday',
        timeSlot: { start: '08:30', end: '10:00' },
        course: 'New Course',
        teacher: 'XY',
        batch: 'C5S1',
        semester: 'Spring 2026',
        department: 'CSE',
        needsReview: false
    },
    // ... more schedules
];
```

Then run: `npm run seed:tutorial`

### Modifying Tutorial Steps
Edit `frontend/src/components/Tutorial/tutorialSteps.js`

### Changing Navigation Logic
Edit `frontend/src/components/Tutorial/TutorialManager.jsx` → `handleNext()` function

## Quick Commands

```bash
# Seed demo data
cd backend && npm run seed:tutorial

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Check demo room in MongoDB
mongosh
use room-booking
db.rooms.findOne({ roomNumber: 'DEMO-101' })
db.schedules.find({ roomNumber: 'DEMO-101' })

# Reset tutorial for a user (MongoDB)
db.users.updateOne(
  { email: 'admin@email.com' },
  { 
    $set: { 
      tutorialCompleted: false,
      'tutorialProgress.skipped': false 
    } 
  }
)
```

## Next Steps

After tutorial is complete:
1. Admin can delete or keep DEMO-101 for practice
2. Upload real PDF schedules
3. Review and fix any red-flagged schedules
4. Create bookings as needed
5. Manage quiz room bookings

---

**Questions or Issues?**
Check [TUTORIAL_SYSTEM.md](./TUTORIAL_SYSTEM.md) for detailed technical documentation.
