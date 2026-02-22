import React from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../../widgets/PageLayout";
import { Leaderboard } from "../../../widgets/Leaderboard";

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageLayout title={t("leaderboard.title")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Leaderboard />
      </div>
    </PageLayout>
  );
};

export default LeaderboardPage;
