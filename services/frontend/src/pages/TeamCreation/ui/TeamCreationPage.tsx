import React from "react";
import { CreateTeamForm } from "../../../features/team-management/create-team";

const TeamCreationPage: React.FC = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col transition-colors duration-200">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
            S
          </div>
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
            SalesAI
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Step 4 of 5
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-1.5 rounded-full"
              style={{ width: "80%" }}
            ></div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-8 sm:p-10">
            <div className="mb-8 text-center sm:text-left">
              <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto sm:mx-0">
                <span className="material-icons text-primary text-2xl">
                  groups
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Create Your First Sales Team
              </h1>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Organize your reps into focused groups. AI will use this
                structure to tailor insights specifically for this team's goals.
              </p>
            </div>

            <CreateTeamForm />
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Need help setting up your team structure?{" "}
              <a className="text-primary hover:underline" href="#">
                Read our guide
              </a>{" "}
              on sales org design.
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

export default TeamCreationPage;
