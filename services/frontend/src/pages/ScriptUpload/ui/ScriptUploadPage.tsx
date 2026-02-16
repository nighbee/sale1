import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scriptApi } from '../../../entities/script/api';
import { toast } from 'sonner';
import Button from '../../../shared/ui/Button';

const ScriptUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('company_id', localStorage.getItem('company_id') || '');

    try {
      await scriptApi.upload(formData);
      toast.success('Script uploaded successfully!');
      navigate('/invite-members');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      const msg = apiError.response?.data?.error || 'Failed to upload script';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      <header className="w-full px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">S</div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">SalesAI</span>
        </div>
        <button className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors">
          Help & Support
        </button>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl dark:shadow-black/20 overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
            <div className="bg-primary h-1.5 rounded-r-full" style={{ width: '83%' }}></div>
          </div>
          <div className="p-8 sm:p-12">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">Step 5 of 6</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Customization</span>
            </div>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-900 dark:text-white">Upload Your Sales Script</h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                Our AI analyzes your best scripts to generate personalized coaching scenarios that match your company's tone.
              </p>
            </div>

            <div className="w-full relative group">
              <label className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 group-hover:shadow-lg dark:group-hover:shadow-primary/5 cursor-pointer bg-slate-50 dark:bg-slate-800/50">
                <input className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" type="file" accept=".pdf,.docx" onChange={handleFileChange} />
                <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center mb-4 ring-1 ring-slate-200 dark:ring-slate-600 group-hover:scale-110 transition-transform duration-300">
                  <span className="material-icons text-primary text-3xl">cloud_upload</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  PDF or DOCX documents (max. 10MB)
                </p>
              </label>

              {isUploading && (
                <div className="mt-6 space-y-3">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-primary">
                      <span className="material-icons text-xl">description</span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between mb-1">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate pr-4">{file?.name}</h4>
                        <span className="text-xs font-medium text-primary">Parsing...</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full animate-pulse w-3/4"></div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">4.2 MB</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">75%</span>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1" onClick={() => setFile(null)}>
                      <span className="material-icons text-xl">close</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex items-start gap-3 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/10 dark:border-primary/20">
              <span className="material-icons text-primary text-xl mt-0.5">info</span>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Why upload scripts?</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Uploaded scripts help our AI create realistic role-play scenarios that mimic your actual sales conversations. We do not share your data.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors"
              onClick={() => navigate('/invite-members')}
            >
              Skip for now
            </button>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button
                className="hidden sm:block text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
                onClick={() => navigate(-1)}
              >
                Back
              </button>
              <Button
                className="w-full sm:w-auto shadow-md shadow-primary/20 flex items-center justify-center gap-2 group"
                onClick={handleUpload as unknown as React.MouseEventHandler<HTMLButtonElement>}
                isLoading={isUploading}
                disabled={!file}
              >
                Upload & Continue
                <span className="material-icons text-sm group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 dark:opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl opacity-50 dark:opacity-20"></div>
      </div>
    </div>
  );
};

export default ScriptUploadPage;
