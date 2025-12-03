# Member Form Enhancement - Persistent Form with Quick Edit

## Tổng Quan

Cập nhật giao diện quản lý thành viên (`/admin/members`) với form luôn hiển thị (persistent form) thay vì modal popup, cho phép quick-edit workflow hiệu quả hơn.

## Thay Đổi Chính

### 1. **Form Layout - Always Visible**

**Trước đây:**
- Form thêm mới ẩn, hiện khi click nút "Thêm Thành Viên Mới"
- Form chỉnh sửa hiển thị trong modal popup riêng biệt
- Phải đóng/mở form nhiều lần

**Bây giờ:**
- Form luôn hiển thị ở đầu trang
- Một form dùng cho cả Add và Edit
- Title form thay đổi động: "➕ Thêm Thành Viên Mới" hoặc "✏️ Chỉnh Sửa: [Tên]"
- Nút submit thay đổi theo context: "➕ Tạo Tài Khoản" hoặc "💾 Lưu Thay Đổi"
- Thêm nút "❌ Hủy Chỉnh Sửa" khi đang edit

### 2. **Quick Edit Workflow**

**Cách hoạt động:**
1. Form mặc định ở chế độ "Add New Member" (form trống)
2. Click nút "Chỉnh sửa" trên bất kỳ row nào trong bảng
3. Form tự động load dữ liệu thành viên đó
4. Trang tự động scroll lên đầu để hiển thị form
5. Sau khi lưu hoặc hủy, form quay về chế độ "Add New" (reset form)

**Hàm `openEditForm` cập nhật:**
```typescript
const openEditForm = (member: Member) => {
  setEditingMember(member);
  setFormData({
    email: member.email,
    full_name: member.full_name,
    role: member.role,
    phone_number: member.phone_number || "",
    dob: member.dob || "",
    gender: member.gender || "",
    device_name: member.device_name || "",
    join_date: member.join_date || new Date().toISOString().split('T')[0],
    pb_hm_time: member.pb_hm_seconds ? formatTime(member.pb_hm_seconds) : "",
    pb_fm_time: member.pb_fm_seconds ? formatTime(member.pb_fm_seconds) : "",
  });
  setFormMessage(null);
  // Scroll to form
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
```

### 3. **Form Fields - Comprehensive**

**Tất cả trường hiện có:**
- ✅ Email (required, disabled khi edit)
- ✅ Họ và Tên (required)
- ✅ Vai trò (dropdown: member, mod_finance, mod_challenge, mod_member, admin)
- ✅ Giới tính (required: Nam/Nữ) - CRITICAL cho auto-award system
- ✅ Số điện thoại
- ✅ Ngày sinh
- ✅ Ngày gia nhập (default: hôm nay)
- ✅ Thiết bị (text field, ví dụ: Garmin Forerunner 245)
- ✅ PB Half Marathon (HH:MM:SS format)
- ✅ PB Full Marathon (HH:MM:SS format)

**Lưu ý hiển thị:**
> 💡 Lưu ý: Các thông tin Strava (ID, access token, refresh token) sẽ tự động được cập nhật khi thành viên kết nối tài khoản Strava của họ.
> 🏃 Personal Best (PB): Admin/Mod có thể nhập PB từ kết quả BTC, hoặc thành viên tự nhập trong profile và chờ admin duyệt.

### 4. **States Removed**

**Removed states:**
- ❌ `showAddForm` - Không cần nữa vì form luôn hiển thị
- ❌ `showEditForm` - Không cần nữa vì dùng chung form

**Remaining states:**
- ✅ `editingMember` - Track member đang edit (null = Add mode)
- ✅ `formData` - Form input values
- ✅ `formMessage` - Success/error messages
- ✅ `formLoading` - Submit loading state

### 5. **Submit Handlers Updated**

**handleAddMember:**
- Sau khi tạo thành công, reset form và clear `editingMember`
- Không cần đóng form vì luôn hiển thị

**handleEditMember:**
- Sau khi update thành công, reset form và clear `editingMember`
- Form tự động quay về chế độ Add

**Code:**
```typescript
// After successful create
setFormMessage("✓ Tài khoản đã được tạo thành công!");
setFormData({ email: "", full_name: "", role: "member", ... });
setEditingMember(null);
setTimeout(() => {
  setFormMessage(null);
  fetchMembers();
}, 1500);

// After successful update
setFormMessage("✓ Cập nhật thành công!");
setTimeout(() => {
  setEditingMember(null);
  setFormData({ email: "", full_name: "", role: "member", ... });
  setFormMessage(null);
  fetchMembers();
}, 1500);
```

## User Experience Improvements

### Before:
1. Click "Thêm Thành Viên Mới" → Form xuất hiện
2. Nhập dữ liệu → Submit
3. Click "Chỉnh sửa" → Modal popup xuất hiện
4. Edit data → Submit → Modal đóng
5. Phải mở lại form để làm việc tiếp

### After:
1. Form luôn sẵn sàng ở đầu trang
2. Muốn thêm mới → Nhập trực tiếp → Submit
3. Muốn edit → Click "Chỉnh sửa" → Form tự động load data → Submit
4. Sau submit → Form tự reset → Sẵn sàng cho thao tác tiếp theo
5. Workflow liên tục, không bị gián đoạn

## Table Display - Comprehensive Data

**12 cột hiển thị:**
1. Tên (full_name)
2. Email
3. Giới tính (👨 Nam / 👩 Nữ)
4. SĐT (phone_number)
5. Ngày sinh (dob)
6. PB HM (color-coded: green=approved, orange+⏳=pending)
7. PB FM (color-coded: green=approved, orange+⏳=pending)
8. Thiết bị (device_name)
9. Vai Trò (role badges with colors)
10. Gia Nhập (join_date)
11. Trạng Thái (Active: green ✓ / Inactive: red ✕ with leave_date)
12. Hành Động (Edit / Mark as Left buttons)

## Technical Benefits

1. **Reduced Complexity:** Xóa 2 states (showAddForm, showEditForm), đơn giản hóa logic
2. **Better UX:** Quick edit workflow, không cần mở/đóng modal nhiều lần
3. **Consistent Interface:** Một form duy nhất cho cả Add và Edit
4. **Auto-scroll:** Tự động scroll lên form khi click Edit
5. **Visual Feedback:** Title và button text thay đổi theo mode
6. **Cancel Option:** Nút "Hủy Chỉnh Sửa" chỉ hiện khi đang edit

## Testing Checklist

- [ ] Form hiển thị đúng ở đầu trang (không cần click để mở)
- [ ] Title form thay đổi khi edit: "✏️ Chỉnh Sửa: [Tên]"
- [ ] Nút submit đổi text: "➕ Tạo Tài Khoản" vs "💾 Lưu Thay Đổi"
- [ ] Click "Chỉnh sửa" trong bảng → Form load dữ liệu
- [ ] Page tự động scroll lên form khi edit
- [ ] Nút "❌ Hủy Chỉnh Sửa" xuất hiện khi edit
- [ ] Click "Hủy" → Form reset về chế độ Add
- [ ] Submit thành công → Form reset tự động
- [ ] Email field disabled khi edit (không thể thay đổi email)
- [ ] Tất cả trường profile hiển thị đầy đủ (gender, phone, dob, join_date, device, PB)
- [ ] PB time format validation (HH:MM:SS)
- [ ] Gender required (male/female) - CRITICAL
- [ ] Bảng hiển thị đầy đủ 12 cột với color-coding đúng

## Files Changed

- `/workspaces/hlr/app/admin/members/page.tsx`
  - Removed: `showAddForm`, `showEditForm` states
  - Updated: `openEditForm` - add auto-scroll
  - Updated: `handleAddMember` - reset editingMember
  - Updated: `handleEditMember` - reset form and editingMember
  - Updated: JSX structure - single persistent form
  - Updated: Form title and submit button dynamic text
  - Added: "Hủy Chỉnh Sửa" button in edit mode

## Next Steps

1. ✅ Form enhancement complete
2. ⏳ Test với real member data
3. ⏳ Import existing members via UI
4. ⏳ Implement /admin/pb-approval page
5. ⏳ Enhance /profile page for member self-update PB
6. ⏳ End-to-end testing of PB approval workflow

---

**Status:** ✅ Complete - Ready for testing
**Date:** December 2, 2024
**Development Day:** Day 2
