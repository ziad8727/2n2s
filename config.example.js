module.exports = {
    web: {
        enabled: true, // If the webserver is even enabled
        port: 8090, // The port to listen for on the webserver
        password: '2s2n' // Change this to false if you don't want a password, highly recommended to change it
    },
    server: {
        whitelist: true, // Only allow the user that connected to 2b2t directly to connect to the proxy
        port: 25537 // The port the minecraft server proxy listens on
    },
    discord: {
        enabled: true, // Enable the discord bot?
        userID: '429315263717179415', // Change this to the user ID of the user you want DMed when the queue pos is low. Also is the only user that can run commands.
        notifications: {
            enabled: true, // Enable DM notifications
            queuePos: 20 // On this position, send a DM saying you should join now
        },
        prefix: '2n' // Bot prefix
    },
    misc: {
        log: true, // Enable logging to console?
        queueOnStart: false, // Start queuing on startup. This has to be enabled if web and discord are disabled.
        reconnectOnMiss: false, // If you are not present when the server connects you in, reconnect to start the queue again
        antiAFK: true, // Some kind of anti afk system. Don't count on it working well.
        chunkCache: true // Cache the map and other things. Recommended that you don't touch this.
    }
}