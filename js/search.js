const searchInput = document.getElementById("searchInput");
const locationFilter = document.getElementById("locationFilter"); 
const categoryFilter = document.getElementById("categoryFilter"); // option value - category.id 
const dateFilter = document.getElementById("dateFilter");
const sortSelect = document.getElementById("sortSelect");

const itemList = document.getElementById("itemList");
const resultCount = document.getElementById("resultCount");
const noResults = document.getElementById("noResults");

let categoriesLoaded = false;

function showAuthRequiredState() {
  itemList.innerHTML = "";
  if (resultCount) resultCount.textContent = "0";
  if (noResults) {
    noResults.textContent = "Please log in first to view items.";
    noResults.style.display = "block";
  }
}

// load category list
async function loadCategories() {
  if (!categoryFilter || categoriesLoaded) return;

  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load categories:", error);
    return;
  }

  const existingValues = new Set(
    Array.from(categoryFilter.options).map((opt) => opt.value)
  );

  data.forEach((cat) => {
    if (!existingValues.has(cat.id)) {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      categoryFilter.appendChild(option);
    }
  });

  categoriesLoaded = true;
}

// bring first item image Signed URL 
async function getFirstItemImageUrl(itemId) {
  const { data: images, error } = await supabaseClient
    .from("item_images")
    .select("storage_path, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !images || images.length === 0) {
    return null;
  }

  const { data: signedData, error: signedError } = await supabaseClient
    .storage
    .from("item-images")
    .createSignedUrl(images[0].storage_path, 3600);

  if (signedError) {
    console.error("Failed to create signed URL:", signedError);
    return null;
  }

  return signedData.signedUrl;
}

// items from Supabase
async function loadItems() {
  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    showAuthRequiredState();
    return;
  }

  await loadCategories();

  const { data, error } = await supabaseClient
    .from("items")
    .select(`
      id,
      user_id,
      category_id,
      name,
      description,
      pickup_method,
      found_date,
      found_location,
      created_at,
      categories ( name )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load items:", error);
    itemList.innerHTML = "";
    if (resultCount) resultCount.textContent = "0";
    if (noResults) {
      noResults.textContent = "Failed to load items.";
      noResults.style.display = "block";
    }
    return;
  }

  itemList.innerHTML = "";

  for (const item of data) {
    // date filter and sort by date (found_date prioritized, if there is none, created_at)
    const effectiveDate = item.found_date || item.created_at || "";

    const card = document.createElement("a");
    card.className = "item-card";
    card.style.cursor = "pointer";
    card.dataset.name = item.name || "";
    card.dataset.categoryId = item.category_id || "";
    card.dataset.location = item.found_location || "";
    card.dataset.date = effectiveDate;

    card.addEventListener("click", () => {
      window.location.href = `itempage.html?id=${item.id}`;
    });

    const formattedDate = effectiveDate
      ? new Date(effectiveDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "Unknown";

    const imageUrl = imageMap.get(item.id);
    const imageContent = imageUrl
      ? `<img src="     " alt="    ">`
      : "📦";

    const categoryName = item.categories?.name || "Uncategorized";

    card.innerHTML = `
      <div class="image-placeholder">${imageContent}</div>
      <div class="item-info">
        <h3>${item.name}</h3>
        <p class="item-meta">Category: ${categoryName}</p>
        <p class="item-meta">Location: ${item.found_location || "Unknown"}</p>
        <p class="item-meta">Date: ${formattedDate}</p>
      </div>
      <span class="arrow">›</span>
    `;

    itemList.appendChild(card);
  }

  filterItems();
}

//search + filtering
function filterItems() {
  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const selectedLocation = locationFilter ? locationFilter.value : "";
  const selectedCategoryId = categoryFilter ? categoryFilter.value : "";
  const dateOption = dateFilter ? dateFilter.value : "all";
  const today = new Date();

  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = (card.dataset.name || "").toLowerCase();
    const cardLocation = card.dataset.location || "";
    const cardCategoryId = card.dataset.categoryId || "";
    const cardDate = new Date(card.dataset.date);

    let matchesDate = true;

    if (dateOption === "today") {
      matchesDate =
        !Number.isNaN(cardDate.getTime()) &&
        cardDate.toDateString() === today.toDateString();
    } else if (dateOption === "week") {
      const difference = (today - cardDate) / (1000 * 60 * 60 * 24);
      matchesDate =
        !Number.isNaN(cardDate.getTime()) &&
        difference >= 0 &&
        difference <= 7;
    } else if (dateOption === "month") {
      matchesDate =
        !Number.isNaN(cardDate.getTime()) &&
        cardDate.getMonth() === today.getMonth() &&
        cardDate.getFullYear() === today.getFullYear();
    }

    const matchesKeyword = name.includes(keyword);
    const matchesLocation =
      !selectedLocation || cardLocation === selectedLocation;
    const matchesCategory =
      !selectedCategoryId || cardCategoryId === selectedCategoryId;

    const isVisible =
      matchesKeyword && matchesLocation && matchesCategory && matchesDate;

    card.style.display = isVisible ? "flex" : "none";
    if (isVisible) visibleCount++;
  });

  if (resultCount) resultCount.textContent = visibleCount;
  if (noResults) {
    if (visibleCount === 0 && cards.length > 0) {
      noResults.textContent = "No matching items found.";
    } else if (visibleCount === 0 && cards.length === 0) {
      noResults.textContent = "No items found.";
    }
    noResults.style.display = visibleCount === 0 ? "block" : "none";
  }
}

// 정렬
function sortItems() {
  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  const sortType = sortSelect ? sortSelect.value : "newest";

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


searchInput?.addEventListener("input", filterItems);
locationFilter?.addEventListener("change", filterItems);
categoryFilter?.addEventListener("change", filterItems);
dateFilter?.addEventListener("change", filterItems);
sortSelect?.addEventListener("change", sortItems);

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    loadItems();
  } else {
    categoriesLoaded = false;
    showAuthRequiredState();
  }
});

// 초기 로드
loadItems();

