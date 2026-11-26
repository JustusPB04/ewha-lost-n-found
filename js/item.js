const itemId = new URLSearchParams(window.location.search).get("id");

const message = document.getElementById("message");
const itemContainer = document.getElementById("itemContainer");
const foundButton = document.getElementById("foundButton");
let isLostPost = false;

function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = isError ? "text-danger" : "text-muted";
    message.style.display = "block";
}

async function checkLogin() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
        window.location.href = "../index.html";
        return false;
    }
    return true;
}

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

    // Check if this post is a Lost Item report ([LOST])
    const rawName = item.name || "No name";
    isLostPost = rawName.startsWith("[LOST]");

    const statusBadge = document.getElementById("statusBadge");
    if (isLostPost) {
        statusBadge.textContent = "Lost Item";
        statusBadge.className = "badge bg-danger";
        document.getElementById("itemName").textContent = rawName.replace("[LOST]", "").trim();
        document.getElementById("dateLabel").textContent = "Date Lost";
        document.getElementById("locationLabel").textContent = "Location Lost";
        document.getElementById("methodLabel").textContent = "Contact / Return Method";
        foundButton.textContent = "Mark as Found (Resolved)";
    } else {
        statusBadge.textContent = "Found Item";
        statusBadge.className = "badge bg-success";
        document.getElementById("itemName").textContent = rawName;
    }

    const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
    document.getElementById("itemCategory").textContent = category?.name || "Not specified";
    document.getElementById("itemDescription").textContent = item.description || "No description";
    document.getElementById("foundDate").textContent = item.found_date || "Not specified";
    document.getElementById("foundLocation").textContent = item.found_location || "Not specified";
    document.getElementById("pickupMethod").textContent = item.pickup_method || "Not specified";

    const imageContainer = document.getElementById("imageContainer");
    imageContainer.innerHTML = "";

    for (const image of (item.item_images || [])) {
        const { data: imageData, error: imageError } = await supabaseClient.storage
            .from("item-images")
            .createSignedUrl(image.storage_path, 3600);

        if (imageError || !imageData) continue;

        const img = document.createElement("img");
        img.src = imageData.signedUrl;
        img.alt = rawName;
        img.className = "item-image";
        imageContainer.appendChild(img);
    }

    message.style.display = "none";
    itemContainer.style.display = "block";
}

foundButton.addEventListener("click", async () => {
    const confirmMsg = isLostPost
        ? "Have you found your lost item? This will remove the post."
        : "Are you sure you want to mark this item as returned?";

    if (!confirm(confirmMsg)) return;

    foundButton.disabled = true;
    foundButton.textContent = "Processing...";

    const { data: images } = await supabaseClient
        .from("item_images")
        .select("storage_path")
        .eq("item_id", itemId);

    const imagePaths = (images || []).map((image) => image.storage_path);
    if (imagePaths.length > 0) {
        await supabaseClient.storage.from("item-images").remove(imagePaths);
    }

    const { error: deleteError } = await supabaseClient
        .from("items")
        .delete()
        .eq("id", itemId);

    if (deleteError) {
        alert("Failed to update item status.");
        foundButton.disabled = false;
        foundButton.textContent = isLostPost ? "Mark as Found (Resolved)" : "Mark as Returned";
        return;
    }

    alert(isLostPost ? "Glad you found your item!" : "Item successfully marked as returned!");
    window.location.href = "search.html";
});

loadItem();
