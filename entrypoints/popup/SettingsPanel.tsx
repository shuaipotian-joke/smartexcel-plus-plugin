import { t, LANG_LABELS, SUPPORTED_LANGS, type Lang } from '@/utils/i18n';

interface CreditState {
  credits: number;
  loggedIn: boolean;
  freeUsed: number;
  freeLimit: number;
  email?: string;
  name?: string;
}

interface SettingsPanelProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onBack: () => void;
  creditState: CreditState | null;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
}

export default function SettingsPanel({
  lang,
  onLangChange,
  onBack,
  creditState,
  onLogin,
  onRegister,
  onLogout,
}: SettingsPanelProps) {
  return (
    <div className="w-[360px] min-h-[200px] bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
          title={t('back', lang)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-white font-semibold text-sm">{t('settings', lang)}</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Language section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('language', lang)}
          </p>
          <div className="flex gap-2">
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l}
                onClick={() => onLangChange(l)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  lang === l
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Usage stats section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('usageStats', lang)}
          </p>
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            {creditState ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('freeUsed', lang)}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {creditState.freeUsed} / {creditState.freeLimit}{' '}
                    {t('times', lang)}
                  </span>
                </div>

                {creditState.loggedIn ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{t('creditsBalance', lang)}</span>
                      <span className="text-sm font-medium text-brand-600">
                        {creditState.credits} {t('times', lang)}
                      </span>
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="text-xs text-gray-400">
                        {t('loggedInAs', lang, {
                          email: creditState.email || creditState.name || '—',
                        })}
                      </div>
                      <button
                        onClick={onLogout}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t('logout', lang)}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">{t('notLoggedIn', lang)}</span>
                      <button
                        onClick={onLogin}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        {t('loginForMore', lang)}
                      </button>
                    </div>
                    <button
                      onClick={onRegister}
                      className="text-xs text-gray-500 hover:text-brand-600 hover:underline"
                    >
                      {t('createAccount', lang)}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-1">—</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
