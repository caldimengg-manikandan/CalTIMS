import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import incidentService from '../../services/incidents/incidentService';
import { validateString } from '../../utils/validation';

const INCIDENT_CATEGORIES = [
    'timesheet error',
    'project missing',
    'incorrect hours',
    'leave conflict',
    'general help'
];

const VALIDATION_RULES = {
    title: { name: 'Title', min: 5, max: 100, required: true },
    description: { name: 'Description', min: 20, max: 500, required: true }
};

const CreateIncidentModal = ({ isOpen, onClose, relatedTimesheetId = null, onSuccess, initialData = null }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        category: 'general help',
        priority: 'Medium',
        description: '',
    });

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: initialData?.title || '',
                category: initialData?.category || 'general help',
                priority: initialData?.priority || 'Medium',
                description: initialData?.description || '',
            });
            setErrors({});
            setTouched({});
        }
    }, [isOpen, initialData]);

    const validateField = useCallback((name, value) => {
        const rules = VALIDATION_RULES[name];
        if (!rules) return '';
        return validateString(value, rules);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Update form data
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Clear error as user corrects input
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Apply real-time validation if field was already touched
        if (touched[name]) {
            const error = validateField(name, value);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const isFormValid = () => {
        const titleError = validateField('title', formData.title);
        const descError = validateField('description', formData.description);
        return !titleError && !descError;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Final validation check
        const titleError = validateField('title', formData.title);
        const descError = validateField('description', formData.description);

        if (titleError || descError) {
            setErrors({ title: titleError, description: descError });
            setTouched({ title: true, description: true });
            toast.error('Please fix the validation errors before submitting');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = { ...formData };
            if (relatedTimesheetId) {
                payload.relatedTimesheet = relatedTimesheetId;
            }

            await incidentService.createIncident(payload);
            toast.success('Support ticket created successfully. Admins have been notified.');

            setFormData({ title: '', category: 'general help', priority: 'Medium', description: '' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating incident:', error);
            toast.error(error.response?.data?.message || 'Failed to create support ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const renderFieldHeader = (label, name, rules) => (
        <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={name} className="label-regular !mb-0">
                {label} {rules?.required && <span className="text-red-500">*</span>}
            </label>
            {rules?.max && (
                <span className={`text-[10px] font-medium tabular-nums ${
                    formData[name]?.length > rules.max ? 'text-red-500' : 
                    formData[name]?.length >= rules.min ? 'text-emerald-500' : 'text-slate-400'
                }`}>
                    {formData[name]?.length}/{rules.max}
                </span>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                <div 
                    className="fixed inset-0 transition-opacity bg-slate-900/60 backdrop-blur-sm" 
                    onClick={onClose} 
                />

                <div className="relative inline-block w-full px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-2xl shadow-2xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8 animate-scale-in">
                    <div className="absolute top-0 right-0 pt-6 pr-6">
                        <button
                            type="button"
                            className="p-1 text-slate-400 transition-colors bg-white rounded-full hover:text-slate-600 hover:bg-slate-100 focus:outline-none"
                            onClick={onClose}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-start mb-8">
                        <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 bg-indigo-50 rounded-xl">
                            <AlertCircle className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-xl font-bold text-slate-900">Report an Issue</h3>
                           
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="form-group">
                            {renderFieldHeader('Issue Title', 'title', VALIDATION_RULES.title)}
                            <input
                                type="text"
                                name="title"
                                id="title"
                                value={formData.title}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`input h-11 ${errors.title ? 'input-error' : formData.title.length >= 5 ? 'border-emerald-200 focus:border-emerald-500' : ''}`}
                                placeholder="e.g., Unable to submit timesheet for Week 14"
                            />
                            {errors.title && <p className="error-msg">{errors.title}</p>}
                            {!errors.title && <p className="helper-text">Minimize title to 5-100 characters.</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="form-group">
                                <label htmlFor="category" className="label-regular">Category</label>
                                <div className="relative">
                                    <select
                                        name="category"
                                        id="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="input h-11 appearance-none pr-10"
                                    >
                                        {INCIDENT_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="priority" className="label-regular">Priority Level</label>
                                <div className="relative">
                                    <select
                                        name="priority"
                                        id="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        className="input h-11 appearance-none pr-10"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            {renderFieldHeader('Description', 'description', VALIDATION_RULES.description)}
                            <textarea
                                id="description"
                                name="description"
                                rows={5}
                                value={formData.description}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`input !h-auto min-h-[120px] py-3 ${errors.description ? 'input-error' : formData.description.length >= 20 ? 'border-emerald-200 focus:border-emerald-500' : ''}`}
                                placeholder="Provide step-by-step details of what happened..."
                            />
                            {errors.description && <p className="error-msg">{errors.description}</p>}
                            {!errors.description && <p className="helper-text font-medium">Please provide at least 20 characters.</p>}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
                            <button
                                type="button"
                                className="btn-secondary w-full sm:w-auto"
                                onClick={onClose}
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !isFormValid()}
                                className="btn-primary w-full sm:w-auto shadow-md shadow-indigo-200/50"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Submitting...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Submit Ticket
                                    </span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateIncidentModal;
