import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import CompanySetup from './pages/CompanySetup';
import TeamCreation from './pages/TeamCreation';
import ScriptUpload from './pages/ScriptUpload';
import InviteMembers from './pages/InviteMembers';
import DirectorDashboard from './pages/DirectorDashboard';
import TeamsOverview from './pages/TeamsOverview';
import TeamDetail from './pages/TeamDetail';
import RepDashboard from './pages/RepDashboard';
import CompanySettings from './pages/CompanySettings';
import Integrations from './pages/Integrations';
import Leaderboard from './pages/Leaderboard';
import CallDetail from './pages/CallDetail';
import CallsList from './pages/CallsList';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/company-setup" element={<CompanySetup />} />
        <Route path="/team-creation" element={<TeamCreation />} />
        <Route path="/script-upload" element={<ScriptUpload />} />
        <Route path="/invite-members" element={<InviteMembers />} />

        <Route path="/dashboard" element={<DirectorDashboard />} />
        <Route path="/rep-dashboard" element={<RepDashboard />} />
        <Route path="/teams" element={<TeamsOverview />} />
        <Route path="/teams/:id" element={<TeamDetail />} />
        <Route path="/settings" element={<CompanySettings />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/calls" element={<CallsList />} />
        <Route path="/calls/:id" element={<CallDetail />} />

        <Route path="/" element={<Navigate to="/register" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
