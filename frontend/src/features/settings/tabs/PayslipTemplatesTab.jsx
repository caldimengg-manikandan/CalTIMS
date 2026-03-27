import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, CheckCircle, Trash2, Eye, 
  Settings, Upload, Save, X, 
  Layout, Palette, Grid, Monitor, AlertCircle,
  Building2
} from 'lucide-react';
import { payslipTemplateAPI } from '../../../services/endpoints';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '../../../store/settingsStore';
import { useAuthStore } from '../../../store/authStore';

const LAYOUT_OPTIONS = [
  { id: 'CORPORATE', name: 'Corporate', description: 'Standard professional blue theme', icon: Building2 },
  { id: 'MODERN', name: 'Modern', description: 'Clean grayscale with large text', icon: Layout },
  { id: 'MINIMAL', name: 'Minimal', description: 'Detailed but focused breakdown', icon: Grid },
  { id: 'EXECUTIVE', name: 'Executive', description: 'Premium indigo with badge styles', icon: Monitor },
  { id: 'COMPACT', name: 'Compact', description: 'Single column condensed view', icon: FileText },
];

const PayslipTemplatesTab = () => {
  const { user } = useAuthStore();
  const { fetchPayslipDesign } = useSettingsStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({ 
    name: '', 
    description: '', 
    layoutType: 'CORPORATE', 
    backgroundImageUrl: '' 
  });
  const [uploadingBg, setUploadingBg] = useState(false);
  const [backgroundPreview, setBackgroundPreview] = useState('');

  useEffect(() => {
    return () => {
      if (backgroundPreview) {
        URL.revokeObjectURL(backgroundPreview);
      }
    };
  }, [backgroundPreview]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await payslipTemplateAPI.getAll();
      setTemplates(res.data.data.templates);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await payslipTemplateAPI.setDefault(id);
      toast.success('Default template updated');
      fetchTemplates();
      fetchPayslipDesign(); // Refresh global design
    } catch (err) {
      toast.error('Failed to update default template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await payslipTemplateAPI.delete(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handlePreview = async (template) => {
    try {
      setPreviewTemplate(template);
      const res = await payslipTemplateAPI.preview({ 
        layoutType: template.layoutType,
        backgroundImageUrl: template.backgroundImageUrl,
        htmlContent: template.htmlContent,
        companyId: user?.companyId
      });
      setPreviewHtml(res.data.data.html);
      console.log("Preview BG:", template.backgroundPreview || template.backgroundImageUrl);
    } catch (err) {
      toast.error('Preview failed');
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Validation
    if (!file.type.includes("image")) {
      toast.error("Only image files (JPG/PNG) are allowed");
      return;
    }

    // 2. Immediate Local Preview
    const previewUrl = URL.createObjectURL(file);
    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    setBackgroundPreview(previewUrl);

    // 3. Server Upload
    const formData = new FormData();
    formData.append('background', file);

    try {
      setUploadingBg(true);
      const res = await payslipTemplateAPI.uploadBackground(formData);
      setUploadData(prev => ({ ...prev, backgroundImageUrl: res.data.data.url }));
      toast.success('Background uploaded');
    } catch (err) {
      toast.error('Upload failed. Use JPG/PNG under 5MB.');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleLayoutSelect = (layoutId) => {
    const hasBg = backgroundPreview || uploadData.backgroundImageUrl;
    if (hasBg) {
      if (!window.confirm('Changing the base template will reset your custom background design. Do you want to continue?')) {
        return;
      }
      if (backgroundPreview) {
        URL.revokeObjectURL(backgroundPreview);
        setBackgroundPreview('');
      }
    }
    setUploadData(prev => ({ ...prev, layoutType: layoutId, backgroundImageUrl: '' }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    try {
      await payslipTemplateAPI.create({
        ...uploadData,
        companyId: user?.companyId
      });
      toast.success('Design saved successfully');
      setShowUploadModal(false);
      setUploadData({ name: '', description: '', layoutType: 'CORPORATE', backgroundImageUrl: '' });
      fetchTemplates();
      fetchPayslipDesign(); // Refresh global design
    } catch (err) {
      toast.error('Failed to save design');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-transparent">
            Payslip Customizer
          </h1>
          <p className="text-slate-500 mt-1">Design your enterprise payslips with visual layouts and custom branding.</p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200"
        >
          <Palette size={18} />
          Create New Design
        </button>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div 
            key={template._id}
            className={`group relative bg-white border-2 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl ${
              template.isSystemDefault ? 'border-primary' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            {/* Template Card Content */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${template.type === 'DEFAULT' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {LAYOUT_OPTIONS.find(l => l.id === template.layoutType)?.icon ? (
                    React.createElement(LAYOUT_OPTIONS.find(l => l.id === template.layoutType).icon, { size: 24 })
                  ) : <FileText size={24} />}
                </div>
                {template.isSystemDefault && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    <CheckCircle size={10} />
                    Active Design
                  </span>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors uppercase tracking-tight">
                {template.name}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{template.layoutType}</span>
                {template.backgroundImageUrl && <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase">Custom BG</span>}
              </div>
              <p className="text-sm text-slate-500 mt-3 line-clamp-2">
                {template.description || 'Enterprise payslip design configuration.'}
              </p>

              {/* Actions Footer */}
              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePreview(template)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Preview Design"
                  >
                    <Eye size={20} />
                  </button>
                  {template.type === 'CUSTOM' && (
                    <button 
                      onClick={() => handleDelete(template._id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete Design"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                
                {!template.isSystemDefault && (
                  <button 
                    onClick={() => handleSetDefault(template._id)}
                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="text-indigo-600" size={24} />
                  Live Preview: <span className="text-indigo-600">{previewTemplate.name}</span>
                </h2>
                <p className="text-sm text-slate-500 font-medium tracking-tight">Real-time simulation of the selected layout and branding.</p>
              </div>
              <button 
                onClick={() => {setPreviewTemplate(null); setPreviewHtml('');}}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100/50 p-4 md:p-8">
              <div 
                className="mx-auto shadow-lg rounded-xl overflow-hidden min-h-full max-w-[800px]"
                style={{
                    backgroundImage: (previewTemplate?.backgroundPreview || previewTemplate?.backgroundImageUrl) 
                        ? `url(${previewTemplate.backgroundPreview || previewTemplate.backgroundImageUrl})` 
                        : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: "#ffffff"
                }}
              >
                {previewHtml ? (
                  <iframe 
                    srcDoc={previewHtml} 
                    className="w-full h-full min-h-[842px] border-none bg-transparent"
                    allowtransparency="true"
                    title="Template Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="font-bold tracking-tight uppercase text-xs">Generating Live Preview...</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button 
                  onClick={() => {setPreviewTemplate(null); setPreviewHtml('');}}
                  className="px-6 py-2.5 text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all"
                >
                  Close
                </button>
                {!previewTemplate.isSystemDefault && (
                   <button 
                    onClick={() => {
                        handleSetDefault(previewTemplate._id);
                        setPreviewTemplate(null);
                    }}
                    className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                  >
                    Activate Design
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Visual Designer Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form 
            onSubmit={handleUpload}
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500"
          >
            <div className="p-8 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Palette size={24} />
                  </div>
                  Visual Payslip Designer
                </h2>
                <button 
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    if (backgroundPreview) {
                        URL.revokeObjectURL(backgroundPreview);
                        setBackgroundPreview('');
                    }
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-slate-500">Customize your enterprise payslips. No coding required.</p>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Step 1: Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Design Name</label>
                  <input 
                    type="text"
                    required
                    value={uploadData.name}
                    onChange={(e) => setUploadData({...uploadData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                    placeholder="e.g., Corporate Standard 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <input 
                    type="text"
                    value={uploadData.description}
                    onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                    placeholder="Briefly describe this variant..."
                  />
                </div>
              </div>

              {/* Step 2: Template Selection */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Step 1: Select Base Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {LAYOUT_OPTIONS.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => handleLayoutSelect(layout.id)}
                      className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left ${
                        uploadData.layoutType === layout.id 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-slate-100 hover:border-indigo-200 bg-white'
                      }`}
                    >
                      <div className={`p-2 rounded-lg mb-3 ${uploadData.layoutType === layout.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <layout.icon size={20} />
                      </div>
                      <span className="font-bold text-sm text-slate-900">{layout.name}</span>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{layout.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Background Upload */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Step 2: Custom Branding (Optional)</label>
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-32 h-20 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {(backgroundPreview || uploadData.backgroundImageUrl) ? (
                        <img 
                            src={backgroundPreview || uploadData.backgroundImageUrl} 
                            alt="Background Preview" 
                            className="w-full h-full object-cover rounded-md" 
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                            <Monitor size={24} className="text-slate-200" />
                            <span className="text-[8px] text-slate-400 font-bold uppercase">No Preview</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm mb-1">Upload Background Image</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        Choose a light, plain-designed background for your payslip. 
                        Avoid images with text to prevent overlap with payroll data.
                      </p>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                          <Upload size={14} />
                          {uploadingBg ? 'Uploading...' : 'Choose File'}
                          <input type="file" className="hidden" accept=".jpg,.jpeg,.png" onChange={handleBgUpload} disabled={uploadingBg} />
                        </label>
                        { (backgroundPreview || uploadData.backgroundImageUrl) && (
                          <button 
                            type="button"
                            onClick={() => {
                                setUploadData({...uploadData, backgroundImageUrl: ''});
                                if (backgroundPreview) {
                                    URL.revokeObjectURL(backgroundPreview);
                                    setBackgroundPreview('');
                                }
                            }}
                            className="text-rose-500 text-xs font-bold hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                   <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 flex gap-3">
                     <AlertCircle size={16} className="shrink-0" />
                     <p className="text-[10px] leading-relaxed font-medium">
                        <strong>Important:</strong> The system will automatically place all payroll fields on top of your background. 
                        Ensure the background is sparse to maintain readability.
                     </p>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button 
                    type="button"
                    onClick={async () => {
                        try {
                            const res = await payslipTemplateAPI.preview({
                                ...uploadData,
                                companyId: user?.companyId
                            });
                            setPreviewHtml(res.data.data.html);
                            setPreviewTemplate({ 
                                ...uploadData, 
                                backgroundPreview: backgroundPreview, // 👈 Pass local preview
                                name: '(Draft) ' + uploadData.name 
                            });
                            console.log("Preview BG (Draft):", backgroundPreview || uploadData.backgroundImageUrl);
                        } catch (err) {
                            toast.error('Preview failed');
                        }
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-indigo-600 text-indigo-600 rounded-xl font-bold transition-all shadow-sm"
                >
                    <Eye size={18} />
                    Live Preview
                </button>
              </div>
              <div className="flex gap-3">
                <button 
                    type="button"
                    onClick={() => {
                        setShowUploadModal(false);
                        if (backgroundPreview) {
                            URL.revokeObjectURL(backgroundPreview);
                            setBackgroundPreview('');
                        }
                    }}
                    className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition-all"
                >
                    Cancel
                </button>
                <button 
                    type="submit"
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                >
                    Save Design
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PayslipTemplatesTab;
