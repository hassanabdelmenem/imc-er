const { JSDOM } = require("jsdom");

const html = `
<body>
  <div id="patient-list-container">
    <div id="details_123" class="card-details">
      <textarea id="diag_123" data-id="123" data-field="diagnosis"></textarea>
      <div id="sepsis_box_123">
        <input type="radio" name="sepsis_123" data-id="123" data-field="sepsisWorkup" value="Yes">
      </div>
    </div>
  </div>
</body>
`;

const dom = new JSDOM(html);
const document = dom.window.document;
const $ = (id) => document.getElementById(id);
const getVal = (id) => $(id) ? $(id).value.trim() : '';

let updatedData = null;
async function updatePatientRecord(id, data) {
  updatedData = data;
}

const visibleBoxValue = (boxId) => {
  const box = $(boxId);
  if (!box || box.classList.contains('hidden')) return undefined;
  const checkedRadio = box.querySelector(`input[type="radio"]:checked`);
  return checkedRadio ? checkedRadio.value : '';
};

function diffPatientFields(patient, candidates) {
  const updateData = {};
  for (const [field, value] of Object.entries(candidates)) {
    if (value === undefined) continue;
    const raw = patient[field];
    const stored = raw === undefined || raw === null ? '' : String(raw);
    if (value !== stored) updateData[field] = value;
  }
  return updateData;
}

const patientsList = [{ id: '123' }];

async function savePatientCardFields(cardId, targetElement = null) {
  const patient = patientsList.find(p => p.id === cardId) || {};
  const allCandidates = {
    diagnosis: getVal(`diag_${cardId}`),
    sepsisWorkup: visibleBoxValue(`sepsis_box_${cardId}`)
  };
  
  const targetField = targetElement ? targetElement.dataset.field : undefined;
  const candidates = (targetField && targetField in allCandidates)
    ? { [targetField]: allCandidates[targetField] }
    : allCandidates;

  const updateData = diffPatientFields(patient, candidates);
  if (Object.keys(updateData).length === 0) return;

  await updatePatientRecord(cardId, updateData);
}

document.querySelectorAll('.card-details input, .card-details select, .card-details textarea').forEach(el => {
  el.addEventListener('change', async (e) => {
    const id = e.target.dataset.id;
    await savePatientCardFields(id, e.target);
  });
});

// SIMULATE
const diag = document.getElementById("diag_123");
diag.value = "Test Sepsis";
diag.dispatchEvent(new dom.window.Event("change"));
console.log("Diag update:", updatedData);

updatedData = null;
const radio = document.querySelector("input[type='radio']");
radio.checked = true;
radio.dispatchEvent(new dom.window.Event("change"));
console.log("Radio update:", updatedData);

