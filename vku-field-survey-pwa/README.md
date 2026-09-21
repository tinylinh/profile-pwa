# VKU Library Field Survey PWA

Ứng dụng khảo sát hiện trường mobile-first về **đánh giá hiểu biết và trải nghiệm thư viện mới**. App chạy được khi mất mạng, lưu phiếu trên thiết bị, xem lịch sử phiên phỏng vấn và tự đồng bộ lên Google Sheet khi online trở lại.

## Tính năng

- Form khảo sát tiếng Việt: người phỏng vấn, người được hỏi, ngành học, năm học, giới tính, độ tuổi.
- Câu hỏi đánh giá thư viện mới: hiểu biết dịch vụ, tần suất sử dụng, điểm đánh giá 1-5 và góp ý.
- Lấy thời gian tự động, lấy vị trí GPS, chụp ảnh hiện trường.
- Offline-first bằng Service Worker và IndexedDB.
- Online thì gửi dữ liệu lên Google Sheet qua Google Apps Script Web App URL.
- Offline thì lưu hàng đợi trên máy, online lại sẽ tự đồng bộ và hiện thông báo.
- Xem lịch sử phiên phỏng vấn và xuất JSON dự phòng.

## Chạy local

Vì Service Worker cần HTTP/HTTPS, hãy chạy bằng một local server:

```bash
npx serve .
```

Hoặc dùng VS Code Live Server, rồi mở thư mục `vku-field-survey-pwa`.

## Cấu hình Google Sheet

1. Tạo một Google Sheet mới.
2. Vào `Extensions > Apps Script`.
3. Dán đoạn code này vào `Code.gs`.

```javascript
const SHEET_NAME = "Survey Responses";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  const headers = [
    "id", "createdAt", "interviewer", "interviewee", "sessionType",
    "major", "schoolYear", "gender", "age", "awareness", "visitFrequency",
    "studySpace", "materials", "wifiEquipment", "staffSupport", "openingHours",
    "overallSatisfaction", "suggestion", "notes", "latitude", "longitude",
    "locationAccuracy", "photoIncluded", "photoDataUrl"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  sheet.appendRow(headers.map((key) => payload[key] || ""));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Chọn `Deploy > New deployment > Web app`.
5. `Execute as`: Me.
6. `Who has access`: Anyone.
7. Copy Web App URL kết thúc bằng `/exec`.
8. Mở app, bấm `Cấu hình Google Sheet`, dán URL và lưu.

Lưu ý: ảnh được nén thành chuỗi `photoDataUrl`. Nếu muốn lưu ảnh vào Google Drive rồi chỉ ghi link ảnh vào Sheet, có thể mở rộng Apps Script sau.

## Deploy HTTPS

### Cloudflare Pages

1. Đưa code lên GitHub public repository.
2. Vào Cloudflare Pages, chọn `Create a project`.
3. Kết nối repository.
4. Build command để trống.
5. Output directory: `vku-field-survey-pwa`.
6. Deploy, nhận link HTTPS dạng `https://ten-du-an.pages.dev`.

### Vercel

1. Import GitHub repository vào Vercel.
2. Framework preset: Other.
3. Build command để trống.
4. Output directory: `vku-field-survey-pwa`.
5. Deploy.

## Kiểm thử offline

1. Mở app bằng HTTPS hoặc localhost.
2. Điền một phiếu, lấy location, chụp ảnh.
3. Tắt mạng hoặc bật DevTools `Network > Offline`.
4. Reload trang, app vẫn mở được.
5. Lưu thêm phiếu, kiểm tra mục `Chờ đồng bộ`.
6. Bật mạng lại, app sẽ tự sync và thông báo thành công.
