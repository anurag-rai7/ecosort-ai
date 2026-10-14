
"use strict";

(() => {
  const WASTE_ITEMS = [
    {
      category: "plastic_bottle",
      icon: "🧴",
      title: "Plastic bottles",
      description:
        "Empty the bottle and check local rules for accepted plastic packaging.",
      disposal: "Usually recyclable where accepted",
      caution:
        "Appearance alone cannot confirm the exact plastic resin."
    },
    {
      category: "paper_cardboard",
      icon: "📦",
      title: "Paper and cardboard",
      description:
        "Keep paper and cardboard dry. Remove food-soiled sections where possible.",
      disposal: "Usually recyclable if clean and dry",
      caution:
        "Greasy or heavily contaminated paper may not be accepted."
    },
    {
      category: "glass",
      icon: "🥛",
      title: "Glass",
      description:
        "Separate glass according to local collection rules and handle breakage carefully.",
      disposal: "Check local glass collection rules",
      caution:
        "Mirrors, window glass and drinking glasses may need separate handling."
    },
    {
      category: "metal_can",
      icon: "🥫",
      title: "Metal cans",
      description:
        "Empty containers and follow local rules for metal packaging.",
      disposal: "Often recyclable where accepted",
      caution:
        "Never handle containers that may contain hazardous chemicals."
    },
    {
      category: "organic_waste",
      icon: "🍃",
      title: "Organic waste",
      description:
        "Separate food scraps for a suitable local composting or organic collection service.",
      disposal: "Compost where accepted",
      caution:
        "Not all composting services accept cooked food or every organic material."
    },
    {
      category: "electronic_waste",
      icon: "🔋",
      title: "Electronic waste",
      description:
        "Use an authorized collection point or manufacturer take-back service.",
      disposal: "Special collection required",
      caution:
        "Do not dismantle electronics or place batteries in ordinary recycling."
    },
    {
      category: "textile",
      icon: "👕",
      title: "Textiles and clothing",
      description:
        "Donate clean, wearable clothing or drop off worn fabrics at dedicated textile collection points.",
      disposal: "Donation or textile recycling",
      caution:
        "Do not place textiles in curbside recycling bins as they can tangle sorting machinery."
    },
    {
      category: "hazardous",
      icon: "⚠️",
      title: "Hazardous waste",
      description:
        "Chemicals, solvents, and paint must be delivered to a household hazardous waste facility.",
      disposal: "Special hazardous depot",
      caution:
        "Never pour chemicals down drains or place hazardous materials in curbside trash."
    },
    {
      category: "general_waste",
      icon: "🔎",
      title: "Uncertain or general waste",
      description:
        "Check the item label and local guidance before deciding how to discard it.",
      disposal: "Verify before disposal",
      caution:
        "Do not assume an unidentified item is recyclable based only on appearance."
    }
  ];

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function buildCard(item) {
    const card = createElement("article", "matrix-card");

    const icon = createElement("div", "matrix-icon", item.icon);
    icon.setAttribute("aria-hidden", "true");

    const title = createElement("h3", "", item.title);
    const description = createElement("p", "", item.description);
    const category = createElement(
      "span",
      "matrix-category",
      item.disposal
    );
    const caution = createElement(
      "p",
      "matrix-caution",
      item.caution
    );

    card.append(icon, title, description, category, caution);

    return card;
  }

  function renderMatrix(searchTerm = "") {
    const container = document.getElementById("waste-matrix");

    if (!container) {
      return;
    }

    const query = searchTerm.trim().toLocaleLowerCase();

    const filteredItems = WASTE_ITEMS.filter((item) => {
      const searchableText = [
        item.category,
        item.title,
        item.description,
        item.disposal,
        item.caution
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(query);
    });

    container.replaceChildren();

    if (filteredItems.length === 0) {
      container.appendChild(
        createElement(
          "p",
          "empty-guide",
          "No matching waste categories found. Try another search."
        )
      );
      return;
    }

    filteredItems.forEach((item) => {
      container.appendChild(buildCard(item));
    });
  }

  function initMatrix() {
    const searchInput = document.getElementById("matrix-search");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderMatrix(searchInput.value);
      });
    }

    renderMatrix();
  }

  window.EcoSortMatrix = Object.freeze({
    initMatrix,
    initialize: initMatrix,
    renderMatrix,
    getCategories: () => WASTE_ITEMS.map((item) => item.category)
  });
})();
