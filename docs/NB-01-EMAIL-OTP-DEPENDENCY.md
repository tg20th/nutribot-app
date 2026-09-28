# NB-01 — Dependency xác minh email bằng OTP

## Trạng thái hiện tại

Frontend chỉ dùng API thật `POST /api/v1/auth/register` với payload `username`, `email`, `password`, `fullName`.
Theo `API_CONTRACTS.md` và implementation hiện tại, API trả về JWT, username và role ngay sau khi tạo tài khoản. `AuthModal` chỉ lưu JWT được backend trả về; không có OTP, trạng thái email đã xác minh hoặc giả lập gửi email ở frontend.

## Dependency backend còn thiếu

Chưa có contract hoặc implementation chính thức cho các khả năng sau:

- Gửi OTP tới email thật sau khi đăng ký.
- Xác minh OTP với backend là nguồn quyết định hợp lệ/không hợp lệ.
- Gửi lại OTP, bao gồm cooldown và giới hạn gửi lại.
- Thông tin expiry, số lần thử còn lại và trạng thái OTP đã dùng/hết hạn.
- Response của đăng ký biểu thị tài khoản đang chờ xác minh, thay cho JWT đăng nhập ngay.
- Trạng thái tài khoản/email chưa xác minh và quy tắc đăng nhập trước/sau khi xác minh.
- Response thành công/thất bại chuẩn cho toàn bộ các thao tác email verification.

## UI frontend đã chuẩn bị

`frontend/src/components/auth/EmailVerificationStep.jsx` là bước giao diện xác minh email trong `AuthModal`. Component dùng các ô code riêng biệt và nhận email, số lượng ô, code, handler verify/resend, trạng thái và cooldown từ integration layer tương lai; không gọi API, tạo OTP, kiểm tra OTP, đếm ngược hoặc tự chuyển trạng thái.

Luồng đăng ký hiện tại không chuyển sang bước này. Khi backend trả contract yêu cầu xác minh email, caller mới truyền `mode="verify-email"` cùng dữ liệu/handler thật vào `AuthModal`.

Trong môi trường development, có thể xem và kiểm tra interaction thuần UI tại `/dev/nb-01-email-verification`. Có thể truyền `email` và `boxCount` qua query string để kiểm tra presentation, ví dụ `/dev/nb-01-email-verification?email=your@email.com&boxCount=6`. Preview không truyền handler gửi/xác minh và không mô phỏng response backend.

## Điều kiện để frontend tích hợp OTP thật

Chỉ sau khi backend công bố contract và endpoint thật, `AuthModal` mới được mở rộng sang bước nhập OTP. Frontend phải gửi OTP người dùng nhập tới backend và chỉ chuyển trạng thái khi response thật từ backend xác nhận thành công.

Không có mock API, fake OTP, hardcode OTP, hardcode xác minh thành công, hay frontend tự kiểm tra OTP trong NB-01 hiện tại.
