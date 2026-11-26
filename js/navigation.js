const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
    logoutButton.addEventListener("click", async (event) => {
        event.preventDefault();

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            alert("Logout failed. Please try again.");
            return;
        }

        window.location.replace("../index.html");
    });
}