console.log("Profile PWA started!");


/*
    Register Service Worker
*/

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")
            .then(() => {
                console.log("Service Worker registered");
            })
            .catch((error) => {
                console.error(
                    "Service Worker registration failed:",
                    error
                );
            });

    });

}