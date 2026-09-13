import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import Campaigns from './pages/Campaigns';
import CampaignWizard from './pages/CampaignWizard';
import CampaignDetail from './pages/CampaignDetail';
import Analytics from './pages/Analytics';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
import Plans from './pages/Plans';
import Billing from './pages/Billing';
import Admin from './pages/Admin';
import EmailIntegrations from './pages/EmailIntegrations';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="lists" element={<Lists />} />
        <Route path="lists/:id" element={<ListDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/new" element={<TemplateEditor />} />
        <Route path="templates/:id/edit" element={<TemplateEditor />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignWizard />} />
        <Route path="campaigns/edit/:id" element={<CampaignWizard />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="email-integrations" element={<EmailIntegrations />} />
        <Route path="plans" element={<Plans />} />
        <Route path="billing" element={<Billing />} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
