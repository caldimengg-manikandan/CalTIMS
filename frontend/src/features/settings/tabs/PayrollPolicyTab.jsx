import React, { useState, useEffect } from 'react';
import { 
  Plus, Save, History, Calculator, ShieldCheck, Clock, Settings2, 
  Trash2, ChevronRight, AlertCircle, CheckCircle2, RefreshCcw,
  Percent, DollarSign, Wallet, Scaling, Briefcase, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { policyAPI } from '../../../services/endpoints';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';

const PayrollPolicyTab = () => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const { data } = await policyAPI.getPolicy();
      setPolicy(data);
      if (data) fetchPreview(data);
    } catch (err) {
      toast.error('Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async (currentPolicy) => {
    setPreviewLoading(true);
    try {
      const { data } = await policyAPI.preview(currentPolicy || policy);
      setPreview(data);
    } catch (err) {
      console.error('Preview failed', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async (isNewVersion = false) => {
    setSaving(true);
    try {
      if (isNewVersion) {
        await policyAPI.createVersion(policy);
        toast.success('New policy version created');
      } else {
        await policyAPI.updatePolicy(policy);
        toast.success('Policy updated successfully');
      }
      fetchPolicy();
    } catch (err) {
      toast.error('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const addComponent = () => {
    if (!policy) return;
    const newComp = { name: 'New Component', type: 'EARNING', calculationType: 'percentage', value: 0, formula: '' };
    setPolicy({ ...policy, salaryComponents: [...(policy.salaryComponents || []), newComp] });
  };

  const removeComponent = (index) => {
    if (!policy) return;
    const updated = [...(policy.salaryComponents || [])];
    updated.splice(index, 1);
    setPolicy({ ...policy, salaryComponents: updated });
  };

  const updateComponent = (index, field, value) => {
    if (!policy) return;
    const updated = [...(policy.salaryComponents || [])];
    updated[index] = { ...updated[index], [field]: value };
    setPolicy({ ...policy, salaryComponents: updated });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!policy) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-400">
      <AlertCircle size={40} className="text-rose-400" />
      <p className="font-semibold text-slate-600">No payroll policy found.</p>
      <p className="text-sm text-center max-w-sm">The backend could not return a policy. Please check your connection or seed the database.</p>
      <button onClick={fetchPolicy} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
        Retry
      </button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-2">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-transparent">
            Policy Settings
          </h1>
          
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all font-medium border border-indigo-100"
          >
            <History size={18} />
            New Version
          </button>
          <button 
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all font-medium shadow-lg shadow-indigo-100"
          >
            {saving ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
            Synchronize Changes
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Navigation & Forms */}
        <div className="xl:col-span-8 space-y-6">
          <nav className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-2xl w-fit border border-slate-200 backdrop-blur-sm">
            {[
              { id: 'components', label: 'Salary Components', icon: Wallet },
              { id: 'statutory', label: 'Statutory Rules', icon: ShieldCheck },
              { id: 'attendance', label: 'Attendance & OT', icon: Clock },
              { id: 'rounding', label: 'Engine Config', icon: Settings2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300",
                  activeTab === tab.id 
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'components' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden backdrop-blur-xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                          <Scaling size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Earning & Deduction Hub</h3>
                      </div>
                      <button 
                        onClick={addComponent}
                        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-100"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(policy.salaryComponents || []).map((comp, idx) => (
                        <div key={idx} className="p-6 hover:bg-slate-50/80 transition-all group relative">
                          <button 
                            onClick={() => removeComponent(idx)}
                            className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-1 space-y-2 text-sm">
                              <label className="text-slate-400 font-medium">Component Name</label>
                              <input 
                                value={comp.name}
                                onChange={(e) => updateComponent(idx, 'name', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-700"
                              />
                            </div>
                            <div className="md:col-span-1 space-y-2 text-sm">
                              <label className="text-slate-400 font-medium">Type & Basis</label>
                              <div className="flex gap-2">
                                <select 
                                  value={comp.type}
                                  onChange={(e) => updateComponent(idx, 'type', e.target.value)}
                                  className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                >
                                  <option value="EARNING">Earning</option>
                                  <option value="DEDUCTION">Deduction</option>
                                </select>
                                <select 
                                  value={comp.calculationType}
                                  onChange={(e) => updateComponent(idx, 'calculationType', e.target.value)}
                                  className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                                >
                                  <option value="fixed">Fixed</option>
                                  <option value="percentage">Basis %</option>
                                  <option value="formula">Expression</option>
                                </select>
                              </div>
                            </div>
                            <div className="md:col-span-2 space-y-2 text-sm">
                              <label className="text-slate-400 font-medium flex items-center justify-between">
                                Calculation Logic
                                {comp.calculationType === 'formula' && (
                                  <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">Ready for Engine</span>
                                )}
                              </label>
                              <div className="relative group/input">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors">
                                  {comp.calculationType === 'formula' ? <Calculator size={18} /> : 
                                   comp.calculationType === 'percentage' ? <Percent size={18} /> : 
                                   <DollarSign size={18} />}
                                </div>
                                {comp.calculationType === 'formula' ? (
                                  <input 
                                    value={comp.formula}
                                    placeholder="e.g. BASIC * 0.4"
                                    onChange={(e) => updateComponent(idx, 'formula', e.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-indigo-600"
                                  />
                                ) : (
                                  <input 
                                    type="number"
                                    value={comp.value}
                                    onChange={(e) => updateComponent(idx, 'value', parseFloat(e.target.value))}
                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-semibold"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'statutory' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Provident Fund */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                           <IndianRupee size={24} />
                         </div>
                         <div>
                           <h4 className="font-bold text-slate-800 text-lg leading-tight">Provident Fund (EPF)</h4>
                           <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Statutory Deductions</span>
                         </div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={policy.statutory.pf.enabled}
                        onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, pf: { ...policy.statutory.pf, enabled: e.target.checked } } })}
                        className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                       <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase">Employee Contribution %</label>
                         <input 
                           type="number"
                           value={policy.statutory.pf.employeeRate}
                           onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, pf: { ...policy.statutory.pf, employeeRate: parseFloat(e.target.value) } } })}
                           className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase">Employer Contribution %</label>
                         <input 
                           type="number"
                           value={policy.statutory.pf.employerRate}
                           onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, pf: { ...policy.statutory.pf, employerRate: parseFloat(e.target.value) } } })}
                           className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                         />
                       </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Wage Ceiling for PF Calculation</label>
                      <div className="flex items-center gap-3">
                        <IndianRupee size={16} className="text-slate-400" />
                        <input 
                          type="number"
                          value={policy.statutory.pf.wageLimit}
                          onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, pf: { ...policy.statutory.pf, wageLimit: parseFloat(e.target.value) } } })}
                          className="bg-transparent text-lg font-bold text-slate-800 outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ESI */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                           <Briefcase size={24} />
                         </div>
                         <div>
                           <h4 className="font-bold text-slate-800 text-lg leading-tight">State Insurance (ESI)</h4>
                           <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Statutory Deductions</span>
                         </div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={policy.statutory.esi.enabled}
                        onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, esi: { ...policy.statutory.esi, enabled: e.target.checked } } })}
                        className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                       <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase">Employee Rate %</label>
                         <input 
                           type="number"
                           step="0.01"
                           value={policy.statutory.esi.employeeRate}
                           onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, esi: { ...policy.statutory.esi, employeeRate: parseFloat(e.target.value) } } })}
                           className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase">Wage Limit Ceiling</label>
                         <input 
                           type="number"
                           value={policy.statutory.esi.wageLimit}
                           onChange={(e) => setPolicy({ ...policy, statutory: { ...policy.statutory, esi: { ...policy.statutory.esi, wageLimit: parseFloat(e.target.value) } } })}
                           className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                         />
                       </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <AlertCircle size={18} className="text-amber-600 mt-1 flex-shrink-0" />
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        ESI is only applicable for employees whose Gross Salary is less than or equal to the specified wage limit.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                          <Clock size={24} />
                        </div>
                        <h4 className="font-bold text-slate-800 text-xl">Attendance Policy</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                             <p className="font-bold text-slate-700">Standard Working Days</p>
                             <p className="text-xs text-slate-400">Used for per-day calculation basis</p>
                          </div>
                          <input 
                            type="number"
                            value={policy.attendance.workingDaysPerMonth}
                            onChange={(e) => setPolicy({ ...policy, attendance: { ...policy.attendance, workingDaysPerMonth: parseInt(e.target.value) } })}
                            className="bg-transparent text-right font-black text-2xl text-indigo-600 outline-none w-16"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                             <p className="font-bold text-slate-700">Salary Proration</p>
                             <p className="text-xs text-slate-400">Adjust components based on attendance</p>
                          </div>
                          <input 
                            type="checkbox"
                            checked={policy.attendance.prorateSalary}
                            onChange={(e) => setPolicy({ ...policy, attendance: { ...policy.attendance, prorateSalary: e.target.checked } })}
                            className="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                          <Plus size={24} />
                        </div>
                        <h4 className="font-bold text-slate-800 text-xl">Overtime Config</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                             <p className="font-bold text-slate-700">Overtime Calculations</p>
                             <p className="text-xs text-slate-400">Enable OT for this policy cycle</p>
                          </div>
                          <input 
                            type="checkbox"
                            checked={policy.overtime.enabled}
                            onChange={(e) => setPolicy({ ...policy, overtime: { ...policy.overtime, enabled: e.target.checked } })}
                            className="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                             <p className="font-bold text-slate-700">Overtime Multiplier</p>
                             <p className="text-xs text-slate-400">Rate for extratime above standard hours</p>
                          </div>
                          <input 
                            type="number"
                            step="0.1"
                            value={policy.overtime.multiplier}
                            onChange={(e) => setPolicy({ ...policy, overtime: { ...policy.overtime, multiplier: parseFloat(e.target.value) } })}
                            className="bg-transparent text-right font-black text-2xl text-indigo-600 outline-none w-16"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rounding' && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                      <Settings2 size={24} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-xl">Engine Configuration</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase">Rounding Strategy</label>
                      <select 
                        value={policy.rounding.rule}
                        onChange={(e) => setPolicy({ ...policy, rounding: { ...policy.rounding, rule: e.target.value } })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                      >
                        <option value="ROUND_OFF">Standard Round Off</option>
                        <option value="ROUND_UP">Ceiling (Always Up)</option>
                        <option value="ROUND_DOWN">Floor (Always Down)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-slate-500 uppercase">Decimal Precision</label>
                       <input 
                          type="number"
                          value={policy.rounding.decimals}
                          onChange={(e) => setPolicy({ ...policy, rounding: { ...policy.rounding, decimals: parseInt(e.target.value) } })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Real-time Preview Engine */}
        <div className="xl:col-span-4 translate-y-0.5">
          <div className="sticky top-24 space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 border-4 border-slate-800 overflow-hidden relative">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full"></div>
              <div className="flex items-center justify-between mb-8 relative">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
                      <Calculator size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">Payroll Calculator</h3>
                    </div>
                 </div>
                 <button 
                  onClick={() => fetchPreview()}
                  className="p-2 text-indigo-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                 >
                   <RefreshCcw size={20} className={clsx(previewLoading && "animate-spin")} />
                 </button>
              </div>

              {preview ? (
                <div className="space-y-8 relative">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-slate-400 font-medium">Monthly CTC Base</span>
                       <span className="font-mono font-bold text-lg text-indigo-300">₹{preview.ctc?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-slate-400 font-medium">Sample Employee</span>
                       <span className="text-sm font-semibold text-slate-100">{preview.sampleEmployee}</span>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-tighter font-black text-slate-500 border-l-2 border-indigo-600 pl-2">Calculated Breakdown</p>
                    <div className="space-y-3">
                      {preview.breakdown.earnings.components.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm group">
                          <span className="text-slate-300 group-hover:text-white transition-colors capitalize">{c.name}</span>
                          <span className="font-mono font-semibold text-emerald-400">+{c.value?.toFixed(2)}</span>
                        </div>
                      ))}
                      {preview.breakdown.deductions.components.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm group">
                          <span className="text-slate-300 group-hover:text-white transition-colors capitalize">{c.name}</span>
                          <span className="font-mono font-semibold text-rose-400">-{c.value?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-8 pb-2">
                    <div className="bg-indigo-600/10 border border-indigo-500/30 p-6 rounded-3xl text-center shadow-inner relative overflow-hidden group">
                      <div className="absolute inset-0 bg-indigo-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-1 relative">Approx. Net Payout</span>
                      <div className="text-4xl font-black text-white relative flex items-center justify-center gap-1">
                        <IndianRupee size={28} className="text-indigo-400" />
                        {preview.breakdown.netPay?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <div className="p-4 bg-slate-800 rounded-full animate-pulse">
                    <Briefcase size={32} />
                  </div>
                  <p className="text-sm font-medium">Aggregating Policy Data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollPolicyTab;
