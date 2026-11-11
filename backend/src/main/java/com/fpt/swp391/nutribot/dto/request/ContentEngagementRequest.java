package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class ContentEngagementRequest {
    @NotNull @Min(0) @Max(86400)
    private Integer dwellTimeSec;
    @NotNull @DecimalMin("0.0") @DecimalMax("100.0")
    private BigDecimal maxScrollPct;
    @NotNull private Boolean completed;
    private Boolean finalize;
}
