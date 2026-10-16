import React, { useEffect, useState, useMemo } from 'react';
import { 
  Bell, X, AlertTriangle, Info, CheckCircle2, AlertCircle, 
  FileText, CheckCheck, ArrowRight, Loader2, UserPlus, 
  Clock, RotateCcw, ShieldCheck, Sparkles, ExternalLink,
  Layers, CheckSquare, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { NotificationItem } from '../types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onOpenTask?: (taskId: string) => void;
  notifications?: NotificationItem[];
  unreadCount?: number;
  onRefresh?: () => void;
}

function timeAgo(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Recently';
  }
}

export default function NotificationPanel({ 
  isOpen, 
  onClose, 
  onNavigate,
  onOpenTask,
  notifications: propNotifications,
  unreadCount: propUnreadCount,
  onRefresh
}: NotificationPanelProps) {
  const { apiFetch } = useAuth();
  const [internalNotifications, setInternalNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const notifications = propNotifications ?? internalNotifications;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setInternalNotifications(data);
        }
      }
    } catch (err) {
      console.warn('[NotificationPanel] Could not fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (onRefresh) {
        onRefresh();
      }
      if (!propNotifications) {
        fetchNotifications();
      }
    }
  }, [isOpen]);

  const markAllRead = async () => {
    setInternalNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('[NotificationPanel] Error marking all read:', err);
    }
  };

  const markOneRead = async (id: string) => {
    setInternalNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('[NotificationPanel] Error marking read:', err);
    }
  };

  const handleTaskAction = (n: NotificationItem) => {
    markOneRead(n.id);
    if (n.taskId && onOpenTask) {
      onOpenTask(n.taskId);
      onClose();
    } else if (onNavigate) {
      onNavigate('workspace');
      onClose();
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    markOneRead(n.id);
    const t = (n.type || '').toUpperCase();
    if (n.taskId && onOpenTask) {
      onOpenTask(n.taskId);
      onClose();
    } else if (t === 'APPROVAL' && onNavigate) {
      onNavigate('approvals');
      onClose();
    } else if (t === 'DOCUMENT' && onNavigate) {
      onNavigate('knowledge');
      onClose();
    } else if (t.startsWith('TASK_') && onNavigate) {
      onNavigate('workspace');
      onClose();
    }
  };

  const getIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-indigo-600" />;
      case 'TASK_REASSIGNED':
        return <Layers className="w-4 h-4 text-purple-600" />;
      case 'DEADLINE_REMINDER':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'REVIEW_REQUESTED':
        return <ShieldCheck className="w-4 h-4 text-sky-600" />;
      case 'REVISION_REQUESTED':
        return <RotateCcw className="w-4 h-4 text-rose-600" />;
      case 'TASK_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'APPROVAL':
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'RISK':
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'DOCUMENT':
        return <FileText className="w-4 h-4 text-sky-500" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-[#141413]" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'TASK_ASSIGNED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Assignment</span>;
      case 'TASK_REASSIGNED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Reassigned</span>;
      case 'DEADLINE_REMINDER':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Deadline</span>;
      case 'REVIEW_REQUESTED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Review Request</span>;
      case 'REVISION_REQUESTED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Revisions</span>;
      case 'TASK_APPROVED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
      case 'APPROVAL':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Approval</span>;
      case 'DOCUMENT':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Document</span>;
      default:
        return null;
    }
  };

  const getBgStyle = (type: string, read: boolean) => {
    if (read) return 'bg-[#FDFCFA] border-[rgba(20,20,19,0.06)] opacity-70';
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'TASK_ASSIGNED':
        return 'bg-indigo-50/60 border-indigo-200 shadow-xs';
      case 'TASK_REASSIGNED':
        return 'bg-purple-50/60 border-purple-200 shadow-xs';
      case 'DEADLINE_REMINDER':
        return 'bg-amber-50/70 border-amber-200 shadow-xs';
      case 'REVIEW_REQUESTED':
        return 'bg-sky-50/70 border-sky-200 shadow-xs';
      case 'REVISION_REQUESTED':
        return 'bg-rose-50/70 border-rose-200 shadow-xs';
      case 'TASK_APPROVED':
        return 'bg-emerald-50/70 border-emerald-200 shadow-xs';
      case 'APPROVAL':
      case 'WARNING':
        return 'bg-amber-50/60 border-amber-200/80 shadow-xs';
      case 'RISK':
      case 'CRITICAL':
        return 'bg-rose-50/60 border-rose-200/80 shadow-xs';
      case 'DOCUMENT':
        return 'bg-sky-50/60 border-sky-200/80 shadow-xs';
      case 'SUCCESS':
        return 'bg-emerald-50/60 border-emerald-200/80 shadow-xs';
      default:
        return 'bg-[#F3F0EE]/50 border-[rgba(20,20,19,0.10)] shadow-xs';
    }
  };

  const calculatedUnread = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : calculatedUnread;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications, activeFilter]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#141413]/30 backdrop-blur-xs z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-screen w-full max-w-md bg-white border-l border-[rgba(20,20,19,0.10)] z-50 flex flex-col shadow-2xl font-sans"
          >
            {/* Header */}
            <div className="p-5 border-b border-[rgba(20,20,19,0.08)] flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#141413] flex items-center justify-center text-[#FDFCFA]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#141413] tracking-tight">Work & Task Notifications</h2>
                  <p className="text-[10px] text-[#8E8D8A] font-mono uppercase tracking-wider">Live Collaboration Feed</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-[#F3F0EE] text-[#666562] hover:text-[#141413] flex items-center justify-center transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Sub-bar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(20,20,19,0.08)] bg-[#FDFCFA]">
              <div className="flex items-center gap-1.5 bg-[#F3F0EE] p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-white text-[#141413] shadow-xs font-semibold'
                      : 'text-[#666562] hover:text-[#141413]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveFilter('unread')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    activeFilter === 'unread'
                      ? 'bg-white text-[#141413] shadow-xs font-semibold'
                      : 'text-[#666562] hover:text-[#141413]'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button 
                  onClick={markAllRead}
                  className="text-xs font-semibold text-[#141413] hover:text-[#262627] transition-colors flex items-center gap-1 cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F3F0EE]/30">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-[#8E8D8A] space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#141413]" />
                  <span className="text-xs font-mono">Syncing task notifications...</span>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white border border-[rgba(20,20,19,0.10)] flex items-center justify-center mx-auto text-[#8E8D8A]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#141413]">
                      {activeFilter === 'unread' ? 'No Unread Notifications' : 'No Notifications Yet'}
                    </h4>
                    <p className="text-xs text-[#666562] mt-1 max-w-xs mx-auto">
                      {activeFilter === 'unread'
                        ? 'All caught up! New assignments, review requests, and approvals will show here.'
                        : 'Task assignments, transfers, revisions, review requests, and approvals appear here in real-time.'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-[rgba(20,20,19,0.20)] relative ${getBgStyle(n.type, n.read)}`}
                  >
                    {!n.read && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#141413] shadow-xs" />
                    )}

                    <div className="flex gap-3 items-start">
                      <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/90 border border-[rgba(20,20,19,0.08)] shadow-2xs">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(n.type)}
                          <span className="text-[10px] font-mono text-[#8E8D8A] shrink-0">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>

                        <h4 className={`text-xs font-bold leading-snug mb-1 ${n.read ? 'text-[#666562]' : 'text-[#141413]'}`}>
                          {n.title}
                        </h4>

                        <p className={`text-xs leading-relaxed ${n.read ? 'text-[#8E8D8A]' : 'text-[#666562]'}`}>
                          {n.message}
                        </p>

                        {/* Explicit "View Task" action button */}
                        {n.taskId ? (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskAction(n);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <span>View Task</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-[#8E8D8A] font-mono">
                              ID: {n.taskId.slice(0, 10)}...
                            </span>
                          </div>
                        ) : n.type === 'APPROVAL' ? (
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
                            <span>Review required in Approvals Queue</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        ) : n.type === 'DOCUMENT' ? (
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-sky-800 font-semibold">
                            <span>Open in Knowledge Base</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3.5 border-t border-[rgba(20,20,19,0.08)] bg-[#FDFCFA] flex items-center justify-between text-[10px] text-[#8E8D8A] font-mono">
              <span>Scoped to Company Workspace</span>
              <span>Reliable Realtime Polling</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
