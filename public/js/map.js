// ============================================================
// map.js — Загрузка SVG-карты, интерактивность, анимация,
//           легенда, районы
// ============================================================

Object.assign(LipetskMap.prototype, {

    async loadMap() {
      try {
        const response = await fetch("/static/map.svg");
        const svgText = await response.text();
        const mapWrapper = document.getElementById("mapWrapper");
        mapWrapper.innerHTML = svgText;
        this.setupMapInteractivity();
      } catch (error) {
        console.error("Error loading map:", error);
        document.getElementById("mapWrapper").innerHTML = '<p class="text-center text-muted">Ошибка загрузки карты</p>';
      }
    },
  
    setupMapInteractivity() {
      const svg = document.querySelector("#mapWrapper svg");
      if (!svg) return;
  
      const regionEletskiy = svg.querySelector("#region_eletskiy");
      const eletsGroup = svg.querySelector("#elets");
      if (regionEletskiy && eletsGroup) {
        svg.appendChild(regionEletskiy); 
        svg.appendChild(eletsGroup); 
      }
  
      const groups = svg.querySelectorAll("g[id][data-region-name]");
      const originalOrder = Array.from(groups);
      const groupIndices = new Map();
      originalOrder.forEach((g, idx) => groupIndices.set(g.id, idx));
      const colors = [
        "#e57878", "#d88953", "#f7dc71", "#cfe672",
        "#8ee157", "#81ec81", "#60e094", "#84f2dc",
        "#7cc6d8", "#66a2fd", "#7171f8", "#b98cfb",
        "#b956d2", "#ea7cd4", "#f14d8f", "#FF6347",
        "#D2B48C", "#87CEEB", "#9932CC", "#FF69B4",
      ];
  
      let hideTimeout;
      groups.forEach((group, index) => {
        const regionId = group.id;
        const regionName =
          group.getAttribute("data-region-name") ||
          this.getDistrictName(regionId);
        const color = colors[index % colors.length];
        this.districtColors[regionName] = color;
        const polygons = group.querySelectorAll("polygon, path, circle, rect");
  
        polygons.forEach((polygon) => {
          if (!polygon.id) {
            polygon.id = `${regionId}-shape-${index}`;
          }
          polygon.classList.add("district");
          polygon.style.fill = color;
          polygon.setAttribute("tabindex", "0");
          polygon.setAttribute("role", "button");
  
          polygon.style.transformOrigin = "center";
          polygon.style.transformBox = "fill-box";
  
          if (!this.animationPlayed) {
            polygon.style.transform = "scale(0)";
            polygon.style.opacity = "0";
            polygon.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out";
          }
  
          this.districts[polygon.id] = {
            name: regionName,
            element: polygon,
            group: group,
          };
  
          const navigateToDistrict = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleDistrictClick(e, regionName);
          };

          // pointerdown надёжнее click для SVG в Chrome/Opera:
          // hover-transform и перестановка групп могут «терять» click.
          polygon.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            navigateToDistrict(e);
          });

          polygon.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
            if (hideTimeout) clearTimeout(hideTimeout);
            if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
            
            const currentGroup = group;
            const currentRegionName = regionName;
            
            requestAnimationFrame(() => {
              if (this.activeDistrict && this.activeDistrict !== currentGroup.id) {
                const oldActiveIndex = groupIndices.get(this.activeDistrict);
                if (oldActiveIndex !== undefined) {
                  const oldActiveGroup = svg.querySelector(`#${this.activeDistrict}`);
                  const targetSibling = svg.children[oldActiveIndex];
                  if (oldActiveGroup && targetSibling && oldActiveGroup !== targetSibling) {
                    svg.insertBefore(oldActiveGroup, targetSibling);
                  }
                }
              }
              
              if (currentGroup.id === "region_eletskiy") {
                const eletsGroup = svg.querySelector("#elets");
                if (eletsGroup) {
                  svg.appendChild(eletsGroup);
                  eletsGroup.classList.add('elets-highlight');
                }
              } else {
                if (currentGroup !== svg.lastElementChild) {
                  svg.appendChild(currentGroup);
                }
              }
              
              this.activeDistrict = currentGroup.id;
            });
            
            this.showTooltip(e, currentRegionName);
          });
          
          polygon.addEventListener("mouseleave", (e) => {
            e.stopPropagation();
            if (hideTimeout) clearTimeout(hideTimeout);
            
            this.hoverTimeout = setTimeout(() => {
              requestAnimationFrame(() => {
                originalOrder.forEach((originalGroup) => {
                  svg.appendChild(originalGroup);
                });
                
                const eletsGroup = svg.querySelector("#elets");
                if (eletsGroup) {
                  eletsGroup.classList.remove('elets-highlight');
                  eletsGroup.style.pointerEvents = '';
                }
                
                this.activeDistrict = null;
                this.hideTooltip();
              });
            }, 100);
          });
  
          polygon.addEventListener("mousemove", (e) => {
            e.stopPropagation();
            this.updateTooltipPosition(e);
          });
  
          polygon.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              this.handleDistrictClick(e, regionName);
            }
          });
        });
      });
  
      if (!this.animationPlayed) {
        setTimeout(() => {
          this.animateDistrictsAppearance();
          this.animationPlayed = true;
        }, 300);
      }
    },
  
    animateDistrictsAppearance() {
      const svg = document.querySelector("#mapWrapper svg");
      if (!svg) return;
  
      const districts = svg.querySelectorAll(".district");
      const centerX = svg.viewBox.baseVal.width / 2;
      const centerY = svg.viewBox.baseVal.height / 2;
  
      districts.forEach((district, index) => {
        const bbox = district.getBBox();
        const districtCenterX = bbox.x + bbox.width / 2;
        const districtCenterY = bbox.y + bbox.height / 2;
  
        const deltaX = districtCenterX - centerX;
        const deltaY = districtCenterY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
  
        const startOffset = Math.min(distance * 0.1, 50);
  
        district.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease-out';
        district.style.transform = `translate(${directionX * startOffset}px, ${directionY * startOffset}px) scale(0.8)`;
        district.style.opacity = "0";
  
        setTimeout(() => {
          district.style.transform = "translate(0, 0) scale(1)";
          district.style.opacity = "1";
  
          setTimeout(() => {
            district.style.transition = 'transform 0.3s ease-out, filter 0.3s ease-out, stroke-width 0.3s ease-out';
          }, 800);
        }, 100 + index * 40);
      });
    },
  
    populateLegend() {
      const legendList = document.getElementById("legendList");
      if (!legendList) return;
  
      const sortedDistricts = Object.values(this.districts).sort();
      legendList.innerHTML = sortedDistricts
        .map((name) => {
          const color = this.districtColors[name];
          return `
            <li class="legend-item" data-district-name="${name}">
              <div class="color-swatch" style="background-color: ${color};"></div>
              <span>${name}</span>
            </li>
          `;
        })
        .join("");
      document.querySelectorAll(".legend-item").forEach((item) => {
        item.addEventListener("click", () => {
          const name = item.dataset.districtName;
          this.currentDistrictName = name;
          this.openDistrictModal(name);
        });
      });
    },
  
    populateDistrictSelect() {
      const districtSelect = document.getElementById("districtId");
      const sortedDistricts = Object.values(this.districts).sort();
      districtSelect.innerHTML = `
          <option value="">Выберите округ</option>
          ${sortedDistricts
          .map(
            (name) =>
              `<option value="${this.districtIdMap[name]}">${name}</option>`
          )
          .join("")}
        `;
    },
  
    getDistrictName(districtId) {
      const name = Object.values(this.districts).find((name) =>
        name.includes(districtId)
      );
      return name || `Округ ${districtId}`;
    },
  
    handleDistrictClick(e, districtName) {
      this.currentDistrictName = districtName;
      this.openDistrictModal(districtName);
    },
  
    openDistrictModal(districtName) {
      const districtId = this.districtIdMap[districtName];
      if (!districtId) {
        const isCatalogEmpty = !this.districtIdMap || Object.keys(this.districtIdMap).length === 0;
        const message = isCatalogEmpty
          ? "Справочник районов не загружен. Заполните БД командой:\ndocker compose exec web python manage.py seed_reference_data\n\nЗатем обновите страницу."
          : `Район «${districtName}» не найден в справочнике. Обновите страницу или выполните seed_reference_data.`;
        console.warn("District id not found for:", districtName, this.districtIdMap);
        alert(message);
        return;
      }
      window.location.assign(`/district/${districtId}/`);
    },

    showDistrictView(districtName) {
      document.getElementById("districtModal").classList.remove("hidden");
      document.getElementById("regionName").textContent = districtName;
      const districtId = this.districtIdMap[districtName];
      this.loadRegionLinks(districtId);
      this.loadInstitutionsForDistrict(districtName);
      const searchInput = document.getElementById("institutionSearch");
      this.resetFiltersUI();
      if (searchInput) searchInput.value = "";
      this.loadDistrictSVG(districtName);
    },
  
    async loadDistrictSVG(districtName) {
      const svgModal = document.querySelector("#districtModal .region-image");
      if (!svgModal) return;
  
      try {
        let mainSvg = document.querySelector("#mapWrapper svg");
        if (!mainSvg) {
          const response = await fetch("/static/map.svg");
          const svgText = await response.text();
          const parser = new DOMParser();
          const parsed = parser.parseFromString(svgText, "image/svg+xml");
          mainSvg = parsed.querySelector("svg");
        }
        if (!mainSvg) return;
  
        let regionGroup = mainSvg.querySelector(
          `g[data-region-name="${districtName}"]`
        );
        if (!regionGroup && districtName === "Липецк (город)") {
          regionGroup = mainSvg.querySelector("#lipeck");
        }
        if (!regionGroup && districtName === "г. Елец") {
          regionGroup = mainSvg.querySelector("#elets");
        }
  
        if (regionGroup) {
          const clone = regionGroup.cloneNode(true);
          const polygon = clone.querySelector("polygon");
          clone.style.opacity = "1";
          clone.style.transform = "none";
          clone.style.transition = "none";
  
          if (polygon) {
            polygon.style.opacity = "1";
            polygon.style.transform = "none";
            polygon.style.transition = "none";
            const a = 1.4420655,
              b = 0,
              c = 0,
              d = 1.4420655,
              e = -45.179089,
              f = -121.84611;
            const pointsStr = polygon.getAttribute("points");
            const pointPairs = pointsStr.match(/[0-9.-]+,[0-9.-]+/g) || [];
  
            let txs = [],
              tys = [];
            pointPairs.forEach((pair) => {
              const [xStr, yStr] = pair.split(",");
              const x = parseFloat(xStr),
                y = parseFloat(yStr);
              const tx = a * x + c * y + e;
              const ty = b * x + d * y + f;
              txs.push(tx);
              tys.push(ty);
            });
  
            if (txs.length > 0) {
              const minX = Math.min(...txs);
              const maxX = Math.max(...txs);
              const minY = Math.min(...tys);
              const maxY = Math.max(...tys);
              const w = maxX - minX;
              const h = maxY - minY;
              const padding = 0.05;
              const offsetX = padding * w;
              const offsetY = padding * h;
              const paddedW = w + 2 * offsetX;
              const paddedH = h + 2 * offsetY;
  
              svgModal.setAttribute("viewBox", `0 0 ${paddedW} ${paddedH}`);
              svgModal.setAttribute("preserveAspectRatio", "xMidYMid meet");
  
              const newPoints = [];
              for (let i = 0; i < pointPairs.length; i++) {
                const nx = txs[i] - minX + offsetX;
                const ny = tys[i] - minY + offsetY;
                newPoints.push(`${nx.toFixed(2)},${ny.toFixed(2)}`);
              }
  
              polygon.setAttribute("points", newPoints.join(" "));
              clone.removeAttribute("transform");
              polygon.style.fill = this.districtColors[districtName];
              polygon.style.stroke = "black";
              polygon.style.strokeWidth = "2";
              polygon.style.opacity = "1";
              polygon.classList.add("region");
  
              svgModal.innerHTML = "";
              svgModal.appendChild(clone);
              return;
            }
          }
  
          svgModal.innerHTML = "";
          svgModal.appendChild(clone);
        } else {
          svgModal.innerHTML =
            '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#27ae60" font-size="16">SVG не найден</text>';
        }
      } catch (error) {
        console.error("Error loading district SVG:", error);
        svgModal.innerHTML =
          '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e74c3c" font-size="16">Ошибка загрузки</text>';
      }
    },
  
    showTooltip(e, districtName) {
      const tooltip = document.getElementById("tooltip");
      tooltip.textContent = districtName;
      tooltip.classList.remove("hidden");
    },
  
    hideTooltip() {
      document.getElementById("tooltip").classList.add("hidden");
    },
  
    updateTooltipPosition(e) {
      const tooltip = document.getElementById("tooltip");
      if (!tooltip) return;
      tooltip.style.left = (e.clientX + 20) + "px";
      tooltip.style.top = (e.clientY - 20) + "px";
    },
  
  });