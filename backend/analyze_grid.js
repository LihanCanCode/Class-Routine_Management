const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('debug_structure.json'));
    const page = data.Pages[0];

    console.log('--- GRID ANALYSIS ---');

    // Helper to decode
    const decode = (t) => decodeURIComponent(t.R[0].T);

    // Find Room Headers
    const rooms = page.Texts.filter(t => decode(t).includes('Room-'));
    rooms.forEach(r => console.log(`ROOM: "${decode(r)}" at x=${r.x}, y=${r.y}`));

    // Find Days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayElements = page.Texts.filter(t => days.includes(decode(t).trim()));
    dayElements.forEach(d => console.log(`DAY: "${decode(d)}" at x=${d.x}, y=${d.y}`));

    // Find Times
    const timePattern = /\d{1,2}:\d{2}/;
    const timeElements = page.Texts.filter(t => timePattern.test(decode(t)));
    timeElements.forEach(t => console.log(`TIME: "${decode(t)}" at x=${t.x}, y=${t.y}`));

    // Find a sample content cell (e.g., CSE something)
    const courseElements = page.Texts.filter(t => decode(t).includes('CSE'));
    console.log('Sample Configuration Items (first 5):');
    courseElements.slice(0, 5).forEach(c => console.log(`CONTENT: "${decode(c)}" at x=${c.x}, y=${c.y}`));

} catch (e) {
    console.error(e);
}
