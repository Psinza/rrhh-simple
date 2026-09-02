import React, { useState } from 'react';
import {
  X,
  Building2,
  Settings,
  DollarSign,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { CompanySettings, IvssRiskLevel } from '../types';

interface CompanySettingsModalProps {
  company: CompanySettings;
  onClose: () => void;
  onSave: (updated: CompanySettings) => void;
}

export function CompanySettingsModal({
  company,
  onClose,
  onSave,
}: CompanySettingsModalProps) {
  const [razonSocial, setRazonSocial] = useState(company.razonSocial);
  const [rif, setRif] = useState(company.rif);
  const [numeroPatronalIVSS, setNumeroPatronalIVSS] = useState(company.numeroPatronalIVSS);
  const [codigoAportanteFAOV, setCodigoAportanteFAOV] = useState(company.codigoAportanteFAOV);
  const [codigoInces, setCodigoInces] = useState(company.codigoInces);
  const [direccionFiscal, setDireccionFiscal] = useState(company.direccionFiscal);
  const [ciudad, setCiudad] = useState(company.ciudad);
  const [telefono, setTelefono] = useState(company.telefono);
  const [representanteLegal, setRepresentanteLegal] = useState(company.representanteLegal);
  const [cargoRepresentante, setCargoRepresentante] = useState(company.cargoRepresentante);

  // Parámetros fiscales y laborales
  const [nivelRiesgoIVSS, setNivelRiesgoIVSS] = useState<IvssRiskLevel>(company.nivelRiesgoIVSS);
  const [salarioMinimoNacional, setSalarioMinimoNacional] = useState(String(company.salarioMinimoNacional));
  const [montoCestaticketNacional, setMontoCestaticketNacional] = useState(String(company.montoCestaticketNacional));
  const [tasaBCV_USD, setTasaBCV_USD] = useState(String(company.tasaBCV_USD));
  const [tasaInteresPrestacionesBCV, setTasaInteresPrestacionesBCV] = useState(
    String(company.tasaInteresPrestacionesBCV)
  );
  const [diasUtilidadesEmpresa, setDiasUtilidadesEmpresa] = useState(String(company.diasUtilidadesEmpresa));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: CompanySettings = {
      ...company,
      razonSocial,
      rif,
      numeroPatronalIVSS,
      codigoAportanteFAOV,
      codigoInces,
      direccionFiscal,
      ciudad,
      telefono,
      representanteLegal,
      cargoRepresentante,
      nivelRiesgoIVSS,
      salarioMinimoNacional: parseFloat(salarioMinimoNacional) || 130,
      montoCestaticketNacional: parseFloat(montoCestaticketNacional) || 1820,
      tasaBCV_USD: parseFloat(tasaBCV_USD) || 45.5,
      tasaInteresPrestacionesBCV: parseFloat(tasaInteresPrestacionesBCV) || 53.2,
      diasUtilidadesEmpresa: parseInt(diasUtilidadesEmpresa) || 30,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-slate-100 text-slate-800 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Parámetros Fiscales & Datos de la Empresa
              </h2>
              <p className="text-xs text-slate-500">
                Ajuste de parámetros laborales de Venezuela, tasas BCV y números de registro legal.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Identificación de la Empresa */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" /> Identificación Institucional
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">R.I.F. (J-00000000-0) *</label>
                <input
                  type="text"
                  required
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Número Patronal IVSS (9 dígitos) *</label>
                <input
                  type="text"
                  required
                  value={numeroPatronalIVSS}
                  onChange={(e) => setNumeroPatronalIVSS(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Código Aportante FAOV</label>
                <input
                  type="text"
                  value={codigoAportanteFAOV}
                  onChange={(e) => setCodigoAportanteFAOV(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Código INCES</label>
                <input
                  type="text"
                  value={codigoInces}
                  onChange={(e) => setCodigoInces(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Teléfono Institucional</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Dirección Fiscal</label>
              <input
                type="text"
                value={direccionFiscal}
                onChange={(e) => setDireccionFiscal(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Representante Legal (Firma)</label>
                <input
                  type="text"
                  value={representanteLegal}
                  onChange={(e) => setRepresentanteLegal(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Cargo del Representante</label>
                <input
                  type="text"
                  value={cargoRepresentante}
                  onChange={(e) => setCargoRepresentante(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Parámetros Laborales y Tasas BCV */}
          <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-sky-600" /> Parámetros Laborales & Tasas Oficiales BCV
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nivel de Riesgo IVSS
                </label>
                <select
                  value={nivelRiesgoIVSS}
                  onChange={(e) => setNivelRiesgoIVSS(parseInt(e.target.value) as IvssRiskLevel)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  <option value={9}>Mínimo (9% Patrono)</option>
                  <option value={10}>Medio (10% Patrono)</option>
                  <option value={11}>Máximo (11% Patrono)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Tasa Oficial BCV (Bs. / USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tasaBCV_USD}
                  onChange={(e) => setTasaBCV_USD(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Tasa Activa BCV Prestaciones (% anual)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tasaInteresPrestacionesBCV}
                  onChange={(e) => setTasaInteresPrestacionesBCV(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-amber-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Cestaticket Socialista (Bs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={montoCestaticketNacional}
                  onChange={(e) => setMontoCestaticketNacional(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Salario Mínimo Nacional (Bs. Tope)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={salarioMinimoNacional}
                  onChange={(e) => setSalarioMinimoNacional(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Días de Utilidades Empresa
                </label>
                <input
                  type="number"
                  min="30"
                  max="120"
                  required
                  value={diasUtilidadesEmpresa}
                  onChange={(e) => setDiasUtilidadesEmpresa(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
            >
              <Check className="w-4 h-4" /> Guardar Parámetros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
