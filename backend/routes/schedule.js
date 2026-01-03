const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const Schedule = require('../models/Schedule');
const SchedulePDF = require('../models/SchedulePDF');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { parsePDFSchedule } = require('../utils/pdfParser');
const { parseSemesterPDF } = require('../utils/pdfPageParser');
const auth = require('../middleware/auth');
const { adminOnly, authOrGuest } = require('../middleware/auth');

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

        const filter = {};
        if (day) filter.day = day;
        if (roomNumber) filter.roomNumber = roomNumber;

        const schedules = await Schedule.find(filter).sort({ day: 1, 'timeSlot.start': 1 });

        res.json({
            success: true,
            count: schedules.length,
            schedules
        });
    } catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
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
        const { roomNumber, day, timeSlot, course, batch, teacher } = req.body;
        const department = req.user.department;

        if (!roomNumber || !day || !timeSlot?.start || !timeSlot?.end) {
            return res.status(400).json({
                error: 'Missing required fields: roomNumber, day, timeSlot.start, timeSlot.end'
            });
        }

        // Check if slot already exists
        const existing = await Schedule.findOne({
            roomNumber,
            day,
            'timeSlot.start': timeSlot.start
        });

        if (existing) {
            return res.status(400).json({
                error: 'A schedule already exists for this slot. Use update instead.'
            });
        }

        const newSchedule = new Schedule({
            roomNumber,
            day,
            timeSlot,
            course: course || '',
            batch: batch || 'All',
            teacher: teacher || '',
            department,
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
        const { course, batch, teacher, timeSlot } = req.body;

        const schedule = await Schedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        if (course !== undefined) schedule.course = course;
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

module.exports = router;
