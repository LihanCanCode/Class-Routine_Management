# CR Management System

A comprehensive Class Representative (CR) management system for university room booking, quiz scheduling, and routine management.

## Features

- **Room Booking**: Book rooms for regular classes with conflict detection
- **Quiz Room Booking**: Special quiz booking system with course selection and syllabus management
- **Schedule Management**: Upload and view PDF schedules with automatic parsing
- **User Roles**: Admin and CR (Class Representative) with role-based access
- **Bi-weekly Lab Detection**: Automatic detection and handling of bi-weekly lab sessions
- **Review System**: Automatic flagging of schedules needing manual review

## Tech Stack

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- JWT Authentication
- PDF Parsing (pdf2json)

### Frontend
- React + Vite
- TailwindCSS
- React Router
- Lucide Icons

## Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (running on localhost:27017)

### Backend Setup
```bash
cd backend
npm install
node seed.js        # Create admin account
node seedCR.js      # Create CR accounts
npm start           # Start on port 5000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev         # Start on port 5173
```

## Default Accounts

**Admin:**
- Email: admin@cse.edu
- Password: admin123

**CR Accounts (CSE and SWE for years 21-24):**
- CSE 22 CR: cse22cr@cse.edu / cse22cr
- SWE 22 CR: swe22cr@cse.edu / swe22cr
- (Similar pattern for other years)

## Features in Detail

### Quiz Booking
- Course selection based on batch
- Syllabus and teacher comment fields
- Automatic course dropdown from schedules
- Viewer access for Admin and CRs

### Schedule Parser
- Automatic room detection (Room-XXX and Lab-X)
- Bi-weekly lab detection
- Merged slot handling (100-minute classes)
- Batch code extraction with pattern fixing
- Review flag for suspicious entries

### User Management
- Separate CSE and SWE CR accounts
- Batch-based course filtering
- Role-based permissions

## Project Structure
```
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── utils/           # PDF parser utilities
│   └── uploads/         # PDF storage
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── context/     # Auth context
│   └── public/
└── README.md
```

## License
MIT
