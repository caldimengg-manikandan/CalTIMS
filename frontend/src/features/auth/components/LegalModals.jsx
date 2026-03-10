import React from 'react'
import Modal from '@/components/ui/Modal'
import { Mail, Globe, ShieldCheck, FileText, Info } from 'lucide-react'

export const PrivacyModal = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Privacy Policy" maxWidth="max-w-3xl">
        <div className="space-y-6 text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white pb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Last Updated: March 2026</p>
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                    <ShieldCheck size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600">Secure & Protected</span>
                </div>
            </div>

            <section className="space-y-3">
                <p className="font-medium leading-relaxed">
                    CALTIMS (Time Information Management System) is developed and maintained by <span className="text-slate-900 dark:text-white font-bold">Caldim Engineering Pvt. Ltd.</span>
                </p>
                <p className="leading-relaxed">
                    We value your privacy and are committed to protecting your personal and organizational data.
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                    <Info size={16} className="text-indigo-500" /> Information We Collect
                </h4>
                <p className="text-sm leading-relaxed">CALTIMS may collect the following information when you use the platform:</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {[
                        'Employee name and contact info',
                        'Email addresses and credentials',
                        'Timesheet entries and work hours',
                        'Leave and attendance info',
                        'Project and task-related info',
                        'System usage logs and activity'
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
                <p className="text-[10px] font-bold text-slate-400 italic mt-2">
                    This information is collected only for the purpose of providing workforce and timesheet management services.
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">How We Use Your Information</h4>
                <div className="space-y-2">
                    {[
                        'Manage employee timesheets and project tracking',
                        'Generate reports and analytics',
                        'Improve system functionality and performance',
                        'Provide support and resolve issues',
                        'Send system notifications or reminders'
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                            <div className="w-5 h-5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 text-[10px] font-bold">{i + 1}</div>
                            <p>{item}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                    We do not sell or share your data with third parties unless required for service operation or legal compliance.
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Data Security</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { title: 'Secure Auth', desc: 'Encrypted login & sessions' },
                        { title: 'RBAC', desc: 'Role-based access controls' },
                        { title: 'Encryption', desc: 'Secure data transmission' },
                        { title: 'Monitoring', desc: 'Regular system audits' }
                    ].map((item, i) => (
                        <div key={i} className="p-3 rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">{item.title}</p>
                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] font-medium text-slate-400">Only authorized personnel have access to administrative systems.</p>
            </section>

            <section className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col items-center text-center gap-4">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">Contact Support</h4>
                    <p className="text-[10px] opacity-60">For any privacy-related questions</p>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    <a href="mailto:support@caldimengg.in" className="flex items-center gap-2 text-xs font-bold hover:text-indigo-400 transition-colors">
                        <Mail size={14} /> support@caldimengg.in
                    </a>
                    <a href="https://www.caldimengg.in" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold hover:text-indigo-400 transition-colors">
                        <Globe size={14} /> www.caldimengg.in
                    </a>
                </div>
            </section>
        </div>
    </Modal>
)

export const TermsModal = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Terms of Service" maxWidth="max-w-3xl">
        <div className="space-y-6 text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white pb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Last Updated: March 2026</p>
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                    <FileText size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600">Official Agreement</span>
                </div>
            </div>

            <p className="font-medium text-sm leading-relaxed">
                By accessing or using CALTIMS, you agree to comply with the following terms and conditions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Service Description</h4>
                    <div className="space-y-2">
                        {[
                            'Timesheet tracking',
                            'Leave management',
                            'Reporting and analytics',
                            'Compliance monitoring',
                            'Incident and support management'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white text-rose-600 dark:text-rose-400">Acceptable Use</h4>
                    <div className="space-y-2">
                        {[
                            'No unauthorized access attempts',
                            'No harmful/malicious data uploads',
                            'No disruption of operations',
                            'No unlawful use'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-1 h-1 rounded-full bg-rose-500" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="space-y-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Account Responsibility</h4>
                <p className="text-xs leading-relaxed">
                    Users must maintain the confidentiality of their login credentials. CALTIMS will not be responsible for unauthorized access caused by compromised accounts.
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Service Availability</h4>
                <p className="text-xs leading-relaxed">
                    While we strive to maintain high system availability, CALTIMS does not guarantee uninterrupted service due to maintenance, upgrades, or technical issues.
                </p>
            </section>

            <section className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Limitation of Liability</h4>
                <p className="text-xs leading-relaxed italic">
                    CALTIMS and Caldim Engineering Pvt. Ltd. shall not be liable for any indirect or consequential damages resulting from the use or inability to use the platform.
                </p>
            </section>

            <section className="pt-6 border-t border-slate-100 dark:border-white">
                <div className="flex flex-wrap gap-6 items-center justify-center grayscale opacity-80">
                    <div className="flex items-center gap-2">
                        <Mail size={16} />
                        <span className="text-[10px] font-bold tracking-widest uppercase">support@caldimengg.in</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe size={16} />
                        <span className="text-[10px] font-bold tracking-widest uppercase">www.caldimengg.in</span>
                    </div>
                </div>
            </section>
        </div>
    </Modal>
)
