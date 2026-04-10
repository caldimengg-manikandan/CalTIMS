import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import { Activity, Bell, Info, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Use useCallback to stabilize the callback and prevent useSocket from reconnecting
  const handleActivity = useCallback((newActivity) => {
    setActivities((prev) => [newActivity, ...prev].slice(0, 50));
  }, []);

  useSocket('activity', handleActivity);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors bg-white rounded-full shadow-sm border border-slate-200"
      >
        <Activity className="w-5 h-5" />
        {activities.length > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 flex flex-col max-h-[500px] overflow-hidden animate-in fade-in transition-all slide-in-from-top-2">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                Live Activity
              </h3>
              <span className="text-xs font-medium text-slate-500 px-2 py-0.5 bg-slate-200/50 rounded-full">
                {activities.length} Events
              </span>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {activities.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center gap-2 opacity-60">
                  <Activity className="w-10 h-10 text-slate-300" />
                  <p className="text-sm text-slate-500 font-medium">No activity yet</p>
                </div>
              ) : (
                activities.map((activity, index) => (
                  <div 
                    key={activity.id || activity._id || index}
                    className="p-4 border-b border-slate-50 hover:bg-indigo-50/30 transition-colors last:border-0"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">
                        {getStatusIcon(activity.status)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-slate-800 font-medium">
                          {activity.user} <span className="text-slate-500 font-normal">{(activity.action || '').toLowerCase().replace(/_/g, ' ')}</span>
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-indigo-600 px-1.5 py-0.5 bg-indigo-50 rounded uppercase tracking-wider">
                            {activity.role}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => { /* Navigate to Audit Logs */ }}
                className="w-full py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                View All Logs
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityFeed;
