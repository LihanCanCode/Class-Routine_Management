import React, { useState } from 'react';
import { uploadSchedule, uploadSchedulePDF } from '../services/api';
import { Upload, FileText, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

const UploadSchedule = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [uploadType, setUploadType] = useState('routine-wise'); // 'routine-wise' or 'semester-wise'

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        const formData = new FormData();
        formData.append('schedule', file);

        try {
            let response;
            if (uploadType === 'routine-wise') {
                formData.append('clearExisting', 'true');
                response = await uploadSchedule(formData);
                setStats(response.data.stats);
                setMessage('Schedule uploaded and parsed successfully!');
            } else {
                // semester-wise - just store PDF
                formData.append('type', 'semester-wise');
                response = await uploadSchedulePDF(formData);
                setMessage('Semester-wise PDF uploaded successfully!');
            }
            setStatus('success');
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to upload schedule.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="glass-card rounded-2xl p-8 mb-8 text-center animate-fade-in-up">
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                    Upload Room Routine
                </h1>
                <p className="text-slate-600 mb-8">
                    Upload the PDF routine to automatically parse schedules or store semester-wise view.
                </p>

                {/* Upload Type Selection */}
                <div className="flex gap-4 justify-center mb-6">
                    <button
                        onClick={() => {
                            setUploadType('routine-wise');
                            setFile(null);
                            setStatus('idle');
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                            uploadType === 'routine-wise'
                                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Calendar size={20} />
                        Routine-wise (Parse)
                    </button>
                    <button
                        onClick={() => {
                            setUploadType('semester-wise');
                            setFile(null);
                            setStatus('idle');
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                            uploadType === 'semester-wise'
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <FileText size={20} />
                        Semester-wise (Store PDF)
                    </button>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:border-primary-500 transition-colors bg-slate-50/50">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                    />
                    <label
                        htmlFor="pdf-upload"
                        className="cursor-pointer flex flex-col items-center justify-center gap-4"
                    >
                        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                            {file ? <FileText size={32} /> : <Upload size={32} />}
                        </div>

                        <div className="text-lg font-medium text-slate-700">
                            {file ? file.name : 'Click to select PDF or drag and drop'}
                        </div>

                        {!file && (
                            <div className="text-sm text-slate-500">
                                <p>Supports PDF files only</p>
                                {uploadType === 'routine-wise' ? (
                                    <p className="mt-2 text-xs">Will parse and extract room schedules</p>
                                ) : (
                                    <p className="mt-2 text-xs">Will store PDF for semester-wise viewing</p>
                                )}
                            </div>
                        )}
                    </label>
                </div>

                {file && (
                    <button
                        onClick={handleUpload}
                        disabled={status === 'uploading'}
                        className={`mt-6 px-8 py-3 rounded-lg font-semibold text-white transition-all shadow-lg shadow-primary-500/30
              ${status === 'uploading'
                                ? 'bg-slate-400 cursor-not-allowed'
                                : uploadType === 'semester-wise'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:scale-105 active:scale-95'
                                    : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:scale-105 active:scale-95'
                            }`}
                    >
                        {status === 'uploading' 
                            ? (uploadType === 'routine-wise' ? 'Parsing PDF...' : 'Uploading PDF...') 
                            : 'Upload & Process'}
                    </button>
                )}

                {status === 'success' && (
                    <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-left animate-fade-in">
                        <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-green-800">Success</h3>
                            <p className="text-green-700">{message}</p>
                            {stats && (
                                <p className="text-sm text-green-600 mt-1">
                                    Found {stats.roomsFound} rooms and created {stats.schedulesCreated} schedule entries.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-left animate-fade-in">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-800">Error</h3>
                            <p className="text-red-700">{message}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadSchedule;
