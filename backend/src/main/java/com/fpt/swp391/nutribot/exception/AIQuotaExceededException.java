package com.fpt.swp391.nutribot.exception;

public class AIQuotaExceededException extends RuntimeException {
    public AIQuotaExceededException(String message) {
        super(message);
    }
}
