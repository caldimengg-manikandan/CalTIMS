import React, { useState, useEffect } from "react";
import {
  Plus,
  Save,
  History,
  Calculator,
  ShieldCheck,
  Clock,
  Settings2,
  Trash2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Percent,
  DollarSign,
  Wallet,
  Scaling,
  Briefcase,
  IndianRupee,
  Terminal,
  Zap,
  HelpCircle,
  Layers,
  Globe,
  Award,
  ShieldOff,
} from "lucide-react";
import { complianceEngine } from "@/features/payroll/complianceEngine";
import { motion, AnimatePresence } from "framer-motion";
import { policyAPI } from "@/services/endpoints";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

const PT_STATE_CONFIGS = {
  TN: {
    name: "Tamil Nadu",
    isApplicable: true,
    slabs: [
      { min: 0, max: 3500, amount: 0 },
      { min: 3501, max: 5000, amount: 22.5 },
      { min: 5001, max: 7500, amount: 52.5 },
      { min: 7501, max: 10000, amount: 115 },
      { min: 10001, max: 12500, amount: 171 },
      { min: 12501, max: 15000, amount: 195 },
      { min: 15001, max: 999999999, amount: 208 },
    ],
  },
  MH: {
    name: "Maharashtra",
    isApplicable: true,
    slabs: [
      { min: 0, max: 7500, amount: 0 },
      { min: 7501, max: 10000, amount: 175 },
      { min: 10001, max: 999999999, amount: 200 },
    ],
    specialNote: "February month tax is ₹300 for salaries above ₹10,000.",
  },
  KA: {
    name: "Karnataka",
    isApplicable: true,
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 999999999, amount: 200 },
    ],
  },
  WB: {
    name: "West Bengal",
    isApplicable: true,
    slabs: [
      { min: 0, max: 8500, amount: 0 },
      { min: 8501, max: 10000, amount: 90 },
      { min: 10001, max: 15000, amount: 110 },
      { min: 15001, max: 25000, amount: 130 },
      { min: 25001, max: 40000, amount: 150 },
      { min: 40001, max: 999999999, amount: 200 },
    ],
  },
  AP: {
    name: "Andhra Pradesh",
    isApplicable: true,
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: 999999999, amount: 200 },
    ],
  },
  TS: {
    name: "Telangana",
    isApplicable: true,
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: 999999999, amount: 200 },
    ],
  },
  GJ: {
    name: "Gujarat",
    isApplicable: true,
    slabs: [
      { min: 0, max: 6000, amount: 0 },
      { min: 6001, max: 9000, amount: 80 },
      { min: 9001, max: 12000, amount: 150 },
      { min: 12001, max: 999999999, amount: 200 },
    ],
  },
  MP: {
    name: "Madhya Pradesh",
    isApplicable: true,
    slabs: [
      { min: 0, max: 18750, amount: 0 },
      { min: 18751, max: 25000, amount: 125 },
      { min: 25001, max: 33333, amount: 167 },
      { min: 33334, max: 999999999, amount: 208 },
    ],
  },
  CG: {
    name: "Chhattisgarh",
    isApplicable: true,
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 16666, amount: 125 },
      { min: 16667, max: 999999999, amount: 208 },
    ],
  },
  OD: {
    name: "Odisha",
    isApplicable: true,
    slabs: [
      { min: 0, max: 13333, amount: 0 },
      { min: 13334, max: 25000, amount: 125 },
      { min: 25001, max: 999999999, amount: 200 },
    ],
  },
  KL: {
    name: "Kerala",
    isApplicable: true,
    mode: "HALF_YEARLY",
    slabs: [
      { min: 0, max: 11999, amount: 0 },
      { min: 12000, max: 17999, amount: 120 },
      { min: 18000, max: 29999, amount: 180 },
      { min: 30000, max: 44999, amount: 300 },
      { min: 45000, max: 59999, amount: 450 },
      { min: 60000, max: 74999, amount: 600 },
      { min: 75000, max: 99999, amount: 750 },
      { min: 100000, max: 124999, amount: 1000 },
      { min: 125000, max: 999999999, amount: 1250 },
    ],
    note: "Slabs are applied on half-yearly income (total of 6 months).",
  },
  AS: {
    name: "Assam",
    isApplicable: true,
    slabs: [
      { min: 0, max: 10000, amount: 0 },
      { min: 10001, max: 15000, amount: 150 },
      { min: 15001, max: 20000, amount: 180 },
      { min: 20001, max: 999999999, amount: 208 },
    ],
  },
  ML: {
    name: "Meghalaya",
    isApplicable: true,
    slabs: [
      { min: 0, max: 4166, amount: 0 },
      { min: 4167, max: 6250, amount: 16.66 },
      { min: 6251, max: 8333, amount: 25 },
      { min: 8334, max: 12500, amount: 41.66 },
      { min: 12501, max: 16666, amount: 62.5 },
      { min: 16667, max: 20833, amount: 83.33 },
      { min: 20834, max: 999999999, amount: 104.16 },
    ],
  },
  TR: {
    name: "Tripura",
    isApplicable: true,
    slabs: [
      { min: 0, max: 7500, amount: 0 },
      { min: 7501, max: 10000, amount: 110 },
      { min: 10001, max: 15000, amount: 150 },
      { min: 15001, max: 999999999, amount: 208 },
    ],
  },
  SK: {
    name: "Sikkim",
    isApplicable: true,
    slabs: [
      { min: 0, max: 16666, amount: 0 },
      { min: 16667, max: 999999999, amount: 125 },
    ],
  },
  DL: { name: "Delhi", isApplicable: false },
  HR: { name: "Haryana", isApplicable: false },
  UP: { name: "Uttar Pradesh", isApplicable: false },
  RJ: { name: "Rajasthan", isApplicable: false },
  PB: { name: "Punjab", isApplicable: false },
  HP: { name: "Himachal Pradesh", isApplicable: false },
  JK: { name: "Jammu & Kashmir", isApplicable: false },
  UK: { name: "Uttarakhand", isApplicable: false },
  BR: { name: "Bihar", isApplicable: false },
  JH: { name: "Jharkhand", isApplicable: false },
  GA: { name: "Goa", isApplicable: false },
};

const PayrollPolicyTab = () => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("statutory");

  const handlePTStateChange = (stateCode) => {
    const config = PT_STATE_CONFIGS[stateCode];
    if (!config) return;

    // Requirement 5: If saved data exists for this state, prioritize it.
    // However, if we are explicitly changing states, we usually want to load that state's defaults.
    // If the state is the same as current, we don't overwrite.
    if (policy.statutory.pt.state === stateCode && policy.statutory.pt.slabs?.length > 0) {
      return;
    }

    const newPT = {
      ...policy.statutory.pt,
      state: stateCode,
      enabled: config.isApplicable,
      mode: config.mode || "MONTHLY",
      slabs: config.isApplicable ? [...(config.slabs || [])] : [],
    };

    setPolicy({
      ...policy,
      statutory: {
        ...policy.statutory,
        pt: newPT,
      },
    });

    if (config.isApplicable) {
      toast.success(`PT slabs prefilled for ${config.name}`);
    } else {
      toast.error(`Professional Tax is not applicable for ${config.name}`);
    }
  };

  const resetPTToDefault = () => {
    const currentState = policy?.statutory?.pt?.state || "TN";
    handlePTStateChange(currentState);
  };
  const [simulationSalary, setSimulationSalary] = useState(50000);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const response = await policyAPI.getPolicy();
      console.log("[PayrollPolicy] API Response:", response.data);
      
      const policyData = response.data.data || response.data; // Handle both wrapped and unwrapped
      setPolicy(policyData);
      
      if (policyData) fetchPreview(policyData);
    } catch (err) {
      console.error("[PayrollPolicy] Fetch Error:", err);
      toast.error("Failed to load policy");
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
      console.error("Preview failed", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async (isNewVersion = false) => {
    setSaving(true);
    try {
      if (isNewVersion) {
        await policyAPI.createVersion(policy);
        toast.success("New policy version created");
      } else {
        await policyAPI.updatePolicy(policy);
        toast.success("Policy updated successfully");
      }
      fetchPolicy();
    } catch (err) {
      toast.error("Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );

  if (!policy)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-slate-400">
        <AlertCircle size={40} className="text-rose-400" />
        <p className="font-semibold text-slate-600">No payroll policy found.</p>
        <p className="text-sm text-center max-w-sm">
          The backend could not return a policy. Please check your connection or
          seed the database.
        </p>
        <button
          onClick={fetchPolicy}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="max-w-[1400px] mx-auto p-2">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-600 bg-clip-text text-transparent">
            Policy Settings
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* <button 
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all font-medium border border-indigo-100"
          >
            <History size={18} />
            New Version
          </button> */}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all font-medium shadow-lg shadow-indigo-100"
          >
            {saving ? (
              <RefreshCcw size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Changes
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Navigation & Forms */}
        <div className="xl:col-span-8 space-y-6">
          <nav className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-white/5 rounded-2xl w-fit border border-slate-200 dark:border-[#333333] backdrop-blur-sm">
            {[
              { id: "statutory", label: "Statutory Rules", icon: ShieldCheck },
              { id: "attendance", label: "Attendance & OT", icon: Clock },
              { id: "rounding", label: "Engine Config", icon: Settings2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300",
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-[#444]"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-200/50",
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
              <>
                {activeTab === "statutory" && (
                  <div className="space-y-6 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* PF Card */}
                      <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-5 relative group transition-all hover:shadow-md">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                              <ShieldCheck size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-base leading-none">
                                Provident Fund (PF)
                              </h4>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                                Statutory Contribution
                              </span>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer scale-90">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={policy?.statutory?.pf?.enabled}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  statutory: {
                                    ...policy?.statutory,
                                    pf: {
                                      ...policy?.statutory?.pf,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {policy?.statutory?.pf?.enabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-5 overflow-hidden pt-2 relative z-10"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                                    Employee %
                                  </label>
                                  <span
                                    className={clsx(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                                      policy?.statutory?.pf?.employeeRate === 12
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : "bg-amber-500/10 text-amber-500",
                                    )}
                                  >
                                    {policy?.statutory?.pf?.employeeRate === 12
                                      ? "Standard"
                                      : "Custom"}
                                  </span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={policy?.statutory?.pf?.employeePercent || 0}
                                    onChange={(e) =>
                                      setPolicy({
                                        ...policy,
                                        statutory: {
                                          ...policy?.statutory,
                                          pf: {
                                            ...policy?.statutory?.pf,
                                            employeePercent:
                                              parseFloat(e.target.value) || 0,
                                          },
                                        },
                                      })
                                    }
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold dark:text-white"
                                  />
                                  <Percent
                                    size={12}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                                    Employer %
                                  </label>
                                  <span
                                    className={clsx(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                                      policy?.statutory?.pf?.employerRate === 12
                                        ? "bg-indigo-500/10 text-indigo-500"
                                        : "bg-amber-500/10 text-amber-500",
                                    )}
                                  >
                                    Recommended: 12%
                                  </span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={policy?.statutory?.pf?.employerPercent || 0}
                                    onChange={(e) =>
                                      setPolicy({
                                        ...policy,
                                        statutory: {
                                          ...policy?.statutory,
                                          pf: {
                                            ...policy?.statutory?.pf,
                                            employerPercent:
                                              parseFloat(e.target.value) || 0,
                                          },
                                        },
                                      })
                                    }
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-bold dark:text-white"
                                  />
                                  <Percent
                                    size={12}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-2xl space-y-3 border border-indigo-100/50 dark:border-indigo-500/10">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">
                                    Wage Ceiling (₹15,000)
                                  </p>
                                  <p className="text-[9px] text-indigo-500/60 font-medium italic">
                                    Apply ceiling limit for PF
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={
                                    policy?.statutory?.pf?.restrictToCeiling || false
                                  }
                                  onChange={(e) =>
                                    setPolicy({
                                      ...policy,
                                      statutory: {
                                        ...policy?.statutory,
                                        pf: {
                                          ...policy?.statutory?.pf,
                                          restrictToCeiling: e.target.checked,
                                        },
                                      },
                                    })
                                  }
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* ESI Card */}
                      <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-5 relative group transition-all hover:shadow-md">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                              <Briefcase size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-base leading-none">
                                State Insurance (ESI)
                              </h4>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                                Medical Compliance
                              </span>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer scale-90">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={policy?.statutory?.esi?.enabled || false}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  statutory: {
                                    ...policy?.statutory,
                                    esi: {
                                      ...policy?.statutory?.esi,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {policy?.statutory?.esi?.enabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-5 pt-2 relative z-10"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                                    Employee %
                                  </label>
                                  <span className="text-[9px] font-bold text-emerald-500 uppercase">
                                    Govt: 0.75%
                                  </span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={policy?.statutory?.esi?.employeePercent || 0}
                                    onChange={(e) =>
                                      setPolicy({
                                        ...policy,
                                        statutory: {
                                          ...policy?.statutory,
                                          esi: {
                                            ...policy?.statutory?.esi,
                                            employeePercent:
                                              parseFloat(e.target.value) || 0,
                                          },
                                        },
                                      })
                                    }
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm font-bold dark:text-white"
                                  />
                                  <Percent
                                    size={12}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                                    Threshold Limit
                                  </label>
                                  <span
                                    className={clsx(
                                      "text-[9px] font-bold uppercase",
                                      policy?.statutory?.esi?.threshold ===
                                        21000
                                        ? "text-emerald-500"
                                        : "text-amber-500",
                                    )}
                                  >
                                    Limit: ₹21k
                                  </span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={policy?.statutory?.esi?.threshold || 0}
                                    onChange={(e) =>
                                      setPolicy({
                                        ...policy,
                                        statutory: {
                                          ...policy?.statutory,
                                          esi: {
                                            ...policy?.statutory?.esi,
                                            threshold:
                                              parseFloat(e.target.value) || 0,
                                          },
                                        },
                                      })
                                    }
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm font-bold dark:text-white"
                                  />
                                  <IndianRupee
                                    size={12}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-3 rounded-xl flex items-start gap-2">
                              <AlertCircle
                                size={14}
                                className="text-emerald-600 mt-0.5 flex-shrink-0"
                              />
                              <p className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400 leading-normal uppercase tracking-tight">
                                Applied only if Gross Salary ≤ ₹
                                {policy?.statutory?.esi?.threshold?.toLocaleString()}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* Gratuity Card */}
                      <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-5 relative group transition-all hover:shadow-md">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                              <Award size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-base leading-none">
                                Gratuity
                              </h4>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                                Retirement Benefit
                              </span>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer scale-90">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={policy?.statutory?.gratuity?.enabled || false}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  statutory: {
                                    ...policy?.statutory,
                                    gratuity: {
                                      ...policy?.statutory?.gratuity,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>

                        {policy?.statutory?.gratuity?.enabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-4 pt-2 relative z-10"
                          >
                            <div className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-white/5 rounded-xl">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                Include in CTC
                              </p>
                              <input
                                type="checkbox"
                                checked={
                                  policy?.statutory?.gratuity?.includeInCTC
                                }
                                onChange={(e) =>
                                  setPolicy({
                                    ...policy,
                                    statutory: {
                                      ...policy.statutory,
                                      gratuity: {
                                        ...policy.statutory.gratuity,
                                        includeInCTC: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 rounded text-amber-600"
                              />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-white/5 rounded-xl">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                Show Accrued to Employee
                              </p>
                              <input
                                type="checkbox"
                                checked={
                                  policy?.statutory?.gratuity?.showAccrued
                                }
                                onChange={(e) =>
                                  setPolicy({
                                    ...policy,
                                    statutory: {
                                      ...policy.statutory,
                                      gratuity: {
                                        ...policy.statutory.gratuity,
                                        showAccrued: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 rounded text-amber-600"
                              />
                            </div>
                            <div className="p-3 bg-amber-50/30 border border-dashed border-amber-200 dark:border-amber-500/20 rounded-xl">
                              <p className="text-[9px] text-amber-700/60 font-medium italic">
                                Standard calculation (15/26 days per year of
                                service) automatically applied after 5 years.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      {/* Professional Tax Card */}
                      <div className="bg-white dark:bg-[#111111] md:col-span-2 p-8 rounded-3xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-6 relative group transition-all">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-100 dark:border-white/5 pb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-white/5">
                              <Globe size={21} />
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                                Professional Tax (PT)
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Statutory Compliance (State Wise)
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center">
                                Work State
                              </label>
                              <select
                                value={policy?.statutory?.pt?.state}
                                onChange={(e) =>
                                  handlePTStateChange(e.target.value)
                                }
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer min-w-[200px]"
                              >
                                <optgroup label="PT Applicable States">
                                  <option value="TN">Tamil Nadu (TN)</option>
                                  <option value="MH">Maharashtra (MH)</option>
                                  <option value="KA">Karnataka (KA)</option>
                                  <option value="WB">West Bengal (WB)</option>
                                  <option value="AP">
                                    Andhra Pradesh (AP)
                                  </option>
                                  <option value="TS">Telangana (TS)</option>
                                  <option value="GJ">Gujarat (GJ)</option>
                                  <option value="MP">
                                    Madhya Pradesh (MP)
                                  </option>
                                  <option value="CG">Chhattisgarh (CG)</option>
                                  <option value="OD">Odisha (OD)</option>
                                  <option value="KL">Kerala (KL)</option>
                                  <option value="AS">Assam (AS)</option>
                                  <option value="ML">Meghalaya (ML)</option>
                                  <option value="TR">Tripura (TR)</option>
                                  <option value="SK">Sikkim (SK)</option>
                                </optgroup>
                                <optgroup label="Non-PT States">
                                  <option value="DL">Delhi (DL)</option>
                                  <option value="HR">Haryana (HR)</option>
                                  <option value="UP">Uttar Pradesh (UP)</option>
                                  <option value="RJ">Rajasthan (RJ)</option>
                                  <option value="PB">Punjab (PB)</option>
                                  <option value="BR">Bihar (BR)</option>
                                  <option value="JH">Jharkhand (JH)</option>
                                  <option value="GA">Goa (GA)</option>
                                </optgroup>
                              </select>
                            </div>
                            <div className="flex flex-col items-center gap-2 pt-4">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={policy?.statutory?.pt?.enabled}
                                  onChange={(e) =>
                                    setPolicy({
                                      ...policy,
                                      statutory: {
                                        ...policy?.statutory,
                                        pt: {
                                          ...policy?.statutory?.pt,
                                          enabled: e.target.checked,
                                        },
                                      },
                                    })
                                  }
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        {!policy?.statutory?.pt?.enabled ? (
                          <div className="p-10 bg-slate-50/50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-4 bg-slate-100 dark:bg-white/5 text-slate-300 rounded-full">
                              <ShieldOff size={32} />
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-700 dark:text-slate-300">
                                Professional Tax Disabled
                              </h5>
                              <p className="text-xs text-slate-500 max-w-xs">
                                Statutory PT deductions are currently disabled.
                                Use the toggle switch above to enable.
                              </p>
                            </div>
                          </div>
                        ) : !PT_STATE_CONFIGS[policy?.statutory?.pt?.state]
                            ?.isApplicable ? (
                          <div className="p-10 bg-slate-50/50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center text-center space-y-3">
                            <div className="p-4 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-full">
                              <ShieldCheck size={32} />
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-700 dark:text-slate-300">
                                Professional Tax Not Applicable
                              </h5>
                              <p className="text-xs text-slate-500 max-w-xs">
                                Professional Tax is not applicable for{" "}
                                {PT_STATE_CONFIGS[policy?.statutory?.pt?.state]
                                  ?.name ||
                                  policy?.statutory?.pt?.state ||
                                  "Selected State"}
                                . No deductions will be made.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6 pt-2"
                          >
                            {policy?.statutory?.pt?.mode === "HALF_YEARLY" && (
                              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
                                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                                  <RefreshCcw size={14} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                                    Half-Yearly PT लागू
                                    <span className="text-[10px] font-medium bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                      Half-Yearly System
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70">
                                    Calculations will be based on 6-month
                                    aggregate income.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-3">
                                <div className="space-y-0.5">
                                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                    Government Slab Rules
                                  </h5>
                                  <p className="text-[9px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                                    Government Defaults (Editable)
                                  </p>
                                </div>
                                <button
                                  onClick={resetPTToDefault}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[9px] font-bold text-slate-500 rounded-md transition-all uppercase tracking-tight"
                                >
                                  <RefreshCcw size={10} /> Reset to Govt
                                  Defaults
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  const newSlabs = [
                                    ...(policy.statutory.pt.slabs || []),
                                    { min: 0, max: 999999999, amount: 0 },
                                  ];
                                  setPolicy({
                                    ...policy,
                                    statutory: {
                                      ...policy.statutory,
                                      pt: {
                                        ...policy.statutory.pt,
                                        slabs: newSlabs,
                                      },
                                    },
                                  });
                                }}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                              >
                                <Plus size={14} /> Add New Rule
                              </button>
                            </div>

                            {(() => {
                              const slabs = policy?.statutory?.pt?.slabs || [];
                              const sorted = [...slabs].sort(
                                (a, b) => a.min - b.min,
                              );
                              const overlaps = [];
                              for (let i = 0; i < sorted.length - 1; i++) {
                                if (sorted[i].max >= sorted[i + 1].min) {
                                  overlaps.push(
                                    `Range ₹${sorted[i].min}-₹${sorted[i].max} overlaps with ₹${sorted[i + 1].min}-₹${sorted[i + 1].max}`,
                                  );
                                }
                                if (sorted[i].min >= sorted[i].max) {
                                  overlaps.push(
                                    `Range error: Min (₹${sorted[i].min}) cannot be ≥ Max (₹${sorted[i].max})`,
                                  );
                                }
                              }
                              if (overlaps.length > 0) {
                                return (
                                  <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-start gap-3">
                                    <AlertCircle
                                      size={18}
                                      className="text-rose-500 mt-0.5"
                                    />
                                    <div className="space-y-1">
                                      <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                                        Structure Validation Errors
                                      </p>
                                      <ul className="list-disc list-inside text-[10px] text-rose-600/80 dark:text-rose-400/80 space-y-1">
                                        {overlaps.map((err, idx) => (
                                          <li key={idx}>{err}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            <div className="space-y-3">
                              {(policy?.statutory?.pt?.slabs || []).map(
                                (slab, sIdx) => (
                                  <motion.div
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={sIdx}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 transition-all items-center hover:border-slate-300 dark:hover:border-white/20 shadow-sm"
                                  >
                                    <div className="md:col-span-4 space-y-1.5 focus-within:ring-2 focus-within:ring-indigo-500/10 rounded-xl transition-all">
                                      <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        Range From
                                      </label>
                                      <div className="relative group">
                                        <input
                                          type="number"
                                          value={slab.min || 0}
                                          onChange={(e) => {
                                            const updated = [
                                              ...policy.statutory.pt.slabs,
                                            ];
                                            updated[sIdx].min =
                                              parseFloat(e.target.value) || 0;
                                            setPolicy({
                                              ...policy,
                                              statutory: {
                                                ...policy.statutory,
                                                pt: {
                                                  ...policy.statutory.pt,
                                                  slabs: updated,
                                                },
                                              },
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold dark:text-white outline-none focus:border-indigo-500 transition-all"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-xs font-bold">
                                          ₹
                                        </div>
                                      </div>
                                    </div>

                                    <div className="md:col-span-4 space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                                        Range To
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          value={slab.max || 0}
                                          onChange={(e) => {
                                            const updated = [
                                              ...policy.statutory.pt.slabs,
                                            ];
                                            updated[sIdx].max =
                                              parseFloat(e.target.value) || 0;
                                            setPolicy({
                                              ...policy,
                                              statutory: {
                                                ...policy.statutory,
                                                pt: {
                                                  ...policy.statutory.pt,
                                                  slabs: updated,
                                                },
                                              },
                                            });
                                          }}
                                          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-200"
                                          placeholder="Infinity"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-xs font-bold">
                                          ₹
                                        </div>
                                      </div>
                                    </div>

                                    <div className="md:col-span-3 space-y-1.5 relative">
                                      <label className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">
                                        PT Amount
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          value={slab.amount || 0}
                                          onChange={(e) => {
                                            const updated = [
                                              ...policy.statutory.pt.slabs,
                                            ];
                                            updated[sIdx].amount =
                                              parseFloat(e.target.value) || 0;
                                            setPolicy({
                                              ...policy,
                                              statutory: {
                                                ...policy.statutory,
                                                pt: {
                                                  ...policy.statutory.pt,
                                                  slabs: updated,
                                                },
                                              },
                                            });
                                          }}
                                          className="w-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-4 py-2.5 text-sm font-extrabold text-indigo-700 dark:text-indigo-300 outline-none focus:border-indigo-500 transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-300 dark:text-indigo-600 pointer-events-none">
                                          ₹
                                        </span>
                                      </div>
                                    </div>

                                    <div className="md:col-span-1 pt-4 flex justify-center">
                                      <button
                                        onClick={() => {
                                          const updated =
                                            policy.statutory.pt.slabs.filter(
                                              (_, i) => i !== sIdx,
                                            );
                                          setPolicy({
                                            ...policy,
                                            statutory: {
                                              ...policy.statutory,
                                              pt: {
                                                ...policy.statutory.pt,
                                                slabs: updated,
                                              },
                                            },
                                          });
                                        }}
                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </motion.div>
                                ),
                              )}
                            </div>

                            {(policy?.statutory?.pt?.state === "MH" ||
                              PT_STATE_CONFIGS[policy?.statutory?.pt?.state]
                                ?.specialNote) && (
                              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                  <Zap size={16} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                                    {
                                      PT_STATE_CONFIGS[
                                        policy?.statutory?.pt?.state
                                      ]?.name
                                    }{" "}
                                    Special Rule:
                                  </p>
                                  <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70">
                                    {PT_STATE_CONFIGS[
                                      policy?.statutory?.pt?.state
                                    ]?.specialNote ||
                                      "A specific state-based compliance rule applies to this configuration."}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                              <HelpCircle
                                size={14}
                                className="text-slate-400"
                              />
                              <p className="text-[10px] font-medium text-slate-500">
                                PT slabs are auto-filled as per government
                                rules. You can edit if needed.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* SIMULATION SANDBOX (ZOHO STYLE) */}
                    <div className="bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-[#333333] rounded-3xl p-10 space-y-8 relative overflow-hidden backdrop-blur-sm">
                      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1">
                          <h4 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                            <Calculator className="text-indigo-600" size={24} />{" "}
                            Compliance Sandbox
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-9">
                            Real-time statutory impact preview
                          </p>
                        </div>
                        <div className="relative w-full md:w-72">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <IndianRupee size={16} className="text-slate-400" />
                          </div>
                          <input
                            type="number"
                            value={simulationSalary}
                            onChange={(e) =>
                              setSimulationSalary(
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-3.5 text-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                          />
                          <label className="absolute -top-2 left-4 px-2 bg-slate-50 dark:bg-[#18181b] text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Test Monthly Gross
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* PF Preview */}
                        <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-3">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">
                              PF Impact
                            </span>
                            <div
                              className={clsx(
                                "w-2 h-2 rounded-full",
                                policy?.statutory?.pf?.enabled
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                  : "bg-slate-300",
                              )}
                            />
                          </div>
                          <div className="space-y-3">
                            {(() => {
                              // Simulation: Basic = 40%, DA = 10% of Gross
                              const basic = simulationSalary * 0.4;
                              const da = simulationSalary * 0.1;
                              const res = complianceEngine.calculatePF(
                                basic,
                                da,
                                { ...policy?.statutory?.pf, enabled: true },
                              );
                              return (
                                <>
                                  <div className="flex justify-between text-[11px] items-center">
                                    <span className="text-slate-500">
                                      Base (Basic + DA)
                                    </span>
                                    <span className="font-bold text-slate-600 dark:text-slate-400">
                                      ₹{(basic + da).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      Employee Deduction
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-white">
                                      ₹{res.employeePF.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      Employer Cont.
                                    </span>
                                    <span className="font-bold text-indigo-500 text-[10px]">
                                      ₹{res.totalEmployer.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-[9px] text-slate-400 flex justify-between">
                                    <span>
                                      Split: EPS ₹{res.employerEPS} | EPF ₹
                                      {res.employerEPF}
                                    </span>
                                  </div>
                                  <div className="h-px bg-slate-50 dark:bg-white/5 my-1" />
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      Deduction
                                    </span>
                                    <span className="text-lg font-black text-rose-500">
                                      ₹{res.employeePF.toLocaleString()}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* ESI Preview */}
                        <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-3">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">
                              ESI Impact
                            </span>
                            <div
                              className={clsx(
                                "w-2 h-2 rounded-full",
                                policy?.statutory?.esi?.enabled &&
                                  simulationSalary <=
                                    policy?.statutory?.esi?.wageLimit
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                  : "bg-slate-300",
                              )}
                            />
                          </div>
                          <div className="space-y-3">
                            {(() => {
                              const res = complianceEngine.calculateESI(
                                simulationSalary,
                                { ...policy?.statutory?.esi, enabled: true },
                              );
                              const isEligible =
                                simulationSalary <=
                                (policy?.statutory?.esi?.wageLimit || 21000);
                              return (
                                <>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      Employee Cont.
                                    </span>
                                    <span
                                      className={clsx(
                                        "font-bold",
                                        isEligible
                                          ? "text-slate-800 dark:text-white"
                                          : "text-slate-300 line-through",
                                      )}
                                    >
                                      ₹{res.employeeESI.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      Eligibility
                                    </span>
                                    <span
                                      className={clsx(
                                        "text-[9px] font-bold",
                                        isEligible
                                          ? "text-emerald-500"
                                          : "text-rose-400",
                                      )}
                                    >
                                      {isEligible ? "Eligible" : "Over Limit"}
                                    </span>
                                  </div>
                                  <div className="h-px bg-slate-50 dark:bg-white/5 my-2" />
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      Deduction
                                    </span>
                                    <span className="text-lg font-black text-rose-500">
                                      ₹{res.employeeESI.toLocaleString()}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* PT Preview */}
                        <div className="bg-white dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-50 dark:border-white/5 pb-3">
                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">
                              PT Impact
                            </span>
                            <div
                              className={clsx(
                                "w-2 h-2 rounded-full",
                                policy?.statutory?.pt?.enabled
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                  : "bg-slate-300",
                              )}
                            />
                          </div>
                          <div className="space-y-3">
                            {(() => {
                              const isHalfYearly =
                                policy?.statutory?.pt?.mode === "HALF_YEARLY";
                              const ptValue = complianceEngine.calculatePT(
                                isHalfYearly
                                  ? simulationSalary * 6
                                  : simulationSalary,
                                {
                                  ...policy?.statutory?.pt,
                                  enabled: true,
                                },
                              );
                              const ptFeb = complianceEngine.calculatePT(
                                simulationSalary,
                                {
                                  ...policy?.statutory?.pt,
                                  enabled: true,
                                },
                                1,
                              );
                              return (
                                <>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">
                                      {isHalfYearly
                                        ? "Combined Half-Yr"
                                        : "Std. Month"}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-white">
                                      ₹{ptValue.toLocaleString()}
                                    </span>
                                  </div>
                                  {!isHalfYearly && (
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-slate-500">
                                        Feb Cycle
                                      </span>
                                      <span className="font-bold text-slate-400 italic text-[9px]">
                                        ₹{ptFeb.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="h-px bg-slate-50 dark:bg-white/5 my-2" />
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                      {isHalfYearly
                                        ? "Estimated Surcharge"
                                        : "Monthly Tax"}
                                    </span>
                                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                      ₹{ptValue.toLocaleString()}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "attendance" && (
                  <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
                            <Clock size={24} />
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-xl">
                            Attendance Policy
                          </h4>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-[#333333]">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-200">
                                Standard Working Days
                              </p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">
                                Used for per-day calculation basis
                              </p>
                            </div>
                            <input
                              type="number"
                              value={policy?.attendance?.workingDaysPerMonth}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  attendance: {
                                    ...policy?.attendance,
                                    workingDaysPerMonth: parseInt(
                                      e.target.value,
                                    ),
                                  },
                                })
                              }
                              className="bg-transparent text-right font-black text-2xl text-indigo-600 dark:text-indigo-400 outline-none w-16"
                            />
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-[#333333]">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-200">
                                Salary Proration
                              </p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">
                                Adjust components based on attendance
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={policy?.attendance?.prorateSalary}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  attendance: {
                                    ...policy?.attendance,
                                    prorateSalary: e.target.checked,
                                  },
                                })
                              }
                              className="w-6 h-6 rounded-lg text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
                            <Plus size={24} />
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-xl">
                            Overtime Config
                          </h4>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-[#333333]">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-200">
                                Overtime Calculations
                              </p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">
                                Enable OT for this policy cycle
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={policy?.overtime?.enabled}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  overtime: {
                                    ...policy?.overtime,
                                    enabled: e.target.checked,
                                  },
                                })
                              }
                              className="w-6 h-6 rounded-lg text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-[#333333]">
                            <div>
                              <p className="font-bold text-slate-700 dark:text-slate-200">
                                Overtime Multiplier
                              </p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">
                                Rate for extratime above standard hours
                              </p>
                            </div>
                            <input
                              type="number"
                              step="0.1"
                              value={policy?.overtime?.multiplier}
                              onChange={(e) =>
                                setPolicy({
                                  ...policy,
                                  overtime: {
                                    ...policy?.overtime,
                                    multiplier: parseFloat(e.target.value),
                                  },
                                })
                              }
                              className="bg-transparent text-right font-black text-2xl text-indigo-600 dark:text-indigo-400 outline-none w-16"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "rounding" && (
                  <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-200 dark:border-[#333333] shadow-sm space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
                        <Settings2 size={24} />
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-xl">
                        Engine Configuration
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 dark:text-gray-500 uppercase">
                          Rounding Strategy
                        </label>
                        <select
                          value={policy?.rounding?.rule}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              rounding: {
                                ...policy?.rounding,
                                rule: e.target.value,
                              },
                            })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#333333] bg-transparent focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 dark:text-gray-300"
                        >
                          <option
                            value="ROUND_OFF"
                            className="dark:bg-[#111111]"
                          >
                            Standard Round Off
                          </option>
                          <option
                            value="ROUND_UP"
                            className="dark:bg-[#111111]"
                          >
                            Ceiling (Always Up)
                          </option>
                          <option
                            value="ROUND_DOWN"
                            className="dark:bg-[#111111]"
                          >
                            Floor (Always Down)
                          </option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 dark:text-gray-500 uppercase">
                          Decimal Precision
                        </label>
                        <input
                          type="number"
                          value={policy?.rounding?.decimals}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              rounding: {
                                ...policy?.rounding,
                                decimals: parseInt(e.target.value),
                              },
                            })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#333333] bg-transparent focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700 dark:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Real-time Preview Engine */}
      </div>
    </div>
  );
};

export default PayrollPolicyTab;
