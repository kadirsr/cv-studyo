"use strict";

const STORAGE_KEY = "cv-studyo-draft-v1";

const defaultSettings = {
  fontFamily: "Calibri, Arial, sans-serif",
  margin: 14,
  bodySize: 10.5,
  lineHeight: 1.19,
  sectionGap: 5.5,
  photoRadius: 0,
  accent: "#000000"
};

const emptyState = () => ({
  version: 1,
  meta: { fileName: "" },
  personal: {
    name: "",
    title: "",
    tagline: "",
    email: "",
    phone: "",
    linkedin: "",
    location: "",
    photo: ""
  },
  summary: "",
  experiences: [],
  education: [],
  skills: [],
  certificates: [],
  language: "",
  settings: { ...defaultSettings }
});

function exampleState() {
  const example = emptyState();
  return {
    ...example,
    meta: { fileName: "Ornek_CV_Ece_Aydin" },
    personal: {
      ...example.personal,
      name: "Ece Aydın",
      title: "İç Mimar",
      tagline: "Ticari Mekan Tasarımı | 3D Görselleştirme | Saha Takibi",
      email: "ece.aydin@example.com",
      phone: "+90 5XX XXX XX XX",
      linkedin: "linkedin.com/in/ornek-profil",
      location: "İzmir, Türkiye"
    },
    summary: "Mağaza ve ofis projelerinde yerleşim planı, malzeme seçimi ve uygulama çizimleri hazırlıyorum. Tasarım kararlarını 3D görsellerle sunuyor, sahada uygulama ekibiyle ölçü ve detay kontrollerini yürütüyorum.",
    experiences: [
      {
        role: "İç Mimar",
        company: "Kıyı Tasarım Stüdyosu",
        detail: "Ticari Mekan Projeleri",
        date: "Mart 2023 - Devam ediyor",
        bullets: [
          "Altı mağaza projesinde yerleşim planları, mobilya detayları ve aydınlatma çizimleri hazırladım.",
          "240 m² bir ofis projesinde alternatif planları ve malzeme seçeneklerini 3D görsellerle müşteriye sundum.",
          "Saha ziyaretlerinde imalat ölçülerini çizimlerle karşılaştırdım ve teslim öncesi düzeltmeleri uygulama ekibiyle takip ettim."
        ]
      },
      {
        role: "İç Mimarlık Proje Asistanı",
        company: "Ada Mekan Atölyesi",
        detail: "Konut ve Ofis Projeleri",
        date: "Ağustos 2021 - Şubat 2023",
        bullets: [
          "Rölöve ölçülerini AutoCAD’e aktardım ve mevcut durum planlarını hazırladım.",
          "Kaplama ve mobilya numunelerini fiyat, teslim süresi ve bakım ihtiyacına göre karşılaştırdım."
        ]
      }
    ],
    education: [
      { school: "Örnek Üniversitesi", program: "İç Mimarlık ve Çevre Tasarımı, Lisans", date: "2017 - 2021" }
    ],
    skills: [
      { name: "Çizim ve modelleme", value: "AutoCAD, SketchUp" },
      { name: "Görselleştirme", value: "Enscape, Adobe Photoshop" },
      { name: "Uygulama", value: "Rölöve, malzeme seçimi, uygulama çizimleri, saha takibi" }
    ],
    certificates: ["İç Mekan Aydınlatma Tasarımı", "SketchUp ve Enscape ile Görselleştirme"],
    language: "İngilizce: B2"
  };
}

let state = emptyState();
let toastTimer;
let saveTimer;

const page = document.getElementById("resumePage");
const toast = document.getElementById("toast");
const overflowBadge = document.getElementById("overflowBadge");
const saveStatus = document.getElementById("saveStatus");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(input) {
  const base = emptyState();
  if (!input || input.version !== 1) throw new Error("Geçersiz taslak sürümü");
  const strings = (value, keys) => Object.fromEntries(keys.map((key) => [
    key, typeof value?.[key] === "string" ? value[key] : ""
  ]));
  const list = (value) => Array.isArray(value) ? value : [];
  const textList = (value) => list(value).filter((item) => typeof item === "string");
  const settings = { ...defaultSettings };
  for (const control of document.querySelectorAll("[data-path^='settings.']")) {
    const key = control.dataset.path.split(".")[1];
    const value = input.settings?.[key];
    if (control.type === "range" && typeof value === "number" && Number.isFinite(value)) {
      settings[key] = Math.min(Number(control.max), Math.max(Number(control.min), value));
    } else if (control.type === "select-one" && [...control.options].some((option) => option.value === value)) {
      settings[key] = value;
    } else if (control.type === "color" && typeof value === "string" && /^#[\da-f]{6}$/i.test(value)) {
      settings[key] = value;
    }
  }
  return {
    ...base,
    ...strings(input, ["summary", "language"]),
    meta: strings(input.meta, ["fileName"]),
    personal: strings(input.personal, Object.keys(base.personal)),
    experiences: list(input.experiences).map((item) => ({
      ...strings(item, ["role", "company", "detail", "date"]),
      bullets: textList(item?.bullets)
    })),
    education: list(input.education).map((item) => strings(item, ["school", "program", "date"])),
    skills: list(input.skills).map((item) => strings(item, ["name", "value"])),
    certificates: textList(input.certificates),
    settings
  };
}

function getAtPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setAtPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], object);
  target[last] = value;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function scheduleSave() {
  saveStatus.dataset.status = "pending";
  saveStatus.textContent = "Kaydediliyor...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDraft("Taslak otomatik kaydedildi");
  }, 350);
}

function saveDraft(message) {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.dataset.status = "saved";
    saveStatus.textContent = message;
    return true;
  } catch (error) {
    saveStatus.dataset.status = "error";
    saveStatus.textContent = "Kayıt yapılamadı";
    return false;
  }
}

function bindStaticFields() {
  document.querySelectorAll("[data-path]").forEach((element) => {
    const path = element.dataset.path;
    const current = getAtPath(state, path);
    element.value = current ?? "";
    element.addEventListener("input", () => {
      let value = element.value;
      if (element.type === "range") value = Number(value);
      setAtPath(state, path, value);
      renderPreview();
      updateOutputs();
      scheduleSave();
    });
  });
}

function syncStaticFields() {
  document.querySelectorAll("[data-path]").forEach((element) => {
    element.value = getAtPath(state, element.dataset.path) ?? "";
  });
  updateOutputs();
}

function updateOutputs() {
  document.getElementById("marginOutput").textContent = `${state.settings.margin} mm`;
  document.getElementById("fontSizeOutput").textContent = `${state.settings.bodySize.toFixed(2)} pt`;
  document.getElementById("lineHeightOutput").textContent = state.settings.lineHeight.toFixed(2);
  document.getElementById("sectionGapOutput").textContent = `${state.settings.sectionGap} px`;
  document.getElementById("photoRadiusOutput").textContent = `${state.settings.photoRadius} px`;
}

function inputField(label, value, onInput, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = options.textarea ? document.createElement("textarea") : document.createElement("input");
  input.value = value || "";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.textarea) input.rows = options.rows || 2;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function cardHeader(title, onRemove, onUp, onDown) {
  const header = document.createElement("div");
  header.className = "editor-card-header";
  const name = document.createElement("span");
  name.className = "editor-card-title";
  name.textContent = title;
  const actions = document.createElement("div");
  actions.className = "card-actions";
  [
    ["↑", "Yukarı taşı", onUp],
    ["↓", "Aşağı taşı", onDown],
    ["Sil", "Kaydı sil", onRemove]
  ].forEach(([text, titleText, handler], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button${index === 2 ? " danger-button" : ""}`;
    button.textContent = text;
    button.title = titleText;
    button.setAttribute("aria-label", titleText);
    button.addEventListener("click", handler);
    actions.append(button);
  });
  header.append(name, actions);
  return header;
}

function moveItem(list, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
  renderEditors();
  commitChange();
}

function commitChange() {
  renderPreview();
  scheduleSave();
}

function renderExperienceEditor() {
  const container = document.getElementById("experienceEditor");
  container.replaceChildren();
  state.experiences.forEach((experience, index) => {
    experience.bullets = Array.isArray(experience.bullets) ? experience.bullets : [];
    const card = document.createElement("section");
    card.className = "editor-card";
    card.append(cardHeader(
      experience.role || `Deneyim ${index + 1}`,
      () => { state.experiences.splice(index, 1); renderEditors(); commitChange(); },
      () => moveItem(state.experiences, index, -1),
      () => moveItem(state.experiences, index, 1)
    ));

    const grid = document.createElement("div");
    grid.className = "form-grid two-columns";
    grid.append(
      inputField("Pozisyon", experience.role, (value) => {
        experience.role = value;
        card.querySelector(".editor-card-title").textContent = value || `Deneyim ${index + 1}`;
        commitChange();
      }),
      inputField("Tarih", experience.date, (value) => { experience.date = value; commitChange(); }),
      inputField("Şirket", experience.company, (value) => { experience.company = value; commitChange(); }),
      inputField("Şirket detayı", experience.detail, (value) => { experience.detail = value; commitChange(); })
    );
    card.append(grid);

    experience.bullets.forEach((bullet, bulletIndex) => {
      const row = document.createElement("div");
      row.className = "bullet-editor";
      const textarea = document.createElement("textarea");
      textarea.rows = 2;
      textarea.placeholder = "Görev, teknoloji veya ölçülebilir sonuç";
      textarea.setAttribute("aria-label", `Deneyim maddesi ${bulletIndex + 1}`);
      textarea.value = bullet;
      textarea.addEventListener("input", () => { experience.bullets[bulletIndex] = textarea.value; commitChange(); });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button danger-button";
      remove.textContent = "×";
      remove.title = "Maddeyi sil";
      remove.setAttribute("aria-label", `${bulletIndex + 1}. maddeyi sil`);
      remove.addEventListener("click", () => {
        experience.bullets.splice(bulletIndex, 1);
        renderExperienceEditor();
        commitChange();
      });
      row.append(textarea, remove);
      card.append(row);
    });

    const addBullet = document.createElement("button");
    addBullet.type = "button";
    addBullet.className = "mini-button top-gap";
    addBullet.textContent = "+ Madde ekle";
    addBullet.addEventListener("click", () => {
      experience.bullets.push("");
      renderExperienceEditor();
      container.children[index].querySelector(".bullet-editor:last-of-type textarea").focus();
      commitChange();
    });
    card.append(addBullet);
    container.append(card);
  });
}

function renderSimpleEditor(type, containerId, itemTitle, fields) {
  const list = state[type];
  const container = document.getElementById(containerId);
  container.replaceChildren();
  list.forEach((item, index) => {
    const card = document.createElement("section");
    card.className = "editor-card";
    card.append(cardHeader(
      item[fields[0].key] || `${itemTitle} ${index + 1}`,
      () => { list.splice(index, 1); renderEditors(); commitChange(); },
      () => moveItem(list, index, -1),
      () => moveItem(list, index, 1)
    ));
    const grid = document.createElement("div");
    grid.className = `form-grid ${fields.length > 1 ? "two-columns" : ""}`;
    fields.forEach((field) => {
      const control = inputField(field.label, item[field.key], (value) => {
        item[field.key] = value;
        if (field === fields[0]) {
          card.querySelector(".editor-card-title").textContent = value || `${itemTitle} ${index + 1}`;
        }
        commitChange();
      }, field);
      if (field.full) control.classList.add("full-width");
      grid.append(control);
    });
    card.append(grid);
    container.append(card);
  });
}

function renderCertificateEditor() {
  const container = document.getElementById("certificateEditor");
  container.replaceChildren();
  state.certificates.forEach((certificate, index) => {
    const row = document.createElement("div");
    row.className = "bullet-editor";
    const input = document.createElement("input");
    input.value = certificate;
    input.placeholder = "Eğitim veya sertifika adı";
    input.setAttribute("aria-label", `Eğitim veya sertifika ${index + 1}`);
    input.addEventListener("input", () => { state.certificates[index] = input.value; commitChange(); });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button danger-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${index + 1}. eğitimi veya sertifikayı sil`);
    remove.addEventListener("click", () => { state.certificates.splice(index, 1); renderCertificateEditor(); commitChange(); });
    row.append(input, remove);
    container.append(row);
  });
}

function renderEditors() {
  renderExperienceEditor();
  renderSimpleEditor("education", "educationEditor", "Eğitim", [
    { key: "school", label: "Okul" },
    { key: "date", label: "Tarih" },
    { key: "program", label: "Bölüm ve derece", full: true }
  ]);
  renderSimpleEditor("skills", "skillEditor", "Yetkinlik", [
    { key: "name", label: "Grup adı" },
    { key: "value", label: "Teknolojiler ve araçlar", textarea: true, rows: 2 }
  ]);
  renderCertificateEditor();
}

function placeholder(text) {
  return `<span class="placeholder">${escapeHtml(text)}</span>`;
}

function sectionHtml(title, content, emptyText) {
  const body = hasText(content) ? content : `<div class="empty-preview">${escapeHtml(emptyText)}</div>`;
  return `<section class="resume-section${content ? "" : " empty-section"}"><h2 class="resume-section-title">${escapeHtml(title)}</h2>${body}</section>`;
}

function renderHeader() {
  const p = state.personal;
  const photo = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(p.photo)
    ? `<img class="resume-photo" src="${escapeHtml(p.photo)}" alt="Profil fotoğrafı">`
    : `<div class="photo-placeholder">FOTOĞRAF</div>`;
  const contactOne = [p.email, p.phone].filter(hasText);
  const contactTwo = [p.linkedin, p.location].filter(hasText);
  const contactLine = (items) => items.length
    ? `<p class="contact-line">${items.map((item) => `<span class="contact-item">${escapeHtml(item)}</span>`).join("")}</p>`
    : "";

  return `
    <header class="resume-header">
      ${photo}
      <div class="resume-identity">
        <h1 class="resume-name">${hasText(p.name) ? escapeHtml(p.name) : placeholder("AD SOYAD")}</h1>
        <p class="resume-title${hasText(p.title) ? "" : " empty-line"}"><strong>${hasText(p.title) ? escapeHtml(p.title) : placeholder("Unvan")}</strong></p>
        <p class="resume-tagline${hasText(p.tagline) ? "" : " empty-line"}">${hasText(p.tagline) ? escapeHtml(p.tagline) : placeholder("Uzmanlık alanları")}</p>
        ${contactLine(contactOne)}
        ${contactLine(contactTwo)}
      </div>
    </header>`;
}

function renderExperiences() {
  const items = state.experiences.filter((item) =>
    [item.role, item.company, item.detail, item.date, ...(item.bullets || [])].some(hasText)
  );
  if (!items.length) return "";
  return items.map((item) => {
    const company = [
      hasText(item.company) ? `<strong>${escapeHtml(item.company)}</strong>` : "",
      hasText(item.detail) ? escapeHtml(item.detail) : ""
    ].filter(Boolean).join(" | ");
    const bullets = (item.bullets || []).filter(hasText);
    return `
      <article class="experience-entry">
        <div class="entry-topline">
          <p class="entry-role">${escapeHtml(item.role || "")}</p>
          <span class="entry-date">${escapeHtml(item.date || "")}</span>
        </div>
        ${company ? `<p class="entry-company">${company}</p>` : ""}
        ${bullets.length ? `<ul class="bullet-list">${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
      </article>`;
  }).join("");
}

function renderEducation() {
  const items = state.education.filter((item) => [item.school, item.program, item.date].some(hasText));
  if (!items.length) return "";
  return items.map((item) => {
    const main = [
      hasText(item.school) ? `<strong>${escapeHtml(item.school)}</strong>` : "",
      hasText(item.program) ? escapeHtml(item.program) : ""
    ].filter(Boolean).join(" | ");
    return `<div class="education-row"><p class="education-main">${main}</p><span class="education-date">${escapeHtml(item.date || "")}</span></div>`;
  }).join("");
}

function renderSkills() {
  const items = state.skills.filter((item) => [item.name, item.value].some(hasText));
  if (!items.length) return "";
  return items.map((item) => `<p class="skill-row"><strong>${escapeHtml(item.name || "")}${hasText(item.name) ? ":" : ""}</strong> ${escapeHtml(item.value || "")}</p>`).join("");
}

function renderTrainingAndLanguage() {
  const certificates = state.certificates.filter(hasText);
  const parts = [];
  if (certificates.length) {
    parts.push(`<p class="inline-list"><strong>${certificates.map(escapeHtml).join(" · ")}</strong></p>`);
  }
  if (hasText(state.language)) {
    const [label, ...rest] = state.language.split(":");
    parts.push(rest.length
      ? `<p class="inline-list"><strong>${escapeHtml(label)}:</strong>${escapeHtml(rest.join(":"))}</p>`
      : `<p class="inline-list">${escapeHtml(state.language)}</p>`
    );
  }
  return parts.join("");
}

function applyPageSettings() {
  const s = state.settings;
  page.style.setProperty("--page-margin", `${s.margin}mm`);
  page.style.setProperty("--body-size", `${s.bodySize}pt`);
  page.style.setProperty("--line-height", s.lineHeight);
  page.style.setProperty("--section-gap", `${s.sectionGap}px`);
  page.style.setProperty("--photo-radius", `${s.photoRadius}px`);
  page.style.setProperty("--resume-accent", s.accent);
  page.style.fontFamily = s.fontFamily;
}

function renderPreview() {
  applyPageSettings();
  document.getElementById("removePhotoButton").disabled = !state.personal.photo;
  page.innerHTML = [
    renderHeader(),
    sectionHtml("Hakkımda", hasText(state.summary) ? `<p class="summary-text">${escapeHtml(state.summary)}</p>` : "", "Profesyonel özet burada görünecek."),
    sectionHtml("Deneyim", renderExperiences(), "Deneyim kayıtları burada görünecek."),
    sectionHtml("Eğitim", renderEducation(), "Eğitim kayıtları burada görünecek."),
    sectionHtml("Teknik Yetkinlikler", renderSkills(), "Yetkinlik grupları burada görünecek."),
    sectionHtml("Eğitimler ve Yabancı Dil", renderTrainingAndLanguage(), "Eğitim, sertifika ve dil bilgisi burada görünecek.")
  ].join("");
  requestAnimationFrame(checkOverflow);
}

function checkOverflow() {
  if (!page.clientHeight) return overflowBadge.classList.contains("is-overflow");
  const style = getComputedStyle(page);
  const contentEnd = page.lastElementChild.offsetTop + page.lastElementChild.offsetHeight;
  const overflowing = contentEnd + parseFloat(style.paddingBottom) > page.clientHeight + 1;
  page.classList.toggle("is-overflow", overflowing);
  const status = overflowing ? "Sayfa taşıyor" : "Tek sayfaya sığıyor";
  if (overflowBadge.textContent !== status) {
    overflowBadge.className = `badge ${overflowing ? "is-overflow" : "is-ok"}`;
    overflowBadge.textContent = status;
  }
  return overflowing;
}

async function resizePhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const maxSide = 700;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .88);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFileName(state.meta.fileName || "CV")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function safeFileName(value) {
  return String(value || "CV")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "CV";
}

function loadState(nextState, message) {
  state = normalizeState(deepClone(nextState));
  syncStaticFields();
  renderEditors();
  renderPreview();
  scheduleSave();
  showToast(message);
}

async function fitToOnePage() {
  const minimumFont = 7.5;
  const minimumLineHeight = 1.12;
  const minimumMargin = 8;
  let attempts = 0;
  while (checkOverflow() && attempts < 80) {
    if (state.settings.bodySize > minimumFont) {
      state.settings.bodySize = Math.max(minimumFont, Number((state.settings.bodySize - .1).toFixed(2)));
    } else if (state.settings.lineHeight > minimumLineHeight) {
      state.settings.lineHeight = Math.max(minimumLineHeight, Number((state.settings.lineHeight - .01).toFixed(2)));
    } else if (state.settings.margin > minimumMargin) {
      state.settings.margin = Math.max(minimumMargin, Number((state.settings.margin - .5).toFixed(1)));
    } else {
      break;
    }
    applyPageSettings();
    await new Promise(requestAnimationFrame);
    attempts += 1;
  }
  syncStaticFields();
  renderPreview();
  scheduleSave();
  showToast(checkOverflow()
    ? "İçerik minimum ayarlarda da taşıyor. Birkaç maddeyi kısaltın."
    : "İçerik tek A4 sayfasına sığdırıldı."
  );
}

function attachWorkspaceEvents() {
  const editor = document.querySelector(".editor-panel");
  const sectionButtons = document.querySelectorAll(".section-nav button");
  for (const button of sectionButtons) {
    button.addEventListener("click", () => {
      for (const item of sectionButtons) {
        const active = item === button;
        if (active) item.setAttribute("aria-current", "true");
        else item.removeAttribute("aria-current");
        document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
      }
      editor.scrollTop = 0;
      document.getElementById(button.getAttribute("aria-controls")).querySelector("h2").focus({ preventScroll: true });
    });
  }

  const layout = document.querySelector(".app-layout");
  const mobileViews = document.querySelectorAll(".mobile-views button");
  const mobileLayout = matchMedia("(max-width: 930px)");
  for (const button of mobileViews) {
    button.addEventListener("click", () => {
      layout.dataset.mobileView = button.dataset.view;
      for (const item of mobileViews) item.setAttribute("aria-pressed", item === button);
      window.scrollTo(0, 0);
      updatePreviewScale();
    });
  }

  const stage = document.querySelector(".page-stage");
  const zoom = document.getElementById("zoomButton");
  function updatePreviewScale() {
    if (!stage.clientWidth) return;
    const style = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const heightScale = !mobileLayout.matches && height > 0 ? height / (297 * 96 / 25.4) : 1;
    const actualSize = zoom.getAttribute("aria-pressed") === "true";
    page.style.setProperty("--preview-scale", actualSize ? 1 : Math.min(1, width / (210 * 96 / 25.4), heightScale));
    checkOverflow();
  }
  zoom.addEventListener("click", () => {
    const actualSize = zoom.getAttribute("aria-pressed") !== "true";
    zoom.setAttribute("aria-pressed", actualSize);
    zoom.textContent = actualSize ? "Ekrana sığdır" : "Yakınlaştır";
    stage.scrollTo(0, 0);
    updatePreviewScale();
  });
  new ResizeObserver(updatePreviewScale).observe(stage);
  mobileLayout.addEventListener("change", updatePreviewScale);

  document.getElementById("printButton").addEventListener("click", () => {
    if (mobileLayout.matches && layout.dataset.mobileView === "editor") mobileViews[1].click();
    if (checkOverflow()) {
      showToast("PDF almadan önce “Tek sayfaya sığdır” seçeneğini kullanın veya içeriği kısaltın.");
      return;
    }
    const oldTitle = document.title;
    document.title = safeFileName(state.meta.fileName || state.personal.name || "CV");
    window.print();
    setTimeout(() => { document.title = oldTitle; }, 500);
  });

  const fileActions = document.getElementById("fileActions");
  fileActions.addEventListener("click", (event) => {
    if (event.target.closest("button")) fileActions.hidePopover();
  });
  document.getElementById("importJsonButton").addEventListener("click", () => {
    document.getElementById("importJsonInput").click();
  });
}

function attachEvents() {
  attachWorkspaceEvents();
  document.getElementById("addExperienceButton").addEventListener("click", () => {
    state.experiences.push({ role: "", company: "", detail: "", date: "", bullets: [""] });
    renderEditors();
    document.querySelector("#experienceEditor .editor-card:last-child input").focus();
    commitChange();
  });
  document.getElementById("addEducationButton").addEventListener("click", () => {
    state.education.push({ school: "", program: "", date: "" });
    renderEditors();
    document.querySelector("#educationEditor .editor-card:last-child input").focus();
    commitChange();
  });
  document.getElementById("addSkillButton").addEventListener("click", () => {
    state.skills.push({ name: "", value: "" });
    renderEditors();
    document.querySelector("#skillEditor .editor-card:last-child input").focus();
    commitChange();
  });
  document.getElementById("addCertificateButton").addEventListener("click", () => {
    state.certificates.push("");
    renderCertificateEditor();
    document.querySelector("#certificateEditor .bullet-editor:last-child input").focus();
    commitChange();
  });
  document.getElementById("photoInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.personal.photo = await resizePhoto(file);
      commitChange();
      showToast("Fotoğraf eklendi.");
    } catch (error) {
      console.error(error);
      showToast("Fotoğraf okunamadı.");
    }
    event.target.value = "";
  });
  document.getElementById("removePhotoButton").addEventListener("click", () => {
    state.personal.photo = "";
    commitChange();
  });
  document.getElementById("newButton").addEventListener("click", () => {
    if (confirm("Tüm alanlar temizlensin mi? Kayıtlı taslağınızın üzerine yazılır.")) {
      loadState(emptyState(), "Yeni boş CV oluşturuldu.");
    }
  });
  document.getElementById("exampleButton").addEventListener("click", () => {
    const hasDraft = JSON.stringify(state) !== JSON.stringify(emptyState());
    if (hasDraft && !confirm("Mevcut taslak örnek CV ile değiştirilsin mi?")) return;
    loadState(exampleState(), "Örnek CV yüklendi.");
  });
  document.getElementById("saveButton").addEventListener("click", () => {
    showToast(saveDraft("Taslak kaydedildi")
      ? "Taslak bu tarayıcıya kaydedildi."
      : "Tarayıcı kayda izin vermedi. “JSON indir” ile yedek alabilirsiniz.");
  });
  document.getElementById("exportJsonButton").addEventListener("click", downloadJson);
  document.getElementById("importJsonInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = normalizeState(JSON.parse(await file.text()));
      if (!confirm("Mevcut taslak JSON dosyasındaki içerikle değiştirilsin mi?")) return;
      loadState(imported, "JSON taslağı açıldı.");
    } catch (error) {
      console.error(error);
      showToast("Bu dosya geçerli bir CV taslağı değil.");
    }
    finally {
      event.target.value = "";
    }
  });
  document.getElementById("fitButton").addEventListener("click", fitToOnePage);
  document.getElementById("resetSettingsButton").addEventListener("click", () => {
    state.settings = { ...defaultSettings };
    syncStaticFields();
    commitChange();
    showToast("Sayfa ayarları sıfırlandı.");
  });
}

function initialize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? normalizeState(JSON.parse(saved)) : exampleState();
    saveStatus.dataset.status = saved ? "saved" : "ready";
    saveStatus.textContent = saved ? "Taslak yüklendi" : "Otomatik kayıt açık";
  } catch (error) {
    console.error(error);
    state = exampleState();
  }
  bindStaticFields();
  renderEditors();
  renderPreview();
  attachEvents();
  updateOutputs();
}

initialize();
