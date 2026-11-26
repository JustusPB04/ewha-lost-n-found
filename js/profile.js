const BUCKET = "item-images";

const userEmailDisplay = document.getElementById("user-email");
const deleteAccountBtn = document.getElementById("delete-account-btn");
const itemListContainer = document.getElementById("item-list-container");

let currentUser = null;

async function checkAuthAndLoadData() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    alert("Please log in to access My Page.");
    window.location.href = "../index.html";
    return;
  }

  currentUser = data.session.user;
  userEmailDisplay.textContent = currentUser.email;
  await loadMyItems(currentUser.id);
}
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

  const { data: signedData, error: signedError } = await supabaseClient.storage
    .from(BUCKET)
    .createSignedUrl(images[0].storage_path, 3600);

  if (signedError) {
    console.error("Failed to create signed URL:", signedError);
    return null;
  }

  return signedData.signedUrl;
}
async function loadMyItems(userId) {
  itemListContainer.innerHTML = '<p class="no-items-msg">Loading your items...</p>';

  const { data: items, error } = await supabaseClient
    .from("items")
    .select(`
      id,
      name,
      found_date,
      found_location,
      created_at,
      categories ( name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  itemListContainer.innerHTML = "";

  if (error) {
    console.error("Error fetching items:", error);
    itemListContainer.innerHTML =
      '<p class="no-items-msg" style="color:red;">Failed to load items.</p>';
    return;
  }

  if (!items || items.length === 0) {
    itemListContainer.innerHTML =
      '<p class="no-items-msg">You have not uploaded any items yet.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "item-card";

    card.addEventListener("click", () => {
      window.location.href = `itempage.html?id=${item.id}`;
    });
    const leftWrapper = document.createElement("div");
    leftWrapper.className = "item-left";

    const thumb = document.createElement("div");
    thumb.className = "item-thumb";
    const signedUrl = await getFirstItemImageUrl(item.id);
    if (signedUrl) {
      const img = document.createElement("img");
      img.src = signedUrl;
      img.alt = item.name;
      thumb.appendChild(img);
    } else {
      thumb.textContent = "📦";
    }

    const infoWrapper = document.createElement("div");

    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = item.name;

    const categoryName = item.categories?.name || "Uncategorized";
    const effectiveDate = item.found_date || item.created_at;
    const formattedDate = effectiveDate
      ? new Date(effectiveDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "Unknown";

    const meta = document.createElement("p");
    meta.className = "item-date";
    meta.textContent = `${categoryName} · ${item.found_location || "Unknown"} · ${formattedDate}`;

    infoWrapper.appendChild(title);
    infoWrapper.appendChild(meta);
    leftWrapper.appendChild(thumb);
    leftWrapper.appendChild(infoWrapper);

    const deleteItemBtn = document.createElement("button");
    deleteItemBtn.className = "delete-item-btn";
    deleteItemBtn.textContent = "Delete";
    deleteItemBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteItem(item.id, item.name);
    });

    card.appendChild(leftWrapper);
    card.appendChild(deleteItemBtn);
    itemListContainer.appendChild(card);
  }
}

async function deleteItem(itemId, itemName) {
  const confirmed = confirm(`Delete "${itemName}"? This cannot be undone.`);
  if (!confirmed || !currentUser) return;

  try {
    const { data: images, error: imgFetchError } = await supabaseClient
      .from("item_images")
      .select("storage_path")
      .eq("item_id", itemId);

    if (imgFetchError) throw imgFetchError;

    if (images && images.length > 0) {
      const paths = images.map((img) => img.storage_path);
      const { error: storageError } = await supabaseClient.storage
        .from(BUCKET)
        .remove(paths);

      if (storageError) {
        console.error("Failed to remove images from storage:", storageError);
      }

      const { error: imgDeleteError } = await supabaseClient
        .from("item_images")
        .delete()
        .eq("item_id", itemId);

      if (imgDeleteError) throw imgDeleteError;
    }

    const { error: itemDeleteError } = await supabaseClient
      .from("items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", currentUser.id);

    if (itemDeleteError) throw itemDeleteError;

    await loadMyItems(currentUser.id);
  } catch (error) {
    console.error("Failed to delete item:", error);
    alert("Failed to delete the item. Please try again.");
  }
}

deleteAccountBtn.addEventListener("click", async () => {
  const confirmDelete = confirm(
    "Are you sure you want to delete your account? This action cannot be undone and will delete all your uploaded items."
  );

  if (!confirmDelete || !currentUser) return;

  deleteAccountBtn.disabled = true;

  try {

    const { data: myItems } = await supabaseClient
      .from("items")
      .select("id")
      .eq("user_id", currentUser.id);

    if (myItems && myItems.length > 0) {
      const itemIds = myItems.map((item) => item.id);
      const { data: myImages } = await supabaseClient
        .from("item_images")
        .select("storage_path")
        .in("item_id", itemIds);

      if (myImages && myImages.length > 0) {
        const paths = myImages.map((img) => img.storage_path);
        await supabaseClient.storage.from(BUCKET).remove(paths);
      }
    }
    
    const { error } = await supabaseClient.rpc("delete_user_account");
    if (error) throw error;

    alert("Your account has been deleted successfully.");
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html";
  } catch (error) {
    console.error("Error deleting account:", error);
    alert("Failed to delete account. Please try again later.");
    deleteAccountBtn.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", checkAuthAndLoadData);
