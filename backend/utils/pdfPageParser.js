const fs = require('fs');
const PDFParser = require('pdf2json');

/**
 * Parse semester-wise PDF page by page using coordinate-based extraction
 * Extracts batch name from top-left position where it consistently appears
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<{totalPages: number, pageMapping: Array}>}
 */
async function parseSemesterPDF(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', errData => {
            console.error('PDF Parser Error:', errData.parserError);
            reject(errData.parserError);
        });
        
        pdfParser.on('pdfParser_dataReady', pdfData => {
            try {
                const totalPages = pdfData.Pages.length;
                const pageMapping = [];

                console.log(`\n========== Parsing ${totalPages} pages with coordinate-based extraction ==========\n`);

                // Process each page
                pdfData.Pages.forEach((page, pageIndex) => {
                    const pageNumber = pageIndex + 1;
                    
                    // Extract all text items with coordinates
                    const textItems = [];
                    
                    if (page.Texts) {
                        page.Texts.forEach(text => {
                            const x = text.x;
                            const y = text.y;
                            const decodedText = decodeURIComponent(text.R[0].T);
                            
                            textItems.push({ x, y, text: decodedText });
                        });
                    }

                    // Sort by Y (top to bottom), then X (left to right)
                    textItems.sort((a, b) => {
                        if (Math.abs(a.y - b.y) < 0.5) {
                            return a.x - b.x;
                        }
                        return a.y - b.y;
                    });

                    // Look for batch name in top area with expanded coordinates
                    // Try multiple areas: top-left, top-center, and first 10 items
                    const topLeftItems = textItems.filter(item => item.y < 3 && item.x < 15);
                    const topAreaItems = textItems.filter(item => item.y < 5 && item.x < 20);
                    const topLeftText = topLeftItems.map(item => item.text).join(' ');
                    const topAreaText = topAreaItems.map(item => item.text).join(' ');
                    const firstItemsText = textItems.slice(0, 10).map(item => item.text).join(' ');

                    console.log(`\nPage ${pageNumber}:`);
                    console.log(`  Top-left (y<3, x<15): "${topLeftText}"`);
                    console.log(`  Top-area (y<5, x<20): "${topAreaText}"`);
                    console.log(`  First 10 items: "${firstItemsText}"`);
                    console.log(`  First 10 with coords:`, textItems.slice(0, 10).map(t => `(x:${t.x.toFixed(2)}, y:${t.y.toFixed(2)}) "${t.text}"`));

                    // Try to extract from top-left first
                    let batchInfo = extractBatchInfo(topLeftText);
                    
                    // If not found, try expanded top area
                    if (!batchInfo.fullText) {
                        batchInfo = extractBatchInfo(topAreaText);
                        if (batchInfo.fullText) {
                            console.log(`  → Found in expanded top area`);
                        }
                    }
                    
                    // If still not found, try first 10 items
                    if (!batchInfo.fullText) {
                        batchInfo = extractBatchInfo(firstItemsText);
                        if (batchInfo.fullText) {
                            console.log(`  → Found in first 10 items`);
                        }
                    }
                    
                    // Last resort: try full page
                    if (!batchInfo.fullText) {
                        const allText = textItems.map(item => item.text).join(' ');
                        batchInfo = extractBatchInfo(allText);
                        if (batchInfo.fullText) {
                            console.log(`  → Found in full page scan`);
                        }
                    }

                    const fullText = batchInfo.fullText || `Page ${pageNumber}`;
                    
                    console.log(`  ✓ Final result: "${fullText}"`);

                    pageMapping.push({
                        pageNumber,
                        batch: batchInfo.batch || '',
                        section: batchInfo.section || '',
                        semester: batchInfo.semester || '',
                        fullText,
                        rawText: topLeftText.substring(0, 200)
                    });
                });

                console.log('========== Extraction Summary ==========');
                pageMapping.forEach(p => {
                    console.log(`  Page ${p.pageNumber}: ${p.fullText}`);
                });
                console.log('========================================\n');

                resolve({ totalPages, pageMapping });
            } catch (error) {
                console.error('Error processing PDF data:', error);
                reject(error);
            }
        });

        pdfParser.loadPDF(pdfPath);
    });
}

/**
 * Extract batch, section, and semester information from page text
 * @param {string} text - Text content of the page
 * @returns {{batch: string|null, section: string|null, semester: string|null, fullText: string|null}}
 */
function extractBatchInfo(text) {
    const result = {
        batch: null,
        section: null,
        semester: null,
        fullText: null
    };

    // Log first 300 chars for debugging
    console.log('Parsing page text:', text.substring(0, 300));

    // Pattern 1: "MSc/PhD CSE" or "MSc / PhD CSE"
    const patternMScPhD = /(MSc\s*\/?\s*PhD\s+(?:CSE|SWE|EEE|MPE|CEE|BTM))/i;
    const matchMScPhD = text.match(patternMScPhD);
    if (matchMScPhD) {
        result.fullText = matchMScPhD[1].replace(/\s+/g, ' ');
        console.log('✓ Matched MSc/PhD:', result.fullText);
        return result;
    }

    // Pattern 2: "MSc CSE" or "MSc(CSE)"
    const patternMSc = /(MSc\s*\(?\s*(?:CSE|SWE|EEE|MPE|CEE|BTM)\s*\)?)/i;
    const matchMSc = text.match(patternMSc);
    if (matchMSc) {
        result.fullText = matchMSc[1].replace(/\s+/g, ' ');
        console.log('✓ Matched MSc:', result.fullText);
        return result;
    }

    // Pattern 3: "BSc CSE 1st-Section 1" or "BSc SWE 1st-Section 1" (with any department)
    const pattern1 = /(BSc\s+(?:CSE|SWE|EEE|MPE|CEE|BTM)\s+\d+(?:st|nd|rd|th)-Section\s+\d+)/i;
    const match1 = text.match(pattern1);
    if (match1) {
        result.fullText = match1[1];
        console.log('✓ Matched Pattern 1:', result.fullText);
        return result;
    }

    // Pattern 2: "BSc CSE 7th - Section 2" (with spaces around hyphen)
    const pattern2 = /(BSc\s+(?:CSE|SWE|EEE|MPE|CEE|BTM)\s+\d+(?:st|nd|rd|th)\s+-\s+Section\s+\d+)/i;
    const match2 = text.match(pattern2);
    if (match2) {
        result.fullText = match2[1];
        console.log('✓ Matched Pattern 2:', result.fullText);
        return result;
    }

    // Pattern 3: "BSc CSE 7th Semester Section 2"
    const pattern3 = /(BSc\s+(?:CSE|SWE|EEE|MPE|CEE|BTM)\s+\d+(?:st|nd|rd|th)?\s+Semester\s+Section\s+\d+)/i;
    const match3 = text.match(pattern3);
    if (match3) {
        result.fullText = match3[1];
        console.log('✓ Matched Pattern 3:', result.fullText);
        return result;
    }

    // Pattern 4: "BSc SWE 1st" or "BSc CSE 1st" (without section - common in headers)
    const pattern4 = /(BSc\s+(?:CSE|SWE|EEE|MPE|CEE|BTM)\s+\d+(?:st|nd|rd|th))/i;
    const match4 = text.match(pattern4);
    if (match4) {
        result.fullText = match4[1];
        console.log('✓ Matched Pattern 4:', result.fullText);
        return result;
    }

    // Pattern 5: "BSc CSE 7th Semester" (without section)
    const pattern5 = /(BSc\s+(?:CSE|SWE|EEE|MPE|CEE|BTM)\s+\d+(?:st|nd|rd|th)\s+Semester)/i;
    const match5 = text.match(pattern5);
    if (match5) {
        result.fullText = match5[1];
        console.log('✓ Matched Pattern 5:', result.fullText);
        return result;
    }

    // Pattern 6: "7th Semester Section 2"
    const pattern6 = /(\d+(?:st|nd|rd|th)\s+Semester\s+Section\s+\d+)/i;
    const match6 = text.match(pattern6);
    if (match6) {
        result.fullText = match6[1];
        console.log('✓ Matched Pattern 6:', result.fullText);
        return result;
    }

    // Pattern 7: "1st Year Section 1" or "4th year"
    const pattern7 = /(\d+(?:st|nd|rd|th)\s+[Yy]ear(?:\s+Section\s+\d+)?)/i;
    const match7 = text.match(pattern7);
    if (match7) {
        result.fullText = match7[1];
        console.log('✓ Matched Pattern 7 (Year):', result.fullText);
        return result;
    }

    console.log('✗ No pattern matched');
    return result;
}

module.exports = {
    parseSemesterPDF,
    extractBatchInfo
};
