package com.fpt.swp391.nutribot.service;

/**
 * Sends user-facing notification emails for account status changes.
 */
public interface UserNotificationSender {

    /**
     * Sends a warm warning email when the account is set to WARN status.
     * @param recipient email address
     * @param username user's display name
     * @param strikeCount total strikes after this warning
     * @param reason why the warning was issued
     */
    void sendWarningNotification(String recipient, String username, int strikeCount, String reason);

    /**
     * Sends a ban notification email when the account is permanently banned.
     * @param recipient email address
     * @param username user's display name
     * @param reason why the account was banned
     */
    void sendBannedNotification(String recipient, String username, String reason);
}
