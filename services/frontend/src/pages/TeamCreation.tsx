import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TeamCreation: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    teamName: '',
    description: '',
    autoAssign: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Integration later
    navigate('/script-upload');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col transition-colors duration-200">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">S</div>
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">SalesAI</span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Step 4 of 5
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: '80%' }}></div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 sm:p-10">
            <div className="mb-8 text-center sm:text-left">
              <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto sm:mx-0">
                <span className="material-icons text-primary text-2xl">groups</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Your First Sales Team</h1>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Organize your reps into focused groups. AI will use this structure to tailor insights specifically for this team's goals.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="team_name">
                  Team Name
                </label>
                <div className="relative">
                  <input
                    autoFocus
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm transition-colors"
                    id="team_name"
                    name="teamName"
                    placeholder="Inbound Sales Team"
                    required
                    type="text"
                    value={formData.teamName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="description">
                    Description
                  </label>
                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                    <span className="material-icons text-[14px]">auto_awesome</span> AI Context
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm transition-colors resize-none"
                    id="description"
                    name="description"
                    placeholder="e.g., Handles all incoming leads from marketing campaigns and website inquiries..."
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                  ></textarea>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Optional. This helps our AI suggest relevant KPIs and coaching templates.
                </p>
              </div>

              <div className="pt-2">
                <div className="flex items-start">
                  <div className="flex h-5 items-center">
                    <input
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-700 dark:bg-gray-800"
                      id="auto_assign"
                      name="autoAssign"
                      type="checkbox"
                      checked={formData.autoAssign}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label className="font-medium text-gray-700 dark:text-gray-300" htmlFor="auto_assign">Enable AI Lead Routing</label>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Automatically assign leads based on rep performance.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                <button
                  className="w-full sm:w-auto text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                  type="button"
                  onClick={() => navigate(-1)}
                >
                  <span className="material-icons text-lg">arrow_back</span>
                  Back
                </button>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors hidden sm:block"
                    onClick={() => navigate('/script-upload')}
                  >
                    Skip for now
                  </button>
                  <button
                    className="w-full sm:w-auto bg-primary hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    type="submit"
                  >
                    Create Team
                  </button>
                </div>
                <button
                  type="button"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors sm:hidden mt-2"
                  onClick={() => navigate('/script-upload')}
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Need help setting up your team structure? <a className="text-primary hover:underline" href="#">Read our guide</a> on sales org design.
            </p>
          </div>
        </div>
      </main>

      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-3xl opacity-40"></div>
      </div>
    </div>
  );
};

export default TeamCreation;
