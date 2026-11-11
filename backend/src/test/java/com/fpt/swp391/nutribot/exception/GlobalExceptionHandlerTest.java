package com.fpt.swp391.nutribot.exception;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    @Test
    void returnsVideoUploadLimitMessageForMultipartLimitExceeded() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var response = handler.handleUploadTooLarge(new MaxUploadSizeExceededException(25L * 1024 * 1024));

        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, response.getStatusCode());
        ApiResponse<Void> body = response.getBody();
        assertEquals("Dung lượng tệp tải lên không được vượt quá 25 MB.", body.getMessage());
    }
}
