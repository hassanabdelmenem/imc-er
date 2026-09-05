const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
`  const actionSelect = $(\`action_\${cardId}\`);
  const isCustomHidden = actionSelect ? actionSelect.classList.contains('hidden') : false;
  const actionSelectVal = getVal(\`action_\${cardId}\`);
  const finalAction = (isCustomHidden || actionSelectVal === 'Custom...') ? (getVal(\`custom_action_\${cardId}\`) || 'Other') : actionSelectVal;

  const deptSelect = $(\`dept_sel_\${cardId}\`);
  const isCustomDeptHidden = deptSelect ? deptSelect.classList.contains('hidden') : false;`,
  ``
);

code = code.replace(
`export function triggerFlashAnimation(element) {
  if (!element) return;
  element.classList.remove('flash-update');
  void element.offsetWidth; // force reflow
  element.classList.add('flash-update');
  setTimeout(() => element.classList.remove('flash-update'), 1500);
}`,
`export function triggerFlashAnimation(element) {
  if (!element) return;
  // If the element is a radio button, flash its parent label or box instead
  const targetEl = (element.type === 'radio' && element.closest('label')) ? (element.closest('.alert-box') || element.closest('label')) : element;
  targetEl.classList.remove('flash-update');
  void targetEl.offsetWidth; // force reflow
  targetEl.classList.add('flash-update');
  setTimeout(() => targetEl.classList.remove('flash-update'), 1500);
}`
);

fs.writeFileSync('public/js/app.js', code);
