/* ---------- Kết nối Supabase (SDK nạp bằng thẻ <script> trong index.html) ---------- */
const configured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_KEY.startsWith("YOUR_");
// Lưu ý: biến toàn cục của SDK tên là "supabase", nên client đặt tên khác (sb)
const sb = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const $ = id => document.getElementById(id);
const el = {
  authView:$("authView"), welcomeView:$("welcomeView"), tabs:$("tabs"), form:$("form"),
  email:$("email"), password:$("password"), confirm:$("confirm"), confirmField:$("confirmField"),
  emailErr:$("emailErr"), passwordErr:$("passwordErr"), confirmErr:$("confirmErr"),
  submit:$("submitBtn"), google:$("googleBtn"), msg:$("msg"), title:$("title"), subtitle:$("subtitle")
};
let mode = "login";

/* ---------- Giao diện ---------- */
function setMode(m){
  mode = m;
  const signup = m === "signup";
  el.tabs.dataset.mode = m;
  $("tabLogin").setAttribute("aria-selected", !signup);
  $("tabSignup").setAttribute("aria-selected", signup);
  el.confirmField.hidden = !signup;
  el.submit.firstElementChild.textContent = signup ? "Tạo tài khoản" : "Đăng nhập";
  el.title.textContent = signup ? "Tạo tài khoản mới" : "Chào mừng trở lại";
  el.subtitle.textContent = signup ? "Chỉ mất vài giây để bắt đầu" : "Đăng nhập để tiếp tục";
  el.password.autocomplete = signup ? "new-password" : "current-password";
  clearErrors(); showMsg();
}
function showMsg(type, text){
  el.msg.hidden = !text;
  el.msg.className = "msg " + (type || "info");
  el.msg.textContent = text || "";
}
function clearErrors(){
  for (const k of ["email","password","confirm"]) { el[k+"Err"].textContent = ""; el[k].removeAttribute("aria-invalid"); }
}
function fieldError(name, text){
  el[name+"Err"].textContent = text; el[name].setAttribute("aria-invalid","true");
}
document.querySelectorAll(".eye").forEach(btn => btn.addEventListener("click", () => {
  const input = $(btn.dataset.target), show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.setAttribute("aria-pressed", show);
  btn.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
}));
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

/* ---------- Soát lỗi phía client ---------- */
function validate(){
  clearErrors(); let ok = true;
  const email = el.email.value.trim(), pw = el.password.value;
  if (!email) { fieldError("email","Vui lòng nhập email."); ok = false; }
  else if (!/^[^\s@]+@[^\s@]+$/.test(email)) { fieldError("email","Email phải có ký tự @."); ok = false; }
  if (!pw) { fieldError("password","Vui lòng nhập mật khẩu."); ok = false; }
  else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(pw)) {
    fieldError("password","Mật khẩu cần ít nhất 6 ký tự, gồm chữ hoa, chữ thường và số."); ok = false;
  }
  if (mode === "signup" && ok && el.confirm.value !== pw) { fieldError("confirm","Mật khẩu nhập lại chưa khớp."); ok = false; }
  return ok;
}

/* ---------- Thông báo lỗi Supabase (tiếng Việt) ---------- */
function viError(err){
  const map = {
    invalid_credentials:"Email hoặc mật khẩu không đúng.",
    user_already_exists:"Email này đã được đăng ký. Hãy chuyển sang đăng nhập.",
    email_exists:"Email này đã được đăng ký. Hãy chuyển sang đăng nhập.",
    email_not_confirmed:"Email chưa được xác nhận. Hãy mở hộp thư và bấm vào liên kết xác nhận.",
    weak_password:"Mật khẩu quá yếu. Hãy dùng mật khẩu dài và phức tạp hơn.",
    validation_failed:"Email hoặc mật khẩu không hợp lệ.",
    signup_disabled:"Dự án đang tắt tính năng đăng ký.",
    provider_disabled:"Phương thức đăng nhập này chưa được bật trong Supabase.",
    over_request_rate_limit:"Bạn thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.",
    over_email_send_rate_limit:"Đã gửi quá nhiều email xác nhận. Vui lòng thử lại sau."
  };
  if (map[err.code]) return map[err.code];
  if (/failed to fetch|network/i.test(err.message || "")) return "Không kết nối được máy chủ. Kiểm tra internet hoặc Project URL.";
  if (/invalid api key/i.test(err.message || "")) return "API key không đúng. Kiểm tra lại supabase-config.js.";
  return "Đã có lỗi: " + (err.message || "không xác định");
}
function busy(on){ el.submit.disabled = el.google.disabled = on; }
function needConfig(){
  if (sb) return false;
  showMsg("error","Chưa cấu hình Supabase. Hãy điền URL và key vào file supabase-config.js.");
  return true;
}

/* ---------- Xử lý đăng ký / đăng nhập ---------- */
el.form.addEventListener("submit", async e => {
  e.preventDefault(); showMsg();
  if (!validate() || needConfig()) return;
  busy(true);
  const email = el.email.value.trim(), password = el.password.value;
  try {
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      // Bật "Confirm email": Supabase trả về user nhưng chưa có session
      if (!data.session) {
        // identities rỗng = email đã tồn tại (Supabase che giấu để tránh lộ thông tin)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          showMsg("error", "Email này đã được đăng ký. Hãy chuyển sang đăng nhập.");
        } else {
          setMode("login");
          showMsg("success", "Đăng ký thành công! Hãy mở email để xác nhận tài khoản, rồi đăng nhập.");
        }
      }
      // Tắt "Confirm email": có session → onAuthStateChange sẽ mở màn hình chào mừng
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) { showMsg("error", viError(err)); }
  finally { busy(false); }
});

/* ---------- Đăng nhập bằng Google (chuyển hướng sang Google rồi quay lại) ---------- */
el.google.addEventListener("click", async () => {
  showMsg(); if (needConfig()) return;
  busy(true);
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) { showMsg("error", viError(error)); busy(false); }
});

/* ---------- Hiển thị email người dùng sau khi đăng nhập ---------- */
function render(session){
  const user = session && session.user;
  el.authView.hidden = !!user; el.welcomeView.hidden = !user;
  if (user) {
    $("userEmail").textContent = user.email;
    $("avatarLetter").textContent = (user.email || "?").charAt(0).toUpperCase();
  }
}
$("logoutBtn").onclick = async () => { if (sb) await sb.auth.signOut(); };

if (sb) {
  // Chạy khi tải trang (INITIAL_SESSION), đăng nhập (SIGNED_IN) và đăng xuất (SIGNED_OUT)
  sb.auth.onAuthStateChange((event, session) => {
    render(session);
    if (event === "SIGNED_OUT") { el.form.reset(); setMode("login"); }
  });
} else {
  showMsg("info","Chế độ xem giao diện: điền supabase-config.js để bật đăng nhập thật.");
}
