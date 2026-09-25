import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui';
import { db } from '../../services/mockSupabase';
import { Outlet, Property, CompanySettings, WhatsAppAutomationRule, WhatsAppTemplate, WhatsAppConfig, Company } from '../../types';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { WhatsAppAutomationRulesTab } from './WhatsAppAutomationRulesTab';
import { WhatsAppTemplatesTab } from './WhatsAppTemplatesTab';
import { WhatsAppSettingsTab } from './WhatsAppSettingsTab';
import { 
  Zap, 
  FileText, 
  Settings as SettingsIcon, 
  Store, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCcw,
  Sparkles,
  ShieldCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WhatsAppConfigModuleProps {
  outlets: Outlet[];
  properties: Property[];
  currentProperty: Property | null;
  currentOutlet: Outlet | null;
  settings: CompanySettings | null;
  refreshSettings: () => Promise<void>;
  showStatus: (msg: string, type: 'success' | 'error') => void;
  waRules: WhatsAppAutomationRule[];
  waTemplates: WhatsAppTemplate[];
  waConfig: WhatsAppConfig | null;
  isLoadingWaData: boolean;
  onToggleWaRule: (ruleId: string, active: boolean) => Promise<void>;
  onSaveWaRule: (rule: WhatsAppAutomationRule) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onTestWaRule: (ruleId: string, phone: string, name?: string) => Promise<{ success: boolean; messageText?: string; error?: string }>;
  onSaveWaTemplate: (template: WhatsAppTemplate) => Promise<void>;
  onDeleteWaTemplate: (templateId: string) => Promise<void>;
  onSaveWaConfig: (updated: Partial<WhatsAppConfig>, newToken?: string) => Promise<void>;
  onTestWaConnection: () => Promise<{ success: boolean; error?: string; details?: any }>;
  activeWaCompany: Company | null;
  activeWaProperty: Property | null;
  activeWaOutlet: Outlet | null;
}

export const WhatsAppConfigModule: React.FC<WhatsAppConfigModuleProps> = ({
  outlets,
  properties,
  currentProperty,
  currentOutlet,
  settings,
  refreshSettings,
  showStatus,
  waRules,
  waTemplates,
  waConfig,
  isLoadingWaData,
  onToggleWaRule,
  onSaveWaRule,
  onDeleteRule,
  onTestWaRule,
  onSaveWaTemplate,
  onDeleteWaTemplate,
  onSaveWaConfig,
  onTestWaConnection,
  activeWaCompany,
  activeWaProperty,
  activeWaOutlet
}) => {
  const [subTab, setSubTab] = useState<'activation' | 'rules' | 'templates' | 'api'>('activation');
  const [updatingOutletId, setUpdatingOutletId] = useState<string | null>(null);

  // Relevant outlets for current property (or all if no property selected)
  const targetOutlets = currentProperty 
    ? outlets.filter(o => o.property_id === currentProperty.id) 
    : outlets;

  const handleToggleOutletWhatsApp = async (targetOutlet: Outlet, newStatus: boolean) => {
    setUpdatingOutletId(targetOutlet.id);
    try {
      // 1. Update outlet table stored in database (Supabase)
      await db.updateOutlet(targetOutlet.id, {
        whatsapp_enabled: newStatus
      });

      // 2. Keep settings.whatsapp_disabled_outlets in sync for dual compatibility
      const currentDisabled = settings?.whatsapp_disabled_outlets || [];
      const updatedDisabled = newStatus
        ? currentDisabled.filter(id => id !== targetOutlet.id)
        : Array.from(new Set([...currentDisabled, targetOutlet.id]));

      const updatedSettings = {
        ...settings!,
        whatsapp_disabled_outlets: updatedDisabled
      };
      await db.updateSettings(updatedSettings);

      // 3. Refresh globally so sidebar updates immediately
      await refreshSettings();

      const statusText = newStatus ? 'activated (Visible in sidebar)' : 'deactivated (Hidden from sidebar)';
      showStatus(`WhatsApp for ${targetOutlet.name} is now ${statusText}.`, 'success');
      toast.success(`${targetOutlet.name}: WhatsApp ${newStatus ? 'Enabled' : 'Disabled'}`);
    } catch (err: any) {
      console.error('Error toggling outlet WhatsApp status:', err);
      showStatus(`Failed to update WhatsApp status: ${err.message}`, 'error');
      toast.error('Failed to update outlet WhatsApp status');
    } finally {
      setUpdatingOutletId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card with WhatsApp Branding & Sub-Navigation */}
      <Card className="rounded-[3rem] border-slate-200/80 shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/20 shrink-0">
              <WhatsAppIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                  WhatsApp Automation & API
                </CardTitle>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Meta Certified
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage outlet activation, automatic trigger workflows, HSM templates, and Cloud API credentials for <span className="font-bold text-slate-800">{activeWaOutlet?.name || 'All Outlets'}</span> ({activeWaProperty?.name || 'Property'})
              </p>
            </div>
          </div>

          {/* Sub-Tabs Pills */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/60 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setSubTab('activation')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'activation'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Outlet Activation</span>
            </button>

            <button
              onClick={() => setSubTab('rules')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'rules'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Auto Rules</span>
            </button>

            <button
              onClick={() => setSubTab('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'templates'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>HSM Templates</span>
            </button>

            <button
              onClick={() => setSubTab('api')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'api'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <SettingsIcon className="w-4 h-4 text-emerald-600" />
              <span>API Gateway</span>
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* 2. SUB-TAB CONTENT: OUTLET ACTIVATION (MATCHING BOOKING ENGINE PATTERN) */}
      {subTab === 'activation' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-50/80 border border-emerald-200/80 p-6 rounded-[2.5rem]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0">
                <WhatsAppIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-emerald-950 uppercase tracking-tight">
                  Outlet WhatsApp Activation Control
                </h3>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  Toggle WhatsApp Hub on or off per outlet. When deactivated, the WhatsApp Hub navigation link is automatically hidden from the sidebar and stored in the database.
                </p>
              </div>
            </div>

            {currentProperty && (
              <div className="px-4 py-2 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center gap-2 self-start md:self-auto">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-800">{currentProperty.name}</span>
              </div>
            )}
          </div>

          {/* Grid of Outlets with Instant Activation Toggle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {targetOutlets.map(outlet => {
              const isEnabled = outlet.whatsapp_enabled !== false && !settings?.whatsapp_disabled_outlets?.includes(outlet.id);
              const isSelectedActive = currentOutlet?.id === outlet.id;
              const prop = properties.find(p => p.id === outlet.property_id);

              return (
                <Card 
                  key={outlet.id} 
                  className={`rounded-[2.5rem] border-2 transition-all overflow-hidden bg-white ${
                    isEnabled ? 'border-emerald-200 shadow-sm' : 'border-slate-200/80 opacity-80'
                  }`}
                >
                  <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                        isEnabled ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-black uppercase tracking-tight text-slate-900">
                            {outlet.name}
                          </CardTitle>
                          {isSelectedActive && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Active Selection
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          {prop?.name || 'Property'} • {outlet.address || 'Facility Outlet'}
                        </p>
                      </div>
                    </div>

                    {/* Activation Toggle Switch */}
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isEnabled ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {isEnabled ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        disabled={updatingOutletId === outlet.id}
                        onClick={() => handleToggleOutletWhatsApp(outlet, !isEnabled)}
                        className={`w-14 h-7 rounded-full transition-all relative cursor-pointer disabled:opacity-50 ${
                          isEnabled ? 'bg-emerald-600 shadow-md shadow-emerald-600/20' : 'bg-slate-300'
                        }`}
                        title={isEnabled ? "Click to deactivate WhatsApp for this outlet" : "Click to activate WhatsApp for this outlet"}
                      >
                        <div 
                          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform shadow-xs flex items-center justify-center ${
                            isEnabled ? 'translate-x-7' : 'translate-x-0'
                          }`}
                        >
                          {isEnabled && <WhatsAppIcon className="w-3 h-3 text-emerald-600" />}
                        </div>
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-500 font-medium">Sidebar Visibility:</span>
                      <span className={`font-black uppercase tracking-wider text-[11px] ${
                        isEnabled ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {isEnabled ? '✓ Visible in Navigation' : '✕ Hidden from Navigation'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-500 font-medium">Sender Tag:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">
                        {outlet.name} • {prop?.name || 'Property'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {targetOutlets.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50 rounded-3xl border border-slate-200">
              No outlets found for the current selection.
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-TAB CONTENT: AUTOMATION RULES & TRIGGERS */}
      {subTab === 'rules' && (
        <Card className="rounded-[3rem] border-slate-200/80 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Auto Triggers</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Configure automated WhatsApp triggers & event dispatchers for {activeWaOutlet?.name || 'Current Venue'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {isLoadingWaData ? (
              <div className="p-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">Loading WhatsApp Auto Triggers...</div>
            ) : (
              <WhatsAppAutomationRulesTab
                rules={waRules}
                templates={waTemplates}
                onToggleActive={onToggleWaRule}
                onSaveRule={onSaveWaRule}
                onDeleteRule={onDeleteRule}
                onTestRule={onTestWaRule}
                companyId={activeWaCompany?.id || ''}
                propertyId={activeWaProperty?.id || ''}
                outletId={activeWaOutlet?.id || ''}
                outletName={activeWaOutlet?.name || 'Outlet'}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. SUB-TAB CONTENT: HSM TEMPLATES */}
      {subTab === 'templates' && (
        <Card className="rounded-[3rem] border-slate-200/80 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">HSM Templates</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Meta Verified WhatsApp message templates for {activeWaOutlet?.name || 'Current Venue'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {isLoadingWaData ? (
              <div className="p-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">Loading HSM Templates...</div>
            ) : (
              <WhatsAppTemplatesTab
                templates={waTemplates}
                onSaveTemplate={onSaveWaTemplate}
                onDeleteTemplate={onDeleteWaTemplate}
                companyId={activeWaCompany?.id || ''}
                propertyId={activeWaProperty?.id || ''}
                outletId={activeWaOutlet?.id || ''}
                outletName={activeWaOutlet?.name || 'Outlet'}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. SUB-TAB CONTENT: META API GATEWAY & CREDENTIALS */}
      {subTab === 'api' && (
        <Card className="rounded-[3rem] border-slate-200/80 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <SettingsIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">API Gateway</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Meta Cloud API token, phone number IDs & webhook settings for {activeWaOutlet?.name || 'Current Venue'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {isLoadingWaData || !waConfig ? (
              <div className="p-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">Loading API Gateway Config...</div>
            ) : (
              <WhatsAppSettingsTab
                config={waConfig}
                onSaveConfig={onSaveWaConfig}
                onTestConnection={onTestWaConnection}
                companyId={activeWaCompany?.id || ''}
                propertyId={activeWaProperty?.id || ''}
                outletId={activeWaOutlet?.id || ''}
                outletName={activeWaOutlet?.name || 'Outlet'}
                propertyName={activeWaProperty?.name || 'Property'}
                companyName={activeWaCompany?.name || 'Torch Group'}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WhatsAppConfigModule;
