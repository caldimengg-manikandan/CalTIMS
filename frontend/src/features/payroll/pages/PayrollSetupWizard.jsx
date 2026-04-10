import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Calculator, 
  Users, 
  Landmark, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  DollarSign, 
  CreditCard, 
  ShieldCheck,
  Building,
  Info,
  Eye,
  Activity,
  Save,
  Lock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollAPI, userAPI } from '@/services/endpoints';
import { toast } from 'react-hot-toast';
import { ROLE_TEMPLATES, calculateSalaryBreakdown } from '../payrollUtils';
import { formatCurrency, getCurrencySymbol } from '@/utils/formatters';
import Spinner from '@/components/ui/Spinner';

const steps = [
  { id: 1, name: 'Salary Breakdown', icon: Calculator, description: 'Earnings & Deductions' },
  { id: 2, name: 'Employee & CTC', icon: Users, description: 'Assign pay & search' },
  { id: 3, name: 'Bank & Compliance', icon: Landmark, description: 'Payment details' },
  { id: 4, name: 'Review & Confirm', icon: Eye, description: 'Final confirmation' }
];

const LOCAL_STORAGE_KEY = 'caltims_payroll_wizard_draft';
const PayrollSetupWizard = () => {
   const { userId: urlUserId } = useParams();
   const location = useLocation();
   const preSelectedUser = location.state?.preSelectedUser;
 
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [currentStep, setCurrentStep] = useState(1);
   const [selectedRole, setSelectedRole] = useState('employee');
   const [ctcType, setCtcType] = useState('annual'); // 'annual' or 'monthly'
   const [isSaving, setIsSaving] = useState(false);
   const [error, setError] = useState(null); // API error handling
   
   // State for Step 1
   const [structure, setStructure] = useState({
     name: 'Payroll Profile',
     earnings: [...ROLE_TEMPLATES['employee'].earnings],
     deductions: [...ROLE_TEMPLATES['employee'].deductions]
   });
 
   // State for Step 2
   const [selectedUser, setSelectedUser] = useState(preSelectedUser || null);
   const [ctcValue, setCtcValue] = useState('');
 
   // State for Step 3
   const [bankDetails, setBankDetails] = useState({
     bankName: '',
     accountNumber: '',
     ifscCode: '',
     pan: '',
     uan: ''
   });

  // Data Fetching
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['usersList'],
    queryFn: () => userAPI.getAll({ limit: 1000 }).then(res => res.data.data)
  });

  const { data: profiles } = useQuery({
    queryKey: ['payrollProfiles'],
    queryFn: () => payrollAPI.getProfiles().then(res => res.data.data)
  });

  const { data: globalPolicy } = useQuery({
    queryKey: ['payrollPolicy'],
    queryFn: () => payrollAPI.getPolicy().then(res => res.data.data)
  });

  // If we have a userId in URL but no selectedUser, find them in the users list
  useEffect(() => {
    if (urlUserId && !selectedUser && users) {
      const user = users.find(u => u.id === urlUserId || u._id === urlUserId);
      if (user) setSelectedUser(user);
    }
  }, [urlUserId, users, selectedUser]);

  // Initialize from LocalStorage or existing profile
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStructure(parsed.structure || {
          name: 'Payroll Profile',
          earnings: ROLE_TEMPLATES['employee'].earnings,
          deductions: ROLE_TEMPLATES['employee'].deductions
        });
        setCtcValue(parsed.ctcValue || '');
        setCtcType(parsed.ctcType || 'annual');
        setBankDetails(parsed.bankDetails || {
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          pan: '',
          uan: ''
        });
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
      } catch (err) {
        console.error('Failed to load draft', err);
      }
    }
  }, []);

  // Sync with global policy when it loads or when role template is applied
  const getAppliedTemplate = (role, policy) => {
    const template = JSON.parse(JSON.stringify(ROLE_TEMPLATES[role]));
    
    if (policy?.statutory) {
      // Override PF if exists
      const pfComp = template.deductions.find(d => d.name.includes('Provident Fund') || d.name === 'PF');
      if (pfComp && policy.statutory.pf?.enabled) {
        pfComp.value = policy.statutory.pf.employeeRate || 12;
      }

      // Override ESI if exists
      const esiComp = template.deductions.find(d => d.name.includes('ESI'));
      if (esiComp && policy.statutory.esi?.enabled) {
        esiComp.value = policy.statutory.esi.employeeRate || 0.75;
      }
    }
    
    return template;
  };

  // Effect to initialize structure once policy is loaded
  useEffect(() => {
    if (globalPolicy && structure.earnings.length === ROLE_TEMPLATES['employee'].earnings.length) {
      const synced = getAppliedTemplate('employee', globalPolicy);
      setStructure({
        name: 'Payroll Profile',
        earnings: synced.earnings,
        deductions: synced.deductions
      });
    }
  }, [globalPolicy]);

  // Save to LocalStorage
  useEffect(() => {
    const draft = { structure, ctcValue, ctcType, bankDetails, currentStep };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
  }, [structure, ctcValue, ctcType, bankDetails, currentStep]);

  // Logic: Real-time Breakdown
  const monthlyCTC = useMemo(() => {
    const val = parseFloat(ctcValue) || 0;
    return ctcType === 'annual' ? val / 12 : val;
  }, [ctcValue, ctcType]);

  const breakdown = useMemo(() => {
    return calculateSalaryBreakdown(structure.earnings, structure.deductions, monthlyCTC);
  }, [structure, monthlyCTC]);

    // Check for existing profile when user is selected
    useEffect(() => {
      if (selectedUser) {
        // Support both user._id and user.id 
        const uId = selectedUser._id || selectedUser.id;
        
        // 🏦 1. Always sync bank details from the user model
        setBankDetails({
          bankName: selectedUser.bankName || selectedUser.employee?.bankName || '',
          accountNumber: selectedUser.accountNumber || selectedUser.employee?.accountNumber || '',
          ifscCode: selectedUser.ifscCode || selectedUser.employee?.ifscCode || '',
          pan: selectedUser.pan || selectedUser.employee?.pan || '',
          uan: selectedUser.uan || selectedUser.employee?.uan || ''
        });

        // 📊 2. If a profile exists, load salary structure & CTC
        if (profiles) {
          const existing = profiles.find(p => (p.employee?.userId === uId) || (p.user === uId));
          if (existing) {
            toast.success(`Loaded existing profile for ${selectedUser.name}`);
            setStructure({
              name: 'Payroll Profile',
              earnings: existing.earnings || ROLE_TEMPLATES['employee'].earnings,
              deductions: existing.deductions || ROLE_TEMPLATES['employee'].deductions
            });
            setCtcValue(existing.annualCTC ? existing.annualCTC.toString() : (existing.monthlyCTC ? (existing.monthlyCTC * 12).toString() : ''));
            setCtcType('annual');
          }
        }
      }
    }, [selectedUser, profiles]);

  const handleToggleCtcType = (newType) => {
    if (newType === ctcType) return;
    const val = parseFloat(ctcValue) || 0;
    if (val > 0) {
      if (newType === 'annual') {
        setCtcValue((val * 12).toFixed(2));
      } else {
        setCtcValue((val / 12).toFixed(2));
      }
    }
    setCtcType(newType);
  };

  const setupProfileMutation = useMutation({
    mutationFn: (data) => payrollAPI.setupFullProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollProfiles'] });
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      toast.success('Salary configuration saved successfully!');
      navigate('/payroll/profiles');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save configuration');
      setIsSaving(false);
    }
  });

  const handleApplyTemplate = (role) => {
    setSelectedRole(role);
    const synced = getAppliedTemplate(role, globalPolicy);
    setStructure({
      ...structure,
      earnings: synced.earnings,
      deductions: synced.deductions
    });
  };

  const updateComponent = (type, index, field, value) => {
    const updated = [...structure[type]];
    let newValue = value;

    if (field === 'value') {
      if (value.length > 8) return;
      const numVal = parseFloat(value);
      if (numVal < 0) newValue = '0';
      if (updated[index].calculationType === 'Percentage' && numVal > 100) {
        newValue = '100';
      }
    } else if (field === 'calculationType' && value === 'Percentage') {
      const currentVal = parseFloat(updated[index].value);
      if (currentVal > 100) updated[index].value = '100';
      if (currentVal < 0) updated[index].value = '0';
    } else if (field === 'calculationType' && value === 'Fixed') {
      const currentVal = parseFloat(updated[index].value);
      if (currentVal < 0) updated[index].value = '0';
    }

    updated[index][field] = newValue;
    setStructure({ ...structure, [type]: updated });
  };

  const addComponent = (type) => {
    const newComp = { name: '', value: 0, calculationType: 'Fixed', basedOn: 'CTC' };
    setStructure({ ...structure, [type]: [...structure[type], newComp] });
  };

  const removeComponent = (type, index) => {
    const updated = [...structure[type]];
    updated.splice(index, 1);
    setStructure({ ...structure, [type]: updated });
  };

  const isBankComplete = useMemo(() => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    
    return (
      bankDetails.bankName.length > 2 && 
      bankDetails.accountNumber.length >= 8 && 
      ifscRegex.test(bankDetails.ifscCode) && 
      panRegex.test(bankDetails.pan)
    );
  }, [bankDetails]);

  const handleNext = () => {
    setError(null);
    if (currentStep === 1) {
      if (structure.earnings.length === 0) return toast.error('At least 1 earning component is required');
      
      // Dependency check: If any component is based on 'Basic Salary', it must exist
      const hasBasic = structure.earnings.some(e => e.name === 'Basic Salary');
      const needsBasic = [...structure.earnings, ...structure.deductions].some(c => c.basedOn === 'Basic Salary');
      
      if (needsBasic && !hasBasic) {
        return toast.error('Basic salary is required as other components depend on it');
      }

      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedUser) return toast.error('Please select an employee');
      if (!ctcValue || parseFloat(ctcValue) <= 0) return toast.error('Please enter a valid CTC');
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!isBankComplete) return toast.error('Please ensure all required bank and identity fields are valid');
      setCurrentStep(4);
    } else if (currentStep === 4) {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setIsSaving(true);
    setError(null);
    const annualCTC = ctcType === 'annual' ? parseFloat(ctcValue) : parseFloat(ctcValue) * 12;
    
    setupProfileMutation.mutate({
      employeeId: selectedUser.employee.id,
      annualCTC,
      earnings: structure.earnings,
      deductions: structure.deductions,
      bankDetails
    });
  };

  if (usersLoading) return <div className="h-screen flex items-center justify-center bg-white"><Spinner size="lg" /></div>;

  const isEditMode = selectedUser && profiles?.some(p => p.employeeId === selectedUser.employee?.id);
  const currentProfile = selectedUser ? profiles?.find(p => p.employeeId === selectedUser.employee?.id) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-black p-6 md:p-12 overflow-x-hidden font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Activity className="text-white" size={20} />
               </div>
               <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Payroll Profile Setup</h1>
            </div>
            <p className="text-slate-500 dark:text-gray-400 font-medium ml-13">Configure compensation, bank and compliance in one flow</p>
          </div>
          
          <div className="flex items-center bg-white dark:bg-[#111111] p-2 rounded-2xl border border-slate-200 dark:border-[#333333] shadow-sm">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div 
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${currentStep === s.id ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : 'text-slate-400'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border-2 transition-all ${currentStep === s.id ? 'bg-white dark:bg-black border-indigo-600' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-[#333333]'}`}>
                    {currentStep > s.id ? <Check size={12} className="text-emerald-600" /> : s.id}
                  </div>
                  <span className="hidden lg:block text-[10px] font-black uppercase tracking-wider">{s.name}</span>
                </div>
                {idx < steps.length - 1 && <div className="w-4 h-px bg-slate-100 dark:bg-[#333333] mx-1" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] border border-slate-200 dark:border-[#333333] shadow-2xl shadow-indigo-100/20 dark:shadow-none min-h-[650px] flex flex-col overflow-hidden relative">
          
          {/* Progress Bar (Subtle) */}
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 dark:bg-white/5">
             <motion.div 
               className="h-full bg-indigo-600 dark:bg-indigo-500" 
               initial={{ width: '0%' }}
               animate={{ width: `${(currentStep / steps.length) * 100}%` }}
               transition={{ duration: 0.5 }}
             />
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1: BREAKDOWN */}
            {currentStep === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                className="p-8 md:p-14 flex-1 space-y-12"
              >
                           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                      <Calculator className="text-indigo-600" size={24} />
                      Define Salary Breakdown
                    </h2>
                    <p className="text-sm font-medium text-slate-400 dark:text-gray-500">Select a preset or customize manually</p>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl">
                    {['intern', 'employee', 'manager'].map(role => (
                      <button 
                        key={role}
                        onClick={() => handleApplyTemplate(role)}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedRole === role ? 'bg-white dark:bg-[#1a1a1a] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  {/* Earnings */}
                  <div className="space-y-8">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#333333] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-black text-slate-600 dark:text-gray-300 uppercase tracking-widest">Earnings (Payable)</span>
                      </div>
                      <button onClick={() => addComponent('earnings')} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-5">
                      {structure.earnings.map((e, idx) => (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="flex gap-4 items-center">
                          <div className="flex-1 space-y-1">
                             <input value={e.name} onChange={(ev) => updateComponent('earnings', idx, 'name', ev.target.value)} placeholder="Basic Salary" className="w-full bg-slate-50 dark:bg-white/5 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 rounded-xl px-4 py-3.5 text-xs font-bold outline-none ring-offset-0 focus:ring-4 focus:ring-indigo-500/5 dark:text-white transition-all" />
                             {e.calculationType === 'Percentage' && (
                               <select 
                                 value={e.basedOn || 'CTC'} 
                                 onChange={(ev) => updateComponent('earnings', idx, 'basedOn', ev.target.value)}
                                 className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-tighter bg-transparent outline-none ml-1 cursor-pointer hover:text-indigo-500"
                               >
                                 <option value="CTC" className="dark:bg-[#1a1a1a]">% of CTC</option>
                                 <option value="Basic Salary" className="dark:bg-[#1a1a1a]">% of Basic</option>
                               </select>
                             )}
                          </div>
                          <div className="flex items-center bg-slate-50 dark:bg-white/5 rounded-2xl p-1 gap-1">
                             <button onClick={() => updateComponent('earnings', idx, 'calculationType', 'Fixed')} className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase ${e.calculationType === 'Fixed' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>Fix</button>
                             <button onClick={() => updateComponent('earnings', idx, 'calculationType', 'Percentage')} className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase ${e.calculationType === 'Percentage' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>%</button>
                          </div>
                          <div className="relative w-28">
                             <input 
                               type="number" 
                               min="0"
                               max={e.calculationType === 'Percentage' ? "100" : undefined}
                               value={e.value} 
                               onChange={(ev) => updateComponent('earnings', idx, 'value', ev.target.value)} 
                               className="w-full bg-slate-50 dark:bg-white/5 border-none rounded-xl px-4 py-3.5 text-xs font-black text-right dark:text-white outline-none ring-4 ring-transparent focus:ring-indigo-500/5 transition-all" 
                             />
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-20 dark:text-white">{e.calculationType === 'Fixed' ? currencySymbol : '%'}</span>
                          </div>
                          <button onClick={() => removeComponent('earnings', idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={18} /></button>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-8">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#333333] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-xs font-black text-slate-600 dark:text-gray-300 uppercase tracking-widest">Deductions (Subtractions)</span>
                      </div>
                      <button onClick={() => addComponent('deductions')} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"><Plus size={16} /></button>
                    </div>
                    <div className="space-y-5">
                      {structure.deductions.map((d, idx) => (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="flex gap-4 items-center">
                          <div className="flex-1 space-y-1">
                            <input value={d.name} onChange={(ev) => updateComponent('deductions', idx, 'name', ev.target.value)} placeholder="Provident Fund" className="w-full bg-slate-50 dark:bg-white/5 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 dark:text-white rounded-xl px-4 py-3.5 text-xs font-bold outline-none ring-4 ring-transparent focus:ring-indigo-500/5 transition-all" />
                            {d.calculationType === 'Percentage' && (
                               <select 
                                 value={d.basedOn || 'CTC'} 
                                 onChange={(ev) => updateComponent('deductions', idx, 'basedOn', ev.target.value)}
                                 className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-tighter bg-transparent outline-none ml-1 cursor-pointer hover:text-indigo-500"
                               >
                                 <option value="CTC" className="dark:bg-[#1a1a1a]">% of CTC</option>
                                 <option value="Basic Salary" className="dark:bg-[#1a1a1a]">% of Basic</option>
                                 <option value="Gross" className="dark:bg-[#1a1a1a]">% of Gross</option>
                               </select>
                            )}
                          </div>
                          <div className="flex items-center bg-slate-50 dark:bg-white/5 rounded-2xl p-1 gap-1">
                             <button onClick={() => updateComponent('deductions', idx, 'calculationType', 'Fixed')} className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase ${d.calculationType === 'Fixed' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>Fix</button>
                             <button onClick={() => updateComponent('deductions', idx, 'calculationType', 'Percentage')} className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase ${d.calculationType === 'Percentage' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>%</button>
                          </div>
                          <div className="relative w-28">
                             <input 
                               type="number" 
                               min="0"
                               max={d.calculationType === 'Percentage' ? "100" : undefined}
                               value={d.value} 
                               onChange={(ev) => updateComponent('deductions', idx, 'value', ev.target.value)} 
                               className="w-full bg-slate-50 dark:bg-white/5 border-none rounded-xl px-4 py-3.5 text-xs font-black text-right dark:text-white outline-none ring-4 ring-transparent focus:ring-indigo-500/5 transition-all" 
                             />
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-20 dark:text-white">{d.calculationType === 'Fixed' ? currencySymbol : '%'}</span>
                          </div>
                          <button onClick={() => removeComponent('deductions', idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={18} /></button>
                        </motion.div>
                      ))}
                      {structure.deductions.length === 0 && <div className="p-10 bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-[#333333] rounded-[2rem] text-center"><p className="text-[10px] font-black text-slate-300 dark:text-gray-600 uppercase tracking-widest">No deductions added</p></div>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: EMPLOYEE & CTC */}
            {currentStep === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: 50 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -50 }}
                className="p-8 md:p-14 flex-1 flex flex-col items-center justify-center space-y-12 max-w-4xl mx-auto w-full"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Set Employee Salary</h2>
                  <p className="text-sm text-slate-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em]">Assignment & CTC Configuration</p>
                </div>

                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                   {/* Column 1: Configuration */}
                   <div className="space-y-12">
                      {/* Selected Employee Card */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">Selected Employee</label>
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-[#333333] rounded-2xl p-5 shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-500 transition-all">
                           <div className="w-12 h-12 bg-white dark:bg-[#1a1a1a] rounded-xl flex items-center justify-center shadow-sm text-indigo-500 group-hover:scale-110 transition-transform">
                              <Users size={20} />
                           </div>
                           <div className="flex-1">
                              <p className="text-sm font-black text-slate-800 dark:text-white">{selectedUser?.name || 'No Employee Selected'}</p>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tighter">ID: {selectedUser?.employee?.employeeCode || '—'}</p>
                           </div>
                           <div className="w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center bg-emerald-50">
                              <Check size={12} className="text-emerald-600" />
                           </div>
                        </div>
                      </div>

                      {/* CTC Input */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-end ml-1">
                           <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Cost to Company (CTC)</label>
                           <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg gap-1">
                              <button onClick={() => handleToggleCtcType('annual')} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${ctcType === 'annual' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>Yearly</button>
                              <button onClick={() => handleToggleCtcType('monthly')} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${ctcType === 'monthly' ? 'bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}>Monthly</button>
                           </div>
                        </div>
                        <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300 dark:text-gray-700 group-focus-within:text-indigo-500 transition-colors">{currencySymbol}</span>
                          <input 
                            type="number" 
                            min="0"
                            value={ctcValue}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr.length > 8) return;
                              const val = parseFloat(valStr);
                              if (val < 0) setCtcValue('0');
                              else setCtcValue(valStr);
                            }}
                            placeholder="0.00"
                            className="w-full pl-14 pr-8 py-8 bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 dark:text-white rounded-[2.5rem] text-5xl font-black focus:outline-none ring-4 ring-transparent focus:ring-indigo-500/5 transition-all placeholder:text-slate-200 dark:placeholder:text-gray-800"
                          />
                        </div>
                      </div>
                   </div>

                   {/* Calculation Preview */}
                   <div className="space-y-6 flex flex-col h-full">
                      <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex-1 relative overflow-hidden flex flex-col justify-between shadow-2xl shadow-indigo-100">
                         <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4"><DollarSign size={200} /></div>
                         <div className="space-y-1 relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Estimate Take-Home (Monthly)</span>
                            <h4 className="text-6xl font-black tracking-tighter">{currencySymbol}{formatCurrency(breakdown.netSalary)}</h4>
                            <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-8 mt-8 relative z-10">
                               <div className="space-y-0.5">
                                  <span className="text-[9px] font-black uppercase opacity-30">Gross Pay</span>
                                  <p className="text-xl font-black text-emerald-400">{currencySymbol}{formatCurrency(breakdown.grossPay)}</p>
                               </div>
                               <div className="space-y-0.5">
                                  <span className="text-[9px] font-black uppercase opacity-30">Deductions</span>
                                  <p className="text-xl font-black text-rose-400">{currencySymbol}{formatCurrency(breakdown.totalDeductions)}</p>
                               </div>
                            </div>

                            {/* 🎯 CTC Allocation Insight */}
                            {(parseFloat(ctcValue) > 0) && (
                               <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 relative z-10">
                                  <div className="flex justify-between items-center">
                                     <span className="text-[9px] font-bold text-white/40 uppercase">{ctcType === 'annual' ? 'Monthly Gross' : 'Annualized Gross'}</span>
                                     <span className="text-xs font-black text-white/80">{currencySymbol}{formatCurrency(ctcType === 'annual' ? breakdown.grossPay : breakdown.grossPay * 12)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-[9px] font-bold text-white/40 uppercase">{ctcType === 'annual' ? 'Target CTC' : 'Monthly CTC'}</span>
                                     <span className="text-xs font-black text-white/80">{currencySymbol}{formatCurrency(ctcType === 'annual' ? parseFloat(ctcValue) : parseFloat(ctcValue) * 12)}</span>
                                  </div>
                                  {Math.abs((breakdown.grossPay * 12) - (ctcType === 'annual' ? parseFloat(ctcValue) : parseFloat(ctcValue) * 12)) > 100 && (
                                     <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-[9px] font-bold text-amber-400/60 uppercase">Unallocated Gap</span>
                                        <span className="text-xs font-black text-amber-400">{currencySymbol}{formatCurrency((ctcType === 'annual' ? parseFloat(ctcValue) : parseFloat(ctcValue) * 12) - (breakdown.grossPay * 12))}</span>
                                     </div>
                                  )}
                               </div>
                            )}

                            {/* 🧾 Detailed Breakdown Summary */}
                            <div className="mt-8 pt-8 border-t border-white/10 space-y-2 max-h-56 overflow-y-auto no-scrollbar relative z-10">
                               <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-4">Structure Overview</p>
                               {breakdown.earnings.map((e, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs">
                                     <span className="text-[10px] font-bold text-white/40">{e.name}</span>
                                     <span className="font-black text-emerald-400/90 text-[11px]">{currencySymbol}{formatCurrency(e.calculatedValue)}</span>
                                  </div>
                               ))}
                               <div className="h-4" />
                               {breakdown.deductions.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs">
                                     <span className="text-[10px] font-bold text-white/40">{d.name}</span>
                                     <span className="font-black text-rose-400/90 text-[11px]">{currencySymbol}{formatCurrency(d.calculatedValue)}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="flex-1 p-5 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center gap-4 text-indigo-700 dark:text-indigo-400">
                            <Info size={18} className="shrink-0" />
                            <p className="text-[10px] font-bold leading-tight">CTC internally stored as **Annual CTC** to maintain system-wide consistency.</p>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: BANK & COMPLIANCE */}
            {currentStep === 3 && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, x: 50 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -50 }}
                className="p-8 md:p-14 flex-1 space-y-12"
              >
                <div className="flex justify-between items-center">
                   <div className="space-y-1">
                      <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-4">
                         <Landmark className="text-emerald-500" size={28} />
                         Bank & Compliance Details
                      </h2>
                      <p className="text-sm font-medium text-slate-400 dark:text-gray-500">Required for official salary disbursement and tax reporting</p>
                   </div>
                   <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${isBankComplete ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'}`}>
                      {isBankComplete ? (<><ShieldCheck size={18} /> Profile Complete</>) : (<><AlertCircle size={18} /> Missing Details</>)}
                   </div>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-center justify-between text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={18} />
                      <span className="text-xs font-bold">{error}</span>
                    </div>
                    <button onClick={handleFinalSubmit} className="text-[10px] font-black uppercase tracking-widest bg-white dark:bg-[#1a1a1a] px-4 py-2 rounded-xl shadow-sm hover:bg-rose-100 dark:hover:bg-white/5 transition-colors">Retry</button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] space-y-10 border border-slate-100 dark:border-[#333333]">
                      <div className="flex items-center gap-4 border-b border-slate-200/50 dark:border-white/5 pb-6">
                         <div className="w-10 h-10 bg-white dark:bg-[#1a1a1a] rounded-xl flex items-center justify-center shadow-sm"><Building size={20} className="text-slate-400 dark:text-gray-500" /></div>
                         <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400">Beneficiary Banking</span>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">Bank Name</label>
                            <input value={bankDetails.bankName} onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})} className="w-full bg-white dark:bg-[#1a1a1a] border-2 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 dark:text-white rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="e.g. Standard Chartered" />
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">Account Number</label>
                               <input 
                                 value={bankDetails.accountNumber} 
                                 onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value.replace(/[^0-9]/g, '')})} 
                                 maxLength={18}
                                 className="w-full bg-white dark:bg-[#1a1a1a] border-2 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 dark:text-white rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                                 placeholder="0000 0000 0000" 
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">IFSC Code</label>
                               <input 
                                 value={bankDetails.ifscCode} 
                                 onChange={(e) => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase().trim()})} 
                                 maxLength={11}
                                 className={`w-full bg-white dark:bg-[#1a1a1a] border-2 rounded-2xl px-5 py-4 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all ${bankDetails.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode) ? 'border-rose-400 text-rose-500' : 'border-transparent focus:border-indigo-100 dark:focus:border-indigo-500'}`} 
                                 placeholder="SCBL000000" 
                               />
                               {bankDetails.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode) && <p className="text-[9px] font-bold text-rose-400 mt-1 ml-1 uppercase">Invalid IFSC Format</p>}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="p-8 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] space-y-10 border border-slate-100 dark:border-[#333333]">
                      <div className="flex items-center gap-4 border-b border-slate-200/50 dark:border-white/5 pb-6">
                         <div className="w-10 h-10 bg-white dark:bg-[#1a1a1a] rounded-xl flex items-center justify-center shadow-sm"><CreditCard size={20} className="text-slate-400 dark:text-gray-500" /></div>
                         <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400">Government Identity</span>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">PAN Card Number</label>
                            <input 
                              value={bankDetails.pan} 
                              onChange={(e) => setBankDetails({...bankDetails, pan: e.target.value.toUpperCase().trim()})} 
                              maxLength={10}
                              className={`w-full bg-white dark:bg-[#1a1a1a] border-2 rounded-2xl px-5 py-4 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all uppercase ${bankDetails.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(bankDetails.pan) ? 'border-rose-400 text-rose-500' : 'border-transparent focus:border-indigo-100 dark:focus:border-indigo-500'}`} 
                              placeholder="ABCDE1234F" 
                            />
                            {bankDetails.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(bankDetails.pan) && <p className="text-[9px] font-bold text-rose-400 mt-1 ml-1 uppercase">Invalid PAN Format</p>}
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">UAN (Universal Account Number)</label>
                            <input 
                              value={bankDetails.uan} 
                              onChange={(e) => setBankDetails({...bankDetails, uan: e.target.value.replace(/[^0-9]/g, '')})} 
                              maxLength={12}
                              className="w-full bg-white dark:bg-[#1a1a1a] border-2 border-transparent focus:border-indigo-100 dark:focus:border-indigo-500 dark:text-white rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                              placeholder="1000 0000 0000" 
                            />
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <motion.div 
                key="step4" 
                initial={{ opacity: 0, x: 50 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -50 }}
                className="p-8 md:p-14 flex-1 space-y-12"
              >
                <div className="text-center space-y-2 mb-12">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-white">Final Review</h2>
                  <p className="text-sm text-slate-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em]">Overall Profile Summary</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   {/* Col 1: Employee & Bank Summary */}
                   <div className="space-y-8">
                      <div className="p-8 bg-white dark:bg-[#1a1a1a] border-2 border-slate-100 dark:border-[#333333] rounded-[2.5rem] shadow-sm space-y-6">
                         <div className="flex items-center gap-4 border-b border-slate-50 dark:border-white/5 pb-6">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Users size={20} /></div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400">Employee Information</span>
                         </div>
                         <div className="space-y-4">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Name</span><span className="text-sm font-black text-slate-800 dark:text-white">{selectedUser?.name}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Employee ID</span><span className="text-sm font-black text-slate-800 dark:text-white">{selectedUser?.employee?.employeeCode}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Annual CTC</span><span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{currencySymbol}{formatCurrency(ctcType === 'annual' ? parseFloat(ctcValue) : parseFloat(ctcValue) * 12)}</span></div>
                         </div>
                      </div>

                      <div className="p-8 bg-white dark:bg-[#1a1a1a] border-2 border-slate-100 dark:border-[#333333] rounded-[2.5rem] shadow-sm space-y-6">
                         <div className="flex items-center gap-4 border-b border-slate-50 dark:border-white/5 pb-6">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Building size={20} /></div>
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400">Bank & Identity</span>
                         </div>
                         <div className="space-y-4">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">Bank</span><span className="text-sm font-black text-slate-800 dark:text-white">{bankDetails.bankName || '—'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">IFSC</span><span className="text-sm font-black text-slate-800 dark:text-white">{bankDetails.ifscCode || '—'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">PAN</span><span className="text-sm font-black text-slate-800 dark:text-white">{bankDetails.pan || '—'}</span></div>
                         </div>
                      </div>
                   </div>

                   {/* Col 2: Salary Structure Summary */}
                   <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl space-y-8 overflow-hidden relative">
                      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4"><Calculator size={200} /></div>
                      <div className="relative z-10 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Monthly Take-Home Estimate</span>
                        <h3 className="text-5xl font-black text-white tracking-tighter">{currencySymbol}{formatCurrency(breakdown.netSalary)}</h3>
                      </div>
                      
                      <div className="space-y-6 relative z-10">
                        <div className="space-y-3">
                           <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">Earnings</span>
                           {breakdown.earnings.map((e, i) => (
                              <div key={i} className="flex justify-between items-center"><span className="text-[11px] font-bold text-white/50">{e.name}</span><span className="text-xs font-black text-emerald-400">{currencySymbol}{formatCurrency(e.calculatedValue)}</span></div>
                           ))}
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="space-y-3">
                           <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">Deductions</span>
                           {breakdown.deductions.map((d, i) => (
                              <div key={i} className="flex justify-between items-center"><span className="text-[11px] font-bold text-white/50">{d.name}</span><span className="text-xs font-black text-rose-400">{currencySymbol}{formatCurrency(d.calculatedValue)}</span></div>
                           ))}
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex justify-between items-end relative z-10">
                        <div className="space-y-1">
                           <span className="text-[9px] font-black uppercase text-white/20">Monthly Gross</span>
                           <p className="text-xl font-black text-emerald-400 opacity-80">{currencySymbol}{formatCurrency(breakdown.grossPay)}</p>
                        </div>
                        <div className="text-right space-y-1">
                           <span className="text-[9px] font-black uppercase text-white/20">Monthly Ded.</span>
                           <p className="text-xl font-black text-rose-400 opacity-80">{currencySymbol}{formatCurrency(breakdown.totalDeductions)}</p>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="p-8 md:px-14 md:py-10 border-t border-slate-100 dark:border-[#333333] flex justify-between bg-white/80 dark:bg-black/80 backdrop-blur-md sticky bottom-0 z-20">
            <button 
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1 || isSaving}
              className={`flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white'}`}
            >
              <ChevronLeft size={18} /> Previous Step
            </button>

            <button 
              onClick={handleNext}
              disabled={isSaving}
              className={`flex items-center gap-6 px-12 py-5 rounded-[2.5rem] bg-indigo-600 dark:bg-indigo-500 shadow-2xl shadow-indigo-200 dark:shadow-none text-white font-black text-xs uppercase tracking-[0.3em] transition-all hover:bg-indigo-700 dark:hover:bg-indigo-600 active:scale-95 disabled:grayscale disabled:opacity-50 group transition-all relative overflow-hidden`}
            >
              {isSaving ? (
                <span>Saving Profile...</span>
              ) : (
                <>
                  <span>
                    {currentStep === 4 ? 'Finish: Save Profile' : 
                     currentStep === 3 ? 'Next: Review Summary' : 
                     currentStep === 2 ? 'Next: Bank & Compliance' : 
                     'Next: Employee & CTC'}
                  </span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
              {/* Subtle shine effect */}
              <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:left-[100%] transition-all duration-700 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollSetupWizard;
