import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policyAPI } from '@/services/endpoints';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Settings, Save, Briefcase, Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

export const PolicySettings = () => {
  const queryClient = useQueryClient();

  const { data: policyData, isLoading } = useQuery({
    queryKey: ['policy'],
    queryFn: () => policyAPI.getPolicy().then(res => res.data)
  });

  const [formData, setFormData] = React.useState(null);

  useEffect(() => {
    if (policyData) {
      setFormData(policyData);
    }
  }, [policyData]);

  const mutation = useMutation({
    mutationFn: (data) => policyAPI.updatePolicy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] });
      toast.success('Organization Policy Extracted to Core');
    },
    onError: (err) => {
      toast.error('Failed to update Policy: ' + err.message);
    }
  });

  if (isLoading || !formData) {
    return (
      <div className="h-[70vh] flex items-center justify-center bg-white dark:bg-[#111111] border-gray-200 dark:border-[#333333] border">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleSave = () => {
    mutation.mutate(formData);
  };

  const handlePayrollChange = (field, value) => {
    setFormData(prev => ({ ...prev, payroll: { ...prev.payroll, [field]: value } }));
  };

  const handleAttendanceChange = (field, value) => {
    setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, [field]: value } }));
  };

  const addLeaveType = () => {
    setFormData(prev => ({
      ...prev,
      leave: {
        ...prev.leave,
        types: [...(prev.leave?.types || []), { name: 'New Type', paid: false }]
      }
    }));
  };

  const updateLeaveType = (idx, field, value) => {
    const updatedTypes = [...formData.leave.types];
    updatedTypes[idx][field] = value;
    setFormData(prev => ({ ...prev, leave: { ...prev.leave, types: updatedTypes } }));
  };

  const removeLeaveType = (idx) => {
    const updatedTypes = formData.leave.types.filter((_, i) => i !== idx);
    setFormData(prev => ({ ...prev, leave: { ...prev.leave, types: updatedTypes } }));
  };

  return (
    <div className="space-y-10">


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Payroll Policy */}
        <div className="bg-white dark:bg-[#111111] border dark:border-[#333333] p-8 rounded-2xl shadow-sm space-y-8">
          <div className="flex items-center gap-4 border-b border-gray-100 dark:border-[#333333] pb-4">
             <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                <Briefcase size={24} />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Payroll Logic</h3>
          </div>
          
          <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Working Days Per Month</label>
                <input type="number" 
                   className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border dark:border-[#333333] outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                   value={formData.payroll.workingDaysPerMonth}
                   onChange={e => handlePayrollChange('workingDaysPerMonth', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Working Hours Per Day</label>
                <input type="number" 
                   className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border dark:border-[#333333] outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                   value={formData.payroll.workingHoursPerDay}
                   onChange={e => handlePayrollChange('workingHoursPerDay', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">LOP Calc Engine</label>
                <select 
                   className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border dark:border-[#333333] outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none dark:text-white"
                   value={formData.payroll.lopCalculation}
                   onChange={e => handlePayrollChange('lopCalculation', e.target.value)}
                >
                   <option value="PER_DAY">Per Day Base Value</option>
                   <option value="PER_HOUR">Per Hour Exact Deduction</option>
                </select>
             </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border dark:border-[#333333]">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Salary Proration Enable</span>
                <input type="checkbox" className="w-5 h-5 accent-indigo-600 cursor-pointer"
                   checked={formData.payroll.salaryProration}
                   onChange={e => handlePayrollChange('salaryProration', e.target.checked)} />
             </div>
          </div>
        </div>

        {/* Attendance Policy */}
        <div className="bg-white dark:bg-[#111111] border dark:border-[#333333] p-8 rounded-2xl shadow-sm space-y-8">
          <div className="flex items-center gap-4 border-b border-gray-100 dark:border-[#333333] pb-4">
             <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center">
                <Clock size={24} />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Clock Integrity</h3>
          </div>
          
          <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Min. Hours / Day for Present</label>
                <input type="number" 
                   className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border dark:border-[#333333] outline-none focus:ring-2 focus:ring-rose-500/20 dark:text-white"
                   value={formData.attendance.minHoursPerDay}
                   onChange={e => handleAttendanceChange('minHoursPerDay', Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border dark:border-[#333333] mt-4">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allow Half-Day Markings</span>
                <input type="checkbox" className="w-5 h-5 accent-rose-600 cursor-pointer"
                   checked={formData.attendance.allowHalfDay}
                   onChange={e => handleAttendanceChange('allowHalfDay', e.target.checked)} />
             </div>
          </div>
        </div>

        {/* Leave Policy */}
        <div className="bg-white dark:bg-[#111111] border dark:border-[#333333] p-8 rounded-2xl shadow-sm space-y-8">
          <div className="flex items-center gap-4 border-b border-gray-100 dark:border-[#333333] pb-4">
             <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                <Calendar size={24} />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Leave Taxonomy</h3>
          </div>
          
          <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border dark:border-[#333333] mb-6">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allow Negative Global Balance</span>
                <input type="checkbox" className="w-5 h-5 accent-emerald-600 cursor-pointer"
                   checked={formData.leave?.allowNegativeBalance}
                   onChange={e => setFormData(prev => ({...prev, leave: {...prev.leave, allowNegativeBalance: e.target.checked}}))} />
             </div>

              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Leave Categories</h4>
                 <button onClick={addLeaveType} className="text-emerald-600 flex items-center gap-1 text-xs font-bold hover:underline">
                    <Plus size={14} /> Add Node
                 </button>
             </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {formData.leave?.types?.map((type, idx) => (
                   <div key={idx} className="flex items-center gap-3 p-3 border dark:border-[#333333] rounded-xl bg-gray-50 dark:bg-[#0a0a0a]">
                      <input type="text" 
                         className="flex-1 px-3 py-2 border dark:border-[#333333] rounded-lg text-sm font-medium outline-none bg-white dark:bg-[#111111] dark:text-white"
                         value={type.name}
                         onChange={(e) => updateLeaveType(idx, 'name', e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                         <input type="checkbox" className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            checked={type.paid}
                            onChange={(e) => updateLeaveType(idx, 'paid', e.target.checked)}
                         />
                         Paid
                      </label>
                      <button onClick={() => removeLeaveType(idx)} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg">
                         <Trash2 size={16} />
                      </button>
                   </div>
                ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};
