# TBY Badminton Team — Slot Booking

Website miễn phí dùng **GitHub Pages + Supabase** theo mẫu TBY.

## Có gì sẵn?
- Trang lịch kèo responsive cho điện thoại/desktop.
- Hiển thị slot Nam/Nữ và danh sách người đăng ký theo thời gian thực khi refresh.
- Form đăng ký không cần tài khoản.
- Chống vượt slot bằng PostgreSQL transaction/row lock.
- Không hiển thị số điện thoại công khai.
- Admin đăng nhập Supabase Auth bằng magic link.
- Admin có thể tạo kèo mới.

## 1. Tạo Supabase
1. Vào Supabase → New project.
2. SQL Editor → New query → dán toàn bộ `supabase.sql` → Run.
3. Project Settings → API, copy:
   - Project URL
   - `anon public` key
4. Mở `config.js`, thay 2 giá trị tương ứng.

> Không đưa `service_role` key vào website/GitHub.

## 2. Cấp quyền admin
1. Mở website → Admin → nhập email → bấm gửi magic link.
2. Sau khi đăng nhập lần đầu, vào Supabase → Authentication → Users → copy `User UID`.
3. SQL Editor chạy:

```sql
insert into public.admin_users(user_id)
values ('DÁN-USER-UID-VÀO-ĐÂY');
```

## 3. Cấu hình Auth URL
Supabase → Authentication → URL Configuration:
- Site URL: `https://TEN_GITHUB.github.io/TEN_REPO/`
- Redirect URLs: thêm cùng URL trên.

## 4. Đưa lên GitHub Pages
1. Tạo repository, ví dụ `tby-badminton`.
2. Upload toàn bộ file trong thư mục này lên repo.
3. GitHub → Settings → Pages.
4. Source: **Deploy from a branch**.
5. Branch: `main` / folder `/ (root)` → Save.
6. Sau vài phút web sẽ có dạng:
   `https://TEN_GITHUB.github.io/tby-badminton/`

## 5. File chính
- `index.html`: giao diện.
- `styles.css`: màu sắc/mobile layout.
- `app.js`: tải lịch, đăng ký, admin.
- `config.js`: URL + anon key Supabase.
- `supabase.sql`: database, RLS, function đăng ký.
- `assets/logo.png`: logo TBY.

## Gợi ý nâng cấp tiếp
- Nút hủy slot bằng mã OTP/Zalo.
- Danh sách chờ khi hết slot.
- Host duyệt người chơi trước khi xác nhận.
- Gửi thông báo Telegram/Zalo/Discord khi có người đăng ký.
- QR đăng ký tại sân.
- Admin sửa/xóa kèo và xuất Excel danh sách.
