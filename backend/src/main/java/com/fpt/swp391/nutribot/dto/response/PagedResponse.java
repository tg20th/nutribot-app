package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponse<T> {

    @JsonProperty("content")
    @Builder.Default
    private List<T> content = List.of();

    @JsonProperty("page")
    @Builder.Default
    private int page = 0;

    @JsonProperty("size")
    @Builder.Default
    private int size = 0;

    @JsonProperty("totalElements")
    @Builder.Default
    private long totalElements = 0;

    @JsonProperty("totalPages")
    @Builder.Default
    private int totalPages = 0;

    @JsonProperty("first")
    @Builder.Default
    private boolean first = true;

    @JsonProperty("last")
    @Builder.Default
    private boolean last = true;

    @JsonProperty("currentPage")
    @Builder.Default
    private int currentPage = 0;

    public static <T> PagedResponse<T> of(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .currentPage(page.getNumber())
                .build();
    }
}
