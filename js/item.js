const statusMessage = document.getElementById("statusMessage");
const detailCard = document.getElementById("detailCard");
const itemImagesContainer = document.getElementById("itemImagesContainer");
const itemCategory = document.getElementById("itemCategory");
const itemName = document.getElementById("itemName");
const itemCreatedAt = document.getElementById("itemCreatedAt");
const itemLocation = document.getElementById("itemLocation");
const itemFoundDate = document.getElementById("itemFoundDate");
const itemPickupMethod = document.getElementById("itemPickupMethod");
const itemDescription = document.getElementById("itemDescription");
const ownerActions = document.getElementById("ownerActions");
const deleteItemBtn = document.getElementById("deleteItemBtn");

function formatDate(dateString) {
  if (!dateString) return "Unknown";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function showStatus(message, isError = false) {
  if (detailCard) detailCard.style.display = "none";
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? "error" : "";
    statusMessage.style.display = "block";
  }
}

async function loadItemDetail() {
  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Failed to check session:", sessionError);
  }

  if (!sessionData?.session) {
    showStatus("Please log in to view item details.", true);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const itemId = params.get("id");

  if (!itemId) {
    showStatus("Invalid item ID.", true);
    return;
  }

  // 1. items + categories 조회 (search.js와 동일한 컬럼 구조)
  const { data: item, error } = await supabaseClient
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
    .eq("id", itemId)
    .single();

  if (error || !item) {
    console.error("Failed to load item detail:", error);
    showStatus("Item not found or failed to load.", true);
    return;
  }

  // 2. 텍스트 필드 렌더링
  itemCategory.textContent = item.categories?.name || "Uncategorized";
  itemName.textContent = item.name || "Unnamed Item";
  itemCreatedAt.textContent = `Posted on ${formatDate(item.created_at)}`;
  itemLocation.textContent = item.found_location || "Unknown";
  itemFoundDate.textContent = formatDate(item.found_date || item.created_at);
  itemPickupMethod.textContent = item.pickup_method || "Not specified";
  itemDescription.textContent =
    item.description || "No description provided.";

  // 3. item_images 조회 및 렌더링 (search.js와 동일한 item-images 버킷 & getPublicUrl)
  const { data: imagesData, error: imagesError } = await supabaseClient
    .from("item_images")
    .select("id, storage_path, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (imagesError) {
    console.error("Failed to load item images:", imagesError);
  }

  itemImagesContainer.innerHTML = "";
  const validImages = (imagesData || []).filter((img) => img.storage_path);

  if (validImages.length > 0) {
    validImages.forEach((img) => {
      const { data: publicUrlData } = supabaseClient.storage
        .from("item-images")
        .getPublicUrl(img.storage_path);

      if (publicUrlData?.publicUrl) {
        const imgEl = document.createElement("img");
        imgEl.src = publicUrlData.publicUrl;
        imgEl.alt = item.name || "Item image";
        itemImagesContainer.appendChild(imgEl);
      }
    });
  }

  if (itemImagesContainer.children.length === 0) {
    itemImagesContainer.innerHTML = `<div class="no-image-box">📦</div>`;
  }

  // 4. 본인 게시글일 경우 삭제 버튼 활성화
  const currentUserId = sessionData.session.user?.id;
  if (currentUserId && currentUserId === item.user_id) {
    ownerActions.style.display = "flex";
    deleteItemBtn.onclick = async () => {
      if (!confirm("Are you sure you want to delete this item?")) return;

      const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("id", item.id);

      if (deleteError) {
        alert("Failed to delete item: " + deleteError.message);
        return;
      }

      alert("Item deleted.");
      window.location.href = "search.html";
    };
  }

  statusMessage.style.display = "none";
  detailCard.style.display = "block";
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    loadItemDetail();
  } else {
    showStatus("Please log in first to view item details.", true);
  }
});

// initial load
loadItemDetail();