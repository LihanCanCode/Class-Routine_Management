const fs = require('fs');
const PDFParser = require("pdf2json");

/**
 * Normalize time to 24-hour format
 * e.g., "8:00" -> "08:00", "2:30 PM" -> "14:30"
 */
function normalizeTime(timeStr) {
    if (!timeStr) return '';

    // Clean string
    timeStr = timeStr.trim().replace(/\s+/g, ' ');

    // Try to parse flexible formats
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
    if (!match) return timeStr; // Return original if parse fails

    let [_, h, m, period] = match;
    h = parseInt(h);

    if (period) {
        if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    } else {
        // Heuristic: if time is 1-6, assume PM (13:00-18:00) unless defined otherwise
        // For school schedules, 8-11 is AM, 12-6 is PM.
        if (h >= 1 && h <= 7) h += 12; // 1:00 -> 13:00
    }

    return `${h.toString().padStart(2, '0')}:${m}`;
}

/**
 * Parse PDF using layout analysis (pdf2json)
 */
function parsePDFSchedule(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", errData => {
            reject(new Error(errData.parserError));
        });

        pdfParser.on("pdfParser_dataReady", pdfData => {
            try {
                const schedules = [];
                const roomsFound = new Set();

                // Process each page
                pdfData.Pages.forEach(page => {
                    processPage(page, schedules, roomsFound);
                });

                // 6. Post-process to merge consecutive slots for the same room/day/batch
                // This handles cases where a class is split across two slots in the PDF
                const mergedSchedules = [];

                // Sort by day, then room, then start time
                const sorted = [...schedules].sort((a, b) => {
                    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const dayCompare = daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
                    if (dayCompare !== 0) return dayCompare;
                    if (a.roomNumber !== b.roomNumber) return a.roomNumber.localeCompare(b.roomNumber);
                    return a.timeSlot.start.localeCompare(b.timeSlot.start);
                });

                sorted.forEach(current => {
                    if (mergedSchedules.length === 0) {
                        mergedSchedules.push(current);
                        return;
                    }

                    const last = mergedSchedules[mergedSchedules.length - 1];

                    // Merge criteria: Same room, Same day, and Sequential time
                    const isSameRoomDay = last.roomNumber === current.roomNumber && last.day === current.day;
                    const isSequential = last.timeSlot.end === current.timeSlot.start;

                    // ONLY merge if SAME COURSE CODE (e.g., Math 4141 spanning 2 slots)
                    const isSameCourse = last.course && current.course && last.course === current.course;
                    
                    // Continuation merging: Previous has course, current has NO course (just batch/room text)
                    // This handles 100-min classes where the second slot only has overflow text
                    // Don't require same batch - the batch text might come from adjacent PDF cells
                    const isContinuation = last.course && !current.course;

                    // Final merge condition
                    const canMerge = isSameCourse || isContinuation;

                    if (isSameRoomDay && isSequential && canMerge) {
                        // Merge into previous
                        last.timeSlot.end = current.timeSlot.end;
                        if (current.course && !last.course) last.course = current.course;
                        // Keep the batch from the slot that has the course
                        last.rawContent += ' / ' + current.rawContent;
                    } else {
                        mergedSchedules.push(current);
                    }
                });

                resolve({
                    schedules: mergedSchedules,
                    rooms: Array.from(roomsFound),
                    rawText: "Parsed using struct method"
                });
            } catch (err) {
                reject(err);
            }
        });

        pdfParser.loadPDF(pdfPath);
    });
}

/**
 * Process a single page to extract schedule
 */
function processPage(page, schedules, roomsFound) {
    // 1. Decode text
    const texts = page.Texts.map(t => ({
        x: t.x,
        y: t.y,
        text: decodeURIComponent(t.R[0].T).trim()
    }));

    // 2. Find Room Header (includes Labs)
    const roomHeader = texts.find(t => t.text.includes("Room-") || t.text.includes("Lab-"));
    if (!roomHeader) return; // No room on this page?

    // Extract room number: "Room-105 (AB3)" -> "105 (AB3)" or "Lab-1" -> "Lab-1"
    let roomNumber;
    const roomMatch = roomHeader.text.match(/Room-([^(]+)(\([^)]+\))?/);
    const labMatch = roomHeader.text.match(/Lab-(\d+)/);
    
    if (labMatch) {
        roomNumber = `Lab-${labMatch[1]}`;
    } else if (roomMatch) {
        roomNumber = roomMatch[1].trim() + (roomMatch[2] ? ' ' + roomMatch[2] : '');
    } else {
        roomNumber = roomHeader.text;
    }

    roomsFound.add(roomNumber.replace(/\s+/g, ' '));

    // 3. Calibrate Grid
    // Find Day Rows
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayRowY = {};

    days.forEach(day => {
        const dayLabel = texts.find(t => t.text === day);
        if (dayLabel) {
            dayRowY[day] = dayLabel.y;
        }
    });

    // If we miss some days (unlikely), interpolate? 
    // For now assume strictly formatted PDF

    // Find Time Columns
    // Look for time patterns like "8:00", "9:15"
    // Map index 0 -> 8:00, 1 -> 9:15
    const timeSlots = [];
    // We know the slots from analysis: 
    // 1: 8:00-9:15, 2: 9:15-10:30, 3: 10:30-11:45, 4: 11:45-13:00, 
    // Break (13-14:30), 5: 14:30-15:45, 6: 15:45-17:00

    // Let's identify them dynamically to be safe
    const timeLabels = texts.filter(t => /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(t.text));

    // Sort by X position
    timeLabels.sort((a, b) => a.x - b.x);

    // Create slots definition
    timeLabels.forEach(t => {
        // "8:00 - 9:15"
        const parts = t.text.split('-');
        if (parts.length === 2) {
            timeSlots.push({
                x: t.x,
                start: normalizeTime(parts[0]),
                end: normalizeTime(parts[1]),
                raw: t.text
            });
        }
    });

    // 4. Iterate content cells
    // Group text by cell
    // Modified logic: Instead of strict slot matching, we'll assign text to the *starting* slot
    // and attempt to detect duration/merges based on X position and width.

    // Key: "Mon_start" -> { text: [], end: ... }
    const validTimeStarts = timeSlots.map(t => t.start); // ["08:00", "09:15", ...]
    const cellMap = {};

    // Thresholds
    const yTolerance = 2.0; // +/- 2 units vertically
    const xTolerance = 2.5; // +/- 2.5 units horizontally

    texts.forEach(t => {
        // Skip headers
        if (days.includes(t.text) || t.text.includes('Room-') || t.text.includes(':')) return;

        // Find matching Day
        let matchedDay = null;
        for (const d of days) {
            if (dayRowY[d] && Math.abs(t.y - dayRowY[d]) < yTolerance) {
                matchedDay = d;
                break;
            }
        }

        if (!matchedDay) return;

        // Find Start Slot - always use CLOSEST slot matching
        let matchedSlot = null;
        let minDiff = Infinity;

        for (const slot of timeSlots) {
            const diff = Math.abs(t.x - slot.x);
            if (diff < minDiff) {
                minDiff = diff;
                matchedSlot = slot;
            }
        }

        // Don't match if content is too far from any slot (probably noise)
        if (minDiff > 10) {
            matchedSlot = null;
        }

        if (matchedDay && matchedSlot) {
            const key = `${matchedDay}|${matchedSlot.start}`;
            if (!cellMap[key]) cellMap[key] = { textParts: [], slotIndex: timeSlots.indexOf(matchedSlot) };
            cellMap[key].textParts.push(t);
        }
    });

    // 5. Parse Cell Content & Detect Merges
    const cellKeys = Object.keys(cellMap);
    const processedSlots = new Set(); // Track slots we've already processed
    
    cellKeys.forEach((key, index) => {
        const [day, start] = key.split('|');
        const { textParts, slotIndex } = cellMap[key];
        
        // Skip if already processed as part of a merge
        if (processedSlots.has(key)) return;

        // Sort lines by Y (top to bottom), then X (left to right)
        textParts.sort((a, b) => (a.y - b.y) || (a.x - b.x));
        
        const content = textParts.map(l => l.text).join(' ');
        
        // Check if next slot exists and contains L-pattern
        let nextSlotContent = '';
        let nextSlotTextParts = [];
        let shouldMergeWithNext = false;
        
        if (slotIndex + 1 < timeSlots.length) {
            const nextKey = `${day}|${timeSlots[slotIndex + 1].start}`;
            if (cellMap[nextKey]) {
                nextSlotTextParts = cellMap[nextKey].textParts;
                nextSlotContent = nextSlotTextParts.map(l => l.text).join(' ');
                
                // Check if next slot contains L-pattern
                if (/\bL-[1-6]\b/i.test(nextSlotContent)) {
                    shouldMergeWithNext = true;
                    processedSlots.add(nextKey); // Mark next slot as processed
                }
            }
        }
        
        // Detect bi-weekly labs by checking for duplicate course codes or section markers
        // Pattern: "1A CSE 4510 CSS1 1B CSE 4510 CSS1" or similar
        const courseCodeMatches = content.match(/([A-Za-z]{2,5})\s*(\d{4})/gi);
        const isBiWeekly = courseCodeMatches && courseCodeMatches.length >= 2 && 
                           courseCodeMatches[0].toUpperCase() === courseCodeMatches[1].toUpperCase();

        // Determine End Time (Default to single slot)
        let end = timeSlots[slotIndex].end;

        // Detect merged slots (spanning 2 time slots):
        // 1. Check for "100 mins", "mins", or "min" keywords
        // 2. Check if next slot contains "L-1" through "L-6" patterns
        // 3. For Lab rooms: Default to 2-slot merge unless next slot has different content
        // 4. For other rooms: Check if text elements span significantly beyond single slot width
        let isMerged = false;
        
        // Check if this is a Lab room
        const isLabRoom = /^Lab-\d+$/i.test(roomNumber);
        
        if (/\b(100\s*mins?|mins?)\b/i.test(content) || shouldMergeWithNext) {
            isMerged = true;
        } else if (isLabRoom && slotIndex + 1 < timeSlots.length) {
            // For Lab rooms: Default to merging with next slot
            const nextKey = `${day}|${timeSlots[slotIndex + 1].start}`;
            const nextCell = cellMap[nextKey];
            
            // Merge unless next slot has its own course content (different course)
            if (!nextCell || nextCell.textParts.length === 0) {
                // Next slot is empty - merge
                isMerged = true;
            } else {
                // Next slot has content - check if it's the same course or different
                const nextContent = nextCell.textParts.map(t => t.text).join(' ');
                const nextCourseMatch = nextContent.match(/([A-Za-z]{2,5})\s*(\d{4})/i);
                
                // If next slot has no course code, or is L-pattern, merge
                if (!nextCourseMatch || /\bL-[1-6]\b/i.test(nextContent)) {
                    isMerged = true;
                }
                // If next slot has different course, don't merge (it's a separate single-slot lab)
            }
        } else if (slotIndex + 1 < timeSlots.length && textParts.length > 0) {
            // For non-lab rooms: Check if text elements span significantly beyond single slot width
            const currentSlotX = timeSlots[slotIndex].x;
            const nextSlotX = timeSlots[slotIndex + 1].x;
            const slotWidth = nextSlotX - currentSlotX;
            
            // Find the rightmost text element
            const maxX = Math.max(...textParts.map(t => t.x));
            
            // If rightmost text is significantly into next slot's area, it's merged
            // Use a threshold of 40% into the next slot
            const threshold = currentSlotX + (slotWidth * 0.6);
            if (maxX >= threshold) {
                isMerged = true;
            }
        }
        
        if (isMerged && slotIndex + 1 < timeSlots.length) {
            end = timeSlots[slotIndex + 1].end;
        }

        // BATCH MAPPING LOGIC
        // Extract course name from content (always from current/first cell)
        let batch = '';
        let course = '';

        // Regex handles course names like Hum, Phy, Math, CSE (2 to 5 letters)
        const courseMatch = content.match(/([A-Za-z]{2,5})\s*(\d{4})/i);
        if (courseMatch) {
            course = courseMatch[0];
        } else {
            // No standard course code found - extract meaningful course name from content
            const batchPatterns = /\b(C\d+S\d+|SW\d+|CSE\s*\d{2}|MSc|PhD|R-\d+|[A-Z]{2,4}\s*$)\b/gi;
            let cleanedContent = content.replace(batchPatterns, '').trim();
            cleanedContent = cleanedContent.replace(/^[A-Z]{2,4}\s+/, '').trim();
            cleanedContent = cleanedContent.replace(/\s+R-\d+.*$/, '').trim();
            
            if (cleanedContent.length > 2) {
                course = cleanedContent;
            }
        }

        // For batch extraction: 
        // For ALL merged slots: Check if next slot cell exists, use its batch code
        // Otherwise: Filter current cell's text to second slot X-range
        let batchText = '';
        
        if (isMerged && slotIndex + 1 < timeSlots.length) {
            // Check if there's a cell in the next slot position
            const nextKey = `${day}|${timeSlots[slotIndex + 1].start}`;
            
            if (cellMap[nextKey] && cellMap[nextKey].textParts.length > 0) {
                // Use batch code from the next slot's cell (whether it's L-pattern or any other content)
                const nextCellTexts = cellMap[nextKey].textParts;
                const bottomY = Math.max(...nextCellTexts.map(t => t.y));
                const bottomTexts = nextCellTexts.filter(t => Math.abs(t.y - bottomY) < 1);
                const rightmostText = bottomTexts.sort((a, b) => b.x - a.x)[0];
                batchText = rightmostText ? rightmostText.text : nextCellTexts.map(t => t.text).join(' ');
            } else {
                // No separate next cell - filter current cell's text to second slot's X range
                const secondSlotX = timeSlots[slotIndex + 1].x;
                const relevantTexts = textParts.filter(t => t.x >= secondSlotX - 2);
                
                if (relevantTexts.length > 0) {
                    const bottomY = Math.max(...relevantTexts.map(t => t.y));
                    const bottomTexts = relevantTexts.filter(t => Math.abs(t.y - bottomY) < 1);
                    const rightmostText = bottomTexts.sort((a, b) => b.x - a.x)[0];
                    batchText = rightmostText ? rightmostText.text : content;
                } else {
                    batchText = content;
                }
            }
        } else {
            // Not merged - search for batch code in entire content first
            batchText = content;
            
            // Flexible batch code pattern that matches: SW5, C5S1, ME3S1, EEE4B2, S5, B2, etc.
            const batchPattern = /\b([A-Z]{1,4}\d+[A-Z]?\d*)\b/i;
            
            // If entire content doesn't have a potential batch code, try right-side texts
            if (!batchPattern.test(batchText) && textParts.length > 0) {
                // Try rightmost texts (regardless of Y position)
                const maxX = Math.max(...textParts.map(t => t.x));
                const rightTexts = textParts.filter(t => Math.abs(t.x - maxX) < 2);
                batchText = rightTexts.map(t => t.text).join(' ');
                
                // If still not found, try bottom-right
                if (!batchPattern.test(batchText)) {
                    const bottomY = Math.max(...textParts.map(t => t.y));
                    const bottomTexts = textParts.filter(t => Math.abs(t.y - bottomY) < 1);
                    const rightmostText = bottomTexts.sort((a, b) => b.x - a.x)[0];
                    batchText = rightmostText ? rightmostText.text : content;
                }
            }
        }

        // Look for batch codes in the text with priority order
        // Priority 1: Standard batch code patterns (most specific)
        const standardBatchMatch = batchText.match(/\b(SW\d+|C\d+S\d+|C\d+B\d+|ME\d+S\d+|ME\d+B\d+|EEE\d+S\d+|EEE\d+B\d+|IPE\d+S\d+|IPE\d+B\d+|CEE\d+S\d+|CEE\d+B\d+|MPE\d+S\d+|MPE\d+B\d+|BTM\d+S\d+|BTM\d+B\d+|CSS\d+|CSB\d+)\b/i);
        
        if (standardBatchMatch) {
            let batchCode = standardBatchMatch[1].toUpperCase();
            // Fix common typos: CSS1 -> C5S1, CSB2 -> C5B2
            batchCode = batchCode.replace(/^CS([SB])(\d+)$/, 'C5$1$2');
            batch = batchCode;
        }
        // Priority 2: Simple section codes (S5, B2, etc.)
        else {
            const simpleBatchMatch = batchText.match(/\b([SB]\d+)\b/i);
            if (simpleBatchMatch) {
                batch = simpleBatchMatch[1].toUpperCase();
            }
            // Priority 3: Check for MSc/PhD indicators
            else if (content.includes('MSc') || content.includes('PhD')) {
                batch = 'MSc(CSE)';
            }
            // Fallback to 'All' if no batch found
            else {
                batch = 'All';
            }
        }

        // Map shorter day names
        const dayMap = {
            'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
            'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
        };

        // Determine if this schedule needs review (suspicious batch or course)
        const needsReview = batch === 'All' || 
                           !course || 
                           course.length < 3 || 
                           /^[^a-zA-Z0-9]+$/.test(course) || // Only special chars
                           /^(ME|IPE|EEE|CEE|MPE|BTM)\d/i.test(course); // Department codes in course field

        if (content.length > 2) {
            schedules.push({
                roomNumber,
                day: dayMap[day] || day,
                timeSlot: { start, end }, // Can be multi-slot
                course,
                batch, // Raw batch code: SW3, C1S1, etc.
                teacher: '',
                isBiWeekly, // Mark if bi-weekly lab
                needsReview, // Flag for admin review if batch is "All" or course is suspicious
                rawContent: content
            });
        }
    });

    // NOTE: Merging is now done ONLY in parsePDFSchedule (global post-process)
    // to avoid double-merging issues. No per-page merge here.
}

module.exports = {
    parsePDFSchedule,
    normalizeTime
};
