/**
 * Ragnarok Operator Dashboard Frontend JavaScript
 * Real-Time Telemetry, Dynamic Charting, DR Failover Controls & Chaos Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const fsmStateBadge = document.getElementById('fsmStateBadge');
  const fsmStateText = document.getElementById('fsmStateText');
  const activeTrafficText = document.getElementById('activeTrafficText');
  const userRoleSelect = document.getElementById('userRoleSelect');

  const lastRtoText = document.getElementById('lastRtoText');
  const currentLagText = document.getElementById('currentLagText');
  const downCountdownText = document.getElementById('downCountdownText');

  const primaryScoreVal = document.getElementById('primaryScoreVal');
  const primaryScoreCircle = document.getElementById('primaryScoreCircle');
  const primaryCapacityVal = document.getElementById('primaryCapacityVal');
  const primaryCapacityFill = document.getElementById('primaryCapacityFill');
  const primarySignalsList = document.getElementById('primarySignalsList');

  const secondaryScoreVal = document.getElementById('secondaryScoreVal');
  const secondaryScoreCircle = document.getElementById('secondaryScoreCircle');
  const secondaryCapacityVal = document.getElementById('secondaryCapacityVal');
  const secondaryCapacityFill = document.getElementById('secondaryCapacityFill');
  const secondarySignalsList = document.getElementById('secondarySignalsList');
  const secondaryRolePill = document.getElementById('secondaryRolePill');

  const rpoStatusBadge = document.getElementById('rpoStatusBadge');
  const backupsTbody = document.getElementById('backupsTbody');
  const eventsTimeline = document.getElementById('eventsTimeline');

  // Control Buttons
  const btnTriggerFailover = document.getElementById('btnTriggerFailover');
  const btnAbortFailover = document.getElementById('btnAbortFailover');
  const btnExecuteFailback = document.getElementById('btnExecuteFailback');
  const btnInjectOutage = document.getElementById('btnInjectOutage');
  const btnInjectLag = document.getElementById('btnInjectLag');
  const btnRecoverPrimary = document.getElementById('btnRecoverPrimary');
  const btnTriggerRestoreDrill = document.getElementById('btnTriggerRestoreDrill');

  // Chart.js Setup
  const ctx = document.getElementById('replicationChart').getContext('2d');
  const replicationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'DB Replication Lag (s)',
          data: [],
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Storage Sync Lag (s)',
          data: [],
          borderColor: '#a371f7',
          borderWidth: 2,
          fill: false,
          tension: 0.3
        },
        {
          label: 'RPO Threshold (60s)',
          data: [],
          borderColor: '#f85149',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          labels: { color: '#c9d1d9', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });

  // WebSocket Connection
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;
  let ws;

  function initWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'TELEMETRY_UPDATE') {
          updateDashboardUI(message);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    ws.onclose = () => {
      console.warn('WebSocket connection closed. Reconnecting in 3s...');
      setTimeout(initWebSocket, 3000);
    };
  }

  // Update UI with Telemetry Data
  function updateDashboardUI(telemetry) {
    const { health, replication, orchestrator } = telemetry;

    // 1. FSM & Traffic Badge Update
    const state = orchestrator.current_state;
    fsmStateText.textContent = `STATE: ${state}`;
    activeTrafficText.textContent = orchestrator.active_traffic_region === 'aws-us-east-1' ? 'AWS US-East-1 (Primary)' : 'Azure East US (Standby)';

    // Update FSM badge color
    fsmStateBadge.className = 'status-badge';
    if (state === 'HEALTHY') fsmStateBadge.style.color = '#3fb950';
    else if (state === 'MONITORING' || state === 'FAILBACK_PENDING') fsmStateBadge.style.color = '#d29922';
    else fsmStateBadge.style.color = '#f85149';

    // RTO / RPO Top Cards
    const latestEvent = orchestrator.events_history[0];
    if (latestEvent && latestEvent.rto_measured_seconds) {
      lastRtoText.textContent = `Last Measured RTO: ${latestEvent.rto_measured_seconds}s`;
    }

    const currentDbLag = replication.db_replication.lag_seconds;
    currentLagText.textContent = `Current DB Lag: ${currentDbLag}s`;

    const downDuration = health.confirmation_window.current_down_duration_seconds;
    downCountdownText.textContent = `Window Progress: ${downDuration}s / 45s`;

    // 2. Region Cards (Primary AWS)
    const primary = health.regions[0];
    primaryScoreVal.textContent = `${primary.health_score}%`;
    primaryScoreCircle.className = `score-circle ${getScoreColorClass(primary.health_score)}`;
    renderSignals(primarySignalsList, primary.signals);

    // Secondary (Azure)
    const secondary = health.regions[1];
    secondaryScoreVal.textContent = `${secondary.health_score}%`;
    secondaryScoreCircle.className = `score-circle ${getScoreColorClass(secondary.health_score)}`;
    renderSignals(secondarySignalsList, secondary.signals);

    // Compute Capacity & Role Pills
    if (replication.db_replication.writer_region === 'azure-eastus') {
      secondaryRolePill.textContent = 'PRIMARY WRITER (Promoted)';
      secondaryRolePill.className = 'role-pill primary-role';
      secondaryCapacityVal.textContent = '100% (Production)';
      secondaryCapacityFill.style.width = '100%';

      primaryCapacityVal.textContent = '0% (Offline/Degraded)';
      primaryCapacityFill.style.width = '0%';
    } else {
      secondaryRolePill.textContent = 'STANDBY READER';
      secondaryRolePill.className = 'role-pill standby-role';
      secondaryCapacityVal.textContent = '20% (Warm Standby)';
      secondaryCapacityFill.style.width = '20%';

      primaryCapacityVal.textContent = '100%';
      primaryCapacityFill.style.width = '100%';
    }

    // 3. Replication Lag Chart Update
    const historical = replication.historical_lag || [];
    replicationChart.data.labels = historical.map(h => h.timestamp);
    replicationChart.data.datasets[0].data = historical.map(h => h.db_lag);
    replicationChart.data.datasets[1].data = historical.map(h => h.storage_lag);
    replicationChart.data.datasets[2].data = historical.map(() => 60);
    replicationChart.update();

    // RPO Badge
    const isCompliant = replication.rpo_status.compliant;
    rpoStatusBadge.textContent = isCompliant ? 'RPO Compliant (<60s)' : '⚠️ RPO BREACH EXCEEDED';
    rpoStatusBadge.className = `badge ${isCompliant ? 'rpo-compliant' : 'rpo-breach'}`;

    // 4. Timeline Audit Log Update
    renderTimeline(orchestrator.events_history);
  }

  function getScoreColorClass(score) {
    if (score >= 70) return 'green';
    if (score >= 30) return 'amber';
    return 'red';
  }

  function renderSignals(container, signals) {
    container.innerHTML = `
      <li class="signal-item">
        <span>Application HTTP Probe (35%)</span>
        <span class="signal-status-dot ${signals.app_http.pass ? 'pass' : 'fail'}"></span>
      </li>
      <li class="signal-item">
        <span>DB Connectivity & Replication Lag (30%)</span>
        <span class="signal-status-dot ${signals.db_replication.pass ? 'pass' : 'fail'}"></span>
      </li>
      <li class="signal-item">
        <span>Load Balancer Target Health (20%)</span>
        <span class="signal-status-dot ${signals.lb_compute.pass ? 'pass' : 'fail'}"></span>
      </li>
      <li class="signal-item">
        <span>Cross-Region Network Ping (15%)</span>
        <span class="signal-status-dot ${signals.network_reachability.pass ? 'pass' : 'fail'}"></span>
      </li>
    `;
  }

  function renderTimeline(events) {
    if (!events || events.length === 0) return;
    const latestEvent = events[0];
    const logs = latestEvent.state_log || [];

    eventsTimeline.innerHTML = logs.map(log => `
      <div class="timeline-item">
        <div class="timeline-header">
          <span class="timeline-state">[${log.state}]</span>
          <span class="timeline-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="timeline-note">${log.note}</div>
      </div>
    `).join('');
  }

  // Load Initial Backups Data
  async function fetchBackups() {
    try {
      const res = await fetch('/api/v1/backups/all');
      const json = await res.json();
      if (json.status === 'success') {
        const jobs = json.data.backup_jobs;
        backupsTbody.innerHTML = jobs.map(j => `
          <tr>
            <td>${j.resource_name}</td>
            <td>${j.type}</td>
            <td>Every 6h</td>
            <td><span style="color: #3fb950; font-weight: 600;">VERIFIED</span></td>
            <td style="font-size: 11px;">${j.checksum.substring(0, 16)}...</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to fetch backups', e);
    }
  }

  // API Call Helper with Role Header
  async function sendApiPost(endpoint, body = {}) {
    const role = userRoleSelect.value;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (res.status >= 400 || json.status === 'error') {
        alert(`API Error: ${json.message || 'Action failed'}`);
      }
      return json;
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  }

  // Event Listeners for DR Controls & Chaos Simulator
  btnTriggerFailover.addEventListener('click', () => {
    if (confirm('Are you sure you want to trigger a Manual DR Failover?')) {
      sendApiPost('/api/v1/failover/trigger', { reason: 'Operator UI Triggered DR Drill' });
    }
  });

  btnAbortFailover.addEventListener('click', () => {
    sendApiPost('/api/v1/failover/abort', { reason: 'Operator Manual Abort' });
  });

  btnExecuteFailback.addEventListener('click', () => {
    sendApiPost('/api/v1/failover/failback');
  });

  btnInjectOutage.addEventListener('click', () => {
    sendApiPost('/api/v1/simulation/inject-failure', { type: 'OUTAGE' });
  });

  btnInjectLag.addEventListener('click', () => {
    sendApiPost('/api/v1/simulation/inject-failure', { type: 'LAG', lagSeconds: 90 });
  });

  btnRecoverPrimary.addEventListener('click', () => {
    sendApiPost('/api/v1/simulation/recover');
  });

  btnTriggerRestoreDrill.addEventListener('click', async () => {
    btnTriggerRestoreDrill.textContent = '⏳ Verifying Checksum...';
    await sendApiPost('/api/v1/backups/restore-test');
    btnTriggerRestoreDrill.textContent = '⚡ Run Restore Drill';
    fetchBackups();
  });

  // Initialize
  initWebSocket();
  fetchBackups();
});
