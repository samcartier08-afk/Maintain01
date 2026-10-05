import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FleetDashboard } from './components/FleetDashboard';
import { AssetDetail } from './components/AssetDetail';
import { DecisionBriefView } from './components/DecisionBriefView';
import { CopilotChat } from './components/CopilotChat';
import { WorkOrdersView } from './components/WorkOrdersView';
import { MetricsAuditView } from './components/MetricsAuditView';
import { 
  Asset, 
  AlertItem, 
  DecisionBrief, 
  WorkOrder, 
  EvaluationMetrics, 
  AuditBlock, 
  Role 
} from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('fleet');
  const [userRole, setUserRole] = useState<Role>('supervisor');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('M-204');

  // Server state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [currentBrief, setCurrentBrief] = useState<DecisionBrief | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>([]);
  const [auditVerification, setAuditVerification] = useState<any>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);

  // Initial data loading
  const loadFleetData = async () => {
    try {
      const [assetsRes, alertsRes, woRes, metricsRes, auditRes] = await Promise.all([
        fetch('/api/assets').then(r => r.json()),
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/work-orders').then(r => r.json()),
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/audit').then(r => r.json()),
      ]);

      if (assetsRes.assets) setAssets(assetsRes.assets);
      if (alertsRes.alerts) setAlerts(alertsRes.alerts);
      if (woRes.work_orders) setWorkOrders(woRes.work_orders);
      if (metricsRes.metrics) setMetrics(metricsRes.metrics);
      if (auditRes.entries) {
        setAuditBlocks(auditRes.entries);
        setAuditVerification(auditRes.verification);
      }
    } catch (err) {
      console.error('Failed to load fleet initial data:', err);
    }
  };

  const loadBriefForAsset = async (assetId: string) => {
    setIsLoadingBrief(true);
    try {
      const res = await fetch(`/api/investigate/${assetId}`, { method: 'POST' });
      const data = await res.json();
      if (data.brief) {
        setCurrentBrief(data.brief);
      }
    } catch (err) {
      console.error(`Failed to generate decision brief for ${assetId}:`, err);
    } finally {
      setIsLoadingBrief(false);
    }
  };

  useEffect(() => {
    loadFleetData();
    loadBriefForAsset('M-204');
  }, []);

  const handleSelectAsset = (id: string) => {
    setSelectedAssetId(id);
    setCurrentTab('asset');
    loadBriefForAsset(id);
  };

  const handleOpenDecisionBrief = (id: string) => {
    setSelectedAssetId(id);
    setCurrentTab('brief');
    loadBriefForAsset(id);
  };

  const handleAskCopilot = (prompt: string, assetId?: string) => {
    if (assetId) setSelectedAssetId(assetId);
    setCurrentTab('chat');
  };

  const handleApproveWorkOrder = async (
    briefId: string, 
    decision: 'APPROVED' | 'EDITED' | 'POSTPONED' | 'REJECTED', 
    justification: string
  ) => {
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: briefId.replace('DB-', 'WO-'),
          decision,
          actor_role: userRole,
          actor_name: userRole === 'supervisor' ? 'Elena Miller (Shift Supervisor)' : 'Anonymous',
          justification
        })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh orders and audit chain
        const [woRes, auditRes] = await Promise.all([
          fetch('/api/work-orders').then(r => r.json()),
          fetch('/api/audit').then(r => r.json()),
        ]);
        if (woRes.work_orders) setWorkOrders(woRes.work_orders);
        if (auditRes.entries) {
          setAuditBlocks(auditRes.entries);
          setAuditVerification(auditRes.verification);
        }
      }
    } catch (err) {
      console.error('Error approving work order:', err);
    }
  };

  const handleReverifyAudit = async () => {
    try {
      const res = await fetch('/api/audit/verify', { method: 'POST' });
      const data = await res.json();
      setAuditVerification(data.verification);
    } catch (err) {
      console.error('Audit verification error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        userRole={userRole}
        setUserRole={setUserRole}
        openAlertsCount={alerts.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'fleet' && (
          <FleetDashboard
            assets={assets}
            alerts={alerts}
            onSelectAsset={handleSelectAsset}
            onOpenDecisionBrief={handleOpenDecisionBrief}
            onAskCopilot={handleAskCopilot}
            onRefresh={loadFleetData}
          />
        )}

        {currentTab === 'asset' && (
          <AssetDetail
            selectedAssetId={selectedAssetId}
            onSelectAssetId={(id) => {
              setSelectedAssetId(id);
              loadBriefForAsset(id);
            }}
            assets={assets}
            onOpenDecisionBrief={handleOpenDecisionBrief}
            onAskCopilot={handleAskCopilot}
          />
        )}

        {currentTab === 'brief' && (
          <DecisionBriefView
            brief={currentBrief}
            userRole={userRole}
            onApprove={handleApproveWorkOrder}
            onAskCopilot={handleAskCopilot}
            isLoading={isLoadingBrief}
          />
        )}

        {currentTab === 'chat' && (
          <CopilotChat
            initialAssetId={selectedAssetId}
            onOpenDecisionBrief={handleOpenDecisionBrief}
          />
        )}

        {currentTab === 'orders' && (
          <WorkOrdersView
            workOrders={workOrders}
            userRole={userRole}
            onRefresh={loadFleetData}
          />
        )}

        {currentTab === 'audit' && (
          <MetricsAuditView
            metrics={metrics}
            auditBlocks={auditBlocks}
            auditVerification={auditVerification}
            onReverify={handleReverifyAudit}
            onRefresh={loadFleetData}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/60 bg-slate-950 py-3 text-center text-xs text-slate-500 font-sans">
        MaintainCopilot · Smart Industrial Reliability Assistant · Supervisor Approval Required for Repairs
      </footer>
    </div>
  );
}
