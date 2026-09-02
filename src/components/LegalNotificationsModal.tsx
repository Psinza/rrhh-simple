import {
  X,
  Bell,
  CheckCircle,
  AlertTriangle,
  FileText,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { LegalNotification } from '../types';

interface LegalNotificationsModalProps {
  notifications: LegalNotification[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
}

export function LegalNotificationsModal({
  notifications,
  onClose,
  onMarkAllAsRead,
}: LegalNotificationsModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Notificaciones y Alertas Normativas
              </h2>
              <p className="text-xs text-slate-500">
                Vigilancia legal de Gaceta Oficial, tasas del BCV y plazos parafiscales de Venezuela.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              Marcar Leídas
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border text-xs transition-all ${
                notif.urgencia === 'alta'
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      notif.urgencia === 'alta'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {notif.tipo}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{notif.titulo}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{notif.fecha}</span>
              </div>

              <p className="text-slate-600 mt-2 leading-relaxed">{notif.descripcion}</p>

              {notif.enlaceReferencia && (
                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">
                    Fuente Oficial: {notif.enlaceReferencia}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                    Gaceta Oficial VE <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
