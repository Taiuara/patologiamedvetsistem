import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { authorizedUserId, firebaseConfig } from "./firebase-config.js";

const navigation = [
  { label: "Casos Clínicos", icon: "▤", kind: "cases" },
  { label: "Arquivo de Imagens", icon: "▧", kind: "image", category: "Arquivo de Imagens" },
  { label: "Parâmetros", icon: "⌁", kind: "parameters" },
  { label: "Citopalogia", icon: "◉", kind: "image", category: "Citopalogia" },
  { label: "Pele", icon: "◌", kind: "image", category: "Pele" },
  { label: "Ouvido", icon: "◉", kind: "image", category: "Ouvido" },
  { label: "Lesões", icon: "✳", kind: "image", category: "Lesões" },
  { label: "Urianálise", icon: "♧", kind: "form", category: "Urianálise" },
  { label: "Coproparasitológico", icon: "◉", kind: "form", category: "Coproparasitológico" },
  { label: "Fungos", icon: "◌", kind: "image", category: "Fungos" },
  { label: "Bactérias", icon: "⌬", kind: "form", category: "Bactérias" },
  { label: "Efusões", icon: "◍", kind: "form", category: "Efusões" },
  { label: "Medicamentos", icon: "▱", kind: "form", category: "Medicamentos" },
  { label: "Fluidoterapia", icon: "♧", kind: "form", category: "Fluidoterapia" },
];

const parameterGroups = {
  "Bioquímicos": [
    "Lactato", "Bilirrubina indireta", "Bilirrubina direta", "Bilirrubina total", "Cloretos",
    "Potássio", "Sódio", "Fósforo", "Cálcio ionizado", "Cálcio", "Globulina", "Albumina",
    "Proteína total", "Triglicerídeos", "Colesterol total", "Fosfatase alcalina", "Gama GT",
    "A.S.T", "A.L.T", "Creatinina", "Ureia",
  ],
  "Hematológicos": ["Hemácias", "Hematócrito", "Hemoglobina", "VCM", "HCM", "CHCM"],
  "Leucograma": [
    "Leucócitos", "Metamielócitos", "Bastonetes", "Segmentados", "Eosinófilos",
    "Linfócitos", "Basófilos", "Monócitos",
  ],
  "Trombograma": ["Plaquetas"],
};

const formFields = {
  "Urianálise": [
    "Método de coleta", "Volume", "Cor", "Odor", "Aspecto", "Densidade", "pH", "Proteína",
    "Glicose", "Corpos cetônicos", "Urobilinogênio", "Bilirrubina", "Sangue oculto",
    "Células eritrocitárias", "Células leucocitárias", "Células", "Cristais", "Bactérias", "Cilindros",
  ],
  "Coproparasitológico": [
    "Descrição macroscópica", "Consistência", "Coloração", "Tripsina fecal", "Fibras musculares",
    "Gordura", "Amido", "Helmintos", "Protozoários", "OPG", "Métodos",
  ],
  "Bactérias": ["Gram negativas", "Gram positivas"],
  "Efusões": [
    "Material utilizado", "Cor", "Volume", "Odor", "Aspecto", "Densidade", "Coagulação",
    "Células nucleadas totais", "pH", "Glicose", "Sangue", "Citologia",
  ],
  "Medicamentos": [
    "Nome do medicamento", "Posologia", "Indicação", "Contra indicação", "Efeito colateral", "Substituto",
  ],
  "Fluidoterapia": ["Soros", "Tempo", "Indicação"],
};

const categoryTitles = {
  cases: "Casos Clínicos",
  parameters: "Parâmetros",
};

let app;
let auth;
let database;
let storage;
let currentUser = null;
let activeSection = "cases";
let activeParameterGroup = "Bioquímicos";
let activeParameterIdentity = null;
let imageListRequestId = 0;

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const pageContent = document.querySelector("#page-content");
const toast = document.querySelector("#toast");

function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

if (isConfigured()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  database = getFirestore(app);
  storage = getStorage(app);
  onAuthStateChanged(auth, (user) => {
    if (user && user.uid !== authorizedUserId) {
      signOut(auth)
        .then(() => {
          document.querySelector("#login-error").textContent =
            "Esta conta não está autorizada a acessar o sistema.";
        })
        .catch((error) => showError(error, "Não foi possível encerrar a sessão não autorizada."));
      return;
    }
    currentUser = user;
    if (user) {
      showWorkspace(user);
    } else {
      showLogin();
    }
  });
} else {
  document.querySelector("#login-error").textContent =
    "Configure firebase-config.js e habilite E-mail/senha no Firebase Authentication para acessar.";
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
  document.querySelector("#login-error").textContent = "";
}

function showWorkspace(user) {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  document.querySelector("#user-email").textContent = user.email || "Conta veterinária";
  renderNavigation();
  renderSection(activeSection);
}

function renderNavigation() {
  const nav = document.querySelector("#main-nav");
  nav.innerHTML = navigation.map((item) => {
    const active = activeSection === item.kind && (
      item.kind === "cases" || item.kind === "parameters" || activeSection === item.category
    );
    const selected = active || activeSection === item.category;
    return `<button class="nav-item${selected ? " active" : ""}" type="button" data-section="${escapeHtml(item.kind === "image" || item.kind === "form" ? item.category : item.kind)}"><span class="nav-icon">${item.icon}</span><span>${escapeHtml(item.label)}</span>${selected ? '<span class="nav-active-mark"></span>' : ""}</button>`;
  }).join("");
  nav.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSection = button.dataset.section;
      activeParameterGroup = "Bioquímicos";
      renderNavigation();
      renderSection(activeSection);
      document.querySelector("#breadcrumb-current").textContent = getSectionTitle(activeSection);
      document.querySelector("#sidebar").classList.remove("sidebar-open");
    });
  });
}

function getSectionTitle(section) {
  return categoryTitles[section] || section;
}

function renderSection(section) {
  if (section !== "parameters") activeParameterIdentity = null;
  if (section === "cases") renderCases();
  else if (section === "parameters") renderParameters();
  else if (formFields[section]) renderManualForm(section, formFields[section]);
  else renderImageForm(section);
}

function sectionHeader(title, description, tag = "REGISTRO CLÍNICO") {
  return `<div class="page-heading"><div><span class="eyebrow">${escapeHtml(tag)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-stamp"><span>✳</span> PATOLOGIA<br />VETERINÁRIA</div></div>`;
}

function recordsSection(eyebrow, title) {
  return `<section class="records-section"><div class="section-title-row"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2></div></div><div id="recent-records" class="recent-records"><div class="loading-line">Carregando registros…</div></div></section>`;
}

function patientFields(step = "01") {
  return `
    <div class="form-section-label"><span>${escapeHtml(step)}</span> IDENTIFICAÇÃO DO PACIENTE</div>
    <div class="field-grid patient-grid">
      ${field("Paciente / identificação", "patient", "text", "Nome do animal", true)}
      ${field("Espécie", "species", "text", "Ex.: Canina, felina", true)}
      ${field("Idade", "age", "text", "Ex.: 4 anos", true)}
      ${field("Raça", "breed", "text", "Ex.: SRD")}
    </div>`;
}

function field(label, name, type = "text", placeholder = "", required = false, wide = false) {
  const attrs = `name="${escapeHtml(name)}"${required ? " required" : ""} placeholder="${escapeHtml(placeholder)}"`;
  if (type === "textarea") {
    return `<div class="field${wide ? " field-wide" : ""}"><label>${escapeHtml(label)}${required ? " <span>*</span>" : ""}</label><textarea ${attrs} rows="3"></textarea></div>`;
  }
  return `<div class="field${wide ? " field-wide" : ""}"><label>${escapeHtml(label)}${required ? " <span>*</span>" : ""}</label><input type="${type}" ${attrs} /></div>`;
}

function renderCases() {
  pageContent.innerHTML = `
    ${sectionHeader("Casos Clínicos", "Registre a história e acompanhe cada caso com cuidado.")}
    <div class="content-card">
      <form id="record-form" data-record-kind="case">
        <div class="form-section-label"><span>01</span> IDENTIFICAÇÃO DO CASO</div>
        <div class="field-grid case-name-grid">
          ${field("Nome do Caso", "caseName", "text", "Ex.: Dermatite alérgica — Mel", true, true)}
        </div>
        ${patientFields("02")}
        <div class="form-section-label section-divider"><span>03</span> HISTÓRICO E AVALIAÇÃO CLÍNICA</div>
        <div class="field-grid">
          ${field("Sintomas clínicos", "symptoms", "textarea", "Descreva os sinais e sintomas observados...", true, true)}
          ${field("Detalhamento clínico", "clinicalDetails", "textarea", "Histórico, exame físico e outras observações...", false, true)}
          ${field("Tratamento", "treatment", "textarea", "Tratamento realizado ou recomendado...", false, true)}
          ${field("Diagnósticos diferenciais", "differentials", "textarea", "Informe as hipóteses diagnósticas...", false, true)}
        </div>
        <div class="form-actions"><span class="form-hint">* Campos obrigatórios</span><button class="button button-primary" type="submit">Salvar caso <span>→</span></button></div>
      </form>
    </div>
    <section class="records-section"><div class="section-title-row"><div><span class="eyebrow">ACOMPANHAMENTO</span><h2>Casos recentes</h2></div></div><div id="recent-records" class="recent-records"><div class="loading-line">Carregando registros…</div></div></section>`;
  bindSave("case");
  loadRecentCases();
}

function renderParameters() {
  const fields = parameterGroups[activeParameterGroup];
  pageContent.innerHTML = `
    ${sectionHeader("Parâmetros", "Valores laboratoriais organizados por paciente, espécie e idade.", "ACOMPANHAMENTO LABORATORIAL")}
    <div class="content-card">
      <form id="record-form" data-record-kind="parameter">
        <div class="form-section-label parameter-identity-heading"><span>01</span> IDENTIFICAÇÃO DO PAINEL — PREENCHA PRIMEIRO</div>
        <div class="field-grid patient-grid parameter-identity-grid">
          ${field("Espécie", "species", "text", "Ex.: Canina, felina", true)}
          ${field("Idade", "age", "text", "Ex.: 4 anos", true)}
        </div>
        <div class="form-section-label section-divider"><span>02</span> ${escapeHtml(activeParameterGroup.toLocaleUpperCase("pt-BR"))}</div>
        <div class="category-tabs" role="tablist">${Object.keys(parameterGroups).map((group) => `<button type="button" role="tab" aria-selected="${group === activeParameterGroup}" class="category-tab${group === activeParameterGroup ? " selected" : ""}" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join("")}</div>
        <div class="field-grid parameter-grid">${fields.map((name, index) => field(name, `value_${index}`, "text", "Valor / observação")).join("")}</div>
        <div class="field field-wide note-field"><label>Observações do painel</label><textarea name="notes" rows="2" placeholder="Unidades, achados ou observações..."></textarea></div>
        <div class="form-actions"><span class="form-hint">Preencha espécie e idade primeiro. Os valores e anotações ficam salvos por espécie, idade e categoria.</span><button class="button button-primary" type="submit">Salvar parâmetros <span>→</span></button></div>
      </form>
    </div>
    ${recordsSection("PARÂMETROS SALVOS", "Registros salvos")}`;
  const identity = activeParameterIdentity;
  if (identity) {
    pageContent.querySelector('[name="species"]').value = identity.species;
    pageContent.querySelector('[name="age"]').value = identity.age;
  }
  pageContent.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      activeParameterIdentity = readParameterIdentity(pageContent.querySelector("#record-form"));
      delete pageContent.querySelector("#record-form").dataset.savedRecordId;
      activeParameterGroup = button.dataset.group;
      renderParameters();
    });
  });
  bindSave("parameter");
  loadRecentParameters();
}

function renderManualForm(category, fields) {
  const usesPatient = requiresPatientIdentity(category);
  pageContent.innerHTML = `
    ${sectionHeader(category, usesPatient ? "Preencha e mantenha os dados do paciente salvos para futuras consultas." : "Cadastre e mantenha estas informações salvas para consultar e editar quando precisar.")}
    <div class="content-card">
      <form id="record-form" data-record-kind="manual" data-category="${escapeHtml(category)}">
        ${usesPatient ? patientFields() : ""}
        <div class="form-section-label${usesPatient ? " section-divider" : ""}"><span>${usesPatient ? "02" : "01"}</span> ${escapeHtml(category.toLocaleUpperCase("pt-BR"))}</div>
        <div class="field-grid manual-grid">${fields.map((name) => field(name, fieldKey(name), "text", "Preencher informação", ["Medicamentos", "Fluidoterapia"].includes(category) && name === fields[0])).join("")}
          ${field("Observações", "notes", "textarea", "Observações complementares...", false, true)}
        </div>
        <div class="form-actions"><span class="form-hint">O registro poderá ser atualizado a qualquer momento.</span><button class="button button-primary" type="submit">Salvar registro <span>→</span></button></div>
      </form>
    </div>
    ${recordsSection("REGISTROS SALVOS", `${category} cadastrados`)}`;
  bindSave("manual", category);
  loadRecentManualRecords(category);
}

function renderImageForm(category) {
  const identifyPatient = category !== "Fungos";
  pageContent.innerHTML = `
    ${sectionHeader(category, "Adicione imagens ao prontuário e registre uma descrição para cada achado.", "ARQUIVO VISUAL")}
    <div class="content-card">
      <form id="record-form" data-record-kind="image" data-category="${escapeHtml(category)}">
        ${identifyPatient ? patientFields() : ""}
        <div class="form-section-label${identifyPatient ? " section-divider" : ""}"><span>${identifyPatient ? "02" : "01"}</span> IMAGEM E DESCRIÇÃO</div>
        <div class="field-grid">
          <div class="field field-wide"><label>Imagem <span>*</span></label>
            <label class="upload-zone" for="image-file"><span class="upload-icon">↑</span><strong>Selecione uma imagem para enviar ou mantenha a atual ao editar</strong><small>JPG, PNG, GIF ou WEBP · até 10 MB</small><span id="file-name" class="file-name"></span><input id="image-file" name="image" type="file" accept="image/jpeg,image/png,image/gif,image/webp" required /></label>
          </div>
          ${field("Descrição", "description", "textarea", "Descreva a imagem, o material e os achados observados...", true, true)}
        </div>
        <div class="form-actions"><span class="form-hint">A imagem será armazenada com acesso restrito à sua conta.</span><button class="button button-primary" type="submit">Enviar imagem <span>→</span></button></div>
      </form>
    </div>
    <section class="records-section"><div class="section-title-row"><div><span class="eyebrow">PRONTUÁRIO VISUAL</span><h2>Imagens recentes</h2></div></div><div id="recent-records" class="recent-records"><div class="loading-line">Carregando imagens…</div></div></section>`;
  document.querySelector("#image-file").addEventListener("change", (event) => {
    document.querySelector("#file-name").textContent = event.target.files[0]?.name || "";
  });
  bindSave("image", category);
  loadRecentImages(category);
}

function fieldKey(label) {
  return `field_${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function normalizedKey(value) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function bindSave(kind, category = "") {
  const form = document.querySelector("#record-form");
  if (kind === "manual") loadManualRecord(category);
  if (kind === "parameter") loadParameterRecord();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    let saveStage = "validar os dados";
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Salvando…';
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      delete data.image;
      const patient = String(data.patient || "").trim();
      if (kind === "case" && !String(data.caseName || "").trim()) {
        throw new Error("Informe o nome do caso para organizá-lo.");
      }
      if ((kind === "case" || (kind === "manual" && requiresPatientIdentity(category))) && !patient) {
        throw new Error("Informe o nome ou a identificação do paciente.");
      }
      if (kind === "parameter" && (!String(data.species || "").trim() || !String(data.age || "").trim())) {
        throw new Error("Informe a espécie e a idade para salvar os parâmetros.");
      }
      const record = {
        ...data,
        patient,
        species: String(data.species || "").trim(),
        age: String(data.age || "").trim(),
        breed: String(data.breed || "").trim(),
        ownerId: currentUser.uid,
        updatedAt: serverTimestamp(),
      };

      if (kind === "image") {
        const file = form.querySelector('[name="image"]').files[0];
        if (!file && !form.dataset.savedRecordId) throw new Error("Selecione uma imagem antes de enviar.");
        if (file) {
          if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const imageRef = ref(storage, `users/${currentUser.uid}/images/${Date.now()}_${safeName}`);
          saveStage = "enviar o arquivo ao Firebase Storage";
          await uploadBytes(imageRef, file, { contentType: file.type });
          record.imagePath = imageRef.fullPath;
          record.imageName = file.name;
        } else {
          saveStage = "carregar o registro existente no Firestore";
          const existingImage = await getDoc(doc(database, "users", currentUser.uid, "records", form.dataset.savedRecordId));
          if (!existingImage.exists()) throw new Error("Imagem original não encontrada. Selecione o arquivo novamente.");
          record.imagePath = existingImage.data().imagePath;
          record.imageName = existingImage.data().imageName;
        }
        record.category = category;
        record.kind = "image";
        const records = collection(database, "users", currentUser.uid, "records");
        saveStage = "salvar os dados da imagem no Cloud Firestore";
        if (form.dataset.savedRecordId) await setDoc(doc(records, form.dataset.savedRecordId), record);
        else await addDoc(records, record);
      } else if (kind === "case") {
        record.kind = "case";
        const records = collection(database, "users", currentUser.uid, "records");
        if (form.dataset.savedRecordId) await setDoc(doc(records, form.dataset.savedRecordId), record);
        else await addDoc(records, record);
      } else {
        record.kind = kind;
        record.category = kind === "parameter" ? activeParameterGroup : category;
        const key = form.dataset.savedRecordId || (
          kind === "parameter"
            ? getParameterRecordId(activeParameterGroup, record.species, record.age)
            : getManualRecordId(category, record)
        );
        await setDoc(doc(database, "users", currentUser.uid, "records", key), record);
        form.dataset.savedRecordId = key;
      }

      notify(kind === "image" ? "Imagem enviada com sucesso." : "Registro salvo com sucesso.");
      if (kind === "image") {
        delete form.dataset.savedRecordId;
        form.reset();
        form.querySelector('[name="image"]').required = true;
        document.querySelector("#file-name").textContent = "";
        loadRecentImages(category);
      } else if (kind === "case") {
        delete form.dataset.savedRecordId;
        form.reset();
        loadRecentCases();
      } else if (kind === "parameter") {
        activeParameterIdentity = readParameterIdentity(form);
        await loadSavedRecord(form, "parameter", activeParameterGroup);
        loadRecentParameters();
      } else {
        if (requiresPatientIdentity(category)) {
          loadSavedRecord(form, kind, category, patient);
        } else {
          await loadSavedRecordById(form, form.dataset.savedRecordId);
        }
        loadRecentManualRecords(category);
      }
    } catch (error) {
      const permissionMessage = kind === "image"
        ? `Permissão negada ao ${saveStage}. Confira se as regras do serviço correspondente foram publicadas no projeto patovet-148a7 e se o UID autorizado é Cbpk1DE58LYHu2kAO9fnkn9ifAe2.`
        : undefined;
      showError(error, "Não foi possível salvar o registro.", permissionMessage);
    } finally {
      button.disabled = false;
      button.innerHTML = kind === "image" ? 'Enviar imagem <span>→</span>' : kind === "case" ? 'Salvar caso <span>→</span>' : kind === "parameter" ? 'Salvar parâmetros <span>→</span>' : 'Salvar registro <span>→</span>';
    }
  });
}

function getManualRecordId(category, record) {
  if (requiresPatientIdentity(category)) return `manual_${normalizedKey(category)}_${normalizedKey(record.patient)}`;
  if (category === "Bactérias") return "manual_bacterias";
  if (category === "Medicamentos") {
    return `manual_medicamentos_${normalizedKey(record[fieldKey("Nome do medicamento")] || "geral")}_${normalizedKey(record[fieldKey("Posologia")] || "geral")}`;
  }
  if (category === "Fluidoterapia") {
    return `manual_fluidoterapia_${normalizedKey(record[fieldKey("Soros")] || "geral")}_${normalizedKey(record[fieldKey("Tempo")] || "geral")}`;
  }
  return `manual_${normalizedKey(category)}`;
}

async function loadManualRecord(category) {
  const form = document.querySelector("#record-form");
  if (!requiresPatientIdentity(category)) return;
  form.elements.patient.addEventListener("change", () => {
    delete form.dataset.savedRecordId;
    clearPatientFields(form);
    loadSavedRecord(form, "manual", category, form.elements.patient.value);
  });
  const lastPatient = localStorage.getItem("patovet-last-patient");
  if (lastPatient) {
    form.elements.patient.value = lastPatient;
    await loadSavedRecord(form, "manual", category, lastPatient);
  }
}

function requiresPatientIdentity(category) {
  return Boolean(formFields[category]) && !["Bactérias", "Medicamentos", "Fluidoterapia"].includes(category);
}

async function loadParameterRecord() {
  const form = document.querySelector("#record-form");
  for (const name of ["species", "age"]) {
    form.elements[name].addEventListener("change", () => {
      delete form.dataset.savedRecordId;
      activeParameterIdentity = readParameterIdentity(form);
      clearParameterValues(form);
      loadSavedRecord(form, "parameter", activeParameterGroup);
    });
  }
  if (activeParameterIdentity) await loadSavedRecord(form, "parameter", activeParameterGroup);
}

function readParameterIdentity(form) {
  if (!form?.isConnected) return null;
  const species = String(form.elements.species.value || "").trim();
  const age = String(form.elements.age.value || "").trim();
  return species && age ? { species, age } : null;
}

function clearParameterValues(form) {
  for (const control of form.elements) {
    if (control.name.startsWith("value_") || control.name === "notes") control.value = "";
  }
}

function clearPatientFields(form) {
  for (const control of form.elements) {
    if (control.name && control.name !== "patient" && control.type !== "file") control.value = "";
  }
}

async function loadSavedRecord(form, kind, category, patient = "") {
  if (!currentUser || !form.isConnected) return;
  try {
    let key;
    if (kind === "parameter") {
      const identity = readParameterIdentity(form);
      if (!identity) return;
      key = getParameterRecordId(category, identity.species, identity.age);
    } else {
      const patientName = String(patient || "").trim();
      if (!patientName) return;
      localStorage.setItem("patovet-last-patient", patientName);
      key = getManualRecordId(category, { patient: patientName });
    }
    let snapshot = await getDoc(doc(database, "users", currentUser.uid, "records", key));
    if (!snapshot.exists() && kind === "parameter") {
      const legacyRecords = await getDocs(query(
        collection(database, "users", currentUser.uid, "records"),
        where("kind", "==", "parameter"),
      ));
      const identity = readParameterIdentity(form);
      if (!identity) return;
      const legacyRecord = legacyRecords.docs.find((item) => {
        const data = item.data();
        return data.category === category && data.species === identity.species && data.age === identity.age;
      });
      if (legacyRecord) snapshot = legacyRecord;
    }
    if (!snapshot.exists() || !form.isConnected) return;
    if (kind === "parameter") {
      const currentIdentity = readParameterIdentity(form);
      if (!currentIdentity || key !== `parameter_${normalizedKey(category)}_${normalizedKey(currentIdentity.species)}_${normalizedKey(currentIdentity.age)}`) return;
    } else if (form.elements.patient.value.trim() !== patient) {
      return;
    }
    const data = snapshot.data();
    form.dataset.savedRecordId = snapshot.id;
    for (const [name, value] of Object.entries(data)) {
      const input = form.elements.namedItem(name);
      if (input && typeof value === "string" && name !== "ownerId") input.value = value;
    }
  } catch (error) {
    showError(error, "Não foi possível carregar o registro salvo.");
  }
}

function getParameterRecordId(category, species, age) {
  return `parameter_${normalizedKey(category)}_${normalizedKey(species)}_${normalizedKey(age)}`;
}

async function loadSavedRecordById(form, recordId) {
  if (!recordId || !currentUser || !form.isConnected) return;
  try {
    const snapshot = await getDoc(doc(database, "users", currentUser.uid, "records", recordId));
    if (!snapshot.exists() || !form.isConnected) return;
    const data = snapshot.data();
    for (const [name, value] of Object.entries(data)) {
      const input = form.elements.namedItem(name);
      if (input && typeof value === "string") input.value = value;
    }
  } catch (error) {
    showError(error, "Não foi possível carregar o registro salvo.");
  }
}

async function loadRecentManualRecords(category) {
  try {
    const records = (await getAllRecords()).filter((item) => item.kind === "manual" && item.category === category);
    renderRecordList(records, {
      empty: "Os registros salvos aparecerão aqui.",
      title: (item) => getManualTitle(category, item),
      subtitle: (item) => getManualSubtitle(category, item),
    });
  } catch (error) {
    setRecordsError();
    showError(error, "Não foi possível carregar os registros salvos.");
  }
}

async function loadRecentCases() {
  try {
    const records = (await getAllRecords()).filter((item) => item.kind === "case");
    renderRecordList(records, {
      empty: "Seus casos clínicos salvos aparecerão aqui.",
      title: (item) => item.caseName || item.patient || "Caso clínico",
      subtitle: (item) => [item.patient, item.species, item.age, item.breed].filter(Boolean).join(" · ") || "Dados do paciente não informados",
    });
  } catch (error) {
    setRecordsError("Não foi possível carregar os casos. Verifique a conexão e as regras do Firestore.");
    showError(error, "Não foi possível carregar os casos clínicos.");
  }
}

async function loadRecentImages(category) {
  const target = document.querySelector("#recent-records");
  if (!target || !currentUser) return;
  const requestId = ++imageListRequestId;
  target.innerHTML = '<div class="loading-line">Carregando imagens salvas…</div>';
  let loadingStage = "buscar a lista de imagens no Firestore";
  try {
    const records = await withTimeout(
      getAllRecords(),
      "A consulta ao Firestore demorou demais. Verifique a conexão e as regras do Firestore e tente atualizar a lista.",
    );
    if (!isCurrentImageRequest(requestId, target, category)) return;
    const images = records.filter((item) => item.kind === "image" && item.category === category);
    loadingStage = "carregar os arquivos de imagem no Firebase Storage";
    const loadedImages = await Promise.all(images.map(async (item) => {
      try {
        if (!item.imagePath) throw new Error("O registro não contém o caminho do arquivo.");
        const imageUrl = await withTimeout(
          getDownloadURL(ref(storage, item.imagePath)),
          `Não foi possível obter o endereço da imagem "${item.imageName || item.patient || "sem nome"}".`,
        );
        return { ...item, imageUrl };
      } catch (error) {
        showError(error, `Não foi possível carregar a imagem de ${item.patient || "um paciente"}.`);
        return { ...item, imageUrl: "" };
      }
    }));
    if (!isCurrentImageRequest(requestId, target, category)) return;
    target.innerHTML = loadedImages.length
      ? `<div class="image-record-grid">${loadedImages.map((item) => `<article class="image-record">${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.description || "Imagem clínica")}" loading="lazy" data-image-record />` : '<div class="image-placeholder">Imagem indisponível</div>'}<div><span class="eyebrow">${escapeHtml(item.patient || item.category || "Imagem")}${item.species ? ` · ${escapeHtml(item.species)}` : ""}</span><p>${escapeHtml(item.description || "")}</p>${recordActions(item)}</div></article>`).join("")}</div>`
      : '<div class="empty-state">As imagens enviadas para esta categoria aparecerão aqui.</div>';
    target.querySelectorAll("[data-image-record]").forEach((image) => {
      image.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "image-placeholder";
        placeholder.textContent = "Falha ao carregar imagem. Verifique a conexão e o acesso ao Storage.";
        image.replaceWith(placeholder);
      }, { once: true });
    });
    bindRecordActions(target);
  } catch (error) {
    if (!isCurrentImageRequest(requestId, target, category)) return;
    const message = error?.code === "permission-denied"
      ? `Acesso negado ao ${loadingStage}. Confira as regras do ${loadingStage.includes("Storage") ? "Storage" : "Firestore"} no projeto Firebase.`
      : error.message || "Não foi possível carregar as imagens.";
    setRecordsError(message, () => loadRecentImages(category));
    showError(error, "Não foi possível carregar as imagens.", message);
  }
}

function isCurrentImageRequest(requestId, target, category) {
  return requestId === imageListRequestId && target.isConnected && activeSection === category;
}

async function withTimeout(operation, message, milliseconds = 20000) {
  let timeoutId;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function loadRecentParameters() {
  const target = document.querySelector("#recent-records");
  if (!target || !currentUser) return;
  try {
    const records = (await getAllRecords()).filter(
      (item) => item.kind === "parameter" && item.category === activeParameterGroup,
    );
    renderRecordList(records, {
      empty: "Salve os valores do painel para que apareçam aqui.",
      title: (item) => `Espécie: ${item.species || "Não informada"} · Idade: ${item.age || "Não informada"}`,
      subtitle: () => activeParameterGroup,
    });
  } catch (error) {
    setRecordsError();
    showError(error, "Não foi possível carregar os parâmetros salvos.");
  }
}

async function getAllRecords() {
  if (!currentUser) return [];
  const recordsQuery = query(
    collection(database, "users", currentUser.uid, "records"),
    orderBy("updatedAt", "desc"),
  );
  const snapshot = await getDocs(recordsQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function getManualTitle(category, item) {
  if (category === "Medicamentos") return item[fieldKey("Nome do medicamento")] || "Medicamento";
  if (category === "Fluidoterapia") return item[fieldKey("Soros")] || "Fluidoterapia";
  if (requiresPatientIdentity(category)) return item.patient || "Paciente sem nome";
  return category;
}

function getManualSubtitle(category, item) {
  const detail = item[fieldKey("Indicação")] || item[fieldKey("Descrição macroscópica")] || item.notes;
  if (requiresPatientIdentity(category)) {
    return [item.species, item.age, item.breed, detail].filter(Boolean).join(" · ") || "Registro clínico";
  }
  return detail || "Registro salvo";
}

function recordActions(item) {
  return `<div class="record-actions"><button type="button" data-record-action="view" data-record-id="${escapeHtml(item.id)}">Visualizar</button><button type="button" data-record-action="edit" data-record-id="${escapeHtml(item.id)}">Editar</button><button type="button" class="record-delete" data-record-action="delete" data-record-id="${escapeHtml(item.id)}">Excluir</button></div>`;
}

function renderRecordList(records, options) {
  const target = document.querySelector("#recent-records");
  if (!target) return;
  target.innerHTML = records.length
    ? records.map((item) => `<article class="record-row"><span class="record-mark">✳</span><div class="saved-record-copy"><strong>${escapeHtml(options.title(item))}</strong><span>${escapeHtml(options.subtitle(item))}</span></div>${recordActions(item)}</article>`).join("")
    : `<div class="empty-state">${escapeHtml(options.empty)}</div>`;
  bindRecordActions(target);
}

function setRecordsError(message = "Não foi possível carregar os registros salvos.", onRetry) {
  const target = document.querySelector("#recent-records");
  if (!target) return;
  target.innerHTML = `<div class="empty-state">${escapeHtml(message)}${onRetry ? '<br /><button type="button" class="retry-button">Tentar novamente</button>' : ""}</div>`;
  if (onRetry) target.querySelector(".retry-button").addEventListener("click", onRetry);
}

function bindRecordActions(target) {
  target.querySelectorAll("[data-record-action]").forEach((button) => {
    button.addEventListener("click", () => handleRecordAction(button.dataset.recordAction, button.dataset.recordId));
  });
}

async function handleRecordAction(action, recordId) {
  if (action === "delete") {
    if (!window.confirm("Excluir este registro permanentemente? Esta ação não pode ser desfeita.")) return;
    try {
      const recordRef = doc(database, "users", currentUser.uid, "records", recordId);
      const snapshot = await getDoc(recordRef);
      if (!snapshot.exists()) throw new Error("O registro não foi encontrado.");
      const record = snapshot.data();
      if (record.imagePath) {
        try {
          await deleteObject(ref(storage, record.imagePath));
        } catch (error) {
          if (error.code !== "storage/object-not-found") throw error;
        }
      }
      await deleteDoc(recordRef);
      notify("Registro excluído.");
      refreshCurrentRecordList();
    } catch (error) {
      showError(error, "Não foi possível excluir o registro.");
    }
    return;
  }
  try {
    const snapshot = await getDoc(doc(database, "users", currentUser.uid, "records", recordId));
    if (!snapshot.exists()) throw new Error("O registro não foi encontrado.");
    const record = { id: snapshot.id, ...snapshot.data() };
    if (action === "view") await showRecordDetails(record);
    else await editRecord(record);
  } catch (error) {
    showError(error, "Não foi possível abrir o registro.");
  }
}

async function editRecord(record) {
  if (record.kind === "parameter") {
    activeSection = "parameters";
    activeParameterGroup = record.category;
    activeParameterIdentity = { species: record.species || "", age: record.age || "" };
  } else {
    activeSection = record.kind === "case" ? "cases" : record.category;
  }
  renderNavigation();
  renderSection(activeSection);
  document.querySelector("#breadcrumb-current").textContent = getSectionTitle(activeSection);
  const form = document.querySelector("#record-form");
  form.reset();
  form.dataset.savedRecordId = record.id;
  await loadSavedRecordById(form, record.id);
  const imageInput = form.querySelector('[name="image"]');
  if (imageInput) imageInput.required = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function showRecordDetails(record) {
  let imageUrl = "";
  if (record.imagePath) {
    imageUrl = await getDownloadURL(ref(storage, record.imagePath));
  }
  let dialog = document.querySelector("#record-details-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "record-details-dialog";
    dialog.className = "record-dialog";
    document.body.append(dialog);
  }
  const excluded = new Set(["id", "ownerId", "updatedAt", "imagePath", "imageName", "kind"]);
  const details = Object.entries(record)
    .filter(([key, value]) => !excluded.has(key) && typeof value === "string" && value.trim())
    .map(([key, value]) => `<div class="detail-item"><strong>${escapeHtml(labelForField(key, record))}</strong><p>${escapeHtml(value)}</p></div>`)
    .join("");
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">REGISTRO SALVO</span><h2>${escapeHtml(record.category || (record.kind === "case" ? "Caso clínico" : "Imagem clínica"))}</h2></div><button type="button" class="dialog-close" aria-label="Fechar">×</button></div>${imageUrl ? `<img class="dialog-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(record.description || "Imagem clínica")}" />` : ""}<div class="record-details-grid">${details || '<p class="empty-state">Sem detalhes preenchidos.</p>'}</div>`;
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.showModal();
}

function labelForField(key, record) {
  const known = {
    caseName: "Nome do Caso", patient: "Paciente / identificação", species: "Espécie", age: "Idade", breed: "Raça",
    symptoms: "Sintomas clínicos", clinicalDetails: "Detalhamento clínico",
    treatment: "Tratamento", differentials: "Diagnósticos diferenciais",
    description: "Descrição", notes: "Observações",
  };
  if (known[key]) return known[key];
  if (key.startsWith("value_") && parameterGroups[record.category]) {
    return parameterGroups[record.category][Number(key.slice(6))] || key;
  }
  const allFields = Object.values(formFields).flat();
  const fieldLabel = allFields.find((label) => fieldKey(label) === key);
  if (fieldLabel) return fieldLabel;
  return key.replace(/^field_/, "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function refreshCurrentRecordList() {
  if (activeSection === "cases") loadRecentCases();
  else if (activeSection === "parameters") loadRecentParameters();
  else if (formFields[activeSection]) loadRecentManualRecords(activeSection);
  else loadRecentImages(activeSection);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function showError(error, fallback, permissionMessage) {
  const detail = error?.code === "permission-denied"
    ? permissionMessage || "Acesso negado. Revise as regras do Firestore e do Storage."
    : error?.code === "unavailable"
      ? "Serviço indisponível. Verifique sua conexão e tente novamente."
      : error?.message && !error.message.includes("Firebase:")
        ? error.message
        : fallback;
  toast.textContent = detail;
  toast.classList.add("visible", "toast-error");
  window.setTimeout(() => toast.classList.remove("visible", "toast-error"), 5000);
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) {
    document.querySelector("#login-error").textContent =
      "Firebase não configurado. Preencha firebase-config.js antes de entrar.";
    return;
  }
  const button = event.currentTarget.querySelector("button");
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Acessando…";
  document.querySelector("#login-error").textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.querySelector("#login-email").value.trim(),
      document.querySelector("#login-password").value,
    );
  } catch (error) {
    const message = {
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um momento e tente novamente.",
      "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
    }[error.code] || "Não foi possível entrar. Verifique seus dados e tente novamente.";
    document.querySelector("#login-error").textContent = message;
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    showError(error, "Não foi possível encerrar a sessão.");
  }
});

document.querySelector("#mobile-menu").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("sidebar-open");
});
