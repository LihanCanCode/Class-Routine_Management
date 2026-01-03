import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5000/api',
});

// Add auth token to requests
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        const guestMode = localStorage.getItem('guestMode');
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        } else if (guestMode === 'true') {
            // Guest mode - no auth required for viewing
            config.headers['X-Guest-Mode'] = 'true';
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
            const guestMode = localStorage.getItem('guestMode');
            
            // Only redirect if not in guest mode
            if (guestMode !== 'true') {
                localStorage.removeItem('token');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
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

export const checkAvailability = async (date, startTime, endTime) => {
    return await API.get('/schedule/availability', {
        params: { date, startTime, endTime }
    });
};

export const createBooking = async (bookingData) => {
    return await API.post('/booking', bookingData);
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
    return `http://localhost:5000/api/schedule/pdf/${type}?token=${token}`;
};

export const getBatchList = async (type, department) => {
    return await API.get(`/schedule/pdf-batches/${type}`, {
        params: { department }
    });
};

export const getFilteredPDFUrl = (type, filter) => {
    const token = localStorage.getItem('token');
    const encodedFilter = encodeURIComponent(filter);
    return `http://localhost:5000/api/schedule/pdf/${type}/filtered?token=${token}&filter=${encodedFilter}`;
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
    const guestMode = localStorage.getItem('guestMode');
    
    if (guestMode === 'true') {
        return `http://localhost:5000/api/schedule/semester-page/${pageNumber}?guestMode=true`;
    }
    return `http://localhost:5000/api/schedule/semester-page/${pageNumber}?token=${token}`;
};

export const updateSemesterPageBatchName = async (pageNumber, batchName) => {
    return await API.put(`/schedule/semester-page/${pageNumber}`, { batchName });
};

export const deleteSemesterPage = async (pageNumber) => {
    return await API.delete(`/schedule/semester-page/${pageNumber}`);
};
