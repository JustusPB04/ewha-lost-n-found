async function requireAuthentication() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.replace("../index.html");
        return null;
    }

    return data.session.user;
}