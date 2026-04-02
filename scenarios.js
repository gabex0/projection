// ── scenarios.js — Scenario Engine ──

let activeScenario = 'base';
window.scenarioResults = {};

// Scenario presets — overrides on top of base inputs
const SCENARIO_PRESETS = {
  base:         {},  // uses all current inputs as-is
  conservative: {
    taxRateOverride: -0.02,   // taxable return -2%
    retRateOverride: -0.02,   // retirement return -2%
    inflationOverride: +0.01, // inflation +1%
  },
  aggressive: {
    taxRateOverride: +0.02,
    retRateOverride: +0.02,
    inflationOverride: -0.005,
  },
  custom:       null, // uses custom inputs (shown in modal if needed)
};

function setScenario(name) {
  activeScenario = name;
  document.querySelectorAll('.scen-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scen === name);
  });
  runScenarios();
  if (typeof renderChart === 'function') renderChart();
}

function buildScenarioOverride(key) {
  const preset = SCENARIO_PRESETS[key];
  if (!preset || key === 'base') return {};

  const baseTaxRate = getVal('taxableReturn') / 100;
  const baseRetRate = getVal('retirementReturn') / 100;
  const baseInf     = getVal('inflationRate') / 100;

  return {
    taxRate:   baseTaxRate + (preset.taxRateOverride || 0),
    retRate:   baseRetRate + (preset.retRateOverride || 0),
    inflation: baseInf    + (preset.inflationOverride || 0),
  };
}

function runScenarios() {
  if (typeof projectScenario !== 'function') return;

  window.scenarioResults = {};

  // Always compute all non-base scenarios for stress test slide
  for (const key of ['conservative', 'aggressive']) {
    const overrides = buildScenarioOverride(key);
    window.scenarioResults[key] = projectScenario(overrides);
  }

  // Stress tests (used in stress test slide)
  window.stressResults = {
    base:     projectionData,
    lowReturn: projectScenario({ taxRate: Math.max(0, getVal('taxableReturn')/100 - 0.02), retRate: Math.max(0, getVal('retirementReturn')/100 - 0.02) }),
    highInflation: projectScenario({ inflation: getVal('inflationRate')/100 + 0.02 }),
    highSpend: projectScenario({ taxContrib: getVal('taxableContrib'), retContrib: getVal('retirementContrib') }), // spending +20% handled inside
  };

  // High spending stress: override spending by 1.2x — use a wrapper
  const baseSpend = getVal('initialSpending');
  window.stressResults.highSpend = projectScenario({ _spendMultiplier: 1.2 });
}

// Patch projectScenario to support _spendMultiplier
const _origComputeSpending = window._computeSpendingOrig || null;

// Override computeSpending for stress test via global flag
window._spendMultiplier = 1;
const _origProjectScenario = null;

// Simple approach: expose stress data for slideshow use
function getStressData(type) {
  return window.stressResults ? window.stressResults[type] : null;
}
