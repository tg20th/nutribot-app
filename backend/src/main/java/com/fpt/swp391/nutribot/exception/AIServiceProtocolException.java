package com.fpt.swp391.nutribot.exception;

/** The internal AI service rejected or returned an invalid chatbot contract. */
public class AIServiceProtocolException extends RuntimeException {
    public AIServiceProtocolException(String message) {
        super(message);
    }
}
