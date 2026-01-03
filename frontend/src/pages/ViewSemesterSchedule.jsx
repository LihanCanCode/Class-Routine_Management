import React, { useState, useEffect } from 'react';
import { getSemesterPages, getSemesterPageUrl, updateSemesterPageBatchName, deleteSemesterPage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, ChevronLeft, ChevronRight, Edit2, Save, X, Trash2 } from 'lucide-react';

const ViewSemesterSchedule = () => {
    const { user } = useAuth();
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPage, setSelectedPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [exists, setExists] = useState(false);
    const [error, setError] = useState('');
    const [editingPage, setEditingPage] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    
    const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

    useEffect(() => {
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await getSemesterPages();
            setPages(response.data.pages);
            setTotalPages(response.data.totalPages);
            setExists(response.data.exists);
            if (response.data.totalPages > 0) {
                setSelectedPage(1);
            }
            setLoading(false);
        } catch (err) {
            setError('Failed to load semester pages');
            setLoading(false);
        }
    };

    const handlePrevPage = () => {
        if (selectedPage > 1) {
            setSelectedPage(selectedPage - 1);
        }
    };

    const handleNextPage = () => {
        if (selectedPage < totalPages) {
            setSelectedPage(selectedPage + 1);
        }
    };

    const getCurrentPageInfo = () => {
        const pageData = pages.find(p => p.pageNumber === selectedPage);
        return pageData?.fullText || `Page ${selectedPage}`;
    };

    const handleEditBatchName = (pageNumber, currentName) => {
        setEditingPage(pageNumber);
        setEditValue(currentName);
    };

    const handleSaveBatchName = async (pageNumber) => {
        if (!editValue.trim()) {
            setError('Batch name cannot be empty');
            return;
        }

        try {
            setSaving(true);
            await updateSemesterPageBatchName(pageNumber, editValue);
            
            // Update local state
            setPages(pages.map(p => 
                p.pageNumber === pageNumber 
                    ? { ...p, fullText: editValue.trim() }
                    : p
            ));
            
            setEditingPage(null);
            setEditValue('');
            setError('');
        } catch (err) {
            setError('Failed to update batch name');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingPage(null);
        setEditValue('');
    };

    const handleDeletePage = async (pageNumber) => {
        if (!confirm(`Are you sure you want to delete page ${pageNumber}?`)) {
            return;
        }

        try {
            setLoading(true);
            await deleteSemesterPage(pageNumber);
            
            // Refresh pages
            await fetchPages();
            
            // Adjust selected page if necessary
            if (selectedPage === pageNumber && totalPages > 1) {
                setSelectedPage(Math.min(selectedPage, totalPages - 1));
            }
        } catch (err) {
            setError('Failed to delete page');
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                        Semester-wise Schedule
                    </h1>
                    <p className="text-slate-500">View class routines by batch and section</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {!exists || totalPages === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 text-lg">No semester schedules found. Please upload a semester-wise PDF first.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Page Navigation Tabs */}
                    <div className="glass-card rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-primary-600" />
                                <span className="font-semibold text-slate-700">
                                    {getCurrentPageInfo()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={selectedPage === 1}
                                    className={`p-2 rounded-lg transition-all ${
                                        selectedPage === 1
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                    }`}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm text-slate-600 min-w-[80px] text-center">
                                    Page {selectedPage} of {totalPages}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={selectedPage === totalPages}
                                    className={`p-2 rounded-lg transition-all ${
                                        selectedPage === totalPages
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                    }`}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Page Tabs with Batch Names */}
                        <div className="flex flex-wrap gap-2">
                            {pages.map((pageData) => {
                                const pageNum = pageData.pageNumber;
                                const displayLabel = pageData?.fullText || `Page ${pageNum}`;
                                const isLongLabel = displayLabel.length > 20;
                                const isEditing = editingPage === pageNum;
                                
                                return (
                                    <div key={pageNum} className="relative group">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1 p-2 bg-white border-2 border-primary-500 rounded-lg shadow-lg">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-40 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveBatchName(pageNum);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleSaveBatchName(pageNum)}
                                                    disabled={saving}
                                                    className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                                    title="Save"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setSelectedPage(pageNum)}
                                                    className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                                                        selectedPage === pageNum
                                                            ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-lg'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    } ${isLongLabel ? 'max-w-[200px]' : ''}`}
                                                    title={`${displayLabel} (Page ${pageNum})`}
                                                >
                                                    <div className="flex flex-col items-start">
                                                        <span className={isLongLabel ? 'truncate w-full' : ''}>
                                                            {displayLabel}
                                                        </span>
                                                        <span className={`text-xs ${
                                                            selectedPage === pageNum ? 'text-white/80' : 'text-slate-500'
                                                        }`}>
                                                            p.{pageNum}
                                                        </span>
                                                    </div>
                                                </button>
                                                {isAdmin && (
                                                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditBatchName(pageNum, displayLabel);
                                                            }}
                                                            className="p-1 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
                                                            title="Edit batch name"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePage(pageNum);
                                                            }}
                                                            className="p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                                                            title="Delete page"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* PDF Viewer */}
                    <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-slate-100">
                        <div className="bg-slate-50 p-3 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-600">
                                    {getCurrentPageInfo()}
                                </span>
                                <a
                                    href={getSemesterPageUrl(selectedPage)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Open in new tab ↗
                                </a>
                            </div>
                        </div>
                        <div className="bg-slate-100" style={{ height: '800px' }}>
                            <embed
                                src={getSemesterPageUrl(selectedPage)}
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                className="border-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewSemesterSchedule;
