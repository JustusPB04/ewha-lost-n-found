// add.js - Upload a new found item (pages/add.html)
// Requires: supabase-js CDN, browser-image-compression CDN, js/supabase.js

const BUCKET = "item-images";

const form = document.getElementById("add-form");
const message = document.getElementById("message");
const submitButton = form.querySelector("button[type='submit']");
const categorySelect = document.getElementById("category");

let currentUser = null;

function showMessage(text, type) {
  message.textContent = text;
  message.className = type;
}

// Redirect to the login page if the user is not logged in
async function checkLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    alert("Please log in first.");
    window.location.href = "../index.html";
    return false;
  }

  currentUser = data.session.user;
  return true;
}

// Fill the category dropdown from the categories table
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load categories:", error);
    showMessage("Failed to load categories.", "error");
    return;
  }

  data.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });
}

// Get the file extension from the image type (e.g. image/png -> png)
function getExtension(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); // Prevent the page from reloading on submit

  submitButton.disabled = true;
  showMessage("Uploading...", "");

  try {
    // 1. Save the item first (its id is needed for the photo folder)
    const { data: item, error: itemError } = await supabaseClient
      .from("items")
      .insert({
        user_id: currentUser.id,
        category_id: categorySelect.value,
        name: document.getElementById("name").value.trim(),
        found_date: document.getElementById("found-date").value,
        found_location: document.getElementById("found-location").value.trim(),
        pickup_method: document.getElementById("storage-location").value.trim(),
        description: document.getElementById("description").value.trim() || null
      })
      .select("id")
      .single();

    if (itemError) throw itemError;

    // 2. Compress and upload each photo to item-images/ITEM_ID/image-N.jpg
    const photos = document.getElementById("photos").files;

    for (let i = 0; i < photos.length; i++) {
      const compressed = await imageCompression(photos[i], { maxSizeMB: 1 });
      const path = `${item.id}/image-${i + 1}.${getExtension(compressed)}`;

      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET)
        .upload(path, compressed, { contentType: compressed.type });

      if (uploadError) throw uploadError;

      // 3. Save the photo path in item_images
      const { error: imageError } = await supabaseClient
        .from("item_images")
        .insert({ item_id: item.id, storage_path: path });

      if (imageError) throw imageError;
    }

    showMessage("Item uploaded successfully!", "success");
    form.reset(); // Stay on add.html with an empty form
  } catch (error) {
    console.error("Upload failed:", error);
    showMessage("Upload failed. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

// Run on page load
checkLogin().then((loggedIn) => {
  if (loggedIn) loadCategories();
});
