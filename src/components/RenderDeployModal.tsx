import { useState } from 'react';
import {
  CloudUpload,
  X,
  Copy,
  Check,
  ExternalLink,
  Server,
  FolderGit2,
  Terminal,
  ShieldCheck,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface RenderDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RenderDeployModal({ isOpen, onClose }: RenderDeployModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const serviceName = 'rrhh-simple';
  const repoUrl = 'https://github.com/Psinza/rrhh-simple';
  const renderUrl = 'https://rrhh-simple.onrender.com';
  const buildCommand = 'npm install && npm run build';
  const publishDirectory = 'dist';
  const rewriteSource = '/*';
  const rewriteDest = '/index.html';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Guía de Despliegue en Render</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                  Static Site (Gratis)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Paso a paso para publicar este proyecto en Render.com con alta velocidad y HTTPS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider">
                Configuración Rápida en 3 Minutos
              </h4>
              <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                Este proyecto es una SPA moderna compilada con Vite. En Render se despliega como un{' '}
                <strong>Static Site</strong> (totalmente gratis, sin tiempo de suspensión y con CDN global).
                El repositorio ya incluye el archivo <code>render.yaml</code> en la raíz para auto-configuración.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-slate-500" />
              1. Exportar el Código a GitHub
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <p className="text-slate-600">
                Tu repositorio asignado en GitHub:
              </p>
              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-xs">
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-bold flex items-center gap-1.5"
                >
                  <FolderGit2 className="w-4 h-4 text-slate-700" />
                  {repoUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => copyToClipboard(repoUrl, 'repo')}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  title="Copiar URL del repositorio"
                >
                  {copiedField === 'repo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                En el menú de Google AI Studio, usa <strong>"Export to GitHub"</strong> apuntando a <code>Psinza/rrhh-simple</code> o sube los archivos mediante Git.
              </p>
            </div>

            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2 pt-2">
              <Server className="w-4 h-4 text-slate-500" />
              2. Crear el Servicio en Render
            </h4>
            <p className="text-xs text-slate-600">
              En tu panel de <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline inline-flex items-center gap-0.5">Render Dashboard <ExternalLink className="w-3 h-3" /></a>, haz clic en <strong>"New +"</strong> &gt; <strong>"Static Site"</strong> y selecciona tu repositorio.
            </p>

            {/* Form Fields with Copy Buttons */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                  <span>Name (Nombre del Servicio en Render):</span>
                  {copiedField === 'name' && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> ¡Copiado!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs border border-slate-800 flex items-center justify-between">
                    <span>{serviceName}</span>
                    <span className="text-slate-400 text-[10px] font-sans">({renderUrl})</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(serviceName, 'name')}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                    title="Copiar nombre del servicio"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                  <span>Build Command (Comando de Compilación):</span>
                  {copiedField === 'build' && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> ¡Copiado!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs border border-slate-800 flex items-center justify-between">
                    <span>{buildCommand}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(buildCommand, 'build')}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                    title="Copiar comando de compilación"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                  <span>Publish Directory (Carpeta de Salida):</span>
                  {copiedField === 'publish' && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> ¡Copiado!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs border border-slate-800 flex items-center justify-between">
                    <span>{publishDirectory}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(publishDirectory, 'publish')}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                    title="Copiar carpeta de publicación"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                  <span>Redirect / Rewrite Rule (Evita error 404 al recargar pantalla):</span>
                  {copiedField === 'rewrite' && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> ¡Copiado!
                    </span>
                  )}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Tipo: <strong>Rewrite</strong></span>
                    <span>Origen: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono">{rewriteSource}</code></span>
                    <span>Destino: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono">{rewriteDest}</code></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Blueprint mention */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600">
                <strong>Archivo de automatización incluido:</strong> Ya hemos creado el archivo{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">
                  render.yaml
                </code>{' '}
                en la raíz de tu proyecto. Si en Render seleccionas <strong>"New Blueprint"</strong>, se auto-configurará todo sin escribir nada.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Guía detallada disponible en el archivo <code>RENDER_DEPLOY.md</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
