package com.fpt.swp391.nutribot.exception;

public class CloudinaryUploadException extends RuntimeException {
    public CloudinaryUploadException(Throwable cause) {
        super("Avatar upload failed.", cause);
    }
}
