import axios from 'axios';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const prodUrl = 'https://class-routine-management.onrender.com';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:5000/api' : `${prodUrl}/api`),
});

// Add auth token to requests
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle auth errors
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const uploadSchedule = async (formData) => {
    return await API.post('/schedule/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const getSchedules = async (filters = {}) => {
    return await API.get('/schedule', { params: filters });
};

export const getRooms = async () => {
    return await API.get('/schedule/rooms');
};

export const checkAvailability = async (date, startTime, endTime) => {
    return await API.get('/schedule/availability', {
        params: { date, startTime, endTime }
    });
};

export const createBooking = async (bookingData) => {
    return await API.post('/booking', bookingData);
};

export const deleteBooking = async (id) => {
    return await API.delete(`/booking/${id}`);
};

export const getBookings = async (filters = {}) => {
    return await API.get('/booking', { params: filters });
};

export const checkSlot = async (roomNumber, date, startTime, endTime) => {
    return await API.get('/booking/check', {
        params: { roomNumber, date, startTime, endTime }
    });
};

// Manual schedule management
export const createScheduleEntry = async (scheduleData) => {
    return await API.post('/schedule/manual', scheduleData);
};

export const updateScheduleEntry = async (id, scheduleData) => {
    return await API.put(`/schedule/manual/${id}`, scheduleData);
};

export const deleteScheduleEntry = async (id) => {
    return await API.delete(`/schedule/manual/${id}`);
};

export const splitSlot = async (roomNumber, day, timeSlot) => {
    return await API.post('/schedule/split-slot', {
        roomNumber,
        day,
        timeSlot
    });
};

// Quiz Room Booking
export const getQuizConfig = async () => {
    return await API.get('/quiz-booking/config');
};

export const getQuizBookings = async (startDate, endDate) => {
    return await API.get('/quiz-booking', {
        params: { startDate, endDate }
    });
};

export const createQuizBooking = async (bookingData) => {
    return await API.post('/quiz-booking', bookingData);
};

export const updateQuizBooking = async (id, bookingData) => {
    return await API.put(`/quiz-booking/${id}`, bookingData);
};

export const deleteQuizBooking = async (id) => {
    return await API.delete(`/quiz-booking/${id}`);
};

export const getCoursesByBatch = async (batch) => {
    return await API.get('/quiz-booking/courses-by-batch', {
        params: { batch }
    });
};

export const getCourseNicknames = async () => {
    return await API.get('/schedule/course-nicknames');
};

// Schedule PDF Management
export const uploadSchedulePDF = async (formData) => {
    return await API.post('/schedule/upload-pdf', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const getPDFInfo = async (type, department) => {
    return await API.get(`/schedule/pdf-info/${type}`, {
        params: { department }
    });
};

export const getPDFUrl = (type) => {
    const token = localStorage.getItem('token');
    const serverUrl = import.meta.env.VITE_SERVER_URL || (isLocalhost ? 'http://localhost:5000' : prodUrl);
    return `${serverUrl}/api/schedule/pdf/${type}?token=${token}`;
};

export const getBatchList = async (type, department) => {
    return await API.get(`/schedule/pdf-batches/${type}`, {
        params: { department }
    });
};

export const getFilteredPDFUrl = (type, filter) => {
    const token = localStorage.getItem('token');
    const encodedFilter = encodeURIComponent(filter);
    const serverUrl = import.meta.env.VITE_SERVER_URL || (isLocalhost ? 'http://localhost:5000' : prodUrl);
    return `${serverUrl}/api/schedule/pdf/${type}/filtered?token=${token}&filter=${encodedFilter}`;
};

export const getSemesterSchedules = async (batch) => {
    return await API.get('/schedule/semester-wise', {
        params: { batch }
    });
};

// Get semester pages
export const getSemesterPages = async () => {
    return await API.get('/schedule/semester-pages');
};

export const getSemesterPageUrl = (pageNumber) => {
    const token = localStorage.getItem('token');
    const serverUrl = import.meta.env.VITE_SERVER_URL || (isLocalhost ? 'http://localhost:5000' : prodUrl);
    return `${serverUrl}/api/schedule/semester-page/${pageNumber}?token=${token}`;
};

export const updateSemesterPageBatchName = async (pageNumber, batchName) => {
    return await API.put(`/schedule/semester-page/${pageNumber}`, { batchName });
};

export const deleteSemesterPage = async (pageNumber) => {
    return await API.delete(`/schedule/semester-page/${pageNumber}`);
};

// Semester Schedule Management (Manual Input)
export const getSemesterSchedule = async (pageNumber, weekStartDate = null) => {
    const params = weekStartDate ? { weekStartDate } : {};
    return await API.get(`/schedule/semester/${pageNumber}`, { params });
};

export const createSemesterEntry = async (pageNumber, scheduleData) => {
    return await API.post(`/schedule/semester/${pageNumber}`, scheduleData);
};

export const updateSemesterEntry = async (id, scheduleData) => {
    return await API.put(`/schedule/semester/${id}`, scheduleData);
};

export const deleteSemesterEntry = async (id) => {
    return await API.delete(`/schedule/semester/${id}`);
};

export const splitSemesterSlot = async (pageNumber, splitData) => {
    return await API.post(`/schedule/semester/${pageNumber}/split-slot`, splitData);
};

// Tutorial endpoints
export const skipTutorial = async () => {
    return await API.put('/auth/tutorial-skip');
};

export const completeTutorial = async () => {
    return await API.put('/auth/tutorial-complete');
};

export const resetTutorial = async () => {
    return await API.put('/auth/tutorial-reset');
};

// Clear all data except DEMO-101
export const clearAllData = async () => {
    return await API.delete('/schedule/clear-all');
};

// Get all unique batches from schedules
export const getBatches = async () => {
    return await API.get('/schedule/batches');
};

// Add a new batch manually
export const addBatch = async (batchName) => {
    return await API.post('/schedule/batches', { batchName });
};

// Delete a batch and all its schedules
export const deleteBatch = async (batchName) => {
    return await API.delete(`/schedule/batches/${encodeURIComponent(batchName)}`);
};
