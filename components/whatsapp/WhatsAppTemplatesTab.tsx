import React, { useState } from 'react';
import { WhatsAppTemplate, WhatsAppTemplateButton } from '../../types';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Smartphone, 
  Trash2, 
  Copy, 
  Sparkles,
  ExternalLink,
  Phone
} from 'lucide-react';

interface WhatsAppTemplatesTabProps {
  templates: WhatsAppTemplate[];
  onSaveTemplate: (template: WhatsAppTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  companyId: string;
  propertyId: string;
  outletId: string;
  outletName: string;
}

export const WhatsAppTemplatesTab: React.FC<WhatsAppTemplatesTabProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  companyId,
  propertyId,
  outletId,
  outletName
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(templates[0] || null);

  // Form State
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('Concierge Services');
  const [buttons, setButtons] = useState<WhatsAppTemplateButton[]>([
    { type: 'QUICK_REPLY', text: 'Confirm Arrival' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !bodyText.trim()) return;

    setIsSaving(true);
    try {
      const newTmpl: WhatsAppTemplate = {
        id: 'tmpl_' + Math.random().toString(36).substring(2, 11),
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category,
        language: 'en_US',
        header_text: headerText || undefined,
        body_text: bodyText,
        footer_text: footerText || undefined,
        buttons: buttons.filter(b => b.text.trim().length > 0),
        status: 'APPROVED',
        meta_template_id: 'waba_tpl_' + Math.floor(Math.random() * 89999999 + 10000000),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await onSaveTemplate(newTmpl);
      setIsCreateModalOpen(false);
      setPreviewTemplate(newTmpl);
      // Reset
      setTemplateName('');
      setHeaderText('');
      setBodyText('');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: 'APPROVED' | 'PENDING' | 'REJECTED') => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" /> Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3 text-red-600" /> Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
              Meta WhatsApp Message Templates
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Pre-approved high-deliverability templates for booking confirmations, membership alerts, and customer engagement for <span className="font-bold text-slate-800">{outletName}</span>.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {(['ALL', 'UTILITY', 'MARKETING', 'AUTHENTICATION'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat === 'ALL' ? 'All Templates' : cat}
          </button>
        ))}
      </div>

      {/* 2-Column Split: Template List & Live Phone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {filteredTemplates.map(tmpl => {
            const isSelected = previewTemplate?.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => setPreviewTemplate(tmpl)}
                className={`bg-white rounded-3xl border p-5 shadow-sm cursor-pointer transition-all ${
                  isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-900 font-mono">
                      {tmpl.name}
                    </h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {tmpl.language}
                    </span>
                  </div>
                  {getStatusBadge(tmpl.status)}
                </div>

                {tmpl.header_text && (
                  <p className="text-xs font-bold text-slate-800 mb-1">{tmpl.header_text}</p>
                )}

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {tmpl.body_text}
                </p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                  <span className="font-mono text-[10px]">{tmpl.meta_template_id || 'WABA_APPROVED'}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {tmpl.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTemplate(tmpl.id);
                      }}
                      className="p-1 hover:text-red-600 text-slate-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Authentic Smartphone Screen Mockup (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 bg-slate-900 rounded-[42px] p-4 shadow-2xl border-4 border-slate-800 max-w-sm mx-auto">
            {/* Phone Notch */}
            <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-900" />
            </div>

            {/* Smartphone Inner Display Screen */}
            <div className="bg-[#efeae2] rounded-[32px] overflow-hidden min-h-[460px] flex flex-col justify-between border border-slate-700/50 shadow-inner">
              {/* WhatsApp App Bar */}
              <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    P
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-none">{outletName}</div>
                    <div className="text-[9px] text-emerald-100/90 leading-tight">Official Business Account</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-xs">
                  ⋮
                </div>
              </div>

              {/* Message Screen Wallpaper Area */}
              <div className="p-3.5 space-y-3 flex-1">
                <div className="text-center">
                  <span className="bg-white/80 text-slate-600 text-[9px] font-bold px-2 py-1 rounded-lg shadow-xs">
                    TODAY
                  </span>
                </div>

                {previewTemplate ? (
                  <div className="bg-white rounded-2xl p-3 shadow-md border border-slate-200/60 text-xs space-y-2 max-w-[95%]">
                    {previewTemplate.header_text && (
                      <div className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1">
                        {previewTemplate.header_text}
                      </div>
                    )}

                    <div className="text-slate-800 whitespace-pre-wrap leading-relaxed text-[11px]">
                      {previewTemplate.body_text
                        .replace(/\{\{1\}\}/g, 'Sheikh Hamad')
                        .replace(/\{\{2\}\}/g, '1042')
                        .replace(/\{\{3\}\}/g, outletName)}
                    </div>

                    {previewTemplate.footer_text && (
                      <div className="text-[10px] text-slate-400 pt-1">
                        {previewTemplate.footer_text}
                      </div>
                    )}

                    {/* Interactive Action Buttons */}
                    {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        {previewTemplate.buttons.map((btn, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 hover:bg-slate-100 text-emerald-700 text-[11px] font-bold py-1.5 px-3 rounded-xl text-center border border-slate-200/80 flex items-center justify-center gap-1.5"
                          >
                            {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                            {btn.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3" />}
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 text-xs text-slate-400">
                    Select a template to view the live WhatsApp preview.
                  </div>
                )}
              </div>

              {/* Bottom Fake Input Bar */}
              <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 border-t border-slate-200/60 text-[10px] text-slate-400 px-3">
                <span>Message</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900">Create Meta WhatsApp Template</h3>
                  <p className="text-xs text-slate-500">Configured for {outletName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. spa_booking_reminder"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="UTILITY">UTILITY (Transactional / Alerts)</option>
                    <option value="MARKETING">MARKETING (Promotions / Offers)</option>
                    <option value="AUTHENTICATION">AUTHENTICATION (OTP / Passwords)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Header Text (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Booking Confirmation"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Body Content *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Use {'{{1}}'}, {'{{2}}'} for placeholders</span>
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Dear {{1}}, your booking for {{2}} is confirmed for {{3}}."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Footer Text (Optional)
                </label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSaving ? 'Submitting...' : 'Register Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
