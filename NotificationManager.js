const { Notification } = require('electron');

class NotificationManager {
    static showNotification(title, body, duration = 5000) {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: title || 'Notification',
                body: body || '',
                silent: false
            });

            notification.show();

            setTimeout(() => {
                notification.close();
            }, duration);
        } else {
            console.log('Notifications are not supported on this platform.');
        }
    }
}

module.exports = NotificationManager;