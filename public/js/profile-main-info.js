(() => {
  const initProfileMainInfo = () => {
    const mainInfoForm = document.getElementById("profileMainInfoForm");
    if (!mainInfoForm) return;

    const typeSelect = document.getElementById("profileMainInstitutionType");
    const ageRow = document.getElementById("profileMainAgeRow");
    const classRow = document.getElementById("profileMainClassRow");
    const syncMainTypeRows = () => {
      const code = (typeSelect?.value || "").trim();
      const isSchool = code === "school" || code === "school_internat";
      ageRow?.classList.toggle("hidden", isSchool);
      classRow?.classList.toggle("hidden", !isSchool);
    };
    typeSelect?.addEventListener("change", syncMainTypeRows);
    syncMainTypeRows();

    const mainMsg = document.getElementById("profileMainInfoMessage");
    const setMainMsg = (text, isError = false) => {
      if (!mainMsg) return;
      mainMsg.textContent = text || "";
      mainMsg.classList.toggle("hidden", !text);
      mainMsg.classList.toggle("error", Boolean(text) && isError);
      mainMsg.classList.toggle("success", Boolean(text) && !isError);
    };

    mainInfoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const districtEl = document.getElementById("profileMainDistrict");
      const code = (typeSelect?.value || "").trim();
      const isSchool = code === "school" || code === "school_internat";
      const payload = {
        district_id: districtEl?.value || null,
        preferred_institution_type: code || null,
        preferred_condition_codes: Array.from(
          mainInfoForm.querySelectorAll('input[name="main_condition"]:checked'),
        ).map((el) => el.value),
        preferred_accessibility_codes: Array.from(
          mainInfoForm.querySelectorAll('input[name="main_accessibility"]:checked'),
        ).map((el) => el.value),
        prefer_aoop: Boolean(document.getElementById("profileMainPreferAoop")?.checked),
      };
      if (isSchool) {
        payload.school_class_from = document.getElementById("profileMainClassFrom")?.value || null;
        payload.school_class_to = document.getElementById("profileMainClassTo")?.value || null;
      } else {
        payload.child_age_min = document.getElementById("profileMainAgeMin")?.value || null;
        payload.child_age_max = document.getElementById("profileMainAgeMax")?.value || null;
      }
      const saveBtn = document.getElementById("profileMainSaveBtn");
      if (saveBtn) saveBtn.disabled = true;
      setMainMsg("");
      try {
        const response = await fetch("/api/update_portal_main_info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          setMainMsg(data?.error || "Не удалось сохранить.", true);
          return;
        }
        setMainMsg("Основная информация сохранена.");
      } catch (e) {
        console.error(e);
        setMainMsg("Ошибка сети. Попробуйте ещё раз.", true);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });

    const matchList = document.getElementById("profileMainMatchList");
    const matchMsg = document.getElementById("profileMainMatchMessage");
    const setMatchMsg = (text, isError = false) => {
      if (!matchMsg) return;
      matchMsg.textContent = text || "";
      matchMsg.classList.toggle("hidden", !text);
      matchMsg.classList.toggle("error", Boolean(text) && isError);
      matchMsg.classList.toggle("success", Boolean(text) && !isError);
    };
    document.getElementById("profileMainMatchBtn")?.addEventListener("click", async () => {
      setMatchMsg("");
      if (matchList) matchList.innerHTML = "";
      try {
        const response = await fetch("/api/profile_match_institutions?page=1&page_size=50");
        const data = await response.json();
        if (!response.ok) {
          setMatchMsg(data?.error || "Не удалось загрузить список.", true);
          return;
        }
        const items = data.institutions || [];
        const total = data.pagination?.total_items ?? items.length;
        if (!items.length) {
          setMatchMsg("Подходящих учреждений не найдено.");
          return;
        }
        setMatchMsg(`Показано ${items.length} из ${total}.`);
        const formatRangeLine = (row) => {
          const min = row.range_min;
          const max = row.range_max;
          if (min == null && max == null) return "";
          const lo = min != null ? String(min) : "—";
          const hi = max != null ? String(max) : "—";
          const t = row.type;
          if (t === "preschool") return `Возраст (как на карте): ${lo} — ${hi}`;
          if (t === "school" || t === "school_internat") return `Классы / диапазон: ${lo} — ${hi}`;
          return `Диапазон: ${lo} — ${hi}`;
        };
        const appendDetailRow = (parent, label, text) => {
          if (!text) return;
          const row = document.createElement("div");
          row.className = "detail-item";
          const strong = document.createElement("strong");
          strong.textContent = `${label}:`;
          row.append(strong, document.createTextNode(` ${text}`));
          parent.appendChild(row);
        };
        const appendBullets = (parent, title, names) => {
          if (!names || !names.length) return;
          const wrap = document.createElement("div");
          wrap.className = "detail-item profile-main-match-detail-block";
          const strong = document.createElement("strong");
          strong.textContent = `${title}:`;
          const ul = document.createElement("ul");
          ul.className = "profile-main-match-detail-list";
          names.forEach((name) => {
            const li = document.createElement("li");
            li.textContent = name;
            ul.appendChild(li);
          });
          wrap.append(strong, ul);
          parent.appendChild(wrap);
        };
        items.forEach((inst) => {
          const districtPart = inst.district_name || "Район не указан";
          const typePart = inst.type_name_ru || inst.type || "Тип не указан";
          const namePart = inst.name || "Без названия";
          const summaryLine = `${districtPart} | ${typePart} | ${namePart}`;

          const card = document.createElement("article");
          card.className = "profile-main-match-card";

          const head = document.createElement("div");
          head.className = "profile-main-match-card-head";

          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "profile-main-match-toggle";
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Показать или скрыть подробности");
          toggle.textContent = "▶";

          const headMain = document.createElement("div");
          headMain.className = "profile-main-match-head-main";

          const lineTop = document.createElement("p");
          lineTop.className = "profile-main-match-line";
          lineTop.textContent = summaryLine;

          const lineSub = document.createElement("p");
          lineSub.className = "profile-main-match-subline";
          const relBits = [`Релевантность: ${inst.relevance ?? "—"}`];
          if (typeof inst.avg_institution_rating === "number") {
            relBits.push(`Средняя оценка: ${inst.avg_institution_rating.toFixed(2)}`);
          }
          lineSub.textContent = relBits.join(" · ");

          headMain.append(lineTop, lineSub);

          const headActions = document.createElement("div");
          headActions.className = "profile-main-match-card-actions";
          const mapLink = document.createElement("a");
          mapLink.className = "btn btn-secondary profile-main-match-maplink";
          const institutionQuery = encodeURIComponent(inst.name || "");
          mapLink.href = inst.district_id
            ? `/district/${inst.district_id}/?q=${institutionQuery}`
            : "/";
          mapLink.textContent = "На карту района";
          mapLink.target = "_blank";
          mapLink.rel = "noopener noreferrer";
          headActions.appendChild(mapLink);

          head.append(toggle, headMain, headActions);

          const detail = document.createElement("div");
          detail.className = "profile-main-match-detail hidden";
          detail.id = `profile-match-detail-${inst.id}`;
          detail.setAttribute("hidden", "");

          if (inst.description) {
            const desc = document.createElement("p");
            desc.className = "institution-description";
            desc.textContent = inst.description;
            detail.appendChild(desc);
          }

          const rangeText = formatRangeLine(inst);
          appendDetailRow(detail, "Возраст / классы / диапазон", rangeText);
          appendDetailRow(detail, "Адрес", inst.address || "");
          appendBullets(detail, "Условия обучения", inst.condition_names_ru);
          appendBullets(detail, "Формы поступления", inst.admission_names_ru);
          appendBullets(detail, "Критерии доступности", inst.accessibility_names_ru);

          if (inst.aoop_url) {
            const row = document.createElement("div");
            row.className = "detail-item";
            const strong = document.createElement("strong");
            strong.textContent = "АООП (ссылка):";
            const a = document.createElement("a");
            a.href = inst.aoop_url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = inst.aoop_url;
            row.append(strong, document.createTextNode(" "), a);
            detail.appendChild(row);
          }
          if (inst.aoop_programs && inst.aoop_programs.length) {
            const names = inst.aoop_programs.map((p) => p.name).filter(Boolean);
            appendBullets(detail, "Программы АООП", names);
          }

          const dir = inst.director || {};
          if (dir.name) {
            const contacts = document.createElement("div");
            contacts.className = "institution-contacts";
            const d1 = document.createElement("div");
            d1.className = "contact-item";
            d1.appendChild(document.createElement("strong")).textContent = "Руководитель:";
            d1.appendChild(document.createTextNode(` ${dir.name}`));
            contacts.appendChild(d1);
            if (dir.phone) {
              const d2 = document.createElement("div");
              d2.className = "contact-item";
              d2.appendChild(document.createElement("strong")).textContent = "Телефон:";
              d2.appendChild(document.createTextNode(` ${dir.phone}`));
              contacts.appendChild(d2);
            }
            if (dir.email) {
              const d3 = document.createElement("div");
              d3.className = "contact-item";
              d3.appendChild(document.createElement("strong")).textContent = "Email:";
              d3.appendChild(document.createTextNode(` ${dir.email}`));
              contacts.appendChild(d3);
            }
            detail.appendChild(contacts);
          }

          if (inst.website) {
            const row = document.createElement("div");
            row.className = "contact-item";
            const strong = document.createElement("strong");
            strong.textContent = "Сайт:";
            const a = document.createElement("a");
            a.href = inst.website;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = inst.website;
            row.append(strong, document.createTextNode(" "), a);
            detail.appendChild(row);
          }

          const reviews = inst.approved_reviews || [];
          if (reviews.length) {
            const sec = document.createElement("div");
            sec.className = "institution-reviews-section";
            const h5 = document.createElement("h5");
            h5.textContent = `Отзывы пользователей (${inst.approved_reviews_count ?? reviews.length})`;
            sec.appendChild(h5);
            const list = document.createElement("div");
            list.className = "institution-reviews-list";
            reviews.slice(0, 5).forEach((rev) => {
              const art = document.createElement("article");
              art.className = "institution-review-item";
              const headR = document.createElement("div");
              headR.className = "institution-review-head";
              const au = document.createElement("span");
              au.className = "institution-review-author";
              au.textContent = rev.author || "Пользователь";
              const dt = document.createElement("span");
              dt.className = "institution-review-date";
              dt.textContent = rev.created_at || "";
              headR.append(au, dt);
              const rating = document.createElement("div");
              rating.className = "institution-review-rating";
              rating.textContent = String(rev.rating ?? "");
              const com = document.createElement("p");
              com.className = "institution-review-comment";
              com.textContent = rev.comment || "Комментарий не указан.";
              art.append(headR, rating, com);
              list.appendChild(art);
            });
            sec.appendChild(list);
            detail.appendChild(sec);
          }

          toggle.addEventListener("click", () => {
            const open = detail.classList.contains("hidden");
            detail.classList.toggle("hidden", !open);
            toggle.textContent = open ? "▼" : "▶";
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            if (open) detail.removeAttribute("hidden");
            else detail.setAttribute("hidden", "");
          });

          card.append(head, detail);
          matchList?.appendChild(card);
        });
      } catch (e) {
        console.error(e);
        setMatchMsg("Ошибка сети.", true);
      }
    });
  };

  window.initProfileMainInfo = initProfileMainInfo;
})();
