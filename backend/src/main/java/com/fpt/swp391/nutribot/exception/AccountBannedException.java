package com.fpt.swp391.nutribot.exception;

public class AccountBannedException extends BadRequestException {
    public AccountBannedException() {
        super("ACCOUNT_BANNED");
    }
}
