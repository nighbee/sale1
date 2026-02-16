import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyApi } from '../../../entities/company/api';
import Button from '../../../shared/ui/Button';

const CompanySetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    companySize: '',
    timezone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCompany = async () => {
      const companyId = localStorage.getItem('company_id');
      if (companyId) {
        try {
          const res = await companyApi.getCompany(companyId);
          const data = res.data as any;
          setFormData({
            companyName: data.name || '',
            industry: data.industry || '',
            companySize: data.size || '',
            timezone: data.time_zone || '',
          });
        } catch {
          console.error('Failed to fetch company');
        }
      }
    };
    fetchCompany();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const companyId = localStorage.getItem('company_id');
    if (!companyId) {
      setError('Company ID not found');
      setLoading(false);
      return;
    }

    try {
      await companyApi.updateSettings(companyId, {
        name: formData.companyName,
        industry: formData.industry,
        size: formData.companySize,
        time_zone: formData.timezone,
      });
      navigate('/team-creation');
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } }; setError(apiError.response?.data?.error || 'Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-display bg-background-light dark:bg-background-dark text-neutral-800 dark:text-neutral-100 min-h-screen flex flex-col antialiased selection:bg-primary/30 selection:text-primary">
      <header className="w-full px-8 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">S</div>
          <span className="font-bold text-xl tracking-tight text-neutral-900 dark:text-white">SalesAI</span>
        </div>
        <button className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary transition-colors">
          Need help?
        </button>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl opacity-60 dark:opacity-20 mix-blend-multiply dark:mix-blend-lighten animate-blob"></div>
          <div className="absolute top-[20%] -left-[10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl opacity-60 dark:opacity-20 mix-blend-multiply dark:mix-blend-lighten animate-blob animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-xl z-10">
          <div className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">Step 2 of 5</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Company Setup</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full w-2/5 transition-all duration-500 ease-in-out"></div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-100 dark:border-neutral-800 rounded-xl p-8 sm:p-10">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">Set Up Your Company</h1>
              <p className="text-neutral-500 dark:text-neutral-400">Tell us about your organization to personalize your AI insights and benchmarks.</p>
            </div>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="company_name">
                  Company Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <span className="material-icons text-[20px]">business</span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                    id="company_name"
                    name="companyName"
                    placeholder="e.g. Acme Corp"
                    required
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="industry">
                  Industry
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <span className="material-icons text-[20px]">domain</span>
                  </div>
                  <select
                    className="appearance-none block w-full pl-10 pr-10 py-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800/50 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                    id="industry"
                    name="industry"
                    required
                    value={formData.industry}
                    onChange={handleChange}
                  >
                    <option value="" disabled>Select an industry...</option>
                    <option value="tech">Technology & Software</option>
                    <option value="finance">Finance & Banking</option>
                    <option value="healthcare">Healthcare & Pharma</option>
                    <option value="retail">Retail & E-commerce</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="education">Education</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
                    <span className="material-icons text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Company Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['1-50', '51-500', '500+'].map((size) => (
                    <label key={size} className="cursor-pointer">
                      <input
                        className="peer sr-only"
                        name="companySize"
                        type="radio"
                        value={size}
                        checked={formData.companySize === size}
                        onChange={handleChange}
                      />
                      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 text-center hover:bg-neutral-50 dark:hover:bg-neutral-800 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary transition-all">
                        <span className="text-sm font-medium">{size}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="timezone">
                  Time Zone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <span className="material-icons text-[20px]">schedule</span>
                  </div>
                  <select
                    className="appearance-none block w-full pl-10 pr-10 py-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800/50 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                    id="timezone"
                    name="timezone"
                    required
                    value={formData.timezone}
                    onChange={handleChange}
                  >
                    <option value="" disabled>Select your time zone...</option>
                    <option value="UTC-08:00">(UTC-08:00) Pacific Time (US & Canada)</option>
                    <option value="UTC-07:00">(UTC-07:00) Mountain Time (US & Canada)</option>
                    <option value="UTC-06:00">(UTC-06:00) Central Time (US & Canada)</option>
                    <option value="UTC-05:00">(UTC-05:00) Eastern Time (US & Canada)</option>
                    <option value="UTC+00:00">(UTC+00:00) Greenwich Mean Time</option>
                    <option value="UTC+01:00">(UTC+01:00) Central European Time</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
                    <span className="material-icons text-[20px]">expand_more</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Used for scheduling reports and meeting insights.</p>
              </div>

              <div className="pt-6 flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-3"
                >
                  Back
                </Button>
                <Button
                  className="flex-1 px-6 py-3 shadow-lg shadow-primary/30 hover:shadow-primary/40 flex justify-center items-center gap-2 group"
                  type="submit"
                  isLoading={loading}
                >
                  Continue
                  <span className="material-icons text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanySetupPage;
