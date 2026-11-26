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

  if (sessionError) {
    console.error("Failed to check session:", sessionError);
  }

 
  if (!sessionData?.session) {
    itemList.innerHTML = "";
    if (resultCount) resultCount.textContent = "0";
    if (noResults) {
      noResults.textContent = "Please log in to view items.";
      noResults.style.display = "block";
    }
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


  const { data: imagesData, error: imagesError } = await supabaseClient
    .from("item_images")
    .select("item_id, storage_path, created_at")
    .order("created_at", { ascending: true });

  if (imagesError) {
    console.error("Failed to load item images:", imagesError);
  }

  const imageMap = new Map();
  (imagesData || []).forEach((img) => {
    if (!imageMap.has(img.item_id) && img.storage_path) {
      const { data: publicUrlData } = supabaseClient.storage
        .from("item-images") // name change in future!!
        .getPublicUrl(img.storage_path);

      if (publicUrlData?.publicUrl) {
        imageMap.set(img.item_id, publicUrlData.publicUrl);
      }
    }
  });

  itemList.innerHTML = "";

  for (const item of data) {
    const effectiveDate = item.found_date || item.created_at || "";

    const card = document.createElement("a");
    card.className = "item-card";
    card.style.cursor = "pointer";
    card.dataset.name = item.name || "";
    card.dataset.category = item.category_id || "";
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
      ? `<img src="${imageUrl}" alt="${item.name || "Item image"}">`
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

function filterItems() {
  const keyword = (searchInput?.value || "").toLowerCase();
  const location = locationFilter?.value || "";
  const category = categoryFilter?.value || "";
  const dateOption = dateFilter?.value || "";
  const today = new Date();

  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = (card.dataset.name || "").toLowerCase();
    const cardLocation = card.dataset.location || "";
    const cardCategory = card.dataset.category || "";
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

  if (resultCount) resultCount.textContent = String(visibleCount);
  if (noResults) {
    if (visibleCount === 0) {
      noResults.textContent = "No items found.";
      noResults.style.display = "block";
    } else {
      noResults.style.display = "none";
    }
  }
}

function sortItems() {
  const cards = Array.from(itemList.querySelectorAll(".item-card"));
  const sortType = sortSelect?.value || "newest";

  cards.sort((a, b) => {
    if (sortType === "newest") {
      return new Date(b.dataset.date) - new Date(a.dataset.date);
    }
    if (sortType === "oldest") {
      return new Date(a.dataset.date) - new Date(b.dataset.date);
    }
    if (sortType === "name") {
      return (a.dataset.name || "").localeCompare(b.dataset.name || "");
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

//initial load
loadItems();

