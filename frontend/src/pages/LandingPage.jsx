import React from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ArrowRight,
  Play,
  Clock,
  Shield,
  BarChart3,
  Users,
  Zap,
  X,
  ChevronRight,
  TrendingUp,
  FileText,
  Calendar,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, SectionHeader, FeatureCard, StepIcon, Badge } from './LandingComponents';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <Container className="h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-2xl text-indigo-600 tracking-tight">
            <Clock className="w-8 h-8" />
            <span>CalTIMS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#problem" className="hover:text-indigo-600 transition-colors">Problem</a>
            <a href="#timesheet" className="hover:text-indigo-600 transition-colors">Timesheets</a>
            <a href="#payroll" className="hover:text-indigo-600 transition-colors">Payroll</a>
            <a href="#enterprise" className="hover:text-indigo-600 transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/login')} variant="ghost" className="hidden sm:flex">Login</Button>
            <Button onClick={() => navigate('/signup')}>Start Free</Button>
          </div>
        </Container>
      </nav>

      <main className="pt-20">
        {/* HERO SECTION */}
        <section className="pt-20 pb-32 overflow-hidden">
          <Container>
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Badge>Revolutionizing Workforce Management</Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-5xl md:text-7xl font-bold mb-8 tracking-tight max-w-4xl leading-[1.1]"
              >
                Track Work. Run Payroll. <br />
                <span className="text-indigo-600">No Confusion.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-xl text-slate-600 mb-12 max-w-2xl leading-relaxed"
              >
                Manage timesheets, approvals, and payroll in one simple system.
                Built for teams that value clarity over complexity.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 mb-20"
              >
                <Button onClick={() => navigate('/signup')} className="px-10 h-14 text-lg">Start Free</Button>
                <Button variant="secondary" className="px-10 h-14 text-lg">
                  <Play size={18} className="fill-current" />
                  See Demo
                </Button>
              </motion.div>

              {/* Mock Dashboard Preview */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="relative w-full max-w-5xl group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden aspect-[16/10] md:aspect-[16/9]">
                  {/* Mock Sidebar */}
                  <div className="flex h-full">
                    <div className="w-16 md:w-64 border-r border-slate-100 bg-slate-50 hidden md:block p-6">
                      <div className="flex items-center gap-3 mb-10">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg shrink-0"></div>
                        <div className="font-bold">CalTIMS</div>
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-8 rounded-lg w-full ${i === 2 ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-200/50'}`}></div>
                        ))}
                      </div>
                    </div>
                    {/* Mock Main Content */}
                    <div className="flex-1 p-4 md:p-8 overflow-hidden bg-white">
                      <div className="flex justify-between items-end mb-8">
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-slate-100 rounded-full"></div>
                          <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
                        </div>
                        <div className="h-10 w-32 bg-indigo-600 rounded-lg"></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-24 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <div className="h-3 w-16 bg-slate-200 rounded-full mb-3"></div>
                            <div className="h-6 w-24 bg-slate-300 rounded-full"></div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-100 h-64 p-6">
                        <div className="flex gap-4 mb-6">
                          {[1, 2, 3, 4, 5, 6, 7].map(i => (
                            <div key={i} className="flex-1 space-y-2">
                              <div className="h-2 w-full bg-slate-200 rounded-full"></div>
                              <div className={`w-full rounded-lg ${i === 3 ? 'h-32 bg-indigo-400' : 'h-24 bg-slate-200'}`}></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </Container>
        </section>

        {/* PROBLEM SECTION */}
        <section id="problem" className="py-32 bg-slate-50">
          <Container>
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div>
                <Badge>The Old Way</Badge>
                <h2 className="text-4xl font-bold mb-6 text-slate-900 tracking-tight leading-tight">
                  Still managing work hours <br />in Excel?
                </h2>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-1">
                      <X size={14} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Employees forget to update time</h4>
                      <p className="text-slate-600">Excel sheets stay blank until the last minute, leading to guesses and memory loss.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-1">
                      <X size={14} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Managers don’t know what is approved</h4>
                      <p className="text-slate-600">Endless email threads and messy spreadsheets make approvals a nightmare.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-1">
                      <X size={14} strokeWidth={3} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Payroll calculations go wrong</h4>
                      <p className="text-slate-600">Manual entry errors lead to overpayments, underpayments, and legal risks.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full"></div>
                <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-slate-200 opacity-80 rotate-1">
                  <div className="text-xs font-mono text-slate-400 mb-4 border-b pb-2">payroll_final_v2_final.xlsx</div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="flex gap-2">
                        <div className="h-6 w-20 bg-slate-100 rounded"></div>
                        <div className="h-6 w-32 bg-slate-50 rounded"></div>
                        <div className={`h-6 flex-1 rounded ${i === 3 ? 'bg-red-50 text-red-500 text-[10px] px-2 flex items-center' : 'bg-slate-50'}`}>
                          {i === 3 && "#REF!"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* SOLUTION SECTION (TIMESHEET FIRST) */}
        <section id="timesheet" className="py-32">
          <Container>
            <SectionHeader
              title="Simple Timesheet That Just Works"
              subtitle="The core of our platform is simplicity. We've removed the friction from time entry so your team can focus on their actual work."
            />

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={Clock}
                title="Daily Time Entry"
                description="Smart forms that remember common projects and tasks. Log hours in seconds on any device."
              />
              <FeatureCard
                icon={Zap}
                title="Instant Approvals"
                description="One-click approvals for managers. No more email follow-ups or manual verification."
                delay={0.1}
              />
              <FeatureCard
                icon={BarChart3}
                title="Project Tracking"
                description="See exactly where the time goes. Real-time insights into work distribution and efficiency."
                delay={0.2}
              />
            </div>

            <div className="mt-24 p-12 bg-indigo-600 rounded-3xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-1/2 h-full bg-indigo-500/30 -skew-x-12 translate-x-1/4 group-hover:translate-x-0 transition-transform duration-1000"></div>
              <div className="relative max-w-xl">
                <h3 className="text-3xl font-bold text-white mb-6">Designed for real work.</h3>
                <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                  "We looked at 10 different systems. CalTIMS was the only one that didn't feel like a 20-year-old database. Our employees actually love using it."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20"></div>
                  <div>
                    <div className="font-bold text-white">Sarah Jenkins</div>
                    <div className="text-indigo-200 text-sm">HR Director at TechScale</div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* VISUAL FLOW */}
        <section className="py-32 border-y border-slate-100 bg-slate-50/50">
          <Container>
            <SectionHeader title="No confusion. Every step is clear." />
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4 relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -z-10 hidden md:block"></div>

              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-[200px] z-10">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                  <Users size={24} />
                </div>
                <div className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">Employee</div>
              </div>

              <ChevronRight className="text-slate-300 hidden md:block" />

              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-[200px] z-10">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                  <Shield size={24} />
                </div>
                <div className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">Manager</div>
              </div>

              <ChevronRight className="text-slate-300 hidden md:block" />

              <div className="flex flex-col items-center p-6 bg-indigo-600 rounded-2xl border border-indigo-700 shadow-lg w-full max-w-[200px] z-10 text-white">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white mb-4">
                  <Check size={24} />
                </div>
                <div className="font-bold">Approved</div>
              </div>

              <ChevronRight className="text-slate-300 hidden md:block" />

              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-[200px] z-10">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
                  <Zap size={24} />
                </div>
                <div className="font-bold underline decoration-emerald-200 decoration-4 underline-offset-4">Ready!</div>
              </div>
            </div>
          </Container>
        </section>

        {/* PAYROLL SECTION */}
        <section id="payroll" className="py-32 overflow-hidden">
          <Container>
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div className="order-2 md:order-1 relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full"></div>
                {/* Mock Payslip Card */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 max-w-sm mx-auto relative z-10"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="h-6 w-24 bg-indigo-600 rounded"></div>
                    <div className="text-[10px] text-slate-400 text-right">MARCH 2026</div>
                  </div>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between">
                      <div className="h-3 w-32 bg-slate-100 rounded"></div>
                      <div className="h-3 w-16 bg-slate-200 rounded"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 w-28 bg-slate-100 rounded"></div>
                      <div className="h-3 w-12 bg-slate-200 rounded"></div>
                    </div>
                    <div className="border-t border-slate-100 pt-4 flex justify-between">
                      <span className="text-sm font-bold">Total Earnings</span>
                      <span className="text-sm font-bold">$4,500.00</span>
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      <Check size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Payment Released</div>
                      <div className="text-sm font-bold text-emerald-900">Available to Download</div>
                    </div>
                  </div>
                </motion.div>
                {/* Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] -z-10 bg-[radial-gradient(circle,rgba(79,70,229,0.05)_0%,transparent_70%)]"></div>
              </div>
              <div className="order-1 md:order-2">
                <Badge>Automated Payroll</Badge>
                <h2 className="text-4xl font-bold mb-6 text-slate-900 tracking-tight leading-tight">
                  Payroll Without Mistakes
                </h2>
                <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                  Once the timesheet is approved, payroll is ready. Our system handles calculations, deductions, and tax compliance automatically.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {[
                    "Auto salary calculation",
                    "LOP handled automatically",
                    "Overtime included",
                    "One-click payslips",
                    "Compliance ready",
                    "Detailed reporting"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* FULL SYSTEM STORY */}
        <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 rotate-12 translate-x-1/4"></div>
          <Container>
            <div className="text-center mb-20">
              <h2 className="text-3xl font-bold mb-4">Complete Workforce Lifecycle</h2>
              <p className="text-slate-400">From the first minute logged to the final report generated.</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold">
              <div className="px-6 py-4 rounded-xl bg-slate-800 border border-slate-700">Timesheet</div>
              <ArrowRight className="text-slate-700" size={16} />
              <div className="px-6 py-4 rounded-xl bg-slate-800 border border-slate-700">Approval</div>
              <ArrowRight className="text-slate-700" size={16} />
              <div className="px-6 py-4 rounded-xl bg-indigo-600 border border-indigo-500">Payroll</div>
              <ArrowRight className="text-slate-700" size={16} />
              <div className="px-6 py-4 rounded-xl bg-slate-800 border border-slate-700">Payslip</div>
              <ArrowRight className="text-slate-700" size={16} />
              <div className="px-6 py-4 rounded-xl bg-slate-800 border border-slate-700">Reports</div>
            </div>
          </Container>
        </section>

        {/* TRUST / ENTERPRISE SECTION */}
        <section id="enterprise" className="py-32">
          <Container>
            <SectionHeader
              title="Built for the Enterprise"
              subtitle="Security, governance, and audit-ready systems. We handle the heavy lifting of compliance so you don't have to."
            />

            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <Lock size={32} />
                </div>
                <h3 className="font-bold mb-2">Role-based Access</h3>
                <p className="text-sm text-slate-500">Fine-grained permissions for HR, Finance, and Admins.</p>
              </div>
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <Shield size={32} />
                </div>
                <h3 className="font-bold mb-2">Audit Logs</h3>
                <p className="text-sm text-slate-500">Full traceability for every change made in the system.</p>
              </div>
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <Zap size={32} />
                </div>
                <h3 className="font-bold mb-2">Real-time Data</h3>
                <p className="text-sm text-slate-500">Sync across all modules without delays or manual imports.</p>
              </div>
              <div className="text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <BarChart3 size={32} />
                </div>
                <h3 className="font-bold mb-2">Secure Data</h3>
                <p className="text-sm text-slate-500">Enterprise-grade encryption and cloud security.</p>
              </div>
            </div>
          </Container>
        </section>

        {/* WHY USERS CHOOSE US */}
        <section className="py-32 bg-slate-50">
          <Container>
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xl">
                <h2 className="text-3xl font-bold mb-10 text-center">Why teams love CalTIMS</h2>
                <div className="grid sm:grid-cols-2 gap-8">
                  {[
                    { title: "Easy to use", desc: "No training required. Intuitive UI." },
                    { title: "Saves time", desc: "Automate 50+ hours of HR admin monthly." },
                    { title: "No manual errors", desc: "Digital verification at every step." },
                    { title: "Clear process", desc: "Employees always know their status." },
                    { title: "Works for any team", desc: "Scales from 10 to 1,000 employees." },
                    { title: "Premium Support", desc: "24/7 dedicated account management." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1">
                        <Check size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 mb-1">{item.title}</p>
                        <p className="text-sm text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* FINAL CTA */}
        <section className="py-40 bg-indigo-600 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] opacity-50"></div>
          <Container className="text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              Start managing your <br />team better today.
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate('/signup')} className="bg-dark text-indigo-600 hover:bg-dark-900 border-white px-12 h-16 text-xl">
                Get Started
              </Button>
            </div>
          </Container>
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-300 via-white to-purple-300 opacity-20"></div>
        </section>
      </main>

      <footer className="py-20 border-t border-slate-100 bg-white">
        <Container>
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div>
              <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 mb-4">
                <Clock className="w-6 h-6" />
                <span>CalTIMS</span>
              </div>
              <p className="text-slate-400 text-sm">© 2026 CalTIMS Inc. All rights reserved.</p>
            </div>
            <div className="flex gap-8 text-sm text-slate-600">
              <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
              <a href="#" className="hover:text-indigo-600">Terms of Service</a>
              <a href="#" className="hover:text-indigo-600">Security</a>
              <a href="#" className="hover:text-indigo-600">Twitter</a>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default LandingPage;
