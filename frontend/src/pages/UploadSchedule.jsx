import React, { useState, useEffect } from 'react';
import { uploadSchedule, uploadSchedulePDF, clearAllData, getBatches, deleteBatch, addBatch } from '../services/api';
import { Upload, FileText, CheckCircle, AlertCircle, Calendar, Trash2, Tags, Plus } from 'lucide-react';

const UploadSchedule = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [uploadType, setUploadType] = useState('routine-wise'); // 'routine-wise' or 'semester-wise'
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [batches, setBatches] = useState([]);
    const [showBatchManager, setShowBatchManager] = useState(false);
    const [batchToDelete, setBatchToDelete] = useState(null);
    const [deletingBatch, setDeletingBatch] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');
    const [addingBatch, setAddingBatch] = useState(false);

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const response = await getBatches();
            setBatches(response.data);
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        }
    };

    const handleDeleteBatch = async (batchName) => {
        try {
            setDeletingBatch(true);
            await deleteBatch(batchName);
            setBatchToDelete(null);
            await fetchBatches(); // Refresh the list
            setStatus('success');
            setMessage(`Batch '${batchName}' and all its schedules deleted successfully.`);
        } catch (error) {
            console.error('Failed to delete batch:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to delete batch.');
        } finally {
            setDeletingBatch(false);
        }
    };

    const handleAddBatch = async (e) => {
        e.preventDefault();
        if (!newBatchName.trim()) return;

        try {
            setAddingBatch(true);
            await addBatch(newBatchName.trim());
            setNewBatchName('');
            await fetchBatches(); // Refresh the list
            setStatus('success');
            setMessage(`Batch '${newBatchName.trim()}' added successfully.`);
        } catch (error) {
            console.error('Failed to add batch:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to add batch.');
        } finally {
            setAddingBatch(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleClearAll = async () => {
        try {
            setStatus('uploading');
            const response = await clearAllData();
            setStatus('success');
            setMessage(`Successfully cleared ${response.data.deleted.schedules} schedules, ${response.data.deleted.rooms} rooms, and ${response.data.deleted.bookings} bookings. DEMO-101 remains intact.`);
            setShowClearConfirm(false);
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to clear data.');
            setShowClearConfirm(false);
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
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                            Upload Room Routine
                        </h1>
                        <p className="text-slate-600 mb-8">
                            Upload the PDF routine to automatically parse schedules or store semester-wise view.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowBatchManager(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-all border border-blue-200"
                            title="Manage batches"
                        >
                            <Tags size={18} />
                            Manage Batches
                        </button>
                        <button
                            onClick={() => setShowClearConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-all border border-red-200"
                            title="Clear all data except DEMO-101"
                        >
                            <Trash2 size={18} />
                            Clear All Data
                        </button>
                    </div>
                </div>

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

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:border-primary-500 transition-colors bg-slate-50/50" data-tutorial="file-upload">
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

            {/* Clear All Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Clear All Data?</h3>
                        </div>
                        <p className="text-slate-600 mb-6">
                            This will permanently delete all schedules, rooms, and bookings from the database.
                            <br /><br />
                            <strong className="text-green-600">DEMO-101 tutorial room will be preserved.</strong>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg"
                            >
                                Yes, Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Manager Modal */}
            {showBatchManager && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Tags size={24} />
                                <h3 className="text-xl font-bold">Manage Batches</h3>
                            </div>
                            <button
                                onClick={() => setShowBatchManager(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <AlertCircle size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                            <p className="text-slate-600 mb-4">
                                Review and delete irrelevant batches extracted from PDFs. You can also add batches manually if parsing missed any.
                            </p>
                            
                            {/* Add Batch Form */}
                            <form onSubmit={handleAddBatch} className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Add New Batch</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newBatchName}
                                        onChange={(e) => setNewBatchName(e.target.value)}
                                        placeholder="e.g., CSE 25, SW4"
                                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        disabled={addingBatch}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newBatchName.trim() || addingBatch}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={18} />
                                        {addingBatch ? 'Adding...' : 'Add'}
                                    </button>
                                </div>
                            </form>

                            {batches.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Tags size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>No batches found. Upload a schedule or add one manually.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {batches.map((batch) => (
                                        <div
                                            key={batch}
                                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group"
                                        >
                                            <span className="font-medium text-slate-700 text-sm">{batch}</span>
                                            <button
                                                onClick={() => setBatchToDelete(batch)}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all p-1 rounded hover:bg-red-50"
                                                title="Delete batch"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Batch Confirmation */}
            {batchToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Delete Batch?</h3>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to delete batch <strong className="text-slate-900">'{batchToDelete}'</strong>?
                            <br /><br />
                            This will permanently delete all schedules associated with this batch.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setBatchToDelete(null)}
                                disabled={deletingBatch}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteBatch(batchToDelete)}
                                disabled={deletingBatch}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deletingBatch ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadSchedule;
