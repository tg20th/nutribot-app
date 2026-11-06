package com.fpt.swp391.nutribot.event;

public record AccountSuspendedEvent(Integer userId, boolean strikeBased, String reason) {}
