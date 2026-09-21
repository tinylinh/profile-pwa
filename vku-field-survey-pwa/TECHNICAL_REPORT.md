# Technical Report: VKU Library Field Survey PWA

## 1. Mục tiêu dự án

Dự án xây dựng một Progressive Web App phục vụ khảo sát hiện trường về mức độ hiểu biết và đánh giá của sinh viên đối với thư viện mới. Ứng dụng hướng đến người phỏng vấn sử dụng trên điện thoại trong điều kiện mạng không ổn định hoặc không có mạng. Mục tiêu chính là đảm bảo phiếu khảo sát vẫn được nhập, lưu, xem lại và tự đồng bộ lên Google Sheet khi thiết bị online trở lại.

## 2. Chức năng chính

Ứng dụng cung cấp form khảo sát mobile-first với các nhóm thông tin: phiên phỏng vấn, thông tin cá nhân cơ bản, câu hỏi đánh giá thư viện mới và bằng chứng hiện trường. Người phỏng vấn có thể nhập tên, mã hoặc tên người được hỏi, ngành học, năm học, giới tính, độ tuổi, mức độ hiểu biết về dịch vụ thư viện, tần suất sử dụng, điểm đánh giá 1-5 cho nhiều tiêu chí và góp ý cải thiện.

Ứng dụng tự lấy thời gian ghi nhận, hỗ trợ GPS để lấy vĩ độ, kinh độ và độ chính xác vị trí. Trường chụp ảnh dùng camera sau trên thiết bị di động khi trình duyệt hỗ trợ thuộc tính `capture="environment"`. Ảnh được nén trước khi lưu để giảm dung lượng lưu trữ và giảm kích thước dữ liệu đồng bộ.

Màn hình lịch sử cho phép xem các phiên đã hỏi, trạng thái đồng bộ, vị trí, mức hài lòng tổng thể và trạng thái có ảnh. Ngoài đồng bộ Google Sheet, ứng dụng còn có chức năng xuất JSON để sao lưu thủ công khi cần.

## 3. Kiến trúc offline-first

Ứng dụng dùng Service Worker để cache app shell gồm HTML, CSS, JavaScript, manifest và icon. Nhờ đó sau lần tải đầu tiên qua HTTPS hoặc localhost, người dùng có thể mở lại ứng dụng ngay cả khi mất mạng.

Dữ liệu khảo sát được lưu trước vào IndexedDB trên thiết bị. Khi bấm lưu phiếu, ứng dụng không phụ thuộc vào trạng thái mạng. Mỗi bản ghi có `id`, `createdAt`, nội dung form, dữ liệu vị trí, ảnh đã nén và `syncStatus`. Bản ghi mới luôn bắt đầu với trạng thái `pending`.

Khi thiết bị online và đã cấu hình Google Apps Script Web App URL, ứng dụng duyệt các bản ghi đang chờ và gửi từng phiếu lên endpoint. Sau khi gửi thành công ở phía frontend, bản ghi được đánh dấu `synced` và lưu thời điểm đồng bộ. Khi mạng bị ngắt hoặc endpoint chưa cấu hình, dữ liệu vẫn nằm trong IndexedDB và sẽ được xử lý lại sau.

## 4. Đồng bộ Google Sheet

Frontend không ghi trực tiếp vào Google Sheet bằng API riêng vì cách đó cần OAuth và không phù hợp cho bài PWA đơn giản. Thay vào đó, Google Apps Script đóng vai trò endpoint trung gian. Script nhận JSON từ request `POST`, tạo sheet nếu cần, tạo hàng tiêu đề và append dữ liệu vào Google Sheet.

Ứng dụng cho phép dán Web App URL trong giao diện cấu hình. URL được lưu trong `localStorage`. Cách này giúp cùng một codebase có thể deploy public nhưng vẫn thay đổi Sheet đích dễ dàng khi chấm bài hoặc demo.

Ảnh hiện trường hiện được gửi dưới dạng `photoDataUrl` đã nén. Với khảo sát quy mô nhỏ, cách này đủ để chứng minh khả năng chụp và lưu ảnh offline. Nếu dùng trong sản phẩm thật, Apps Script nên mở rộng để lưu ảnh vào Google Drive và chỉ ghi Drive URL vào Google Sheet.

## 5. PWA, bảo mật và giới hạn

Ứng dụng cần HTTPS khi deploy để Service Worker, geolocation và camera hoạt động ổn định trên thiết bị di động. Khi chạy local, có thể dùng `localhost` vì trình duyệt xem đây là secure context.

Browser notification được dùng để thông báo đồng bộ thành công. Nếu người dùng chưa cấp quyền notification hoặc trình duyệt không hỗ trợ, ứng dụng vẫn hiển thị thông báo trong giao diện.

Giới hạn chính là Background Sync API không được dùng bắt buộc vì mức hỗ trợ trình duyệt không đồng đều. Thay vào đó, ứng dụng sync khi sự kiện `online` xảy ra, khi người dùng bấm nút sync hoặc khi lưu endpoint. Đây là cách ổn định cho bài tập và dễ kiểm thử.

## 6. Kiểm thử đề xuất

Kiểm thử online: mở app qua HTTPS, cấu hình Apps Script URL, điền form, lấy GPS, chụp ảnh và lưu phiếu. Kiểm tra Google Sheet có hàng dữ liệu mới và lịch sử hiển thị trạng thái đã đồng bộ.

Kiểm thử offline: tải app một lần khi online, sau đó tắt mạng, reload trang, nhập phiếu mới và lưu. Ứng dụng phải tăng số phiếu chờ đồng bộ. Khi bật mạng lại, ứng dụng tự gửi dữ liệu và hiển thị thông báo đồng bộ thành công.

Kiểm thử cài đặt PWA: mở app trên Chrome Android hoặc Edge, chọn cài đặt vào màn hình chính, mở lại như ứng dụng độc lập và kiểm tra form, lịch sử, camera, location.
