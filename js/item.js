// Get item ID from URL
const itemId = new URLSearchParams(window.location.search).get("id");

const message = document.getElementById("message");
const itemContainer = document.getElementById("itemContainer");
const foundButton = document.getElementById("foundButton");

function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = isError ? "error" : "";
    message.style.display = "block";
}

// 1. Check login status
async function checkLogin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "../index.html";
        return false;
    }

    return true;
}

// 2. Load item details
async function loadItem() {
    if (!itemId) {
        showMessage("No item was selected.", true);
        return;
    }

    const loggedIn = await checkLogin();
    if (!loggedIn) return;

    const { data: item, error } = await supabaseClient
        .from("items")
        .select(`
            id,
            name,
            description,
            found_date,
            found_location,
            pickup_method,
            categories(name),
            item_images(storage_path)
        `)
        .eq("id", itemId)
        .single();

    if (error || !item) {
        console.error("Item loading error:", error);
        showMessage("Could not load item details.", true);
        return;
    }

    // Display item information
    document.getElementById("itemName").textContent = item.name || "No name";

    const category = Array.isArray(item.categories)
        ? item.categories[0]
        : item.categories;

    document.getElementById("itemCategory").textContent =
        category?.name || "Not specified";

    document.getElementById("itemDescription").textContent =
        item.description || "No description";

    document.getElementById("foundDate").textContent =
        item.found_date || "Not specified";

    document.getElementById("foundLocation").textContent =
        item.found_location || "Not specified";

    document.getElementById("pickupMethod").textContent =
        item.pickup_method || "Not specified";

    // 3. Load images from Supabase Storage
    const imageContainer = document.getElementById("imageContainer");
    imageContainer.innerHTML = "";

    for (const image of (item.item_images || [])) {
        const { data: imageData, error: imageError } =
            await supabaseClient.storage
                .from("item-images")
                .createSignedUrl(image.storage_path, 3600);

        if (imageError || !imageData) {
            console.error("Image loading error:", imageError);
            continue;
        }

        const img = document.createElement("img");
        img.src = imageData.signedUrl;
        img.alt = item.name;
        img.className = "item-image";

        imageContainer.appendChild(img);
    }

    message.style.display = "none";
    itemContainer.style.display = "block";
}

// 4. Mark item as returned
foundButton.addEventListener("click", async () => {
    const confirmed = confirm(
        "Are you sure you want to mark this item as returned?"
    );

    if (!confirmed) return;

    foundButton.disabled = true;
    foundButton.textContent = "Processing...";

    // Get image paths
    const { data: images, error: imageError } = await supabaseClient
        .from("item_images")
        .select("storage_path")
        .eq("item_id", itemId);

    if (imageError) {
        console.error(imageError);
        alert("Failed to retrieve item images.");
        foundButton.disabled = false;
        foundButton.textContent = "Mark as Returned";
        return;
    }

    // Delete images from Storage
    const imagePaths = (images || []).map((image) => image.storage_path);

    if (imagePaths.length > 0) {
        const { error: storageError } = await supabaseClient.storage
            .from("item-images")
            .remove(imagePaths);

        if (storageError) {
            console.error(storageError);
            alert("Failed to delete item images.");
            foundButton.disabled = false;
            foundButton.textContent = "Mark as Returned";
            return;
        }
    }

    // Delete item record
    const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("id", itemId);

    if (deleteError) {
        console.error(deleteError);
        alert("Failed to delete item.");
        foundButton.disabled = false;
        foundButton.textContent = "Mark as Returned";
        return;
    }

    alert("Item successfully marked as returned!");
    window.location.href = "search.html";
});

// Start page
loadItem();
