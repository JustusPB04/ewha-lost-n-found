const searchInput = document.getElementById("searchInput");
const locationFilter = document.getElementById("locationFilter");
const categoryFilter = document.getElementById("categoryFilter");
const dateFilter = document.getElementById("dateFilter");
const sortSelect = document.getElementById("sortSelect");

const itemList = document.getElementById("itemList");
const resultCount = document.getElementById("resultCount");
const noResults = document.getElementById("noResults");

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load categories:", error);
    return;
  }


  data.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categoryFilter.appendChild(option);
  });
}
// Load items from Supabase database
async function loadItems() {
  const { data, error } = await supabaseClient
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load items:", error);
    noResults.textContent = "Failed to load items.";
    noResults.style.display = "block";
    return;
  }

  itemList.innerHTML = "";

  data.forEach((item) => {
    const card = document.createElement("a");
    card.className = "item-card";
    card.style.cursor = "pointer"; 
    card.dataset.name = item.name || "";
    card.dataset.category = item.category_id || "";
    card.dataset.location = item.found_location || "";
    card.dataset.date = item.created_at || "";

    card.addEventListener("click", () => {
      window.location.href = `itempage.html?id=${item.id}`;
    });

    const formattedDate = item.created_at
      ? new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "Unknown";

    const imageContent = item.image_url
      ? `<img src="${item.image_url}" alt="${item.name}">`
      : "📦";

    card.innerHTML = `
      <div class="image-placeholder">${imageContent}</div>
      <div class="item-info">
        <h3>${item.name}</h3>
        <p class="item-meta">Location: ${item.found_location}</p>
        <p class="item-meta">Date: ${formattedDate}</p>
      </div>
      <span class="arrow">›</span>
    `;

    itemList.appendChild(card);
  });

  filterItems();
}

// Search and Filter Items
function filterItems() {
  const keyword = searchInput.value.toLowerCase();
  const location = locationFilter.value;
  const category = categoryFilter.value;
  const dateOption = dateFilter.value;
  const today = new Date();

  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = card.dataset.name.toLowerCase();
    const cardLocation = card.dataset.location;
    const cardCategory = card.dataset.category;
    const cardDate = new Date(card.dataset.date);

    let matchesDate = true;

    if (dateOption === "today") {
      matchesDate = cardDate.toDateString() === today.toDateString();
    } else if (dateOption === "week") {
      const difference = (today - cardDate) / (1000 * 60 * 60 * 24);
      matchesDate = difference >= 0 && difference <= 7;
    } else if (dateOption === "month") {
      matchesDate =
        cardDate.getMonth() === today.getMonth() &&
        cardDate.getFullYear() === today.getFullYear();
    }

    const matchesKeyword = name.includes(keyword);
    const matchesLocation = !location || cardLocation === location;
    const matchesCategory = !category || cardCategory === category;

    const isVisible =
      matchesKeyword && matchesLocation && matchesCategory && matchesDate;

    card.style.display = isVisible ? "flex" : "none";
    if (isVisible) visibleCount++;
  });

  resultCount.textContent = visibleCount;
  noResults.style.display = visibleCount === 0 ? "block" : "none";
}

// Sort Items
function sortItems() {
  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  const sortType = sortSelect.value;

  cards.sort((a, b) => {
    if (sortType === "newest") {
      return new Date(b.dataset.date) - new Date(a.dataset.date);
    }
    if (sortType === "oldest") {
      return new Date(a.dataset.date) - new Date(b.dataset.date);
    }
    if (sortType === "name") {
      return a.dataset.name.localeCompare(b.dataset.name);
    }
    return 0;
  });

  cards.forEach((card) => itemList.appendChild(card));
  filterItems();
}

// Event Listeners
searchInput.addEventListener("input", filterItems);
locationFilter.addEventListener("change", filterItems);
categoryFilter.addEventListener("change", filterItems);
dateFilter.addEventListener("change", filterItems);
sortSelect.addEventListener("change", sortItems);

// Initialize page after authentication check
async function initializePage() {
  const user = await requireAuthentication();

  if (!user) {
    return;
  }
  await loadCategories();
  await loadItems();
}

initializePage();
