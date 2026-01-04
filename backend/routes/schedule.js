const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const Schedule = require('../models/Schedule');
const SemesterSchedule = require('../models/SemesterSchedule');
const SchedulePDF = require('../models/SchedulePDF');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { parsePDFSchedule } = require('../utils/pdfParser');
const { parseSemesterPDF } = require('../utils/pdfPageParser');
const auth = require('../middleware/auth');
const { adminOnly, authOrGuest } = require('../middleware/auth');

// ============================================================================
// WEEK UTILITY FUNCTIONS
// ============================================================================

// Get the start of week (Sunday) for a given date
const getWeekStartDate = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Subtract days to get to Sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0); // Reset to midnight
    return weekStart;
};

// Get week offset from current week (0 = this week, 1 = next week, etc.)
const getWeekByOffset = (offset = 0) => {
    const today = new Date();
    const weekStart = getWeekStartDate(today);
    weekStart.setDate(weekStart.getDate() + (offset * 7));
    return weekStart;
};

// Check if a date is within allowed range (current week + 8 weeks)
const isWithinAllowedWeekRange = (weekStartDate) => {
    const currentWeekStart = getWeekStartDate(new Date());
    const maxWeekStart = getWeekByOffset(8);
    const checkDate = new Date(weekStartDate);
    return checkDate >= currentWeekStart && checkDate <= maxWeekStart;
};

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `schedule-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload and parse PDF schedule
router.post('/upload', auth, adminOnly, upload.single('schedule'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const pdfPath = req.file.path;
        const department = req.user.department; // Get department from authenticated user

        // Parse the PDF
        const { schedules, rooms, rawText } = await parsePDFSchedule(pdfPath);

        // Add department to all schedules
        const schedulesWithDept = schedules.map(schedule => ({
            ...schedule,
            department
        }));

        // Clear existing schedules for this department (optional)
        const clearExisting = req.body.clearExisting === 'true';
        if (clearExisting) {
            await Schedule.deleteMany({ department });
        }

        // Save rooms to database
        const roomDocs = rooms.map(roomNumber => ({
            roomNumber,
            building: 'Main Building',
            capacity: 40
        }));

        if (roomDocs.length > 0) {
            await Room.bulkWrite(
                roomDocs.map(room => ({
                    updateOne: {
                        filter: { roomNumber: room.roomNumber },
                        update: room,
                        upsert: true
                    }
                }))
            );
        }

        // Save schedules to database
        if (schedulesWithDept.length > 0) {
            await Schedule.insertMany(schedulesWithDept, { ordered: false })
                .catch(err => {
                    // Ignore duplicate key errors if any
                    if (err.code !== 11000) throw err;
                });
        }

        res.json({
            success: true,
            message: 'Schedule uploaded and parsed successfully',
            department,
            stats: {
                roomsFound: rooms.length,
                schedulesCreated: schedulesWithDept.length
            },
            schedules: schedulesWithDept,
            rawText: rawText.substring(0, 500) // Send first 500 chars for debugging
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Failed to process schedule',
            details: error.message
        });
    }
});

// Get all schedules
router.get('/', async (req, res) => {
    try {
        const { day, roomNumber } = req.query;

        const filter = { semesterPageNumber: null }; // Only room-wise schedules
        if (day) filter.day = day;
        if (roomNumber) filter.roomNumber = roomNumber;

        const schedules = await Schedule.find(filter).sort({ day: 1, 'timeSlot.start': 1, subSlotIndex: 1 });

        // Merge sub-slots: Group by unique (roomNumber, day, timeSlot.start) and return all sub-slots
        const mergedSchedules = [];
        const slotMap = new Map();

        schedules.forEach(schedule => {
            const key = `${schedule.roomNumber}-${schedule.day}-${schedule.timeSlot.start}-${schedule.subSlotIndex}`;
            if (!slotMap.has(key)) {
                slotMap.set(key, schedule);
                mergedSchedules.push(schedule);
            }
        });

        res.json({
            success: true,
            count: mergedSchedules.length,
            schedules: mergedSchedules
        });
    } catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// @route   GET /api/schedule/rooms
// @desc    Get all rooms
// @access  Public
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.find({}).sort({ roomNumber: 1 });
        res.json({
            success: true,
            rooms: rooms.map(r => r.roomNumber)
        });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

// Get room availability for a specific date and time
router.get('/availability', async (req, res) => {
    try {
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required parameters: date, startTime, endTime'
            });
        }

        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

        // Get all rooms
        const allRooms = await Room.find({});

        // Get schedules for this day and time slot
        const schedules = await Schedule.find({
            day: dayOfWeek,
            $or: [
                {
                    'timeSlot.start': { $lte: startTime },
                    'timeSlot.end': { $gt: startTime }
                },
                {
                    'timeSlot.start': { $lt: endTime },
                    'timeSlot.end': { $gte: endTime }
                },
                {
                    'timeSlot.start': { $gte: startTime },
                    'timeSlot.end': { $lte: endTime }
                }
            ]
        });

        // Get bookings for this specific date range
        // We match bookings that are on the same calendar day
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await Booking.find({
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            status: { $ne: 'cancelled' },
            $or: [
                {
                    'timeSlot.start': { $lte: startTime },
                    'timeSlot.end': { $gt: startTime }
                },
                {
                    'timeSlot.start': { $lt: endTime },
                    'timeSlot.end': { $gte: endTime }
                },
                {
                    'timeSlot.start': { $gte: startTime },
                    'timeSlot.end': { $lte: endTime }
                }
            ]
        });

        // Find occupied rooms
        const occupiedRoomNumbers = new Set([
            ...schedules.map(s => s.roomNumber.trim()),
            ...bookings.map(b => b.roomNumber.trim())
        ]);

        // Categorize rooms
        const availableRooms = allRooms.filter(room => {
            const normalizedRoom = room.roomNumber.trim();
            return !occupiedRoomNumbers.has(normalizedRoom);
        });

        // Use Maps to de-duplicate by roomNumber
        const scheduleMap = new Map();
        schedules.forEach(s => {
            if (!scheduleMap.has(s.roomNumber)) {
                scheduleMap.set(s.roomNumber, {
                    roomNumber: s.roomNumber,
                    course: s.course,
                    batch: s.batch,
                    reason: 'scheduled_class'
                });
            }
        });

        const bookingMap = new Map();
        bookings.forEach(b => {
            if (!bookingMap.has(b.roomNumber)) {
                bookingMap.set(b.roomNumber, {
                    roomNumber: b.roomNumber,
                    batch: b.batch,
                    purpose: b.purpose,
                    bookedBy: b.bookedBy?.name,
                    reason: 'booked'
                });
            }
        });

        const occupiedBySchedule = Array.from(scheduleMap.values());
        const occupiedByBooking = Array.from(bookingMap.values());

        res.json({
            success: true,
            date,
            day: dayOfWeek,
            timeSlot: { start: startTime, end: endTime },
            available: availableRooms,
            occupied: [...occupiedBySchedule, ...occupiedByBooking],
            statusDetails: {
                occupiedBySchedule,
                occupiedByBooking
            },
            summary: {
                totalRooms: allRooms.length,
                available: availableRooms.length,
                occupied: occupiedRoomNumbers.size
            }
        });

    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({ error: 'Failed to check availability' });
    }
});

// Delete all schedules (for testing/reset)
router.delete('/clear', auth, adminOnly, async (req, res) => {
    try {
        await Schedule.deleteMany({});
        await Room.deleteMany({});
        res.json({ success: true, message: 'All schedules and rooms cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear schedules' });
    }
});

// Create a new schedule entry manually
router.post('/manual', auth, adminOnly, async (req, res) => {
    try {
        const { roomNumber, day, timeSlot, course, courseNickname, batch, teacher, subSlotIndex } = req.body;
        const department = req.user.department;

        if (!roomNumber || !day || !timeSlot?.start || !timeSlot?.end) {
            return res.status(400).json({
                error: 'Missing required fields: roomNumber, day, timeSlot.start, timeSlot.end'
            });
        }

        // Find existing slots to determine totalSubSlots
        const existingSlots = await Schedule.find({
            roomNumber,
            day,
            'timeSlot.start': timeSlot.start,
            semesterPageNumber: null
        });

        const totalSubSlots = existingSlots.length > 0 ? existingSlots[0].totalSubSlots : 1;
        const targetSubSlotIndex = subSlotIndex !== undefined ? subSlotIndex : 0;

        // Check if this specific sub-slot already has data
        const existing = await Schedule.findOne({
            roomNumber,
            day,
            'timeSlot.start': timeSlot.start,
            subSlotIndex: targetSubSlotIndex,
            semesterPageNumber: null
        });

        if (existing) {
            return res.status(400).json({
                error: 'A schedule already exists for this sub-slot. Use update instead.'
            });
        }

        const newSchedule = new Schedule({
            roomNumber,
            day,
            timeSlot,
            course: course || '',
            courseNickname: courseNickname || '',
            batch: batch || 'All',
            teacher: teacher || '',
            department,
            subSlotIndex: targetSubSlotIndex,
            totalSubSlots,
            rawContent: `${course || ''} ${batch || ''}`.trim()
        });

        await newSchedule.save();

        // Ensure room exists
        await Room.updateOne(
            { roomNumber },
            { $setOnInsert: { roomNumber, building: 'Main Building', capacity: 40 } },
            { upsert: true }
        );

        res.json({
            success: true,
            message: 'Schedule entry created successfully',
            schedule: newSchedule
        });
    } catch (error) {
        console.error('Manual schedule create error:', error);
        res.status(500).json({ error: 'Failed to create schedule entry' });
    }
});

// Update an existing schedule entry
router.put('/manual/:id', auth, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { course, courseNickname, batch, teacher, timeSlot } = req.body;

        const schedule = await Schedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        if (course !== undefined) schedule.course = course;
        if (courseNickname !== undefined) schedule.courseNickname = courseNickname;
        if (batch !== undefined) schedule.batch = batch;
        if (teacher !== undefined) schedule.teacher = teacher;
        if (timeSlot?.end) schedule.timeSlot.end = timeSlot.end;

        schedule.rawContent = `${schedule.course || ''} ${schedule.batch || ''}`.trim();
        
        // Clear needsReview flag when admin updates the schedule
        schedule.needsReview = false;

        await schedule.save();

        res.json({
            success: true,
            message: 'Schedule entry updated successfully',
            schedule
        });
    } catch (error) {
        console.error('Manual schedule update error:', error);
        res.status(500).json({ error: 'Failed to update schedule entry' });
    }
});

// Delete a schedule entry
router.delete('/manual/:id', auth, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findByIdAndDelete(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({
            success: true,
            message: 'Schedule entry deleted successfully'
        });
    } catch (error) {
        console.error('Manual schedule delete error:', error);
        res.status(500).json({ error: 'Failed to delete schedule entry' });
    }
});

// Split slot into sub-slots (for room-wise manual entries only)
router.post('/split-slot', auth, adminOnly, async (req, res) => {
    try {
        const { roomNumber, day, timeSlot } = req.body;
        const department = req.user.department;

        if (!roomNumber || !day || !timeSlot?.start) {
            return res.status(400).json({
                error: 'Missing required fields: roomNumber, day, timeSlot.start'
            });
        }

        // Find all sub-slots for this time slot
        const existingSlots = await Schedule.find({
            roomNumber,
            day,
            'timeSlot.start': timeSlot.start,
            semesterPageNumber: null // Only manual room-wise entries
        }).sort({ subSlotIndex: 1 });

        if (existingSlots.length === 0) {
            return res.status(404).json({ error: 'No schedule found for this slot' });
        }

        const currentTotalSubSlots = existingSlots[0].totalSubSlots;
        let newTotalSubSlots;

        // Cycle: 1 → 2 → 4 → 1
        if (currentTotalSubSlots === 1) {
            newTotalSubSlots = 2;
        } else if (currentTotalSubSlots === 2) {
            newTotalSubSlots = 4;
        } else {
            newTotalSubSlots = 1; // Reset to unsplit
        }

        // Delete all existing sub-slots
        await Schedule.deleteMany({
            roomNumber,
            day,
            'timeSlot.start': timeSlot.start,
            semesterPageNumber: null
        });

        // Create new sub-slots
        const newSlots = [];

        if (newTotalSubSlots === 1) {
            // Unsplit - preserve data from first sub-slot (Option A)
            const firstSlot = existingSlots[0];
            const unSplitSlot = new Schedule({
                roomNumber,
                day,
                timeSlot: firstSlot.timeSlot,
                course: firstSlot.course,
                courseNickname: firstSlot.courseNickname,
                batch: firstSlot.batch,
                teacher: firstSlot.teacher,
                department,
                subSlotIndex: 0,
                totalSubSlots: 1
            });
            newSlots.push(unSplitSlot);
        } else {
            // Split into 2 or 4 sub-slots
            for (let i = 0; i < newTotalSubSlots; i++) {
                const existingData = existingSlots.find(slot => slot.subSlotIndex === i);
                
                const newSlot = new Schedule({
                    roomNumber,
                    day,
                    timeSlot: existingSlots[0].timeSlot,
                    course: existingData?.course || '',
                    courseNickname: existingData?.courseNickname || '',
                    batch: existingData?.batch || '',
                    teacher: existingData?.teacher || '',
                    department,
                    subSlotIndex: i,
                    totalSubSlots: newTotalSubSlots
                });
                newSlots.push(newSlot);
            }
        }

        await Schedule.insertMany(newSlots);

        res.json({
            success: true,
            message: `Slot ${newTotalSubSlots === 1 ? 'merged' : 'split into ' + newTotalSubSlots}`,
            totalSubSlots: newTotalSubSlots,
            slots: newSlots
        });

    } catch (error) {
        console.error('Split slot error:', error);
        res.status(500).json({ error: 'Failed to split slot' });
    }
});

// Upload semester-wise PDF (parse and store schedule data)
router.post('/upload-pdf', auth, adminOnly, upload.single('schedule'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { type } = req.body; // 'routine-wise' or 'semester-wise'
        if (!type || !['routine-wise', 'semester-wise'].includes(type)) {
            return res.status(400).json({ error: 'Invalid or missing PDF type' });
        }

        const department = req.user.department;
        const pdfPath = req.file.path;

        // Delete old PDF of the same type for this department if exists
        const existingPDF = await SchedulePDF.findOne({ type, department });
        if (existingPDF) {
            // Delete old file
            if (fs.existsSync(existingPDF.filePath)) {
                fs.unlinkSync(existingPDF.filePath);
            }
            // Delete cached filtered PDFs
            const cacheDir = path.join(__dirname, '../uploads/cache');
            if (fs.existsSync(cacheDir)) {
                const cacheFiles = fs.readdirSync(cacheDir).filter(f => 
                    f.startsWith(`${type}-${department}-`)
                );
                cacheFiles.forEach(f => fs.unlinkSync(path.join(cacheDir, f)));
            }
            await SchedulePDF.deleteOne({ type, department });
        }

        let pageMapping = [];
        let totalPages = 0;

        // Split semester-wise PDF into individual pages
        if (type === 'semester-wise') {
            console.log('Splitting semester-wise PDF into individual pages...');
            
            // Load the PDF
            const pdfBytes = fs.readFileSync(pdfPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            totalPages = pdfDoc.getPageCount();
            
            // Create pages directory if it doesn't exist
            const pagesDir = path.join(__dirname, '..', 'uploads', 'pages');
            if (!fs.existsSync(pagesDir)) {
                fs.mkdirSync(pagesDir, { recursive: true });
            }
            
            // Delete old page files for this department
            const oldPagePattern = new RegExp(`^semester-wise-${department}-\\d+\\.pdf$`);
            const existingFiles = fs.readdirSync(pagesDir);
            existingFiles.forEach(file => {
                if (oldPagePattern.test(file)) {
                    fs.unlinkSync(path.join(pagesDir, file));
                }
            });
            
            // Parse page mapping to extract batch info
            const parsedData = await parseSemesterPDF(pdfPath);
            const extractedPageMapping = parsedData.pageMapping;
            
            // Split and save each page
            for (let i = 0; i < totalPages; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
                newPdf.addPage(copiedPage);
                const pdfBytesPage = await newPdf.save();
                
                const pageFileName = `semester-wise-${department}-${i + 1}.pdf`;
                const pageFilePath = path.join(pagesDir, pageFileName);
                fs.writeFileSync(pageFilePath, pdfBytesPage);
                
                // Merge with existing page mapping data
                const existingPageData = extractedPageMapping.find(p => p.pageNumber === i + 1) || {};
                pageMapping.push({
                    pageNumber: i + 1,
                    batch: existingPageData.batch || '',
                    section: existingPageData.section || '',
                    semester: existingPageData.semester || '',
                    fullText: existingPageData.fullText || `Page ${i + 1}`,
                    rawText: existingPageData.rawText || '',
                    pageFilePath: `pages/${pageFileName}`
                });
            }
            
            console.log(`Split PDF into ${totalPages} individual pages`);
        }

        // Save PDF metadata
        const pdfDoc = new SchedulePDF({
            filename: req.file.filename,
            originalName: req.file.originalname,
            filePath: req.file.path,
            type,
            department,
            uploadedBy: req.user.userId,
            pageMapping,
            totalPages
        });

        await pdfDoc.save();

        res.json({
            success: true,
            message: `${type} PDF uploaded successfully`,
            pdf: {
                type,
                filename: req.file.filename,
                totalPages,
                uploadedAt: pdfDoc.createdAt,
                pagesCreated: pageMapping.length,
                batchesFound: type === 'semester-wise' 
                    ? [...new Set(pageMapping.map(p => p.fullText).filter(Boolean))].length 
                    : 0
            }
        });

    } catch (error) {
        console.error('PDF upload error:', error);
        res.status(500).json({
            error: 'Failed to upload PDF',
            details: error.message
        });
    }
});

// Get PDF file
router.get('/pdf/:type', auth, async (req, res) => {
    try {
        const { type } = req.params;
        const department = req.query.department || req.user.department;

        const pdfDoc = await SchedulePDF.findOne({ type, department });

        if (!pdfDoc) {
            return res.status(404).json({ error: `No ${type} PDF found` });
        }

        if (!fs.existsSync(pdfDoc.filePath)) {
            return res.status(404).json({ error: 'PDF file not found on server' });
        }

        // Send PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${pdfDoc.originalName}"`);
        
        const fileStream = fs.createReadStream(pdfDoc.filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('PDF retrieval error:', error);
        res.status(500).json({
            error: 'Failed to retrieve PDF',
            details: error.message
        });
    }
});

// Get PDF metadata
router.get('/pdf-info/:type', auth, async (req, res) => {
    try {
        const { type } = req.params;
        const department = req.query.department || req.user.department;

        const pdfDoc = await SchedulePDF.findOne({ type, department })
            .select('-filePath')
            .populate('uploadedBy', 'name email');

        if (!pdfDoc) {
            return res.json({ exists: false });
        }

        res.json({
            exists: true,
            pdf: pdfDoc
        });

    } catch (error) {
        console.error('PDF info retrieval error:', error);
        res.status(500).json({
            error: 'Failed to retrieve PDF info',
            details: error.message
        });
    }
});

// Get available batches and sections from semester-wise PDF
router.get('/pdf-batches/:type', auth, async (req, res) => {
    try {
        const { type } = req.params;
        const department = req.query.department || req.user.department;

        const pdfDoc = await SchedulePDF.findOne({ type, department });

        if (!pdfDoc || !pdfDoc.pageMapping || pdfDoc.pageMapping.length === 0) {
            return res.json({ batches: [] });
        }

        // Extract unique fullText values (e.g., "BSc CSE 1st-Section 1")
        const batchMap = new Map();
        
        pdfDoc.pageMapping.forEach(page => {
            if (page.fullText) {
                const key = page.fullText;
                if (!batchMap.has(key)) {
                    batchMap.set(key, {
                        fullText: page.fullText,
                        pages: []
                    });
                }
                batchMap.get(key).pages.push(page.pageNumber);
            }
        });

        // Convert to array format
        const batches = Array.from(batchMap.values()).map(b => ({
            fullText: b.fullText,
            pageCount: b.pages.length
        })).sort((a, b) => a.fullText.localeCompare(b.fullText));

        res.json({
            success: true,
            batches
        });

    } catch (error) {
        console.error('Batch list retrieval error:', error);
        res.status(500).json({
            error: 'Failed to retrieve batch list',
            details: error.message
        });
    }
});

// Get filtered PDF by fullText (with caching)
router.get('/pdf/:type/filtered', auth, async (req, res) => {
    try {
        const { type } = req.params;
        const { filter } = req.query; // filter is the fullText like "BSc CSE 1st-Section 1"
        const department = req.user.department;

        if (!filter) {
            return res.status(400).json({ error: 'Filter parameter is required' });
        }

        const pdfDoc = await SchedulePDF.findOne({ type, department });

        if (!pdfDoc) {
            return res.status(404).json({ error: `No ${type} PDF found` });
        }

        if (!fs.existsSync(pdfDoc.filePath)) {
            return res.status(404).json({ error: 'PDF file not found on server' });
        }

        // Create cache directory if it doesn't exist
        const cacheDir = path.join(__dirname, '../uploads/cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        // Generate cache filename (sanitize the filter text for filename)
        const sanitizedFilter = filter.replace(/[^a-zA-Z0-9]/g, '-');
        const cacheFilename = `${type}-${department}-${sanitizedFilter}.pdf`;
        const cachePath = path.join(cacheDir, cacheFilename);

        // Check if cached version exists
        if (fs.existsSync(cachePath)) {
            console.log('Serving cached filtered PDF:', cacheFilename);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Routine-${filter}.pdf"`);
            const fileStream = fs.createReadStream(cachePath);
            return fileStream.pipe(res);
        }

        // Filter pages by fullText
        const filteredPages = pdfDoc.pageMapping
            .filter(page => page.fullText === filter)
            .map(page => page.pageNumber);

        if (filteredPages.length === 0) {
            return res.status(404).json({ 
                error: 'No pages found for the specified filter' 
            });
        }

        console.log(`Creating filtered PDF for "${filter}": ${filteredPages.length} pages`);

        // Load the original PDF
        const existingPdfBytes = fs.readFileSync(pdfDoc.filePath);
        const pdfDocLib = await PDFDocument.load(existingPdfBytes);

        // Create a new PDF with only the filtered pages
        const newPdf = await PDFDocument.create();

        for (const pageNum of filteredPages) {
            const [copiedPage] = await newPdf.copyPages(pdfDocLib, [pageNum - 1]);
            newPdf.addPage(copiedPage);
        }

        // Save the filtered PDF to cache
        const pdfBytes = await newPdf.save();
        fs.writeFileSync(cachePath, pdfBytes);

        console.log('Cached filtered PDF:', cacheFilename);

        // Send the filtered PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Routine-${filter}.pdf"`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Filtered PDF retrieval error:', error);
        res.status(500).json({
            error: 'Failed to retrieve filtered PDF',
            details: error.message
        });
    }
});

// Get unique course nicknames for autocomplete suggestions
router.get('/course-nicknames', auth, async (req, res) => {
    try {
        // Get distinct courseNicknames from both collections
        const roomWiseNicknames = await Schedule.distinct('courseNickname', {
            courseNickname: { $exists: true, $ne: '' }
        });
        
        const semesterNicknames = await SemesterSchedule.distinct('courseNickname', {
            courseNickname: { $exists: true, $ne: '' }
        });
        
        // Combine and remove duplicates
        const allNicknames = [...new Set([...roomWiseNicknames, ...semesterNicknames])];
        
        res.json({
            success: true,
            nicknames: allNicknames.sort()
        });
    } catch (error) {
        console.error('Get course nicknames error:', error);
        res.status(500).json({ error: 'Failed to retrieve course nicknames' });
    }
});

// Get semester-wise pages (accessible to all authenticated users including viewers)
router.get('/semester-pages', authOrGuest, async (req, res) => {
    try {
        let query = { type: 'semester-wise' };
        
        // If user has a department, filter by it; otherwise show first available
        if (req.user.department) {
            query.department = req.user.department;
        }
        
        // Get the semester-wise PDF document
        const pdfDoc = await SchedulePDF.findOne(query);

        if (!pdfDoc) {
            return res.json({
                success: true,
                exists: false,
                pages: [],
                totalPages: 0
            });
        }

        res.json({
            success: true,
            exists: true,
            pages: pdfDoc.pageMapping,
            totalPages: pdfDoc.totalPages
        });
    } catch (error) {
        console.error('Get semester pages error:', error);
        res.status(500).json({ error: 'Failed to fetch semester pages' });
    }
});

// Serve individual semester page PDF (accessible to all authenticated users including viewers)
router.get('/semester-page/:pageNumber', authOrGuest, async (req, res) => {
    try {
        let query = { type: 'semester-wise' };
        
        // If user has a department, filter by it; otherwise show first available
        if (req.user.department) {
            query.department = req.user.department;
        }
        
        const pageNumber = parseInt(req.params.pageNumber);
        
        // Get the semester-wise PDF document
        const pdfDoc = await SchedulePDF.findOne(query);

        if (!pdfDoc) {
            return res.status(404).json({ error: 'Semester PDF not found' });
        }

        // Find the page in pageMapping
        const pageData = pdfDoc.pageMapping.find(p => p.pageNumber === pageNumber);
        if (!pageData || !pageData.pageFilePath) {
            return res.status(404).json({ error: 'Page not found' });
        }

        // Construct full path to page file
        const pagePath = path.join(__dirname, '..', 'uploads', pageData.pageFilePath);
        
        if (!fs.existsSync(pagePath)) {
            return res.status(404).json({ error: 'Page file not found on disk' });
        }

        // Send the PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Page-${pageNumber}.pdf"`);
        res.sendFile(pagePath);

    } catch (error) {
        console.error('Get semester page error:', error);
        res.status(500).json({ error: 'Failed to retrieve page' });
    }
});

// Update batch name for a semester page (Admin only)
router.put('/semester-page/:pageNumber', auth, adminOnly, async (req, res) => {
    try {
        const department = req.user.department;
        const pageNumber = parseInt(req.params.pageNumber);
        const { batchName } = req.body;

        if (!batchName || batchName.trim() === '') {
            return res.status(400).json({ error: 'Batch name is required' });
        }

        const pdfDoc = await SchedulePDF.findOne({ 
            type: 'semester-wise', 
            department 
        });

        if (!pdfDoc) {
            return res.status(404).json({ error: 'Semester PDF not found' });
        }

        // Find and update the page
        const pageIndex = pdfDoc.pageMapping.findIndex(p => p.pageNumber === pageNumber);
        if (pageIndex === -1) {
            return res.status(404).json({ error: 'Page not found' });
        }

        pdfDoc.pageMapping[pageIndex].fullText = batchName.trim();
        await pdfDoc.save();

        res.json({ 
            success: true, 
            message: 'Batch name updated successfully',
            page: pdfDoc.pageMapping[pageIndex]
        });
    } catch (error) {
        console.error('Update page batch name error:', error);
        res.status(500).json({ error: 'Failed to update batch name' });
    }
});

// Delete a semester page (Admin only)
router.delete('/semester-page/:pageNumber', auth, adminOnly, async (req, res) => {
    try {
        const department = req.user.department;
        const pageNumber = parseInt(req.params.pageNumber);

        const pdfDoc = await SchedulePDF.findOne({ 
            type: 'semester-wise', 
            department 
        });

        if (!pdfDoc) {
            return res.status(404).json({ error: 'Semester PDF not found' });
        }

        // Find the page
        const pageIndex = pdfDoc.pageMapping.findIndex(p => p.pageNumber === pageNumber);
        if (pageIndex === -1) {
            return res.status(404).json({ error: 'Page not found' });
        }

        const pageData = pdfDoc.pageMapping[pageIndex];

        // Delete the page file from disk
        if (pageData.pageFilePath) {
            const pagePath = path.join(__dirname, '..', 'uploads', pageData.pageFilePath);
            if (fs.existsSync(pagePath)) {
                fs.unlinkSync(pagePath);
            }
        }

        // Remove from pageMapping
        pdfDoc.pageMapping.splice(pageIndex, 1);
        pdfDoc.totalPages = pdfDoc.pageMapping.length;
        await pdfDoc.save();

        res.json({ 
            success: true, 
            message: 'Page deleted successfully',
            totalPages: pdfDoc.totalPages
        });
    } catch (error) {
        console.error('Delete semester page error:', error);
        res.status(500).json({ error: 'Failed to delete page' });
    }
});

// @route   DELETE /api/schedule/clear-all
// @desc    Clear all schedules except DEMO-101 (Admin only)
// @access  Private/Admin
router.delete('/clear-all', auth, adminOnly, async (req, res) => {
    try {
        // Delete all schedules except DEMO-101
        const result = await Schedule.deleteMany({ 
            roomNumber: { $ne: 'DEMO-101' } 
        });

        // Delete all rooms except DEMO-101
        const roomResult = await Room.deleteMany({ 
            roomNumber: { $ne: 'DEMO-101' } 
        });

        // Delete all bookings
        const bookingResult = await Booking.deleteMany({});

        // Delete all semester PDFs
        const pdfResult = await SchedulePDF.deleteMany({});

        res.json({
            success: true,
            message: 'All data cleared successfully',
            deleted: {
                schedules: result.deletedCount,
                rooms: roomResult.deletedCount,
                bookings: bookingResult.deletedCount,
                pdfs: pdfResult.deletedCount
            }
        });
    } catch (error) {
        console.error('Clear all data error:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

// @route   GET /api/schedule/batches
// @desc    Get unique batches from all schedules
// @access  Public
router.get('/batches', async (req, res) => {
    try {
        const batches = await Schedule.distinct('batch');
        
        // Filter out empty or invalid batches and sort
        const validBatches = batches
            .filter(batch => batch && batch.trim() !== '')
            .sort();

        res.json(validBatches);
    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

// @route   POST /api/schedule/batches
// @desc    Add a new batch manually (Admin only)
// @access  Private/Admin
router.post('/batches', auth, adminOnly, async (req, res) => {
    try {
        const { batchName } = req.body;

        if (!batchName || !batchName.trim()) {
            return res.status(400).json({ error: 'Batch name is required' });
        }

        // Check if batch already exists
        const existingBatches = await Schedule.distinct('batch');
        if (existingBatches.includes(batchName.trim())) {
            return res.status(400).json({ error: 'Batch already exists' });
        }

        // Create a dummy schedule entry to register the batch
        // This ensures the batch appears in the list
        const dummySchedule = new Schedule({
            roomNumber: 'BATCH-PLACEHOLDER',
            day: 'Monday',
            timeSlot: { start: '00:00', end: '00:01' },
            course: 'Placeholder',
            batch: batchName.trim(),
            teacher: 'System',
            isPlaceholder: true // Flag to identify placeholder entries
        });

        await dummySchedule.save();

        res.json({
            success: true,
            message: `Batch '${batchName}' added successfully`,
            batch: batchName.trim()
        });
    } catch (error) {
        console.error('Add batch error:', error);
        res.status(500).json({ error: 'Failed to add batch' });
    }
});

// @route   DELETE /api/schedule/batches/:batchName
// @desc    Delete a batch and all its associated schedules (Admin only)
// @access  Private/Admin
router.delete('/batches/:batchName', auth, adminOnly, async (req, res) => {
    try {
        const { batchName } = req.params;

        // Delete all schedules with this batch
        const result = await Schedule.deleteMany({ batch: batchName });

        res.json({
            success: true,
            message: `Batch '${batchName}' deleted successfully`,
            deletedSchedules: result.deletedCount
        });
    } catch (error) {
        console.error('Delete batch error:', error);
        res.status(500).json({ error: 'Failed to delete batch' });
    }
});

// ============================================================================
// SEMESTER SCHEDULE CRUD ROUTES (Manual Input for Semester-wise Viewer)
// ============================================================================

// @route   GET /api/schedule/semester/:pageNumber
// @desc    Get all schedule entries for a specific semester page
// @access  Public
router.get('/semester/:pageNumber', authOrGuest, async (req, res) => {
    try {
        const { pageNumber } = req.params;
        const { weekStartDate } = req.query; // Optional: specific week, defaults to template
        const pageNum = parseInt(pageNumber, 10);

        if (isNaN(pageNum)) {
            return res.status(400).json({ error: 'Invalid page number' });
        }

        let schedules;

        if (weekStartDate) {
            // Fetch schedules for a specific week
            const weekStart = new Date(weekStartDate);
            
            // Validate week range
            if (!isWithinAllowedWeekRange(weekStart)) {
                return res.status(400).json({ error: 'Week is outside allowed range (current week + 8 weeks)' });
            }

            // Get template schedules
            const templates = await SemesterSchedule.find({ 
                semesterPageNumber: pageNum,
                isTemplate: true
            });

            // Get week-specific overrides
            const overrides = await SemesterSchedule.find({ 
                semesterPageNumber: pageNum,
                isTemplate: false,
                weekStartDate: weekStart
            });

            // Merge: overrides take priority over templates
            const scheduleMap = new Map();
            
            // Add templates first
            templates.forEach(t => {
                const key = `${t.day}-${t.timeSlot.start}-${t.subSlotIndex || 0}`;
                scheduleMap.set(key, t);
            });

            // Override with week-specific entries
            overrides.forEach(o => {
                const key = `${o.day}-${o.timeSlot.start}-${o.subSlotIndex || 0}`;
                scheduleMap.set(key, o);
            });

            schedules = Array.from(scheduleMap.values())
                .sort((a, b) => {
                    const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    if (dayDiff !== 0) return dayDiff;
                    return a.timeSlot.start.localeCompare(b.timeSlot.start);
                });
        } else {
            // Fetch template schedules only
            schedules = await SemesterSchedule.find({ 
                semesterPageNumber: pageNum,
                isTemplate: true
            }).sort({ day: 1, 'timeSlot.start': 1 });
        }

        res.json({
            success: true,
            schedules,
            weekStartDate: weekStartDate || null,
            isTemplate: !weekStartDate
        });
    } catch (error) {
        console.error('Get semester schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch semester schedules' });
    }
});

// @route   POST /api/schedule/semester/:pageNumber
// @desc    Create a new schedule entry for a semester page
// @access  Private/CR/Admin
router.post('/semester/:pageNumber', auth, async (req, res) => {
    try {
        const { pageNumber } = req.params;
        const pageNum = parseInt(pageNumber, 10);

        console.log('CREATE semester schedule - Page:', pageNum, 'Data:', req.body);

        if (isNaN(pageNum)) {
            return res.status(400).json({ error: 'Invalid page number' });
        }

        const { day, timeSlot, course, courseNickname, batch, teacher, weekStartDate, isTemplate, status, statusNote, roomNumber, subSlotIndex, totalSubSlots } = req.body;
        const department = req.user.department;

        if (!day || !timeSlot?.start || !timeSlot?.end) {
            return res.status(400).json({
                error: 'Missing required fields: day, timeSlot.start, timeSlot.end'
            });
        }

        // Validate week range for weekly overrides
        if (weekStartDate && !isTemplate) {
            const weekStart = new Date(weekStartDate);
            if (!isWithinAllowedWeekRange(weekStart)) {
                return res.status(400).json({ error: 'Week is outside allowed range (current week + 8 weeks)' });
            }
        }

        // Check if slot already exists
        const queryConditions = {
            semesterPageNumber: pageNum,
            day,
            'timeSlot.start': timeSlot.start,
            subSlotIndex: subSlotIndex || 0
        };

        if (isTemplate || !weekStartDate) {
            queryConditions.isTemplate = true;
        } else {
            queryConditions.isTemplate = false;
            queryConditions.weekStartDate = new Date(weekStartDate);
        }

        const existing = await SemesterSchedule.findOne(queryConditions);

        if (existing) {
            return res.status(400).json({
                error: 'A schedule already exists for this slot. Use update instead.'
            });
        }

        const newSchedule = new SemesterSchedule({
            semesterPageNumber: pageNum,
            day,
            timeSlot,
            course: course || '',
            courseNickname: courseNickname || '',
            batch: batch || '',
            teacher: teacher || '',
            roomNumber: roomNumber || '',
            department,
            subSlotIndex: subSlotIndex || 0,
            totalSubSlots: totalSubSlots || 1,
            isTemplate: isTemplate !== false, // Default to template
            weekStartDate: weekStartDate && !isTemplate ? new Date(weekStartDate) : null,
            status: status || 'active',
            statusNote: statusNote || '',
            rawContent: `${course || ''} ${batch || ''}`.trim()
        });

        await newSchedule.save();

        console.log('Semester schedule CREATED successfully:', { id: newSchedule._id, page: pageNum, course: newSchedule.course });

        res.json({
            success: true,
            message: `Semester schedule entry created successfully ${!isTemplate && weekStartDate ? '(week-specific)' : '(template)'}`,
            schedule: newSchedule
        });
    } catch (error) {
        console.error('Semester schedule create error:', error);
        res.status(500).json({ error: 'Failed to create semester schedule entry' });
    }
});

// @route   PUT /api/schedule/semester/:id
// @desc    Update an existing semester schedule entry
// @access  Private/CR/Admin
router.put('/semester/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { course, courseNickname, batch, teacher, timeSlot, status, statusNote, roomNumber, currentWeekStartDate } = req.body;

        console.log('UPDATE request:', { id, course, batch, roomNumber, currentWeekStartDate, isTemplate: req.body.isTemplate });

        const schedule = await SemesterSchedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        console.log('Found schedule:', { 
            id: schedule._id, 
            isTemplate: schedule.isTemplate, 
            subSlotIndex: schedule.subSlotIndex,
            totalSubSlots: schedule.totalSubSlots,
            currentCourse: schedule.course 
        });

        // If editing a template and currentWeekStartDate is provided, create a week-specific override
        if (schedule.isTemplate && currentWeekStartDate) {
            const weekStart = new Date(currentWeekStartDate);
            
            // Check if a week-specific override already exists
            const existingOverride = await SemesterSchedule.findOne({
                semesterPageNumber: schedule.semesterPageNumber,
                day: schedule.day,
                'timeSlot.start': schedule.timeSlot.start,
                subSlotIndex: schedule.subSlotIndex || 0,
                isTemplate: false,
                weekStartDate: weekStart
            });

            if (existingOverride) {
                // Update the existing override
                if (course !== undefined) existingOverride.course = course;
                if (courseNickname !== undefined) existingOverride.courseNickname = courseNickname;
                if (batch !== undefined) existingOverride.batch = batch;
                if (teacher !== undefined) existingOverride.teacher = teacher;
                if (roomNumber !== undefined) existingOverride.roomNumber = roomNumber;
                if (timeSlot?.end) existingOverride.timeSlot.end = timeSlot.end;
                if (status !== undefined) existingOverride.status = status;
                if (statusNote !== undefined) existingOverride.statusNote = statusNote;

                existingOverride.rawContent = `${existingOverride.course || ''} ${existingOverride.batch || ''}`.trim();
                await existingOverride.save();

                return res.json({
                    success: true,
                    message: 'Week-specific schedule updated successfully',
                    schedule: existingOverride
                });
            } else {
                // Create a new week-specific override based on the template
                const newOverride = new SemesterSchedule({
                    semesterPageNumber: schedule.semesterPageNumber,
                    day: schedule.day,
                    timeSlot: {
                        start: schedule.timeSlot.start,
                        end: timeSlot?.end || schedule.timeSlot.end
                    },
                    course: course !== undefined ? course : schedule.course,
                    courseNickname: courseNickname !== undefined ? courseNickname : schedule.courseNickname,
                    batch: batch !== undefined ? batch : schedule.batch,
                    teacher: teacher !== undefined ? teacher : schedule.teacher,
                    roomNumber: roomNumber !== undefined ? roomNumber : schedule.roomNumber,
                    department: schedule.department,
                    subSlotIndex: schedule.subSlotIndex || 0,
                    totalSubSlots: schedule.totalSubSlots || 1,
                    isTemplate: false,
                    weekStartDate: weekStart,
                    status: status !== undefined ? status : 'active',
                    statusNote: statusNote !== undefined ? statusNote : '',
                    rawContent: `${course !== undefined ? course : schedule.course} ${batch !== undefined ? batch : schedule.batch}`.trim()
                });

                await newOverride.save();

                return res.json({
                    success: true,
                    message: 'Week-specific schedule override created successfully',
                    schedule: newOverride
                });
            }
        }

        // Normal update for non-template entries or template updates without week context
        console.log('Updating schedule directly:', { course, batch, roomNumber });
        if (course !== undefined) schedule.course = course;
        if (courseNickname !== undefined) schedule.courseNickname = courseNickname;
        if (batch !== undefined) schedule.batch = batch;
        if (teacher !== undefined) schedule.teacher = teacher;
        if (roomNumber !== undefined) schedule.roomNumber = roomNumber;
        if (timeSlot?.end) schedule.timeSlot.end = timeSlot.end;
        if (status !== undefined) schedule.status = status;
        if (statusNote !== undefined) schedule.statusNote = statusNote;

        schedule.rawContent = `${schedule.course || ''} ${schedule.batch || ''}`.trim();
        schedule.needsReview = false;

        await schedule.save();

        console.log('Schedule saved successfully:', { id: schedule._id, course: schedule.course, batch: schedule.batch });

        res.json({
            success: true,
            message: 'Semester schedule entry updated successfully',
            schedule
        });
    } catch (error) {
        console.error('Semester schedule update error:', error);
        res.status(500).json({ error: 'Failed to update semester schedule entry' });
    }
});

// @route   POST /api/schedule/semester/:pageNumber/split-slot
// @desc    Split a time slot into sub-slots (2 or 4 divisions)
// @access  Private/CR/Admin
router.post('/semester/:pageNumber/split-slot', auth, async (req, res) => {
    try {
        const { pageNumber } = req.params;
        const pageNum = parseInt(pageNumber, 10);
        const { day, timeSlot, newTotalSubSlots, weekStartDate, isTemplate } = req.body;

        console.log('SPLIT-SLOT called:', { pageNum, day, timeSlot, newTotalSubSlots, isTemplate, weekStartDate });

        if (![1, 2, 4].includes(newTotalSubSlots)) {
            return res.status(400).json({ error: 'totalSubSlots must be 1, 2, or 4' });
        }

        // Find existing schedules for this slot
        const queryConditions = {
            semesterPageNumber: pageNum,
            day,
            'timeSlot.start': timeSlot.start
        };

        if (isTemplate || !weekStartDate) {
            queryConditions.isTemplate = true;
        } else {
            queryConditions.isTemplate = false;
            queryConditions.weekStartDate = new Date(weekStartDate);
        }

        const existingSchedules = await SemesterSchedule.find(queryConditions);
        const department = req.user.department;

        // Option A: If splitting from 1 slot with data, preserve data in first division
        if (existingSchedules.length === 1 && (existingSchedules[0].totalSubSlots === 1 || !existingSchedules[0].totalSubSlots)) {
            const existingData = existingSchedules[0];
            
            // If going from 1 to multiple (2 or 4), preserve data in subSlotIndex 0
            if (newTotalSubSlots > 1 && existingData.course) {
                // Update existing entry to be subSlot 0
                existingData.subSlotIndex = 0;
                existingData.totalSubSlots = newTotalSubSlots;
                await existingData.save();

                // Create empty sub-slots for remaining divisions
                for (let i = 1; i < newTotalSubSlots; i++) {
                    const newSubSlot = new SemesterSchedule({
                        semesterPageNumber: pageNum,
                        day,
                        timeSlot,
                        course: '',
                        courseNickname: '',
                        batch: '',
                        teacher: '',
                        roomNumber: '',
                        department,
                        subSlotIndex: i,
                        totalSubSlots: newTotalSubSlots,
                        isTemplate: isTemplate !== false,
                        weekStartDate: weekStartDate && !isTemplate ? new Date(weekStartDate) : null,
                        status: 'active',
                        rawContent: ''
                    });
                    await newSubSlot.save();
                }

                return res.json({
                    success: true,
                    message: `Slot split into ${newTotalSubSlots} divisions. Existing data preserved in first division.`
                });
            } else if (newTotalSubSlots === 1) {
                // Going back to single slot, just update totalSubSlots
                existingData.totalSubSlots = 1;
                existingData.subSlotIndex = 0;
                await existingData.save();

                return res.json({
                    success: true,
                    message: 'Slot merged to single division'
                });
            }
        }

        // Handle existing split slots (already has multiple sub-slots)
        if (existingSchedules.length > 0) {
            const currentTotal = existingSchedules[0].totalSubSlots || 1;
            
            if (newTotalSubSlots < currentTotal) {
                // Delete sub-slots beyond the new total
                await SemesterSchedule.deleteMany({
                    ...queryConditions,
                    subSlotIndex: { $gte: newTotalSubSlots }
                });
            }

            // Update totalSubSlots for remaining entries
            await SemesterSchedule.updateMany(
                queryConditions,
                { $set: { totalSubSlots: newTotalSubSlots } }
            );

            // Create missing sub-slots if going from smaller to larger
            if (newTotalSubSlots > currentTotal) {
                const existingIndexes = existingSchedules.map(s => s.subSlotIndex);
                
                for (let i = 0; i < newTotalSubSlots; i++) {
                    if (!existingIndexes.includes(i)) {
                        const newSubSlot = new SemesterSchedule({
                            semesterPageNumber: pageNum,
                            day,
                            timeSlot,
                            course: '',
                            batch: '',
                            teacher: '',
                            department,
                            subSlotIndex: i,
                            totalSubSlots: newTotalSubSlots,
                            isTemplate: isTemplate !== false,
                            weekStartDate: weekStartDate && !isTemplate ? new Date(weekStartDate) : null,
                            status: 'active',
                            rawContent: ''
                        });
                        await newSubSlot.save();
                    }
                }
            }
        } else {
            // No existing schedules, create empty sub-slots
            for (let i = 0; i < newTotalSubSlots; i++) {
                const newSubSlot = new Schedule({
                    semesterPageNumber: pageNum,
                    day,
                    timeSlot,
                    course: '',
                    batch: '',
                    teacher: '',
                    department,
                    subSlotIndex: i,
                    totalSubSlots: newTotalSubSlots,
                    isTemplate: isTemplate !== false,
                    weekStartDate: weekStartDate && !isTemplate ? new Date(weekStartDate) : null,
                    status: 'active',
                    rawContent: ''
                });
                await newSubSlot.save();
            }
        }

        res.json({
            success: true,
            message: `Slot split into ${newTotalSubSlots} division(s) successfully`
        });
    } catch (error) {
        console.error('Split slot error:', error);
        res.status(500).json({ error: 'Failed to split slot' });
    }
});

// @route   DELETE /api/schedule/semester/:id
// @desc    Delete a semester schedule entry
// @access  Private/CR/Admin
router.delete('/semester/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await SemesterSchedule.findByIdAndDelete(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({
            success: true,
            message: 'Semester schedule entry deleted successfully'
        });
    } catch (error) {
        console.error('Semester schedule delete error:', error);
        res.status(500).json({ error: 'Failed to delete semester schedule entry' });
    }
});

module.exports = router;
