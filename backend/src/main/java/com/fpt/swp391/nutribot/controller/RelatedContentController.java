package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.service.ContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * NB-59: API Gợi ý nội dung liên quan
 * GET /api/v1/contents/{id}/related?limit=6
 */
@RestController
@RequestMapping("/api/v1/contents")
@RequiredArgsConstructor
public class RelatedContentController {

    private final ContentService contentService;

    /**
     * Lấy danh sách nội dung liên quan đến bài viết / video theo ID.
     * Ưu tiên cùng danh mục (category) + cùng loại (BLOG/VIDEO),
     * fallback sang cùng loại nếu không đủ số lượng.
     *
     * @param id    ID bài viết hoặc video gốc
     * @param limit Số lượng tối đa cần lấy (mặc định 6, tối đa 20)
     */
    @GetMapping("/{id}/related")
    public ResponseEntity<ApiResponse<List<ContentListResponse>>> getRelatedContents(
            @PathVariable Integer id,
            @RequestParam(defaultValue = "6") int limit) {

        List<ContentListResponse> related = contentService.getRelatedContents(id, limit);
        return ResponseEntity.ok(ApiResponse.success(related));
    }
}
