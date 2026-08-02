/**
 * =============================================================================
 * PROPRIETARY AND CONFIDENTIAL — SEVENSN SHARED UI COMPONENT LIBRARY
 * Copyright (c) 2026 SEVENSN. All Rights Reserved.
 * Universal UI Components for ER Tracker Pro, Hospital EMR, and IMC ER Console.
 * =============================================================================
 */

/**
 * 1. Triage Badges & Status Indicators
 */
export function createTriageBadge(triageLevel = 'ESI-4: Semi-Urgent') {
  const level = String(triageLevel || 'ESI-4: Semi-Urgent').trim();
  const lower = level.toLowerCase();
  let badgeClass = 'badge-stable';
  let icon = '🟢';
  let pulse = '';

  if (lower.includes('esi-1') || lower.includes('resuscitation') || lower.includes('critical') || lower.includes('red') || lower.includes('code')) {
    badgeClass = 'badge-critical';
    icon = '🚨';
    pulse = 'animation: criticalPulse 1.5s infinite cubic-bezier(0.66, 0, 0, 1) !important;';
  } else if (lower.includes('esi-2') || lower.includes('emergent') || lower.includes('orange')) {
    badgeClass = 'badge-urgent';
    icon = '🔥';
  } else if (lower.includes('esi-3') || lower.includes('urgent') || lower.includes('yellow')) {
    badgeClass = 'badge-urgent';
    icon = '⚡';
  } else if (lower.includes('esi-5') || lower.includes('discharged')) {
    badgeClass = 'badge-stable';
    icon = '🚪';
  }

  return `<span class="badge ${badgeClass}" style="padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; ${pulse}">${icon} ${level}</span>`;
}

export function createStatusBadge(statusText = 'Under assessment', options = {}) {
  const text = String(statusText || 'Under assessment').trim();
  const bg = options.bg || 'var(--warning-bg)';
  const color = options.color || 'var(--warning)';
  const customStyle = options.style || '';
  return `<span class="badge status-badge" style="background: ${bg}; color: ${color}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; ${customStyle}">${text}</span>`;
}

/**
 * 2. Skeleton Loaders
 */
export function createSkeletonLoader(type = 'card', count = 1) {
  let itemHtml = '';
  if (type === 'card') {
    itemHtml = `
      <div class="patient-card glass-panel skeleton-loader" style="padding:16px; margin-bottom:12px; border-radius:16px; border:1px solid var(--border); animation: pulse 1.5s infinite ease-in-out;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="width: 40%; height: 20px; background: var(--border); border-radius: 6px;"></div>
          <div style="width: 25%; height: 20px; background: var(--border); border-radius: 6px;"></div>
        </div>
        <div style="width: 75%; height: 14px; background: var(--border); border-radius: 4px; margin-bottom:8px;"></div>
        <div style="width: 50%; height: 14px; background: var(--border); border-radius: 4px;"></div>
      </div>
    `;
  } else if (type === 'table-row') {
    itemHtml = `
      <tr class="skeleton-loader" style="animation: pulse 1.5s infinite ease-in-out;">
        <td colspan="6" style="padding: 12px 18px;">
          <div style="height: 18px; background: var(--border); border-radius: 6px; width: 100%;"></div>
        </td>
      </tr>
    `;
  } else {
    itemHtml = `<div class="skeleton-loader" style="height: 20px; background: var(--border); border-radius: 6px; margin-bottom: 8px; animation: pulse 1.5s infinite ease-in-out;"></div>`;
  }

  return Array.from({ length: count }, () => itemHtml).join('');
}

/**
 * 3. Global Buttons & Inputs (with 44px Touch Targets)
 */
export function createActionButton(label, onClickAction = '', options = {}) {
  const type = options.type || 'button';
  const variant = options.variant === 'outline' ? 'btn-outline' : 'btn-primary';
  const extraClass = options.className || '';
  const style = options.style || '';
  const minHeight = '44px';
  const onClickAttr = onClickAction ? `onclick="${onClickAction}"` : '';

  return `<button type="${type}" class="btn ${variant} ${extraClass}" ${onClickAttr} style="min-height: ${minHeight}; padding: 8px 16px; font-weight: 600; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease-out; ${style}">${label}</button>`;
}

export function createMiniButton(label, onClickAction = '', options = {}) {
  const variant = options.variant === 'outline' ? 'btn-outline' : 'btn-primary';
  const extraClass = options.className || '';
  const style = options.style || '';
  const onClickAttr = onClickAction ? `onclick="${onClickAction}"` : '';

  return `<button type="button" class="btn btn-mini ${variant} ${extraClass}" ${onClickAttr} style="min-height: 32px; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease-out; ${style}">${label}</button>`;
}

/**
 * 4. Clinical Data Table / Flowsheet Wrappers
 */
export function createFlowsheetWrapper(headers = [], rowsHtml = '', options = {}) {
  const tableId = options.id ? `id="${options.id}"` : '';
  const customClass = options.className || '';
  const headersHtml = headers.map(h => `<th style="padding: 12px 16px; text-align: left; font-weight: 700; border-bottom: 2px solid var(--border); color: var(--text-main);">${h}</th>`).join('');

  return `
    <div class="flowsheet-wrapper ${customClass}" style="overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); background: var(--card-bg); box-shadow: var(--shadow-sm);">
      <table ${tableId} style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead style="background: var(--surface-elevated);">
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="100%" style="text-align:center; padding: 24px; color: var(--text-muted);">No clinical records available.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 5. Patient Cards & Bento Grid Shells
 */
export function createPatientCardShell(patient, headerContentHtml, detailsContentHtml = '', options = {}) {
  const cardId = options.id || `card_${patient.id || Math.random().toString(36).substr(2, 9)}`;
  const isExpanded = options.isExpanded || false;
  const cardClass = options.className || 'patient-card glass-panel';
  const cardStyle = options.style || 'padding: 16px; margin-bottom: 12px; transition: all 0.2s ease-out; border-radius: 16px;';
  const onClickAttr = options.onHeaderClick ? `onclick="${options.onHeaderClick}"` : '';

  return `
    <div id="${cardId}" class="${cardClass}" style="${cardStyle}" ${options.dataAttrs || ''}>
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; flex-wrap: wrap; gap: 12px;" ${onClickAttr}>
        ${headerContentHtml}
      </div>
      ${detailsContentHtml ? `<div id="details_${cardId}" class="card-details ${isExpanded ? '' : 'hidden'}" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;" onclick="event.stopPropagation()">${detailsContentHtml}</div>` : ''}
    </div>
  `;
}

// Universal Global Export for browsers and non-module scripts
if (typeof window !== 'undefined') {
  window.SharedUI = {
    createTriageBadge,
    createStatusBadge,
    createSkeletonLoader,
    createActionButton,
    createMiniButton,
    createFlowsheetWrapper,
    createPatientCardShell
  };
}
