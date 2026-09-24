# Thiết kế: Tải ảnh đại diện lên Cloudinary

## Mục tiêu

Cho phép người dùng chọn file ảnh đại diện trong popup Edit Profile. Spring Boot xác thực file, tải ảnh lên Cloudinary và lưu URL ảnh trả về vào `users.avatar_url`. Giao diện hiển thị ảnh mới sau khi lưu thành công.

## Bối cảnh hiện tại

- Schema `backend/sql/Database.sql` đã có `users.avatar_url NVARCHAR(500) NULL`; `SampleData.sql` tạo URL mẫu.
- Profile hiện dùng React + Vite. Popup đang cho sửa URL ảnh và lưu dữ liệu trong state giao diện, chưa kết nối API.
- Backend hiện chưa có source entity/repository cho `User`, chưa có kết nối database trong `application.properties` và chưa có cấu hình Cloudinary.
- Hợp đồng API dự án quy định response chuẩn `ApiResponse<T>`.

## Luồng đề xuất

1. Người dùng chọn file ảnh trong popup. Giao diện kiểm tra loại file/kích thước cơ bản, hiện preview tạm bằng object URL và gửi file qua multipart request.
2. Backend nhận file tại `PUT /api/v1/users/profile/avatar`, xác định user từ danh tính đã xác thực, không nhận user ID do client chọn.
3. Backend kiểm tra nội dung là ảnh hợp lệ và giới hạn dung lượng. Mức đề xuất ban đầu là PNG, JPEG hoặc WebP, tối đa 5 MB.
4. Backend tải ảnh lên Cloudinary bằng Java SDK, với credential được đọc từ biến môi trường `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
5. Khi Cloudinary trả kết quả thành công, backend lưu `secure_url` vào `users.avatar_url` và trả URL mới theo response envelope của dự án.
6. Frontend chỉ cập nhật ảnh hồ sơ sau response thành công. Trong lúc upload hiển thị trạng thái đang tải; nếu có lỗi thì giữ ảnh cũ và cho phép thử lại.

## Hợp đồng API dự kiến

- **Method/path:** `PUT /api/v1/users/profile/avatar`
- **Content-Type:** `multipart/form-data`
- **Part name đề xuất:** `file`
- **Thành công:** HTTP 200, `ApiResponse` chứa URL ảnh đại diện đã lưu.
- **Lỗi:** 400 cho file không hợp lệ/quá lớn; 401 nếu chưa đăng nhập; 502 nếu Cloudinary không hoàn tất upload.

Endpoint avatar riêng giữ cho `PUT /api/v1/users/profile` tập trung vào các trường profile dạng văn bản/ngày sinh/giới tính.

## Dữ liệu và vòng đời ảnh

- Database lưu URL HTTPS, không lưu byte ảnh.
- Bản đầu không xóa ảnh avatar cũ khi thay ảnh mới vì schema hiện chỉ lưu URL, không lưu Cloudinary `public_id`. Điều này có thể để lại asset cũ trên Cloudinary.
- Nếu cần dọn asset cũ tự động, thiết kế tiếp theo sẽ lưu thêm `public_id` và xóa asset cũ sau khi URL mới được lưu thành công.
- Nếu upload thành công nhưng ghi database thất bại, backend nên xóa asset vừa upload nếu còn giữ được `public_id` từ response.

## Bảo mật và kiểm tra đầu vào

- Không đưa API secret hoặc chữ ký upload vào React/frontend.
- Chỉ cho phép user đã đăng nhập sửa avatar của chính họ.
- Không tin riêng phần mở rộng hoặc MIME do trình duyệt gửi; kiểm tra định dạng nội dung ở backend.
- Giới hạn kích thước file ở cả cấu hình multipart Spring và validation ứng dụng.
- Không nhận URL ảnh từ người dùng trong luồng upload file.

## Thay đổi dự kiến

- Backend: cấu hình Cloudinary, dịch vụ upload ảnh, endpoint nhận multipart, lưu `avatar_url` trên entity/repository User.
- Frontend: thay trường URL ảnh bằng file picker, preview, trạng thái upload/thành công/lỗi và gọi endpoint avatar.
- Cấu hình chạy: thêm tên biến môi trường Cloudinary vào tài liệu cấu hình; không lưu credential thật trong repository.
- Dữ liệu: giữ schema hiện tại nếu cột `avatar_url` đã được tạo; nếu database đang chạy được dựng trước thay đổi schema thì cần áp dụng `ALTER TABLE users ADD avatar_url NVARCHAR(500) NULL`.

## Tiêu chí chấp nhận

- User chọn ảnh hợp lệ, xem preview, upload và thấy ảnh mới sau response thành công.
- File sai định dạng hoặc vượt giới hạn không được gửi lên Cloudinary và có thông báo dễ hiểu.
- Lỗi upload không làm mất URL/ảnh avatar đang dùng.
- User không thể cập nhật avatar của tài khoản khác bằng cách sửa request.
- Response lỗi/thành công tuân theo `ApiResponse<T>`.
- Credential Cloudinary chỉ được cung cấp cho backend qua cấu hình môi trường.

## Tài liệu Cloudinary

- [Java image and video upload](https://cloudinary.com/documentation/java_image_and_video_upload)
- [Java SDK integration](https://cloudinary.com/documentation/java_integration)
