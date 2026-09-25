package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserStatusRequest {

    @Pattern(regexp = "ACTIVE|BANNED|SUSPENDED|DELETED",
             message = "Status phải là ACTIVE, BANNED, SUSPENDED hoặc DELETED")
    private String status;
}
