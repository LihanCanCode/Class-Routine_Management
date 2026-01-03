const PDFParser = require("pdf2json");
const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataReady", pdfData => {
    const page1 = pdfData.Pages[0];
    console.log("Total pages:", pdfData.Pages.length);
    console.log("Page 1 texts:", page1.Texts.length);
    console.log("\nFirst 30 elements:");
    
    page1.Texts.slice(0, 30).forEach((t, i) => {
        const text = decodeURIComponent(t.R[0].T);
        console.log(i, "x=" + t.x.toFixed(2), "y=" + t.y.toFixed(2), 'text="' + text + '"');
    });
});

pdfParser.on("pdfParser_dataError", err => console.error("Error:", err));
pdfParser.loadPDF("E:/3-1/Classrooms and Labs-1.pdf");
