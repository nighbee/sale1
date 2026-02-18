import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@shared/utils/cn';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language;

  const languages = [
    { code: 'kk', label: 'KK' },
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg mb-4 mx-3">
      <span className="material-icons text-slate-400 text-sm mr-1">language</span>
      <div className="flex gap-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              "text-xs font-bold px-2 py-1 rounded transition-colors",
              currentLanguage.startsWith(lang.code)
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            )}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
