package com.fpt.swp391.nutribot.exception;

import lombok.Getter;

import java.util.List;

@Getter
public class ProfileIncompleteException extends RuntimeException {

    private final List<String> missingFields;

    public ProfileIncompleteException(List<String> missingFields) {
        super("Hồ sơ sức khỏe chưa đầy đủ");
        this.missingFields = missingFields;
    }
}
