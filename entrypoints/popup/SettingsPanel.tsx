import { t, LANG_LABELS, SUPPORTED_LANGS, type Lang } from '@/utils/i18n';
import { ArrowLeft, Check, Globe2, Sparkles } from 'lucide-react';

interface SettingsPanelProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onBack: () => void;
}

export default function SettingsPanel({
  lang,
  onLangChange,
  onBack,
}: SettingsPanelProps) {
  return (
    <div className="w-[380px] min-h-[260px] overflow-hidden bg-cream-50 text-[#173127]">
      {/* Header */}
      <div className="border-b border-cream-200 bg-[radial-gradient(circle_at_top_left,rgba(42,179,127,0.18),transparent_36%),linear-gradient(135deg,#fffdf7_0%,#f1fbf6_100%)] px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9e7d8] bg-white/80 text-[#557064] shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            title={t('back', lang)}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-[#173127]">{t('settings', lang)}</h1>
            <p className="mt-0.5 text-xs text-[#557064]">SmartExcel</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Language section */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#557064]">
            <Globe2 className="h-3.5 w-3.5 text-brand-600" />
            <span>{t('language', lang)}</span>
          </p>
          <p className="mb-2 text-xs leading-relaxed text-[#6d8277]">
            {t('languageRegionHint', lang)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l}
                onClick={() => onLangChange(l)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  lang === l
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-[#d9e7d8] bg-white/80 text-[#557064] hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {lang === l && <Check className="h-3.5 w-3.5" />}
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Usage stats section */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#557064]">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>{t('pluginMode', lang)}</span>
          </p>
          <div className="space-y-2.5 rounded-xl border border-[#e5eadf] bg-white/85 p-3 shadow-soft">
            <p className="text-sm font-medium text-[#305246]">
              {t('freeEditionEnabled', lang)}
            </p>
            <p className="text-xs leading-relaxed text-[#6d8277]">
              {t('freeEditionDescription', lang)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
