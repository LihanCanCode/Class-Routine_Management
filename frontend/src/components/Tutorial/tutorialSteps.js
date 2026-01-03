export const tutorialSteps = [
    {
        id: 0,
        title: "Welcome to CR Management System! 🎉",
        description: "I'll guide you through the key features using a demo room (DEMO-101) with sample schedules. Let's get started!",
        targetElement: null,
        position: "center",
        image: null,
        actions: {
            next: "Start Tutorial",
            skip: "Skip Tutorial"
        }
    },
    {
        id: 1,
        title: "Upload Schedule PDFs",
        description: "Let's visit the Upload page where you can add new schedules by uploading PDF routines. Click here to navigate.",
        targetElement: "[data-tutorial='upload-schedule']",
        position: "bottom-right",
        highlightPulse: true,
        actions: {
            next: "Take me there",
            skip: "Skip"
        }
    },
    {
        id: 2,
        title: "Upload Your PDF Routine",
        description: "This is the upload area. You can drag & drop or click to select a PDF. The system will automatically parse all rooms and schedules. (No need to upload now - we have demo data ready!)",
        targetElement: "[data-tutorial='file-upload']",
        position: "top",
        showWhen: "route:/upload",
        highlightPulse: true,
        actions: {
            next: "Got it!",
            previous: "Back"
        }
    },
    {
        id: 3,
        title: "View Room Schedules",
        description: "Now let's check the schedules. Click here to view all room schedules including our demo room.",
        targetElement: "[data-tutorial='view-schedule']",
        position: "bottom-right",
        highlightPulse: true,
        actions: {
            next: "Show schedules",
            previous: "Back"
        }
    },
    {
        id: 4,
        title: "Select DEMO-101 Room",
        description: "Find and select 'DEMO-101' from the room list. This is our demo room with sample schedules including one that needs your review.",
        targetElement: "select",
        position: "bottom",
        showWhen: "route:/view",
        actions: {
            next: "Continue",
            previous: "Back"
        }
    },
    {
        id: 5,
        title: "Review Flagged Schedules ⚠️",
        description: "See the red highlighted cell? That's Tuesday 10:00-11:30. Red cells indicate schedules with unclear batch codes or course titles that need admin review. Click on it to edit and fix the details.",
        targetElement: ".bg-red-50",
        position: "left",
        showWhen: "route:/view",
        skipIfNotFound: true,
        actions: {
            next: "Understood",
            previous: "Back"
        }
    },
    {
        id: 6,
        title: "Book a Room",
        description: "Now let's book the demo room for an event. Click here to go to the booking page.",
        targetElement: "[data-tutorial='book-room']",
        position: "bottom-right",
        highlightPulse: true,
        actions: {
            next: "Let's book",
            previous: "Back"
        }
    },
    {
        id: 7,
        title: "Step 1: Select Date",
        description: "First, select next Monday from the calendar. This will show available rooms for that day.",
        targetElement: "[data-tutorial='select-date']",
        position: "bottom-right", // Changed from right for better visibility
        showWhen: "route:/book",
        highlightPulse: true,
        actions: {
            next: "Next",
            previous: "Back"
        }
    },
    {
        id: 8,
        title: "Step 2: Select Time Slot",
        description: "Now select the time slot 11:30-13:00. This will check which rooms are available during this time.",
        targetElement: "[data-tutorial='select-time']",
        position: "right",
        showWhen: "route:/book",
        highlightPulse: true,
        actions: {
            next: "Next",
            previous: "Back"
        }
    },
    {
        id: 9,
        title: "Step 3: Book DEMO-101",
        description: "Great! Now you'll see available rooms. Click on DEMO-101 to book it for your event. Try it now!",
        targetElement: "[data-tutorial='demo-room-card']",
        position: "left",
        showWhen: "route:/book",
        highlightPulse: true,
        skipIfNotFound: true,
        actions: {
            next: "I've booked it",
            previous: "Back"
        }
    },
    {
        id: 10,
        title: "Quiz Room Booking (For CRs)",
        description: "CRs can book quiz rooms here. Courses are filtered by batch (CSE/SWE), and you can add syllabus and teacher comments.",
        targetElement: "[data-tutorial='quiz-booking']",
        position: "bottom-right",
        highlightPulse: true,
        actions: {
            next: "Show me",
            previous: "Back"
        }
    },
    {
        id: 11,
        title: "View Quiz Schedule",
        description: "Check all quiz bookings here. Both admins and CRs can view syllabus and teacher comments for each quiz.",
        targetElement: "[data-tutorial='quiz-schedule']",
        position: "bottom-right",
        highlightPulse: true,
        actions: {
            next: "Next",
            previous: "Back"
        }
    },
    {
        id: 12,
        title: "Tutorial Complete! 🎉",
        description: "Great! You've learned all the key features. The demo room (DEMO-101) will remain for practice. Feel free to explore and experiment!",
        targetElement: null,
        position: "center",
        actions: {
            next: "Finish",
            previous: "Back"
        }
    }
];
