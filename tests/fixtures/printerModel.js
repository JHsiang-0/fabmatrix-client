export function printerModelFixture(id = '403', at = new Date().toISOString()) {
  const measured = value => ({ value, quality: 'GOOD', observedAt: at, source: 'DEVICE' })
  const unavailable = { value: null, quality: 'UNSUPPORTED', observedAt: null, source: 'NONE' }
  return {
    serverTime: at, stale: false,
    model: {
      modelVersion: 2,
      identity: { localPrinterId: String(id), sourceInstanceId: '00000000-0000-0000-0000-000000000001', deviceUid: '00000000-0000-0000-0000-000000000002' },
      descriptor: {
        revision: 1, name: '双喷头设备', machineNumber: 'A1', firmwareFamily: 'RRF', firmwareVersion: '3.7',
        connectionMode: 'RRF_STANDALONE', machineMode: 'FFF', emulated: false,
        primaryToolId: 'T0', primaryBedHeaterId: 'bed', locationLabel: null, configuredMaterial: 'PLA', configuredNozzleDiameterMm: 0.4,
        tools: [{ id: 'T0', name: '主工具', heaterIds: ['h0'], fanIds: ['f0'], extruderIds: ['e0'] }],
        heaters: [{ id: 'h0', name: '主喷头', role: 'TOOL', roleEvidence: 'PROBED' }, { id: 'h1', name: '副喷头', role: 'TOOL', roleEvidence: 'UNKNOWN' }],
        fans: [{ id: 'f0', name: '模型风扇', role: 'PART' }], axes: [{ id: 'X', name: 'X' }],
        sensors: [{ id: 's0', name: '断料检测', kind: 'FILAMENT', unit: 'BOOLEAN' }],
        capabilities: [{ code: 'HEATERS', support: 'SUPPORTED', evidence: 'PROBED', detectedAt: at }]
      },
      observation: {
        id: '00000000-0000-0000-0000-000000000003', deviceBootId: '00000000-0000-0000-0000-000000000004',
        revision: 1, descriptorRevision: 1, captureStartedAt: at, observedAt: at, completeness: 'PARTIAL',
        connection: { status: 'ONLINE', monitorEnabled: true, lastSuccessfulAt: at, consecutiveFailures: 0 },
        systemState: 'READY', operationState: 'PRINTING', currentToolId: 'T0',
        heaters: [{ id: 'h0', currentC: measured(0), effectiveTargetC: measured(210), activeTargetC: measured(210), standbyTargetC: measured(0), pwmRatio: measured(0), mode: 'ACTIVE' },
          { id: 'h1', currentC: measured(23.4), effectiveTargetC: unavailable, activeTargetC: unavailable, standbyTargetC: unavailable, pwmRatio: unavailable, mode: 'STANDBY' }],
        fans: [{ id: 'f0', pwmRatio: measured(0), rpm: unavailable }],
        motion: { coordinateSpace: 'GCODE', axes: [{ id: 'X', positionMm: measured(0), homed: measured(false) }], speedFactor: measured(1), flowFactor: unavailable },
        sensors: [{ id: 's0', enabled: measured(false), reading: measured(false) }],
        currentExecution: {
          id: '00000000-0000-0000-0000-000000000005', source: 'EXTERNAL', kind: 'PRINT', localFarmJobId: null,
          firstObservedAt: at, startedAt: at, file: { name: 'test-part.gcode', sizeBytes: 12345, sha256: null },
          progressPercent: measured(0), progressMethod: 'FILE_OFFSET', filePositionBytes: measured(0),
          timing: { printSeconds: measured(12), totalSeconds: measured(15), activeSeconds: measured(12), warmupSeconds: measured(3), pausedSeconds: measured(0), slicerEstimatedTotalSeconds: unavailable },
          layers: { current: measured(0), total: unavailable }, filamentLengthMm: measured(0),
          estimatedRemaining: { seconds: measured(120), method: 'FILE', confidence: null }
        },
        lastExecutionResult: { executionId: '00000000-0000-0000-0000-000000000006', outcome: 'CANCELLED', kind: 'PRINT', evidence: 'DEVICE_EXPLICIT', endedAt: at, observedAt: at, reasonCode: null }, issues: []
      }
    }
  }
}
