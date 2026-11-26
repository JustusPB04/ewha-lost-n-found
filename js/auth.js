
const SCHOOL_DOMAIN = "@ewha.ac.kr";

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");
const registerButton = document.getElementById("register-button");
const registerMessage = document.getElementById("register-message");
const logoutButton = document.getElementById("logout-button");

// Display messages
function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
}

function showRegisterMessage(text, type) {
    registerMessage.textContent = text;
    registerMessage.className = type;
}

// Check existing session
supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
        showMessage("Could not check login status.", "error");
        return;
    }

    if (data.session) {
        showMessage("You are already logged in.", "success");
    }
});

// Login
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    showRegisterMessage("", "");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email.toLowerCase().endsWith(SCHOOL_DOMAIN)) {
        showMessage(
            "Only school email addresses can be used to log in.",
            "error"
        );
        return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showMessage(
            "Login failed. Please check your email and password.",
            "error"
        );
        return;
    }

    showMessage("Login successful!", "success");
});

// Registration
registerButton.addEventListener("click", async () => {
    showMessage("", "");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showRegisterMessage(
            "Please enter your email and password.",
            "error"
        );
        return;
    }

    if (!email.toLowerCase().endsWith(SCHOOL_DOMAIN)) {
        showRegisterMessage(
            "Only school email addresses can be used.",
            "error"
        );
        return;
    }

    registerButton.disabled = true;

    try {
        const { error } = await registrationClient.auth.signUp({
            email,
            password
        });

        if (error) {
            showRegisterMessage(error.message, "error");
            return;
        }

        showRegisterMessage(
            "Registration successful! You can now log in.",
            "success"
        );

        document.getElementById("password").value = "";

    } catch (error) {
        showRegisterMessage(
            "An unexpected error occurred during registration.",
            "error"
        );

    } finally {
        registerButton.disabled = false;
    }
});

// Logout
logoutButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showMessage("Logout failed. Please try again.", "error");
        return;
    }

    showMessage("You have been logged out.", "success");
    showRegisterMessage("", "");
});